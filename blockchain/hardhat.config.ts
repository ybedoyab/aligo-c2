import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // Required for ExecutionLedger: registerEvent + LedgerEventRegistered emit
      // otherwise solc hits "stack too deep" with many string/bytes32 params.
      viaIR: true,
    },
  },
  networks: {
    // The in-process Hardhat network used for `hardhat test`.
    hardhat: {
      chainId: 31337,
    },
    // The standalone node started with `npx hardhat node`.
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
};

export default config;
