/**
 * URL-level guards so sandbox never quietly talks to Ethereum mainnet.
 * Chain-id is checked separately once a provider is connected.
 */
export function isMainnetRpcUrl(rpcUrl: string): boolean {
  const value = rpcUrl.trim().toLowerCase();
  if (!value) {
    return false;
  }
  if (value.includes("sepolia") || value.includes("11155111")) {
    return false;
  }
  return (
    value.includes("mainnet") ||
    /eth[-.]mainnet/.test(value) ||
    /chain[_-]?id=1(?:\D|$)/.test(value) ||
    value.includes("network=mainnet")
  );
}

export function isExplicitTestnet(rpcUrl: string): boolean {
  const value = rpcUrl.trim().toLowerCase();
  return value.includes("sepolia") || value.includes("11155111") || value.includes("testnet");
}

export function assertSandboxRpcUrl(rpcUrl: string, nodeEnv: string): void {
  if (nodeEnv !== "sandbox") {
    return;
  }
  if (isMainnetRpcUrl(rpcUrl)) {
    throw new Error(
      [
        "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
        "REFUSING TO LOAD A MAINNET RPC URL WHILE NODE_ENV=sandbox.",
        `SEPOLIA_RPC_URL=${rpcUrl}`,
        "This would point sandbox traffic (and a throwaway test wallet) at a chain that holds real funds.",
        "Use a Sepolia endpoint (Alchemy, Infura, or a public Sepolia RPC) instead.",
        "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
      ].join("\n"),
    );
  }
}
