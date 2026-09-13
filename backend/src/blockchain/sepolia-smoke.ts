import path from "node:path";
import dotenv from "dotenv";
import { JsonRpcProvider } from "ethers";
import { assertSandboxRpcUrl } from "./rpc-guards";

const SEPOLIA_CHAIN_ID = 11155111n;

export type SepoliaSmokeResult = {
  chainId: bigint;
  blockNumber: number;
  rpcUrl: string;
};

/**
 * Hits a real Sepolia JSON-RPC endpoint. Refuses to run when the chain is mocked
 * so the nightly workflow cannot go green without talking to the network.
 */
export async function runSepoliaSmoke(
  env: NodeJS.ProcessEnv = process.env,
): Promise<SepoliaSmokeResult> {
  if (env.MOCK_CHAIN_PROVIDER === "true") {
    throw new Error(
      "Refusing to run the Sepolia smoke test with MOCK_CHAIN_PROVIDER=true. Unset it to hit a real RPC.",
    );
  }

  const rpcUrl = env.SEPOLIA_RPC_URL;
  if (!rpcUrl) {
    throw new Error("SEPOLIA_RPC_URL is missing");
  }
  assertSandboxRpcUrl(rpcUrl, "sandbox");

  const provider = new JsonRpcProvider(rpcUrl);
  try {
    const network = await provider.getNetwork();
    if (network.chainId !== SEPOLIA_CHAIN_ID) {
      throw new Error(
        `Sepolia smoke expected chainId ${SEPOLIA_CHAIN_ID.toString()}, got ${network.chainId.toString()}.`,
      );
    }
    const blockNumber = await provider.getBlockNumber();
    if (!Number.isFinite(blockNumber) || blockNumber < 1) {
      throw new Error(`Sepolia smoke got an invalid head block: ${blockNumber}`);
    }
    return { chainId: network.chainId, blockNumber, rpcUrl };
  } finally {
    provider.destroy();
  }
}

function isCliEntry(): boolean {
  const invoked = process.argv[1];
  return Boolean(invoked && /sepolia-smoke\.[cm]?[tj]s$/.test(invoked));
}

if (isCliEntry()) {
  dotenv.config({
    path: path.resolve(__dirname, "../../../.env.sandbox"),
  });
  void runSepoliaSmoke()
    .then((result) => {
      console.log(
        `Sepolia smoke ok chainId=${result.chainId.toString()} block=${result.blockNumber}`,
      );
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
