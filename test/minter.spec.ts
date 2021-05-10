import {ethers} from "hardhat";
import chai from "chai";
import {VirtualDollar, VirtualDollar__factory, Minter, Minter__factory} from "../typechain";
import {BigNumber} from "@ethersproject/bignumber";
import tokenSwapper from "./utils/tokenSwapper";

const {expect} = chai;

const DECIMAL = BigNumber.from("1000000000000000000");
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
describe("Virtual Dollar Minter", async function () {
  let dv: VirtualDollar, minter: Minter;
  let signers;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    const dvFactory = (await ethers.getContractFactory("VirtualDollar", signers[0])) as VirtualDollar__factory;
    dv = await dvFactory.deploy(signers[8].address);
    expect(dv.address).to.be.properAddress;

    const minterFactory = (await ethers.getContractFactory("Minter", signers[0])) as Minter__factory;
    minter = await minterFactory.deploy(dv.address);
    expect(minter.address).to.be.properAddress;
    await dv.updateMinter(minter.address);
  });

  context("Calculate mintage", function () {
    it("Should calculate mintage for 1000 DAI deposit", async function () {
      const amount = BigNumber.from(1000).mul(DECIMAL);
      const fee = await minter.mintingFee();
      const maxFee = await minter.MAX_MINTING_FEE();
      const expectedMintage = amount.sub(amount.mul(fee).div(maxFee));
      const actualMintage = await minter.calculateMintage(DAI_ADDRESS, amount);
      expect(actualMintage).to.be.eq(expectedMintage, "Incorrect mintage calculation");
    });

    it("Should return 0 mingate if not whitelisted token", async function () {
      const amount = BigNumber.from(1000).mul(DECIMAL);
      const actualMintage = await minter.calculateMintage(WETH_ADDRESS, amount);
      expect(actualMintage).to.be.eq("0", "Incorrect mintage calculation");
    });
  });

  context("Mint DV", function () {
    it("Should deposit DAI and mint DV", async function () {
      await tokenSwapper.swapEthForToken("1", DAI_ADDRESS, signers[1]);
      const amount = BigNumber.from(1000).mul(DECIMAL);

      
      const DAI = await ethers.getContractAt("ERC20", DAI_ADDRESS);
      const treasury = await minter.treasury();
      console.log("treasury balance", (await DAI.balanceOf(treasury)).toString());
      await DAI.connect(signers[1]).approve(minter.address, amount);
      const expectedDV = await minter.calculateMintage(DAI_ADDRESS, amount);
      await minter.connect(signers[1]).mint(DAI_ADDRESS, amount);
      const dvBalance = await dv.balanceOf(signers[1].address);
      expect(dvBalance).to.be.eq(expectedDV, "Incorrect DV minted");

      
      expect(await DAI.balanceOf(treasury)).to.be.eq(amount, "Incorrect DAI balance in treasury");
    });

    it("Should revert if token is not whitelisted", async function () {
      const amount = BigNumber.from(1000).mul(DECIMAL);
      const tx = minter.connect(signers[1]).mint(WETH_ADDRESS, amount);
      await expect(tx).to.be.revertedWith("token-is-not-supported");
    });
  });

  context("Update minting fee", function () {
    it("Should revert if setting same minting fee", async function () {
      const tx = minter.updateMintingFee(5);
      await expect(tx).to.be.revertedWith("same-minting-fee");
    });

    it("Should revert when same treasury added again", async function () {
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

  describe("Update token whiltelist", function () {
    let tokenWhitelist, addressList;
    beforeEach(async function () {
      tokenWhitelist = await minter.whitelistedTokens();
      addressList = await ethers.getContractAt("IAddressList", tokenWhitelist);
    });
    context("Add token in whitelist", function () {
      it("Should revert if caller is not governor", async function () {
        const tx = minter.connect(signers[4]).addWhitelistedToken(DAI_ADDRESS);
        await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
      });

      it("Should add token address in whitelist", async function () {
        await minter.addWhitelistedToken(WETH_ADDRESS);
        expect(await addressList.length()).to.be.equal("4", "Address added successfully");
      });

      it("Should revert if address already exist in list", async function () {
        await expect(minter.addWhitelistedToken(DAI_ADDRESS)).to.be.revertedWith("add-in-list-failed");
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
      });

      it("Should revert if token not in list", async function () {
        await expect(minter.removeWhitelistedToken(WETH_ADDRESS)).to.be.revertedWith("remove-from-list-failed");
      });
    });
  });
});
