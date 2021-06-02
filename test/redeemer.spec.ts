import {ethers} from "hardhat";
import chai from "chai";
import {
  VUSD,
  VUSD__factory,
  Minter,
  Minter__factory,
  Redeemer,
  Redeemer__factory,
  Treasury,
  Treasury__factory,
} from "../typechain";
import {BigNumber} from "@ethersproject/bignumber";
import tokenSwapper from "./utils/tokenSwapper";
import Address from "./utils/address";

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

const {expect} = chai;

describe("VUSD redeemer", async function () {
  let vusd: VUSD, minter: Minter, redeemer: Redeemer, treasury: Treasury;
  let signers;
  let user1, user2, user3, user4;

  async function mintVUSD(toToken: string, caller: SignerWithAddress): Promise<BigNumber> {
    const amount = await tokenSwapper.swapEthForToken("1", toToken, caller);
    const Token = await ethers.getContractAt("ERC20", toToken);
    await Token.connect(caller).approve(minter.address, amount);
    await minter.connect(caller).mint(toToken, amount);
    return amount;
  }

  beforeEach(async function () {
    signers = await ethers.getSigners();
    [, user1, user2, user3, user4] = signers;
    const vusdFactory = (await ethers.getContractFactory("VUSD", signers[0])) as VUSD__factory;
    vusd = await vusdFactory.deploy(signers[8].address);
    expect(vusd.address).to.be.properAddress;

    const minterFactory = (await ethers.getContractFactory("Minter", signers[0])) as Minter__factory;
    minter = await minterFactory.deploy(vusd.address);
    expect(minter.address).to.be.properAddress;
    await vusd.updateMinter(minter.address);

    const redeemerFactory = (await ethers.getContractFactory("Redeemer", signers[0])) as Redeemer__factory;
    redeemer = await redeemerFactory.deploy(vusd.address);
    expect(redeemer.address).to.be.properAddress;

    const treasuryFactory = (await ethers.getContractFactory("Treasury", signers[0])) as Treasury__factory;
    treasury = await treasuryFactory.deploy(vusd.address);
    expect(treasury.address).to.be.properAddress;
    await vusd.updateTreasury(treasury.address);
    await treasury.updateRedeemer(redeemer.address);
  });

  context("Check redeemable", function () {
    it("Should return zero redeemable when no balance", async function () {
      expect(await redeemer["redeemable(address)"](Address.DAI_ADDRESS)).to.be.eq(0, "redeemable should be zero");
    });

    it("Should return valid redeemable", async function () {
      await mintVUSD(Address.USDC_ADDRESS, user1);
      expect(await redeemer["redeemable(address)"](Address.USDC_ADDRESS)).to.be.gt(0, "redeemable should be > 0");
    });

    it("Should return valid redeemable when query with amount", async function () {
      const depositAmount = await mintVUSD(Address.DAI_ADDRESS, user1);
      const cDAI = await ethers.getContractAt("CToken", Address.cDAI_ADDRESS);
      await cDAI.exchangeRateCurrent();
      const redeemable = await redeemer["redeemable(address,uint256)"](Address.DAI_ADDRESS, depositAmount);
      expect(redeemable).to.be.gt(0, "redeemable should be > 0");
    });

    it("Should return zero redeemable when token is not supported", async function () {
      const tx = await redeemer["redeemable(address,uint256)"](Address.WETH_ADDRESS, 100);
      expect(tx).to.be.eq(0, "redeemable should be zero");
    });
  });

  context("Redeem token", function () {
    it("Should redeem token and burn VUSD", async function () {
      const token = Address.USDT_ADDRESS;
      await mintVUSD(token, user2);
      const amountToWithdraw = await vusd.balanceOf(user2.address);
      await vusd.connect(user2).approve(redeemer.address, amountToWithdraw);
      const USDT = await ethers.getContractAt("ERC20", token);
      expect(await USDT.balanceOf(user2.address)).to.be.eq(0, "Governor balance should be zero");

      const cUSDT = await ethers.getContractAt("CToken", Address.cUSDT_ADDRESS);
      await cUSDT.exchangeRateCurrent();

      const redeemAmount = await redeemer["redeemable(address,uint256)"](token, amountToWithdraw);
      await redeemer.connect(user2)["redeem(address,uint256)"](token, amountToWithdraw);
      expect(await USDT.balanceOf(user2.address)).to.be.eq(redeemAmount, "Incorrect USDT balance");
    });

    it("Should allow redeem to another address", async function () {
      const token = Address.DAI_ADDRESS;
      await mintVUSD(token, user3);
      const amountToWithdraw = ethers.utils.parseUnits("1000", "ether"); // 1000 DAI
      await vusd.connect(user3).approve(redeemer.address, amountToWithdraw);
      const DAI = await ethers.getContractAt("ERC20", token);
      expect(await DAI.balanceOf(user4.address)).to.be.eq(0, "User balance should be zero");
      await redeemer.connect(user3)["redeem(address,uint256,address)"](token, amountToWithdraw, user4.address);
      expect(await DAI.balanceOf(user4.address)).to.be.eq(amountToWithdraw, "Incorrect DAI balance");
    });
  });

  describe("Update redeem fee", function () {
    it("Should revert if caller is not governor", async function () {
      const tx = redeemer.connect(signers[4]).updateRedeemFee(3);
      await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
    });

    it("Should revert if setting same redeem fee", async function () {
      await redeemer.updateRedeemFee(3);
      const tx = redeemer.updateRedeemFee(3);
      await expect(tx).to.be.revertedWith("same-redeem-fee");
    });

    it("Should revert if redeem fee is above max", async function () {
      const tx = redeemer.updateRedeemFee(10001);
      await expect(tx).to.be.revertedWith("redeem-fee-limit-reached");
    });

    it("Should add new redeem fee", async function () {
      const redeemFee = await redeemer.redeemFee();
      const newRedeemFee = 10;
      const tx = redeemer.updateRedeemFee(newRedeemFee);
      await expect(tx).to.emit(redeemer, "UpdatedRedeemFee").withArgs(redeemFee, newRedeemFee);
      expect(await redeemer.redeemFee()).to.eq(newRedeemFee, "Redeem fee update failed");
    });
  });
});
