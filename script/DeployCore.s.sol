// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/contract/MarketAsset.sol";

/**
 * @title DeployCore
 * @notice Deploy only core contracts (Asset + Fractionalizer + License system)
 * @dev Useful for phased deployment or testing core functionality
 *
 * Usage:
 *   forge script script/DeployCore.s.sol --rpc-url http://localhost:8545 --broadcast
 */
contract DeployCore is Script {
    AssetNFT public assetNft;
    AssetRegistry public registry;
    Fractionalizer public fractionalizer;
    LicenseNFT public licenseNft;
    LicenseManager public licenseManager;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("Lixa Core Deployment");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance / 1e18, "ETH");
        console.log("========================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy core contracts
        console.log("Deploying core contracts...\n");

        assetNft = new AssetNFT("Lixa Asset", "LIXA");
        console.log("1. AssetNFT:       ", address(assetNft));

        registry = new AssetRegistry(address(assetNft));
        console.log("2. AssetRegistry:  ", address(registry));

        assetNft.setRegistry(address(registry));
        console.log("   - Permissions set");

        fractionalizer = new Fractionalizer(address(registry));
        console.log("3. Fractionalizer: ", address(fractionalizer));

        licenseNft = new LicenseNFT("Lixa License", "LIXLIC");
        console.log("4. LicenseNFT:     ", address(licenseNft));

        licenseManager =
            new LicenseManager(address(registry), address(licenseNft), address(fractionalizer));
        console.log("5. LicenseManager: ", address(licenseManager));

        licenseNft.setManager(address(licenseManager));
        console.log("   - Permissions set");

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("CORE DEPLOYMENT COMPLETE!");
        console.log("========================================\n");

        // Save addresses
        string memory addresses = string.concat(
            "# Lixa Core Contracts\n\n",
            "Network: ",
            vm.toString(block.chainid),
            "\n",
            "Deployer: ",
            vm.toString(deployer),
            "\n\n",
            "AssetNFT: ",
            vm.toString(address(assetNft)),
            "\n",
            "AssetRegistry: ",
            vm.toString(address(registry)),
            "\n",
            "Fractionalizer: ",
            vm.toString(address(fractionalizer)),
            "\n",
            "LicenseNFT: ",
            vm.toString(address(licenseNft)),
            "\n",
            "LicenseManager: ",
            vm.toString(address(licenseManager)),
            "\n"
        );

        vm.writeFile("deployments/core.txt", addresses);
        console.log("Addresses saved to: deployments/core.txt\n");
    }
}
