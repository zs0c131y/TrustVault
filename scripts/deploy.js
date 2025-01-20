const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment...");

  // Ensure the contract artifacts directory exists
  const artifactsDir = path.join(__dirname, "../public/contracts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Deploy the contract
  const PropertyRegistry = await hre.ethers.getContractFactory(
    "PropertyRegistry"
  );
  const propertyRegistry = await PropertyRegistry.deploy();
  await propertyRegistry.waitForDeployment();

  const address = await propertyRegistry.getAddress();
  console.log("PropertyRegistry deployed to:", address);

  // Save the contract address
  const addressFile = path.join(artifactsDir, "contract-address.json");
  fs.writeFileSync(
    addressFile,
    JSON.stringify({ PropertyRegistry: address }, null, 2)
  );
  console.log("Contract address saved to:", addressFile);

  // Copy the contract artifact
  const artifactSource = path.join(
    hre.config.paths.artifacts,
    "contracts/PropertyRegistry.sol/PropertyRegistry.json"
  );
  const artifactDest = path.join(
    artifactsDir,
    "contracts/PropertyRegistry.sol/PropertyRegistry.json"
  );

  // Ensure the destination directory exists
  fs.mkdirSync(path.dirname(artifactDest), { recursive: true });
  fs.copyFileSync(artifactSource, artifactDest);
  console.log("Contract artifact copied to:", artifactDest);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
