import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const name = "Minter";
let version;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  const dvDeployment = await deployments.get("VirtualDollar");
  const DV = await hre.ethers.getContractAt("VirtualDollar", dvDeployment.address);

  const deployed = await deploy(name, {
    from: deployer,
    args: [DV.address],
    log: true,
  });

  const minter = await hre.ethers.getContractAt(name, deployed.address);
  await DV.updateMiner(minter.address);

  version = await minter.VERSION();
};

export default func;
func.tags = [`${name}-${version}`];
