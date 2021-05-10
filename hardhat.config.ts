import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import "@typechain/hardhat";
import {HardhatUserConfig} from "hardhat/types";
import "solidity-coverage";
import "hardhat-log-remover";
import dotenv from "dotenv";
dotenv.config();

const gasPrice = 55000000000;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    localhost :{
      saveDeployments: true,
    },
    hardhat: {
      saveDeployments: true,
      forking: {
        url: process.env.NODE_URL || "https://localhost:8545",
        blockNumber: 12454838,
      },
    },
    mainnet: {
      url: process.env.NODE_URL,
      chainId: 1,
      gas: 6700000,
      gasPrice,
    },
  },
  paths: {
    deployments: "deployments",
  },
  namedAccounts: {
    deployer: process.env.DEPLOYER || 0,
    treasury:"0x6c2e3f1a88C19Bf4cf14fa38B8f745330573Da37",
  },
  solidity: {
    compilers: [{version: "0.8.3", settings: {}}],
  },
};

export default config;
