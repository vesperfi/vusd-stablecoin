import {ethers} from "hardhat";
import chai from "chai";
import {VirtualDollar, VirtualDollar__factory, Minter__factory, Minter} from "../typechain";
import {BigNumber} from "@ethersproject/bignumber";
import tokenSwapper from "./utils/tokenSwapper";
const {expect} = chai;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DECIMAL = BigNumber.from("1000000000000000000");
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

describe("Virtual Dollar: DV", async function () {
  let dv: VirtualDollar;
  let signers;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    const dvFactory = (await ethers.getContractFactory("VirtualDollar", signers[0])) as VirtualDollar__factory;
    dv = await dvFactory.deploy(signers[9].address);
    expect(dv.address).to.be.properAddress;
  });

  describe("Update miner address", function () {
    it("Should revert if caller is not governor", async function () {
      const tx = dv.connect(signers[4]).updateMinter(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
    });

    it("Shoud revert if minter address is zero", async function () {
      const tx = dv.updateMinter(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("minter-address-is-zero");
    });

    it("Should add new minter", async function () {
      const minter = signers[9].address;
      const tx = dv.updateMinter(minter);
      await expect(tx).to.emit(dv, "UpdatedMinter").withArgs(ZERO_ADDRESS, minter);
      expect(await dv.minter()).to.eq(minter, "Minter update failed");
    });

    it("Should revert when same minter added again", async function () {
      const minter = signers[9].address;
      await dv.updateMinter(minter);
      const tx = dv.updateMinter(minter);
      await expect(tx).to.be.revertedWith("same-minter");
    });
  });

  describe("Update treasury address", function () {
    it("Should revert if caller is not governor", async function () {
      const tx = dv.connect(signers[4]).updateTreasury(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
    });

    it("Shoud revert if treasury address is zero", async function () {
      const tx = dv.updateTreasury(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("treasury-address-is-zero");
    });

    it("Should add new treasury", async function () {
      const newTreasury = signers[8].address;
      const treasury = await dv.treasury();
      const tx = dv.updateTreasury(newTreasury);
      await expect(tx).to.emit(dv, "UpdatedTreasury").withArgs(treasury, newTreasury);
      expect(await dv.treasury()).to.eq(newTreasury, "Treasury update failed");
    });

    it("Should revert when same treasury added again", async function () {
      const treasury = signers[8].address;
      await dv.updateTreasury(treasury);
      const tx = dv.updateTreasury(treasury);
      await expect(tx).to.be.revertedWith("same-treasury");
    });
  });

  describe("Mint DV", function () {
    it("Should revert if caller is not minter", async function () {
      const tx = dv.mint(signers[2].address, BigNumber.from(10000));
      await expect(tx).to.be.revertedWith("caller-is-not-minter");
    });
  });

  describe("Multi transfer", function () {
    it("Should revert if arity mismatch", async function () {
      const tx = dv.multiTransfer([signers[1].address], [10, 15]);
      await expect(tx).to.be.revertedWith("input-length-mismatch");
    });

    it("Should revert if no balance to transfer", async function () {
      const tx = dv.multiTransfer([signers[1].address], [10]);
      await expect(tx).to.be.revertedWith("transfer amount exceeds balance");
    });

    it("Should transfer DV to multiple recipients", async function () {
      const minterFactory = (await ethers.getContractFactory("Minter", signers[0])) as Minter__factory;
      const minter: Minter = await minterFactory.deploy(dv.address);
      expect(minter.address).to.be.properAddress;
      await dv.updateMinter(minter.address);

      await tokenSwapper.swapEthForToken("1", DAI_ADDRESS, signers[1]);
      const amount = BigNumber.from(1000).mul(DECIMAL);
      const DAI = await ethers.getContractAt("ERC20", DAI_ADDRESS);
      await DAI.connect(signers[1]).approve(minter.address, amount);
      await minter.connect(signers[1]).mint(DAI_ADDRESS, amount);
      const dvBalance = await dv.balanceOf(signers[1].address);
      expect(dvBalance).to.be.gt(0, "Incorrect DV balance");
      const halfBalance = dvBalance.div(2);
      await dv
        .connect(signers[1])
        .multiTransfer([signers[2].address, signers[3].address], [halfBalance, halfBalance]);

      const dvBalance1 = await dv.balanceOf(signers[1].address);
      const dvBalance2 = await dv.balanceOf(signers[2].address);
      const dvBalance3 = await dv.balanceOf(signers[3].address);
      expect(dvBalance1).to.be.eq(0, "Sender balance should be zero");
      expect(dvBalance2).to.be.eq(dvBalance3, "Multi transfe failed");
    });
  });
});
