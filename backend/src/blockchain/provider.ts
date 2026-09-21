import { JsonRpcProvider, Network, Wallet, type Provider } from "ethers";
import {
  config,
  getRpcUrl,
  getSignerPrivateKey,
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
} from "../config/env";
import { assertProductionRpcUrl, assertSandboxRpcUrl, isMainnetRpcUrl } from "./rpc-guards";

const SEPOLIA_CHAIN_ID_BIGINT = BigInt(SEPOLIA_CHAIN_ID);
const MAINNET_CHAIN_ID_BIGINT = BigInt(MAINNET_CHAIN_ID);
const MOCK_SEPOLIA_HEAD_BLOCK = 9_000_000;

let provider: JsonRpcProvider | undefined;
let wallet: Wallet | undefined;

export function isMockChainProviderEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MOCK_CHAIN_PROVIDER === "true";
}

/**
 * In-process Sepolia stand-in for per-commit CI. Never opens a socket.
 * Nightly smoke uses a real RPC and must not set MOCK_CHAIN_PROVIDER.
 */
export function createMockSepoliaProvider(): JsonRpcProvider {
  const sepolia = Network.from(SEPOLIA_CHAIN_ID_BIGINT);
  const mock = new JsonRpcProvider("https://mock.sepolia.invalid", sepolia, {
    staticNetwork: sepolia,
  });
  mock.send = async (method: string): Promise<unknown> => {
    switch (method) {
      case "eth_chainId":
        return "0xaa36a7";
      case "eth_blockNumber":
        return `0x${MOCK_SEPOLIA_HEAD_BLOCK.toString(16)}`;
      case "eth_getBlockByNumber":
      case "eth_getBlockByHash":
        return null;
      case "eth_getLogs":
        return [];
      case "eth_getTransactionByHash":
      case "eth_getTransactionReceipt":
        return null;
      case "net_version":
        return "11155111";
      default:
        throw new Error(`MOCK_CHAIN_PROVIDER blocked JSON-RPC method ${method}`);
    }
  };
  return mock;
}

export function resetProviderCacheForTests(): void {
  provider = undefined;
  wallet = undefined;
}

function requireConfiguredChain(): void {
  if (config.NODE_ENV === "sandbox") {
    assertSandboxRpcUrl(config.SEPOLIA_RPC_URL, config.NODE_ENV);
    return;
  }

  if (isMockChainProviderEnabled()) {
    throw new Error("MOCK_CHAIN_PROVIDER is not allowed when NODE_ENV=production.");
  }
  assertProductionRpcUrl(config.MAINNET_RPC_URL, config.NODE_ENV);
}

function normalizePrivateKey(key: string): string {
  return key.startsWith("0x") ? key : `0x${key}`;
}

export function getConfiguredRpcUrl(): string {
  requireConfiguredChain();
  return getRpcUrl();
}

export function getProvider(): JsonRpcProvider {
  requireConfiguredChain();
  if (!provider) {
    if (config.NODE_ENV === "sandbox" && isMockChainProviderEnabled()) {
      provider = createMockSepoliaProvider();
    } else {
      // Do not pin staticNetwork: getNetwork() must observe the real chain id so a
      // mislabeled endpoint cannot hide behind the env var name.
      provider = new JsonRpcProvider(getConfiguredRpcUrl());
    }
  }
  return provider;
}

export function getWallet(): Wallet {
  requireConfiguredChain();
  if (!wallet) {
    wallet = new Wallet(normalizePrivateKey(getSignerPrivateKey()), getProvider());
  }
  return wallet;
}

/**
 * Shared receive address derived from the configured signer key.
 * Sandbox: throwaway Sepolia wallet. Production: dedicated mainnet signer
 * from MAINNET_PRIVATE_KEY (never the sandbox throwaway).
 */
export function getSharedReceiveAddress(): string {
  requireConfiguredChain();
  return new Wallet(normalizePrivateKey(getSignerPrivateKey())).address;
}

export async function assertConnectedToConfiguredChain(
  activeProvider: Provider = getProvider(),
): Promise<void> {
  requireConfiguredChain();
  const network = await activeProvider.getNetwork();

  if (config.NODE_ENV === "sandbox") {
    if (network.chainId === MAINNET_CHAIN_ID_BIGINT || isMainnetRpcUrl(network.name)) {
      throw new Error(
        [
          "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
          "REFUSING TO USE THIS RPC WHILE NODE_ENV=sandbox.",
          `Connected chainId=${network.chainId.toString()} name=${network.name}`,
          "The endpoint resolved to Ethereum mainnet. Sandbox must use Sepolia (11155111).",
          "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
        ].join("\n"),
      );
    }
    if (network.chainId !== SEPOLIA_CHAIN_ID_BIGINT) {
      throw new Error(
        `Sandbox provider must be Sepolia (chainId ${SEPOLIA_CHAIN_ID}); got ${network.chainId.toString()}.`,
      );
    }
    return;
  }

  if (network.chainId !== MAINNET_CHAIN_ID_BIGINT) {
    throw new Error(
      [
        "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
        "REFUSING TO USE THIS RPC WHILE NODE_ENV=production.",
        `Connected chainId=${network.chainId.toString()} name=${network.name}`,
        `Production must be Ethereum mainnet (chainId ${MAINNET_CHAIN_ID}).`,
        "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
      ].join("\n"),
    );
  }
}

/** @deprecated Use assertConnectedToConfiguredChain. */
export const assertConnectedToSepolia = assertConnectedToConfiguredChain;

export const SEPOLIA_CHAIN_ID_NUMBER = SEPOLIA_CHAIN_ID;
export const MAINNET_CHAIN_ID_NUMBER = MAINNET_CHAIN_ID;
