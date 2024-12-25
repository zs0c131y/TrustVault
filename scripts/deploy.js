async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    "Account balance:",
    await ethers.provider.getBalance(deployer.address)
  );

  const PropertyRegistry = await ethers.getContractFactory("PropertyRegistry");
  const propertyRegistry = await PropertyRegistry.deploy();

  // Wait for the deployment transaction to be mined
  await propertyRegistry.waitForDeployment();

  // Get the deployed contract address
  const contractAddress = await propertyRegistry.getAddress();
  console.log("PropertyRegistry deployed to:", contractAddress);

  // Store the contract addresses for frontend use
  const fs = require("fs");
  const contractsDir = __dirname + "/../public/contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify({ PropertyRegistry: contractAddress }, undefined, 2)
  );

  // Also save the contract ABI
  const artifact = require("../artifacts/contracts/PropertyRegistry.sol/PropertyRegistry.json");
  fs.writeFileSync(
    contractsDir + "/PropertyRegistry.json",
    JSON.stringify(artifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
