import {ethers} from "hardhat";
import chai from "chai";
import {VUSD, VUSD__factory, Minter, Minter__factory} from "../typechain";
import {BigNumber} from "@ethersproject/bignumber";
import tokenSwapper from "./utils/tokenSwapper";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

const {expect} = chai;

const DECIMAL = BigNumber.from("1000000000000000000");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const cDAI_ADDRESS = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";
const cUSDC_ADDRESS = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";
const cUSDT_ADDRESS = "0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9";
const cETH_ADDRESS = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5";

describe("VUSD Minter", async function () {
  let vusd: VUSD, minter: Minter;
  let signers;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    const vusdFactory = (await ethers.getContractFactory("VUSD", signers[0])) as VUSD__factory;
    vusd = await vusdFactory.deploy(signers[8].address);
    expect(vusd.address).to.be.properAddress;

    const minterFactory = (await ethers.getContractFactory("Minter", signers[0])) as Minter__factory;
    minter = await minterFactory.deploy(vusd.address);
    expect(minter.address).to.be.properAddress;
    await vusd.updateMinter(minter.address);
  });

  describe("Calculate mintage", function () {
    it("Should calculate mintage for 1000 DAI deposit", async function () {
      const amount = BigNumber.from(1000).mul(DECIMAL);
      const fee = await minter.mintingFee();
      const maxFee = await minter.MAX_MINTING_FEE();
      const expectedMintage = amount.sub(amount.mul(fee).div(maxFee));
      const actualMintage = await minter.calculateMintage(DAI_ADDRESS, amount);
      expect(actualMintage).to.be.eq(expectedMintage, "Incorrect mintage calculation");
    });

    it("Should return 0 mintage if not whitelisted token", async function () {
      const amount = BigNumber.from(1000).mul(DECIMAL);
      const actualMintage = await minter.calculateMintage(WETH_ADDRESS, amount);
      expect(actualMintage).to.be.eq("0", "Incorrect mintage calculation");
    });
  });

  describe("Mint VUSD", function () {
    let treasury;

    async function swapEthForToken(toToken: string, caller: SignerWithAddress): Promise<BigNumber> {
      const amount = await tokenSwapper.swapEthForToken("1", toToken, caller);
      const Token = await ethers.getContractAt("ERC20", toToken);
      await Token.connect(caller).approve(minter.address, amount);
      return amount;
    }

    beforeEach(async function () {
      treasury = await minter.treasury();
    });

    it("Should deposit DAI and mint VUSD", async function () {
      const amount = await swapEthForToken(DAI_ADDRESS, signers[1]);
      const cDAI = await ethers.getContractAt("ERC20", cDAI_ADDRESS);
      expect(await cDAI.balanceOf(treasury)).to.be.eq(0, "CToken balance of treasury should be zero");
      const expectedVUSD = await minter.calculateMintage(DAI_ADDRESS, amount);
      await minter.connect(signers[1]).mint(DAI_ADDRESS, amount);
      const vusdBalance = await vusd.balanceOf(signers[1].address);
      expect(vusdBalance).to.be.eq(expectedVUSD, "Incorrect VUSD minted");
      expect(await cDAI.balanceOf(treasury)).to.be.gt(0, "Incorrect cToken balance in treasury");
    });

    it("Should deposit DAI and mint VUSD and also take mintingFee", async function () {
      //Update minting fee
      await minter.updateMintingFee(5);
      const amount = await swapEthForToken(DAI_ADDRESS, signers[1]);
      const cDAI = await ethers.getContractAt("ERC20", cDAI_ADDRESS);
      const cDaiBefore = await cDAI.balanceOf(treasury);
      // expect(await cDAI.balanceOf(treasury)).to.be.eq(0, "CToken balance of treasury should be zero");
      const expectedVUSD = await minter.calculateMintage(DAI_ADDRESS, amount);
      await minter.connect(signers[1]).mint(DAI_ADDRESS, amount);
      const vusdBalance = await vusd.balanceOf(signers[1].address);
      expect(vusdBalance).to.be.eq(expectedVUSD, "Incorrect VUSD minted");
      const cDaiAfter = await cDAI.balanceOf(treasury);
      expect(cDaiAfter.sub(cDaiBefore)).to.be.gt(0, "Incorrect cToken balance in treasury");
    });

    it("Should deposit USDC and mint VUSD", async function () {
      const amount = await swapEthForToken(USDC_ADDRESS, signers[2]);
      const cUSDC = await ethers.getContractAt("ERC20", cUSDC_ADDRESS);
      expect(await cUSDC.balanceOf(treasury)).to.be.eq(0, "CToken balance of treasury should be zero");
      const expectedVUSD = await minter.calculateMintage(USDC_ADDRESS, amount);
      await minter.connect(signers[2]).mint(USDC_ADDRESS, amount);
      const vusdBalance = await vusd.balanceOf(signers[2].address);
      expect(vusdBalance).to.be.eq(expectedVUSD, "Incorrect VUSD minted");
      expect(await cUSDC.balanceOf(treasury)).to.be.gt(0, "Incorrect cToken balance in treasury");
    });

    it("Should deposit USDT and mint VUSD", async function () {
      const amount = await swapEthForToken(USDT_ADDRESS, signers[2]);
      const cUSDT = await ethers.getContractAt("ERC20", cUSDT_ADDRESS);
      expect(await cUSDT.balanceOf(treasury)).to.be.eq(0, "CToken balance of treasury should be zero");
      const expectedVUSD = await minter.calculateMintage(USDT_ADDRESS, amount);
      await minter.connect(signers[2]).mint(USDT_ADDRESS, amount);
      const vusdBalance = await vusd.balanceOf(signers[2].address);
      expect(vusdBalance).to.be.eq(expectedVUSD, "Incorrect VUSD minted");
      expect(await cUSDT.balanceOf(treasury)).to.be.gt(0, "Incorrect cToken balance in treasury");
    });

    it("Should revert if token is not whitelisted", async function () {
      const amount = BigNumber.from(1000).mul(DECIMAL);
      const tx = minter.connect(signers[1]).mint(WETH_ADDRESS, amount);
      await expect(tx).to.be.revertedWith("token-is-not-supported");
    });
  });

  describe("Update minting fee", function () {
    it("Should revert if caller is not governor", async function () {
      const tx = minter.connect(signers[4]).updateMintingFee(3);
      await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
    });
    it("Should revert if setting same minting fee", async function () {
      await minter.updateMintingFee(5);
      const tx = minter.updateMintingFee(5);
      await expect(tx).to.be.revertedWith("same-minting-fee");
    });

    it("Should revert if minting fee is above max", async function () {
      const tx = minter.updateMintingFee(10001);
      await expect(tx).to.be.revertedWith("minting-fee-limit-reached");
    });

    it("Should add new minting fee", async function () {
      const mintingFee = await minter.mintingFee();
      const newMintingFee = 10;
      const tx = minter.updateMintingFee(newMintingFee);
      await expect(tx).to.emit(minter, "UpdatedMintingFee").withArgs(mintingFee, newMintingFee);
      expect(await minter.mintingFee()).to.eq(newMintingFee, "Minting fee update failed");
    });
  });

  describe("Update token whitelist", function () {
    let tokenWhitelist, addressList;
    beforeEach(async function () {
      tokenWhitelist = await minter.whitelistedTokens();
      addressList = await ethers.getContractAt("IAddressList", tokenWhitelist);
    });
    context("Add token in whitelist", function () {
      it("Should revert if caller is not governor", async function () {
        const tx = minter.connect(signers[4]).addWhitelistedToken(DAI_ADDRESS, cDAI_ADDRESS);
        await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
      });

      it("Should add token address in whitelist", async function () {
        await minter.addWhitelistedToken(WETH_ADDRESS, cETH_ADDRESS);
        expect(await addressList.length()).to.be.equal("4", "Address added successfully");
        expect(await minter.cTokens(WETH_ADDRESS)).to.be.eq(cETH_ADDRESS, "Wrong cToken");
      });

      it("Should revert if address already exist in list", async function () {
        await expect(minter.addWhitelistedToken(DAI_ADDRESS, cDAI_ADDRESS)).to.be.revertedWith("add-in-list-failed");
      });
    });
    context("Remove token address from whitelist", function () {
      it("Should revert if caller is not governor", async function () {
        const tx = minter.connect(signers[4]).removeWhitelistedToken(DAI_ADDRESS);
        await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
      });

      it("Should remove token from whitelist", async function () {
        await minter.removeWhitelistedToken(DAI_ADDRESS);
        expect(await addressList.length()).to.be.equal("2", "Address removed successfully");
        expect(await minter.cTokens(DAI_ADDRESS)).to.be.eq(ZERO_ADDRESS, "CToken should be removed");
      });

      it("Should revert if token not in list", async function () {
        await expect(minter.removeWhitelistedToken(WETH_ADDRESS)).to.be.revertedWith("remove-from-list-failed");
      });
    });
  });
});
