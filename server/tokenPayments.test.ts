import { describe, expect, it } from "vitest";
import {
  AI_MESSAGE_TOKEN_COST,
  PROJECT_TOKEN_ADDRESS,
  PROJECT_TOKEN_BUY_URL,
  PROJECT_TOKEN_CHAIN_ID,
} from "../shared/projectToken";
import { getRequiredProjectTokenAmount } from "./tokenPayments";

describe("project-token AI payments", () => {
  it("uses the fixed project token, testnet, and buy DApp configuration", () => {
    expect(PROJECT_TOKEN_ADDRESS).toBe(
      "0x940F24D6C49EEa9357Aa7F440b27678Fd2E8820D"
    );
    expect(PROJECT_TOKEN_CHAIN_ID).toBe(46630);
    expect(AI_MESSAGE_TOKEN_COST).toBe(10);
    expect(PROJECT_TOKEN_BUY_URL).toContain(
      "/token/0x940F24D6C49EEa9357Aa7F440b27678Fd2E8820D?side=buy"
    );
  });

  it("uses integer-safe raw amounts for the configured message cost", () => {
    expect(getRequiredProjectTokenAmount(18)).toBe(10_000_000_000_000_000_000n);
    expect(getRequiredProjectTokenAmount(6)).toBe(10_000_000n);
  });
});
