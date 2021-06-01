import {ethers} from "hardhat";
import chai from "chai";
import {VUSD, VUSD__factory, Minter__factory, Minter} from "../typechain";
import {BigNumber} from "@ethersproject/bignumber";
import tokenSwapper from "./utils/tokenSwapper";
const {expect} = chai;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DECIMAL = BigNumber.from("1000000000000000000");
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

describe("VUSD", async function () {
  let vusd: VUSD;
  let signers;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    const vusdFactory = (await ethers.getContractFactory("VUSD", signers[0])) as VUSD__factory;
    vusd = await vusdFactory.deploy(signers[9].address);
    expect(vusd.address).to.be.properAddress;
  });

  describe("Update miner address", function () {
    it("Should revert if caller is not governor", async function () {
      const tx = vusd.connect(signers[4]).updateMinter(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
    });

    it("Should revert if minter address is zero", async function () {
      const tx = vusd.updateMinter(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("minter-address-is-zero");
    });

    it("Should add new minter", async function () {
      const minter = signers[9].address;
      const tx = vusd.updateMinter(minter);
      await expect(tx).to.emit(vusd, "UpdatedMinter").withArgs(ZERO_ADDRESS, minter);
      expect(await vusd.minter()).to.eq(minter, "Minter update failed");
    });

    it("Should revert when same minter added again", async function () {
      const minter = signers[9].address;
      await vusd.updateMinter(minter);
      const tx = vusd.updateMinter(minter);
      await expect(tx).to.be.revertedWith("same-minter");
    });
  });

  describe("Update treasury address", function () {
    it("Should revert if caller is not governor", async function () {
      const tx = vusd.connect(signers[4]).updateTreasury(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
    });

    it("Should revert if treasury address is zero", async function () {
      const tx = vusd.updateTreasury(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("treasury-address-is-zero");
    });

    it("Should add new treasury", async function () {
      const newTreasury = signers[8].address;
      const treasury = await vusd.treasury();
      const tx = vusd.updateTreasury(newTreasury);
      await expect(tx).to.emit(vusd, "UpdatedTreasury").withArgs(treasury, newTreasury);
      expect(await vusd.treasury()).to.eq(newTreasury, "Treasury update failed");
    });

    it("Should revert when same treasury added again", async function () {
      const treasury = signers[8].address;
      await vusd.updateTreasury(treasury);
      const tx = vusd.updateTreasury(treasury);
      await expect(tx).to.be.revertedWith("same-treasury");
    });
  });

  describe("Mint VUSD", function () {
    it("Should revert if caller is not minter", async function () {
      const tx = vusd.mint(signers[2].address, BigNumber.from(10000));
      await expect(tx).to.be.revertedWith("caller-is-not-minter");
    });
  });

  describe("Multi transfer", function () {
    it("Should revert if arity mismatch", async function () {
      const tx = vusd.multiTransfer([signers[1].address], [10, 15]);
      await expect(tx).to.be.revertedWith("input-length-mismatch");
    });

    it("Should revert if no balance to transfer", async function () {
      const tx = vusd.multiTransfer([signers[1].address], [10]);
      await expect(tx).to.be.revertedWith("transfer amount exceeds balance");
    });

    it("Should transfer VUSD to multiple recipients", async function () {
      const minterFactory = (await ethers.getContractFactory("Minter", signers[0])) as Minter__factory;
      const minter: Minter = await minterFactory.deploy(vusd.address);
      expect(minter.address).to.be.properAddress;
      await vusd.updateMinter(minter.address);

      await tokenSwapper.swapEthForToken("1", DAI_ADDRESS, signers[1]);
      const amount = BigNumber.from(1000).mul(DECIMAL);
      const DAI = await ethers.getContractAt("ERC20", DAI_ADDRESS);
      await DAI.connect(signers[1]).approve(minter.address, amount);
      await minter.connect(signers[1]).mint(DAI_ADDRESS, amount);
      const vusdBalance = await vusd.balanceOf(signers[1].address);
      expect(vusdBalance).to.be.gt(0, "Incorrect VUSD balance");
      const halfBalance = vusdBalance.div(2);
      await vusd
        .connect(signers[1])
        .multiTransfer([signers[2].address, signers[3].address], [halfBalance, halfBalance]);

      const vusdBalance1 = await vusd.balanceOf(signers[1].address);
      const vusdBalance2 = await vusd.balanceOf(signers[2].address);
      const vusdBalance3 = await vusd.balanceOf(signers[3].address);
      expect(vusdBalance1).to.be.eq(0, "Sender balance should be zero");
      expect(vusdBalance2).to.be.eq(vusdBalance3, "Multi transfer failed");
    });
  });
});
