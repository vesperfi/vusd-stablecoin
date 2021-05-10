import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";

const name = "VirtualDollar";
const version = "v1.0.0";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, treasury} = await getNamedAccounts();

  await deploy(name, {
    from: deployer,
    args: [treasury],
    log: true,
  });
};
export default func;
func.tags = [`${name}-${version}`];
