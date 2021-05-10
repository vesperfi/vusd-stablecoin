'use strict'
require('dotenv').config()

module.exports = {
  client: require('ganache-cli'),
  providerOptions: {
    fork: process.env.NODE_URL,
    default_balance_ether: 50000,
    network_id: 1
  },
}
