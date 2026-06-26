import { ethers, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys ExecutionLedger to the configured network and exports:
 *  - deployment.json (repo root): the deployed address + network info
 *  - server/app/blockchain/contract_abi.json: the ABI used by web3.py
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying ExecutionLedger with account: ${deployer.address}`);

  const Factory = await ethers.getContractFactory("ExecutionLedger");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("------------------------------------------------------------");
  console.log(`ExecutionLedger deployed at: ${address}`);
  console.log("Set this in your .env as CONTRACT_ADDRESS");
  console.log("------------------------------------------------------------");

  // Persist deployment metadata at the repo root.
  const network = await ethers.provider.getNetwork();
  const deployment = {
    contract: "ExecutionLedger",
    address,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const rootDir = path.resolve(__dirname, "..", "..");
  fs.writeFileSync(
    path.join(rootDir, "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );

  // Export the ABI so the Python server can talk to the contract.
  const artifact = await artifacts.readArtifact("ExecutionLedger");
  const abiTargetDir = path.join(rootDir, "server", "app", "blockchain");
  fs.mkdirSync(abiTargetDir, { recursive: true });
  fs.writeFileSync(
    path.join(abiTargetDir, "contract_abi.json"),
    JSON.stringify(artifact.abi, null, 2)
  );
  console.log("ABI exported to server/app/blockchain/contract_abi.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
