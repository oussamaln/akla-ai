import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
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
  web3TokenTasks,
  web3Verifications,
  questCompletions,
  quests,
  wallets,
  profiles,
  users,
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
  enabled: Boolean(ENV.robinhoodRpcUrl),
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

export function assertRobinhoodTestnet(chainId: number) {
  if (chainId !== WEB3_CONFIG.chainId)
    throw new Error(
      "Wallet verification must happen on Robinhood Chain Testnet."
    );
}

export function validateTokenTaskInput(input: {
  name: string;
  symbol: string;
  contractAddress: string;
  chainId: number;
  decimals: number;
  minimumBalance: string;
  rewardPoints: number;
  description: string;
  active: boolean;
}) {
  assertRobinhoodTestnet(input.chainId);
  if (!isAddress(input.contractAddress))
    throw new Error("Enter a valid EVM token contract address.");
  if (!input.name.trim() || !input.symbol.trim() || !input.description.trim())
    throw new Error("Token name, symbol, and description are required.");
  if (
    !Number.isInteger(input.decimals) ||
    input.decimals < 0 ||
    input.decimals > 36
  )
    throw new Error("Token decimals must be an integer between 0 and 36.");
  if (!Number.isFinite(input.rewardPoints) || input.rewardPoints < 200)
    throw new Error("Proof of Passage rewards must be at least 200 points.");
  try {
    const minimum = parseUnits(input.minimumBalance.trim(), input.decimals);
    if (minimum < BigInt(0)) throw new Error();
  } catch {
    throw new Error(
      "Minimum balance must be a valid non-negative token amount."
    );
  }
  return {
    ...input,
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    contractAddress: getAddress(input.contractAddress),
    minimumBalance: input.minimumBalance.trim(),
    description: input.description.trim(),
  };
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
  const [walletRows, tasks] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1),
    db
      .select()
      .from(web3TokenTasks)
      .where(eq(web3TokenTasks.active, true))
      .orderBy(desc(web3TokenTasks.createdAt)),
  ]);
  const wallet = walletRows[0];
  return {
    config: WEB3_CONFIG,
    tasks,
    wallet: wallet
      ? { address: wallet.address, verificationState: wallet.verificationState }
      : null,
  };
}

export async function getWeb3VerificationHistory() {
  const db = requireDatabase(await getDb());
  return db
    .select({
      id: web3Verifications.id,
      userId: web3Verifications.userId,
      username: profiles.username,
      name: users.name,
      questId: web3Verifications.questId,
      taskName: quests.title,
      walletAddress: web3Verifications.walletAddress,
      contractAddress: web3Verifications.contractAddress,
      chainId: web3Verifications.chainId,
      verifiedBalance: web3Verifications.verifiedBalance,
      requiredBalance: web3Verifications.requiredBalance,
      status: web3Verifications.status,
      verificationData: web3Verifications.verificationData,
      createdAt: web3Verifications.createdAt,
    })
    .from(web3Verifications)
    .innerJoin(quests, eq(web3Verifications.questId, quests.id))
    .innerJoin(users, eq(web3Verifications.userId, users.id))
    .leftJoin(profiles, eq(web3Verifications.userId, profiles.userId))
    .orderBy(desc(web3Verifications.createdAt))
    .limit(200);
}

export async function verifyTokenHolder(
  userId: number,
  taskId: number,
  rawAddress: string
) {
  const db = requireDatabase(await getDb());
  if (!isAddress(rawAddress))
    throw new Error("Connect a valid EVM wallet before verifying.");
  const address = getAddress(rawAddress);
  await enforceRateLimit(userId, "web3_token_verify", 10, 60 * 60 * 1000);
  const [task] = await db
    .select()
    .from(web3TokenTasks)
    .where(and(eq(web3TokenTasks.id, taskId), eq(web3TokenTasks.active, true)))
    .limit(1);
  if (!task) throw new Error("This Proof of Passage task is not active.");
  assertRobinhoodTestnet(task.chainId);
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
  const [quest] = await db
    .select()
    .from(quests)
    .where(eq(quests.id, task.questId))
    .limit(1);
  if (!quest) throw new Error("The Proof of Passage task is unavailable.");
  const existing = await db
    .select()
    .from(questCompletions)
    .where(
      and(
        eq(questCompletions.userId, userId),
        eq(questCompletions.questId, task.questId)
      )
    )
    .limit(1);
  if (existing[0]?.status === "verified")
    return {
      status: "completed",
      completion: existing[0],
      transaction: null,
      walletAddress: address,
      chainId: task.chainId,
      taskId: task.id,
    } as const;

  const client = createPublicClient({
    chain: ROBINHOOD_TESTNET,
    transport: http(WEB3_CONFIG.rpcUrl),
  });
  let balance: bigint;
  try {
    balance = await client.readContract({
      address: getAddress(task.contractAddress),
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });
  } catch {
    throw new Error(
      "The token contract could not be read on Robinhood Chain Testnet. Try again later."
    );
  }
  if (
    !Number.isInteger(task.decimals) ||
    task.decimals < 0 ||
    task.decimals > 36
  )
    throw new Error("The target token has invalid decimals.");
  const requiredRaw = parseUnits(task.minimumBalance, task.decimals);
  const detectedBalance = formatUnits(balance, task.decimals);
  const eligible = balance >= requiredRaw;
  const verificationData = {
    type: "TOKEN_HOLD",
    walletAddress: address,
    taskId: task.id,
    chainId: task.chainId,
    contractAddress: task.contractAddress,
    tokenSymbol: task.symbol,
    tokenDecimals: task.decimals,
    verifiedBalance: detectedBalance,
    requiredBalance: task.minimumBalance,
    verificationTimestamp: new Date().toISOString(),
  };
  await db.insert(web3Verifications).values({
    userId,
    questId: task.questId,
    walletAddress: address,
    chainId: task.chainId,
    contractAddress: task.contractAddress,
    verifiedBalance: detectedBalance,
    requiredBalance: task.minimumBalance,
    status: eligible ? "verified" : "not_eligible",
    verificationData,
  });
  if (!eligible)
    return {
      status: "not_eligible",
      walletAddress: address,
      chainId: task.chainId,
      taskId: task.id,
      verifiedBalance: detectedBalance,
      requiredBalance: task.minimumBalance,
    } as const;

  const idempotencyKey = `web3:token-hold:${userId}:${task.id}:${address.toLowerCase()}`;
  await db
    .insert(questCompletions)
    .values({
      userId,
      questId: task.questId,
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
    basePoints: task.rewardPoints,
    idempotencyKey: `quest:${completion!.id}`,
  });
  return {
    status: "verified",
    walletAddress: address,
    chainId: task.chainId,
    taskId: task.id,
    verifiedBalance: detectedBalance,
    requiredBalance: task.minimumBalance,
    completion,
    transaction,
  } as const;
}
