import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  parseUnits,
  verifyMessage,
  formatUnits,
  type Hex,
} from "viem";
import {
  web3Challenges,
  web3Verifications,
  questCompletions,
  quests,
  wallets,
} from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import {
  awardPoints,
  ensureDefaultConfiguration,
  enforceRateLimit,
  requireDatabase,
} from "./rewards";

export const ROBINHOOD_TESTNET = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [ENV.robinhoodRpcUrl] } },
});

export const WEB3_CONFIG = {
  chainId: 46630,
  chainName: "Robinhood Chain Testnet",
  nativeSymbol: "ETH",
  rpcUrl: ENV.robinhoodRpcUrl,
  tokenAddress:
    ENV.web3TargetTokenAddress && isAddress(ENV.web3TargetTokenAddress)
      ? getAddress(ENV.web3TargetTokenAddress)
      : null,
  tokenSymbol: ENV.web3TargetTokenSymbol || "TOKEN",
  tokenDecimals: Number.isInteger(Number(ENV.web3TargetTokenDecimals))
    ? Number(ENV.web3TargetTokenDecimals)
    : null,
  minimumBalance: ENV.web3TargetTokenMinBalance || "0",
  rewardPoints: Math.max(200, Number(ENV.web3TargetTokenRewardPoints) || 500),
  enabled: Boolean(
    ENV.robinhoodRpcUrl &&
      ENV.web3TargetTokenAddress &&
      isAddress(ENV.web3TargetTokenAddress) &&
      ENV.web3TargetTokenMinBalance
  ),
} as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "decimals", type: "uint8" }],
  },
] as const;

function requireWeb3Config() {
  if (!WEB3_CONFIG.enabled || !WEB3_CONFIG.tokenAddress) {
    throw new Error(
      "Proof of Passage is not configured yet. An administrator must configure the target token first."
    );
  }
  return WEB3_CONFIG;
}

export function assertRobinhoodTestnet(chainId: number) {
  if (chainId !== WEB3_CONFIG.chainId)
    throw new Error(
      "Wallet verification must happen on Robinhood Chain Testnet."
    );
}

export function makeWalletChallengeMessage(
  address: string,
  nonce: string,
  expiresAt: Date
) {
  return `Akla AI Proof of Passage\n\nSign this message to verify wallet ownership.\nNetwork: Robinhood Chain Testnet\nWallet: ${address}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;
}

export async function createWalletChallenge(
  userId: number,
  rawAddress: string,
  requestedChainId: number
) {
  const db = requireDatabase(await getDb());
  assertRobinhoodTestnet(requestedChainId);
  if (!isAddress(rawAddress))
    throw new Error("Connect a valid EVM wallet address.");
  const address = getAddress(rawAddress);
  await enforceRateLimit(userId, "web3_challenge", 5, 10 * 60 * 1000);
  const nonce = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const message = makeWalletChallengeMessage(address, nonce, expiresAt);
  await db
    .insert(web3Challenges)
    .values({ userId, address, nonce, message, expiresAt });
  return { nonce, message, address, expiresAt, chainId: WEB3_CONFIG.chainId };
}

export async function verifyWalletOwnership(
  userId: number,
  input: { address: string; nonce: string; signature: string; chainId: number }
) {
  const db = requireDatabase(await getDb());
  assertRobinhoodTestnet(input.chainId);
  if (!isAddress(input.address))
    throw new Error("The connected wallet address is invalid.");
  const address = getAddress(input.address);
  const challengeRows = await db
    .select()
    .from(web3Challenges)
    .where(
      and(
        eq(web3Challenges.userId, userId),
        eq(web3Challenges.nonce, input.nonce),
        isNull(web3Challenges.usedAt)
      )
    )
    .limit(1);
  const challenge = challengeRows[0];
  if (!challenge || challenge.expiresAt < new Date())
    throw new Error(
      "This wallet verification request expired. Please connect again."
    );
  if (challenge.address.toLowerCase() !== address.toLowerCase())
    throw new Error(
      "The wallet address does not match the verification request."
    );
  let valid = false;
  try {
    valid = await verifyMessage({
      address,
      message: challenge.message,
      signature: input.signature as Hex,
    });
  } catch {
    valid = false;
  }
  if (!valid)
    throw new Error(
      "Wallet signature verification failed. No wallet data was saved."
    );
  const existingOwner = await db
    .select({ userId: wallets.userId })
    .from(wallets)
    .where(eq(wallets.normalizedAddress, address.toLowerCase()))
    .limit(1);
  if (existingOwner[0] && existingOwner[0].userId !== userId)
    throw new Error("This wallet is already linked to another Akla account.");
  await db
    .update(web3Challenges)
    .set({ usedAt: new Date() })
    .where(eq(web3Challenges.id, challenge.id));
  await db
    .insert(wallets)
    .values({
      userId,
      address,
      normalizedAddress: address.toLowerCase(),
      verificationState: "verified",
    })
    .onDuplicateKeyUpdate({
      set: {
        address,
        normalizedAddress: address.toLowerCase(),
        verificationState: "verified",
      },
    });
  return { verified: true, address, chainId: WEB3_CONFIG.chainId } as const;
}

export async function getWeb3Status(userId: number) {
  const db = requireDatabase(await getDb());
  const walletRows = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);
  const wallet = walletRows[0];
  return {
    config: WEB3_CONFIG,
    wallet: wallet
      ? { address: wallet.address, verificationState: wallet.verificationState }
      : null,
  };
}

export async function verifyTokenHolder(userId: number, rawAddress: string) {
  const db = requireDatabase(await getDb());
  const config = requireWeb3Config();
  const tokenAddress = config.tokenAddress;
  if (!tokenAddress)
    throw new Error("The target token address is not configured.");
  if (!isAddress(rawAddress))
    throw new Error("Connect a valid EVM wallet before verifying.");
  const address = getAddress(rawAddress);
  await enforceRateLimit(userId, "web3_token_verify", 10, 60 * 60 * 1000);
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);
  if (
    !wallet ||
    wallet.verificationState !== "verified" ||
    wallet.normalizedAddress !== address.toLowerCase()
  )
    throw new Error(
      "Verify ownership of this wallet before checking token balance."
    );
  await ensureDefaultConfiguration();
  const [quest] = await db
    .select()
    .from(quests)
    .where(eq(quests.slug, "hold-target-token"))
    .limit(1);
  if (!quest)
    throw new Error("The Proof of Passage token quest is unavailable.");
  const existing = await db
    .select()
    .from(questCompletions)
    .where(
      and(
        eq(questCompletions.userId, userId),
        eq(questCompletions.questId, quest.id)
      )
    )
    .limit(1);
  if (existing[0]?.status === "verified")
    return {
      status: "completed",
      completion: existing[0],
      transaction: null,
      walletAddress: address,
      chainId: config.chainId,
    } as const;

  const client = createPublicClient({
    chain: ROBINHOOD_TESTNET,
    transport: http(config.rpcUrl),
  });
  let decimals: number;
  let balance: bigint;
  try {
    decimals = Number(
      await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
      })
    );
    balance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });
  } catch {
    throw new Error(
      "The token contract could not be read on Robinhood Chain Testnet. Try again later."
    );
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36)
    throw new Error("The target token returned invalid decimals.");
  const requiredRaw = parseUnits(config.minimumBalance, decimals);
  const detectedBalance = formatUnits(balance, decimals);
  const eligible = balance >= requiredRaw;
  const verificationData = {
    type: "TOKEN_HOLD",
    walletAddress: address,
    chainId: config.chainId,
    contractAddress: tokenAddress,
    tokenSymbol: config.tokenSymbol,
    tokenDecimals: decimals,
    verifiedBalance: detectedBalance,
    requiredBalance: config.minimumBalance,
    verificationTimestamp: new Date().toISOString(),
  };
  await db.insert(web3Verifications).values({
    userId,
    questId: quest.id,
    walletAddress: address,
    chainId: config.chainId,
    contractAddress: tokenAddress,
    verifiedBalance: detectedBalance,
    requiredBalance: config.minimumBalance,
    status: eligible ? "verified" : "not_eligible",
    verificationData,
  });
  if (!eligible)
    return {
      status: "not_eligible",
      walletAddress: address,
      chainId: config.chainId,
      verifiedBalance: detectedBalance,
      requiredBalance: config.minimumBalance,
    } as const;

  const idempotencyKey = `web3:token-hold:${userId}:${quest.id}:${address.toLowerCase()}`;
  await db
    .insert(questCompletions)
    .values({
      userId,
      questId: quest.id,
      status: "verified",
      verificationData,
      verifiedAt: new Date(),
      idempotencyKey,
    })
    .onDuplicateKeyUpdate({
      set: { verificationData, status: "verified", verifiedAt: new Date() },
    });
  const [completion] = await db
    .select()
    .from(questCompletions)
    .where(eq(questCompletions.idempotencyKey, idempotencyKey))
    .limit(1);
  const transaction = await awardPoints({
    userId,
    source: "quest",
    sourceId: String(completion!.id),
    basePoints: config.rewardPoints,
    idempotencyKey: `quest:${completion!.id}`,
  });
  return {
    status: "verified",
    walletAddress: address,
    chainId: config.chainId,
    verifiedBalance: detectedBalance,
    requiredBalance: config.minimumBalance,
    completion,
    transaction,
  } as const;
}
