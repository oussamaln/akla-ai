import { describe, expect, it } from "vitest";
import {
  assertRobinhoodTestnet,
  makeWalletChallengeMessage,
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
});
