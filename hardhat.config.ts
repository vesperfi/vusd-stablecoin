import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import "@typechain/hardhat";
import {HardhatUserConfig} from "hardhat/types";
import "solidity-coverage";
import "hardhat-log-remover";
import "hardhat-gas-reporter";
import dotenv from "dotenv";
dotenv.config();

const gasPrice = 55000000000;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      saveDeployments: true,
    },
    hardhat: {
      saveDeployments: true,
      forking: {
        url: process.env.NODE_URL || "https://localhost:8545",
        blockNumber: process.env.BLOCK_NUMBER ? parseInt(process.env.BLOCK_NUMBER) : undefined,
      },
    },
    mainnet: {
      url: process.env.NODE_URL,
      chainId: 1,
      gas: 6700000,
      gasPrice,
    },
    ropsten: {
      url: process.env.NODE_URL_ROPSTEN,
      chainId: 3,
    }
  },
  paths: {
    deployments: "deployments",
  },
  namedAccounts: {
    deployer: process.env.DEPLOYER || 0
  },
  solidity: {
    compilers: [{version: "0.8.3", settings: {}}],
  },
};

export default config;
