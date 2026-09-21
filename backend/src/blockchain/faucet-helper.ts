#!/usr/bin/env node
import { isAddress } from "ethers";

const FAUCET_URL = "https://sepoliafaucet.com";
const ALCHEMY_FAUCET_URL = "https://www.alchemy.com/faucets/ethereum-sepolia";
const GOOGLE_FAUCET_URL = "https://cloud.google.com/application/web3/faucet/ethereum/sepolia";

function usage(): never {
  console.log("Usage: npm run sandbox:fund -- <sepolia-address>");
  console.log("Example: npm run sandbox:fund -- 0x0000000000000000000000000000000000000000");
  process.exit(1);
}

function main(): void {
  const address = process.argv.slice(2).find((arg) => arg.length > 0);
  if (!address) {
    usage();
  }
  if (!isAddress(address.toLowerCase())) {
    console.error(`Not a valid Ethereum address: ${address}`);
    usage();
  }

  const faucetWithAddress = `${FAUCET_URL}/?address=${address}`;

  console.log("");
  console.log("CryptoChain sandbox — Sepolia faucet helper");
  console.log("This is NOT an automated faucet. Public faucets require a captcha in the browser.");
  console.log("");
  console.log(`Address: ${address}`);
  console.log("");
  console.log("1. Open a faucet (captcha required):");
  console.log(`   ${faucetWithAddress}`);
  console.log(`   ${ALCHEMY_FAUCET_URL}`);
  console.log(`   ${GOOGLE_FAUCET_URL}`);
  console.log("2. Paste the address above and complete the captcha.");
  console.log("3. Wait for the Sepolia ETH to arrive, then pay your PaymentIntent as usual.");
  console.log("4. Never send mainnet ETH to this address.");
  console.log("");
}

main();
