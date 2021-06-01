import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const name = "Treasury";
const vusd = "VUSD";
const redeemer = "Redeemer";
let version;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, execute} = deployments;

  const {deployer} = await getNamedAccounts();
  const vusdDeployment = await deployments.get(vusd);

  const deployed = await deploy(name, {
    from: deployer,
    args: [vusdDeployment.address],
    log: true,
  });

  const treasury = await hre.ethers.getContractAt(name, deployed.address);

  // Update treasury in VUSD
  await execute(vusd, {from: deployer, log: true}, "updateTreasury", treasury.address);

  //Update redeemer in treasury
  const redeemerDeployment = await deployments.get(redeemer);
  await execute(name, {from: deployer, log: true}, "updateRedeemer", redeemerDeployment.address);

  version = await treasury.VERSION();
};

export default func;
func.id = `${name}-${version}`;
func.tags = [name];
func.dependencies = [redeemer];
