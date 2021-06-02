import {ethers} from "hardhat";
import chai from "chai";
import {VUSD, VUSD__factory, Minter, Minter__factory, Treasury, Treasury__factory} from "../typechain";
import {BigNumber} from "@ethersproject/bignumber";
import tokenSwapper from "./utils/tokenSwapper";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import Address from "./utils/address";

const {expect} = chai;

const ZERO_ADDRESS = Address.ZERO_ADDRESS;
const DAI_ADDRESS = Address.DAI_ADDRESS;
const USDC_ADDRESS = Address.USDC_ADDRESS;
const USDT_ADDRESS = Address.USDT_ADDRESS;
const WETH_ADDRESS = Address.WETH_ADDRESS;

const cDAI_ADDRESS = Address.cDAI_ADDRESS;
const cUSDC_ADDRESS = Address.cUSDC_ADDRESS;
const cETH_ADDRESS = Address.cETH_ADDRESS;

describe("VUSD Treasury", async function () {
  let vusd: VUSD, minter: Minter, treasury: Treasury;
  let signers;

  async function mintVUSD(toToken: string, caller: SignerWithAddress, amountIn?: string): Promise<BigNumber> {
    const inputAmount = amountIn || "1";
    const amount = await tokenSwapper.swapEthForToken(inputAmount, toToken, caller);
    const Token = await ethers.getContractAt("ERC20", toToken);
    await Token.connect(caller).approve(minter.address, amount);
    await minter.connect(caller).mint(toToken, amount);
    return amount;
  }

  async function mineBlocks(blocksToMine: number): Promise<void> {
    const currentBlockNumber = await ethers.provider.getBlockNumber();
    const target = currentBlockNumber + blocksToMine;
    while ((await ethers.provider.getBlockNumber()) < target) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  beforeEach(async function () {
    signers = await ethers.getSigners();
    const vusdFactory = (await ethers.getContractFactory("VUSD", signers[0])) as VUSD__factory;
    vusd = await vusdFactory.deploy(signers[8].address);
    expect(vusd.address).to.be.properAddress;

    const minterFactory = (await ethers.getContractFactory("Minter", signers[0])) as Minter__factory;
    minter = await minterFactory.deploy(vusd.address);
    expect(minter.address).to.be.properAddress;
    await vusd.updateMinter(minter.address);

    const treasuryFactory = (await ethers.getContractFactory("Treasury", signers[0])) as Treasury__factory;
    treasury = await treasuryFactory.deploy(vusd.address);
    expect(treasury.address).to.be.properAddress;
    await vusd.updateTreasury(treasury.address);
  });

  context("Check Withdrawable", function () {
    it("Should return zero withdrawable when no balance", async function () {
      expect(await treasury.withdrawable(DAI_ADDRESS)).to.be.eq(0, "Withdrawable should be zero");
    });

    it("Should return valid withdrawable", async function () {
      await mintVUSD(USDC_ADDRESS, signers[3]);
      expect(await treasury.withdrawable(USDC_ADDRESS)).to.be.gt(0, "Withdrawable should be > 0");
    });

    it("Should return zero withdrawable for non supporting token", async function () {
      expect(await treasury.withdrawable(WETH_ADDRESS)).to.be.eq(0, "Withdrawable should be zero");
    });
  });

  context("Withdraw token", function () {
    it("Should revert if caller is neither governor nor redeemer", async function () {
      await mintVUSD(DAI_ADDRESS, signers[4]);
      const amountToWithdraw = ethers.utils.parseUnits("1000", "ether"); // 1000 DAI
      const tx = treasury.connect(signers[4])["withdraw(address,uint256)"](DAI_ADDRESS, amountToWithdraw);
      await expect(tx).to.be.revertedWith("caller-is-not-authorized");
    });

    it("Should revert if token is not supported", async function () {
      const tx = treasury["withdraw(address,uint256)"](WETH_ADDRESS, "1000");
      await expect(tx).to.be.revertedWith("token-is-not-supported");
    });

    it("Should allow withdraw by redeemer", async function () {
      await treasury.updateRedeemer(signers[3].address);
      await mintVUSD(USDT_ADDRESS, signers[3]);
      const amountToWithdraw = ethers.utils.parseUnits("1000", "mwei"); // 1000 USDT
      const USDT = await ethers.getContractAt("ERC20", USDT_ADDRESS);
      expect(await USDT.balanceOf(signers[3].address)).to.be.eq(0, "Governor balance should be zero");
      await treasury.connect(signers[3])["withdraw(address,uint256)"](USDT_ADDRESS, amountToWithdraw);
      expect(await USDT.balanceOf(signers[3].address)).to.be.eq(amountToWithdraw, "Incorrect USDT balance");
    });

    /* eslint-disable no-unexpected-multiline */
    it("Should allow withdraw to another address by redeemer", async function () {
      await treasury.updateRedeemer(signers[3].address);
      await mintVUSD(DAI_ADDRESS, signers[4]);
      const amountToWithdraw = ethers.utils.parseUnits("1000", "ether"); // 1000 DAI
      const DAI = await ethers.getContractAt("ERC20", DAI_ADDRESS);
      expect(await DAI.balanceOf(signers[5].address)).to.be.eq(0, "User balance should be zero");

      await treasury
        .connect(signers[3])
        ["withdraw(address,uint256,address)"](DAI_ADDRESS, amountToWithdraw, signers[5].address);
      expect(await DAI.balanceOf(signers[5].address)).to.be.eq(amountToWithdraw, "Incorrect DAI balance");
    });

    it("Should allow withdraw by governor", async function () {
      await mintVUSD(USDC_ADDRESS, signers[2]);
      const amountToWithdraw = ethers.utils.parseUnits("1000", "mwei"); // 1000 USDC
      const USDC = await ethers.getContractAt("ERC20", USDC_ADDRESS);
      expect(await USDC.balanceOf(signers[0].address)).to.be.eq(0, "Governor balance should be zero");
      await treasury["withdraw(address,uint256)"](USDC_ADDRESS, amountToWithdraw);
      expect(await USDC.balanceOf(signers[0].address)).to.be.eq(amountToWithdraw, "Incorrect USDC balance");
    });
  });

  context("WithdrawMulti by governor", function () {
    it("Should allow withdrawMulti by governor", async function () {
      await mintVUSD(DAI_ADDRESS, signers[2]);
      const amountToWithdraw = ethers.utils.parseUnits("1000", "ether"); // 1000 DAI
      const DAI = await ethers.getContractAt("ERC20", DAI_ADDRESS);
      const balanceBefore = await DAI.balanceOf(signers[0].address);
      await treasury.withdrawMulti([DAI_ADDRESS], [amountToWithdraw]);
      const balanceAfter = await DAI.balanceOf(signers[0].address);
      expect(balanceAfter).to.be.eq(balanceBefore.add(amountToWithdraw), "Incorrect DAI balance");
    });

    it("Should revert withdrawMulti if inputs are bad", async function () {
      const tx = treasury.withdrawMulti([DAI_ADDRESS], []);
      await expect(tx).to.be.revertedWith("input-length-mismatch");
    });
  });

  context("WithdrawAll by governor", function () {
    it("Should allow withdrawAll by governor", async function () {
      await mintVUSD(DAI_ADDRESS, signers[2]);
      const DAI = await ethers.getContractAt("ERC20", DAI_ADDRESS);
      const balanceBefore = await DAI.balanceOf(signers[0].address);
      const withdrawable = await treasury.withdrawable(DAI_ADDRESS);
      await treasury.withdrawAll([DAI_ADDRESS]);
      const balanceAfter = await DAI.balanceOf(signers[0].address);
      // Checking gte as actual will be having little extra due to earning from 1 block
      expect(balanceAfter).to.be.gte(balanceBefore.add(withdrawable), "Incorrect DAI balance");
    });

    it("Should revert withdrawAll if token is not supported", async function () {
      const tx = treasury.withdrawAll([WETH_ADDRESS]);
      await expect(tx).to.be.revertedWith("token-is-not-supported");
    });
  });

  context("Claim COMP", function () {
    it("Should claim comp from all cToken markets", async function () {
      await mintVUSD(DAI_ADDRESS, signers[4], "100");
      await mineBlocks(1000);
      const cUSDC = await ethers.getContractAt("ERC20", cUSDC_ADDRESS);
      expect(await cUSDC.balanceOf(treasury.address)).to.be.eq(0, "cUSDC balance should be zero");
      await treasury.claimCompAndConvertTo(USDC_ADDRESS);
      expect(await cUSDC.balanceOf(treasury.address)).to.be.gt(0, "cUSDC balance should be > 0");
    });

    it("Should revert if token is not supported", async function () {
      const tx = treasury.claimCompAndConvertTo(WETH_ADDRESS);
      await expect(tx).to.be.revertedWith("token-is-not-supported");
    });
  });


  context("Sweep token", function () {
    it("Should sweep token", async function () {
      const daiAmount = await tokenSwapper.swapEthForToken("1", DAI_ADDRESS, signers[5], treasury.address);
      const DAI = await ethers.getContractAt("ERC20", DAI_ADDRESS);
      const balanceBefore = await DAI.balanceOf(signers[0].address);
      await treasury.sweep(DAI_ADDRESS);
      const balanceAfter = await DAI.balanceOf(signers[0].address);
      await treasury.claimCompAndConvertTo(USDC_ADDRESS);
      expect(balanceAfter.sub(balanceBefore)).to.be.eq(daiAmount, "Sweep token amount is not correct");
    });

    it("Should revert if trying to sweep cToken", async function () {
      const tx = treasury.sweep(cDAI_ADDRESS);
      await expect(tx).to.be.revertedWith("cToken-is-not-allowed-to-sweep");
    });
  });

  context("Update redeemer", function () {
    it("Should revert if caller is not governor", async function () {
      const tx = treasury.connect(signers[4]).updateRedeemer(signers[9].address);
      await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
    });
    it("Should revert if setting zero address as redeemer", async function () {
      const tx = treasury.updateRedeemer(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("redeemer-address-is-zero");
    });

    it("Should add new redeemer", async function () {
      const redeemer = await treasury.redeemer();
      const newRedeemer = signers[9].address;
      const tx = treasury.updateRedeemer(newRedeemer);
      await expect(tx).to.emit(treasury, "UpdatedRedeemer").withArgs(redeemer, newRedeemer);
      expect(await treasury.redeemer()).to.eq(newRedeemer, "Redeemer update failed");
    });

    it("Should revert if setting same redeemer", async function () {
      await treasury.updateRedeemer(signers[9].address);
      const tx = treasury.updateRedeemer(signers[9].address);
      await expect(tx).to.be.revertedWith("same-redeemer");
    });
  });

  context("Update swap manager", function () {
    it("Should revert if caller is not governor", async function () {
      const tx = treasury.connect(signers[4]).updateSwapManager(signers[7].address);
      await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
    });
    it("Should revert if setting zero address as swap manager", async function () {
      const tx = treasury.updateSwapManager(ZERO_ADDRESS);
      await expect(tx).to.be.revertedWith("swap-manager-address-is-zero");
    });

    it("Should add new swap manager", async function () {
      const swapManager = await treasury.swapManager();
      const newSwapManager = swapManager;
      const tx = treasury.updateSwapManager(newSwapManager);
      await expect(tx).to.emit(treasury, "UpdatedSwapManager").withArgs(swapManager, newSwapManager);
      expect(await treasury.swapManager()).to.eq(newSwapManager, "Swap manager update failed");
    });
  });

  context("Update token whitelist", function () {
    let addressList, cTokenAddressList;
    beforeEach(async function () {
      const tokenWhitelist = await treasury.whitelistedTokens();
      addressList = await ethers.getContractAt("IAddressList", tokenWhitelist);

      const cTokenList = await treasury.cTokenList();
      cTokenAddressList = await ethers.getContractAt("IAddressList", cTokenList);
    });
    context("Add token in whitelist", function () {
      it("Should revert if caller is not governor", async function () {
        const tx = treasury.connect(signers[4]).addWhitelistedToken(DAI_ADDRESS, cDAI_ADDRESS);
        await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
      });

      it("Should revert if setting zero address for token", async function () {
        const tx = treasury.addWhitelistedToken(ZERO_ADDRESS, cETH_ADDRESS);
        await expect(tx).to.be.revertedWith("token-address-is-zero");
      });

      it("Should revert if setting zero address for cToken", async function () {
        const tx = treasury.addWhitelistedToken(WETH_ADDRESS, ZERO_ADDRESS);
        await expect(tx).to.be.revertedWith("cToken-address-is-zero");
      });

      it("Should add token address in whitelist", async function () {
        await treasury.addWhitelistedToken(WETH_ADDRESS, cETH_ADDRESS);
        expect(await addressList.length()).to.be.equal("4", "Address added successfully");
        expect(await cTokenAddressList.length()).to.be.equal("4", "cToken address added successfully");
        expect(await treasury.cTokens(WETH_ADDRESS)).to.be.eq(cETH_ADDRESS, "Wrong cToken");
      });

      it("Should revert if address already exist in list", async function () {
        await expect(treasury.addWhitelistedToken(DAI_ADDRESS, cDAI_ADDRESS)).to.be.revertedWith("add-in-list-failed");
      });
    });
    context("Remove token address from whitelist", function () {
      it("Should revert if caller is not governor", async function () {
        const tx = treasury.connect(signers[4]).removeWhitelistedToken(DAI_ADDRESS);
        await expect(tx).to.be.revertedWith("caller-is-not-the-governor");
      });

      it("Should remove token from whitelist", async function () {
        await treasury.removeWhitelistedToken(DAI_ADDRESS);
        expect(await addressList.length()).to.be.equal("2", "Address removed successfully");
        expect(await cTokenAddressList.length()).to.be.equal("2", "cToken address removed successfully");
        expect(await treasury.cTokens(DAI_ADDRESS)).to.be.eq(ZERO_ADDRESS, "CToken should be removed");
      });

      it("Should revert if token not in list", async function () {
        await expect(treasury.removeWhitelistedToken(WETH_ADDRESS)).to.be.revertedWith("remove-from-list-failed");
      });
    });
  });
});
