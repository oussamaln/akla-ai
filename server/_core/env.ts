export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  robinhoodRpcUrl:
    process.env.ROBINHOOD_TESTNET_RPC_URL ??
    "https://rpc.testnet.chain.robinhood.com",
  web3TargetTokenAddress: process.env.WEB3_TARGET_TOKEN_ADDRESS ?? "",
  web3TargetTokenSymbol: process.env.WEB3_TARGET_TOKEN_SYMBOL ?? "",
  web3TargetTokenDecimals: process.env.WEB3_TARGET_TOKEN_DECIMALS ?? "",
  web3TargetTokenMinBalance: process.env.WEB3_TARGET_TOKEN_MIN_BALANCE ?? "",
  web3TargetTokenRewardPoints:
    process.env.WEB3_TARGET_TOKEN_REWARD_POINTS ?? "500",
};
