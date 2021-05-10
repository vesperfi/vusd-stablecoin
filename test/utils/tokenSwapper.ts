"use strict";

import {expect} from "chai";
import {BigNumber} from "ethers";
import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

const DECIMAL = BigNumber.from("1000000000000000000");
const uniswapAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

/**
 * Swap ETH into given token
 *
 * @param ethAmount ETH amount, it is in ETH i.e. 2 for 2 ETH
 * @param toToken Address of output token
 * @param caller caller with signer, who will pay for ETH
 * @param receiver? Address of token receiver
 * @returns Promise with balance of toToken after swap
 */
async function swapEthForToken(
  ethAmount: string,
  toToken: string,
  caller: SignerWithAddress,
  receiver?: SignerWithAddress
): Promise<BigNumber> {
  const toAddress = receiver || caller.address;
  const amountIn = BigNumber.from(ethAmount).mul(DECIMAL).toString();
  const uni = await ethers.getContractAt("IUniswapRouterTest", uniswapAddress);
  const block = await ethers.provider.getBlock("latest");
  const path = [WETH, toToken];
  const token = await ethers.getContractAt("ERC20", toToken);
  await uni.connect(caller).swapExactETHForTokens(1, path, toAddress, block.timestamp + 60, {value: amountIn});
  const tokenBalance = await token.balanceOf(toAddress);
  expect(tokenBalance).to.be.gt("0", "Token balance is not correct");
  return tokenBalance;
}

export default {swapEthForToken};
