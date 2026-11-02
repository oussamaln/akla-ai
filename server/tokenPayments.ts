import { and, desc, eq } from "drizzle-orm";
import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  http,
  isAddress,
  parseUnits,
  formatUnits,
  type Hex,
} from "viem";
import {
  agents,
  projectTokenPayments,
  projects,
  questCompletions,
  wallets,
  web3TokenTasks,
} from "../drizzle/schema";
import {
  AI_MESSAGE_TOKEN_COST,
  PROJECT_TOKEN_ADDRESS,
  PROJECT_TOKEN_BUY_URL,
  PROJECT_TOKEN_CHAIN_ID,
  PROJECT_TOKEN_DECIMALS,
} from "../shared/projectToken";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { ROBINHOOD_TESTNET, WEB3_CONFIG } from "./web3";

const TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

const DECIMALS_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

const BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

function requireDb() {
  return getDb().then(db => {
    if (!db) throw new Error("Database unavailable");
    return db;
  });
}

function publicClient() {
  return createPublicClient({
    chain: ROBINHOOD_TESTNET,
    transport: http(ENV.robinhoodRpcUrl),
  });
}

export function getRequiredProjectTokenAmount(decimals: number) {
  return parseUnits(String(AI_MESSAGE_TOKEN_COST), decimals);
}

export async function getProjectTokenPaymentConfig() {
  let decimals: number | null = null;
  try {
    decimals = Number(
      await publicClient().readContract({
        address: getAddress(PROJECT_TOKEN_ADDRESS),
        abi: DECIMALS_ABI,
        functionName: "decimals",
      })
    );
  } catch {
    decimals = null;
  }
  return {
    tokenAddress: PROJECT_TOKEN_ADDRESS,
    chainId: PROJECT_TOKEN_CHAIN_ID,
    decimals,
    messageCost: AI_MESSAGE_TOKEN_COST,
    treasuryAddress: ENV.projectTokenTreasuryAddress || null,
    buyUrl: PROJECT_TOKEN_BUY_URL,
    configured: Boolean(
      ENV.projectTokenTreasuryAddress &&
        isAddress(ENV.projectTokenTreasuryAddress) &&
        decimals !== null
    ),
    environment: "Robinhood Chain Testnet",
  };
}

export async function assertProjectTokenEligibility(
  userId: number,
  agentId: number,
  walletAddress: string
) {
  const db = await requireDb();
  if (!isAddress(walletAddress)) throw new Error("Connect a valid wallet.");
  const address = getAddress(walletAddress);
  const [row] = await db
    .select({ agent: agents, project: projects })
    .from(agents)
    .innerJoin(projects, eq(agents.projectId, projects.id))
    .where(eq(agents.id, agentId))
    .limit(1);
  if (!row || row.agent.status !== "launched")
    throw new Error("This agent is not available for chat.");
  if (
    !row.project.tokenContractAddress ||
    row.project.tokenContractAddress.toLowerCase() !==
      PROJECT_TOKEN_ADDRESS.toLowerCase()
  )
    throw new Error(
      "This agent is not connected to the Akla project token yet."
    );
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(
      and(eq(wallets.userId, userId), eq(wallets.verificationState, "verified"))
    )
    .limit(1);
  if (!wallet || wallet.normalizedAddress !== address.toLowerCase())
    throw new Error("Connect and verify the wallet used for Proof of Passage.");
  const [proof] = await db
    .select({ completion: questCompletions })
    .from(questCompletions)
    .innerJoin(
      web3TokenTasks,
      eq(web3TokenTasks.questId, questCompletions.questId)
    )
    .where(
      and(
        eq(questCompletions.userId, userId),
        eq(questCompletions.status, "verified"),
        eq(web3TokenTasks.active, true),
        eq(web3TokenTasks.contractAddress, PROJECT_TOKEN_ADDRESS)
      )
    )
    .limit(1);
  if (!proof)
    throw new Error(
      "Complete Proof of Passage for the project token before chatting."
    );
  return { address, agent: row.agent, project: row.project };
}

export async function getProjectTokenEligibility(
  userId: number,
  agentId: number,
  walletAddress?: string
) {
  if (!walletAddress || !isAddress(walletAddress))
    return {
      eligible: false,
      reason: "Connect and verify a wallet first.",
    } as const;
  try {
    await assertProjectTokenEligibility(userId, agentId, walletAddress);
    return { eligible: true, reason: "Proof of Passage verified." } as const;
  } catch (error) {
    return {
      eligible: false,
      reason:
        error instanceof Error
          ? error.message
          : "Complete Proof of Passage first.",
    } as const;
  }
}

export async function getProjectTokenBalance(walletAddress?: string) {
  if (!walletAddress || !isAddress(walletAddress))
    return {
      address: null,
      balance: null,
      balanceRaw: null,
      sufficient: false,
    } as const;
  const config = await getProjectTokenPaymentConfig();
  const address = getAddress(walletAddress);
  if (config.decimals === null)
    return {
      address,
      balance: null,
      balanceRaw: null,
      sufficient: false,
    } as const;
  try {
    const raw = await publicClient().readContract({
      address: getAddress(PROJECT_TOKEN_ADDRESS),
      abi: BALANCE_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    const required = getRequiredProjectTokenAmount(config.decimals);
    return {
      address,
      balance: formatUnits(raw, config.decimals),
      balanceRaw: raw.toString(),
      sufficient: raw >= required,
    } as const;
  } catch {
    return {
      address,
      balance: null,
      balanceRaw: null,
      sufficient: false,
    } as const;
  }
}

export async function verifyProjectTokenPayment(
  userId: number,
  input: {
    agentId: number;
    walletAddress: string;
    txHash: string;
    chainId: number;
  }
) {
  const db = await requireDb();
  if (input.chainId !== PROJECT_TOKEN_CHAIN_ID)
    throw new Error("Switch your wallet to Robinhood Chain Testnet.");
  if (!isAddress(input.walletAddress))
    throw new Error("Connect a valid wallet.");
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.txHash))
    throw new Error("Enter a valid testnet transaction hash.");
  const wallet = getAddress(input.walletAddress);
  await assertProjectTokenEligibility(userId, input.agentId, wallet);
  const [existing] = await db
    .select()
    .from(projectTokenPayments)
    .where(eq(projectTokenPayments.transactionHash, input.txHash))
    .limit(1);
  if (existing) {
    if (existing.userId !== userId || existing.agentId !== input.agentId)
      throw new Error("This transaction has already been used.");
    return existing;
  }
  const treasury = ENV.projectTokenTreasuryAddress;
  if (!treasury || !isAddress(treasury))
    throw new Error(
      "Token payments are not configured yet. Please contact the administrator."
    );
  const treasuryAddress = getAddress(treasury);
  const client = publicClient();
  const hash = input.txHash as Hex;
  let tx;
  let receipt;
  try {
    tx = await client.getTransaction({ hash });
    receipt = await client.getTransactionReceipt({ hash });
  } catch {
    throw new Error(
      "Waiting for transaction confirmation on Robinhood Chain Testnet."
    );
  }
  if (receipt.status !== "success")
    throw new Error("The token payment transaction failed.");
  if (
    tx.chainId !== PROJECT_TOKEN_CHAIN_ID ||
    getAddress(tx.from) !== wallet ||
    !tx.to ||
    getAddress(tx.to) !== getAddress(PROJECT_TOKEN_ADDRESS)
  )
    throw new Error(
      "The payment sender, chain, or token contract does not match."
    );
  let decimals: number = PROJECT_TOKEN_DECIMALS;
  try {
    decimals = Number(
      await client.readContract({
        address: getAddress(PROJECT_TOKEN_ADDRESS),
        abi: DECIMALS_ABI,
        functionName: "decimals",
      })
    );
  } catch {
    throw new Error("The project-token decimals could not be read.");
  }
  const amountRaw = getRequiredProjectTokenAmount(decimals);
  const validTransfer = receipt.logs.some(log => {
    if (getAddress(log.address) !== getAddress(PROJECT_TOKEN_ADDRESS))
      return false;
    try {
      const decoded = decodeEventLog({
        abi: TRANSFER_ABI,
        data: log.data,
        topics: log.topics,
      });
      return (
        decoded.eventName === "Transfer" &&
        getAddress(decoded.args.from) === wallet &&
        getAddress(decoded.args.to) === treasuryAddress &&
        decoded.args.value === amountRaw
      );
    } catch {
      return false;
    }
  });
  if (!validTransfer)
    throw new Error(
      `Payment must transfer exactly ${AI_MESSAGE_TOKEN_COST} project tokens to the configured treasury.`
    );
  try {
    const [inserted] = await db.insert(projectTokenPayments).values({
      userId,
      agentId: input.agentId,
      walletAddress: wallet,
      tokenAddress: getAddress(PROJECT_TOKEN_ADDRESS),
      treasuryAddress,
      chainId: PROJECT_TOKEN_CHAIN_ID,
      decimals,
      amountRaw: amountRaw.toString(),
      transactionHash: input.txHash,
      blockNumber: receipt.blockNumber.toString(),
      status: "verified",
      verifiedAt: new Date(),
    });
    return {
      id: inserted.insertId,
      status: "verified" as const,
      amount: AI_MESSAGE_TOKEN_COST,
    };
  } catch {
    const [duplicate] = await db
      .select()
      .from(projectTokenPayments)
      .where(eq(projectTokenPayments.transactionHash, input.txHash))
      .limit(1);
    if (duplicate?.userId === userId && duplicate.agentId === input.agentId)
      return duplicate;
    throw new Error("This payment has already been used.");
  }
}

export async function reserveProjectTokenPayment(
  userId: number,
  agentId: number,
  paymentId: number
) {
  const db = await requireDb();
  const [payment] = await db
    .select()
    .from(projectTokenPayments)
    .where(
      and(
        eq(projectTokenPayments.id, paymentId),
        eq(projectTokenPayments.userId, userId),
        eq(projectTokenPayments.agentId, agentId),
        eq(projectTokenPayments.status, "verified")
      )
    )
    .limit(1);
  if (!payment)
    throw new Error("Verify a new project-token payment before chatting.");
  await assertProjectTokenEligibility(userId, agentId, payment.walletAddress);
  await db
    .update(projectTokenPayments)
    .set({ status: "used" })
    .where(
      and(
        eq(projectTokenPayments.id, paymentId),
        eq(projectTokenPayments.status, "verified")
      )
    );
  return payment;
}

export async function releaseProjectTokenPayment(paymentId: number) {
  const db = await requireDb();
  await db
    .update(projectTokenPayments)
    .set({
      status: "verified",
      failureReason: "AI provider failed after verified payment",
    })
    .where(eq(projectTokenPayments.id, paymentId));
}

export async function listProjectTokenPayments() {
  const db = await requireDb();
  return db
    .select({
      payment: projectTokenPayments,
      agentName: agents.name,
      projectName: projects.name,
    })
    .from(projectTokenPayments)
    .innerJoin(agents, eq(agents.id, projectTokenPayments.agentId))
    .innerJoin(projects, eq(projects.id, agents.projectId))
    .orderBy(desc(projectTokenPayments.createdAt))
    .limit(200);
}
