import { JsonRpcProvider, Network, Wallet, type Provider } from "ethers";
import { config } from "../config/env";
import { assertSandboxRpcUrl, isMainnetRpcUrl } from "./rpc-guards";

const SEPOLIA_CHAIN_ID = 11155111n;
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
  const sepolia = Network.from(SEPOLIA_CHAIN_ID);
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

function requireTestnetContext(): void {
  if (config.NODE_ENV === "sandbox") {
    assertSandboxRpcUrl(config.SEPOLIA_RPC_URL, config.NODE_ENV);
    return;
  }

  throw new Error(
    [
      "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
      "REFUSING TO CONSTRUCT A SIGNER/PROVIDER FOR PAYMENTS.",
      `NODE_ENV=${config.NODE_ENV} chain=${config.chain}`,
      "The ethers wallet is only loaded when NODE_ENV=sandbox (Sepolia testnet).",
      "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
    ].join("\n"),
  );
}

function normalizePrivateKey(key: string): string {
  return key.startsWith("0x") ? key : `0x${key}`;
}

export function getSepoliaRpcUrl(): string {
  requireTestnetContext();
  if (config.NODE_ENV !== "sandbox") {
    throw new Error("Sepolia RPC is only available when NODE_ENV=sandbox.");
  }
  return config.SEPOLIA_RPC_URL;
}

export function getProvider(): JsonRpcProvider {
  requireTestnetContext();
  if (!provider) {
    if (isMockChainProviderEnabled()) {
      provider = createMockSepoliaProvider();
    } else {
      // Do not pin staticNetwork: getNetwork() must observe the real chain id so a
      // mainnet endpoint cannot hide behind a Sepolia label.
      provider = new JsonRpcProvider(getSepoliaRpcUrl());
    }
  }
  return provider;
}

export function getWallet(): Wallet {
  requireTestnetContext();
  if (!wallet) {
    wallet = new Wallet(normalizePrivateKey(config.SEPOLIA_PRIVATE_KEY), getProvider());
  }
  return wallet;
}

/**
 * Shared sandbox receive address (the throwaway test wallet).
 * See createPaymentIntent for why intents share this address.
 */
export function getSharedReceiveAddress(): string {
  requireTestnetContext();
  return new Wallet(normalizePrivateKey(config.SEPOLIA_PRIVATE_KEY)).address;
}

export async function assertConnectedToSepolia(
  activeProvider: Provider = getProvider(),
): Promise<void> {
  requireTestnetContext();
  const network = await activeProvider.getNetwork();
  if (network.chainId === 1n || isMainnetRpcUrl(network.name)) {
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
  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Sandbox provider must be Sepolia (chainId ${SEPOLIA_CHAIN_ID.toString()}); got ${network.chainId.toString()}.`,
    );
  }
}

export const SEPOLIA_CHAIN_ID_NUMBER = Number(SEPOLIA_CHAIN_ID);
