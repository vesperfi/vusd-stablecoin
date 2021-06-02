import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const name = "VUSD";
const version = "v1.0.0";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();
  await deploy(name, {
    from: deployer,
    args: [deployer],
    log: true,
  });
};
export default func;
func.id = `${name}-${version}`;
func.tags = [name];
