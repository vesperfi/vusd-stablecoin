'use strict'
require('@nomiclabs/hardhat-waffle')
require('solidity-coverage')
require('hardhat-log-remover')
require('dotenv').config()

const gasPrice = 55000000000


module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: process.env.NODE_URL,
      },
    },
    mainnet: {
      url: process.env.NODE_URL,
      chainId: 1,
      gas: 6700000,
      gasPrice,
    },
  },
  solidity: {
    version: '0.8.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  mocha: {
    timeout: 200000
  }
}
