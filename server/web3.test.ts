import { describe, expect, it } from "vitest";
import {
  assertRobinhoodTestnet,
  makeWalletChallengeMessage,
  validateTokenTaskInput,
  WEB3_CONFIG,
} from "./web3";

describe("Proof of Passage Web3 safeguards", () => {
  it("only accepts Robinhood Chain Testnet for wallet verification", () => {
    expect(() => assertRobinhoodTestnet(WEB3_CONFIG.chainId)).not.toThrow();
    expect(() => assertRobinhoodTestnet(1)).toThrow("Robinhood Chain Testnet");
    expect(() => assertRobinhoodTestnet(8453)).toThrow(
      "Robinhood Chain Testnet"
    );
  });

  it("binds wallet signatures to the Akla app, address, nonce, network, and expiry", () => {
    const expiresAt = new Date("2026-10-03T00:00:00.000Z");
    const message = makeWalletChallengeMessage(
      "0x1234567890abcdef1234567890abcdef12345678",
      "nonce-abc-123",
      expiresAt
    );
    expect(message).toContain("Akla AI Proof of Passage");
    expect(message).toContain("Robinhood Chain Testnet");
    expect(message).toContain("0x1234567890abcdef1234567890abcdef12345678");
    expect(message).toContain("nonce-abc-123");
    expect(message).toContain(expiresAt.toISOString());
  });

  it("normalizes valid token task configuration without trusting client reward values", () => {
    const task = validateTokenTaskInput({
      name: "Akla Token",
      symbol: "akla",
      contractAddress: "0x0000000000000000000000000000000000000001",
      chainId: WEB3_CONFIG.chainId,
      decimals: 18,
      minimumBalance: "100.5",
      rewardPoints: 500,
      description: "Hold the configured token to complete passage.",
      active: true,
    });
    expect(task.symbol).toBe("AKLA");
    expect(task.contractAddress).toBe(
      "0x0000000000000000000000000000000000000001"
    );
    expect(task.minimumBalance).toBe("100.5");
  });

  it("rejects malformed contracts, unsupported networks, invalid amounts, and sub-minimum rewards", () => {
    const base = {
      name: "Akla Token",
      symbol: "AKLA",
      contractAddress: "0x0000000000000000000000000000000000000001",
      chainId: WEB3_CONFIG.chainId,
      decimals: 18,
      minimumBalance: "100",
      rewardPoints: 500,
      description: "Hold the configured token to complete passage.",
      active: true,
    };
    expect(() =>
      validateTokenTaskInput({ ...base, contractAddress: "bad" })
    ).toThrow("valid EVM");
    expect(() => validateTokenTaskInput({ ...base, chainId: 1 })).toThrow(
      "Robinhood"
    );
    expect(() =>
      validateTokenTaskInput({ ...base, minimumBalance: "not-a-number" })
    ).toThrow("Minimum balance");
    expect(() =>
      validateTokenTaskInput({ ...base, rewardPoints: 199 })
    ).toThrow("200");
  });
});
