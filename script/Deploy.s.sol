// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/contract/MarketAsset.sol";
import "../src/contract/SecondaryMarket.sol";

/**
 * @title Deploy
 * @notice Complete deployment script for Lixa - License Exchange for Game Assets
 * @dev Deploys all contracts in correct order with proper setup
 *
 * Usage:
 * 1. Local/Anvil:
 *    forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
 *
 * 2. Testnet (e.g., Sepolia):
 *    forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
 *
 * 3. Mainnet:
 *    forge script script/Deploy.s.sol --rpc-url $MAINNET_RPC_URL --broadcast --verify --slow
 */
contract Deploy is Script {
    // Deployed contract addresses (will be set during deployment)
    AssetNFT public assetNft;
    AssetRegistry public registry;
    Fractionalizer public fractionalizer;
    LicenseNFT public licenseNft;
    LicenseManager public licenseManager;
    SecondaryMarket public secondaryMarket;

    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("Lixa Deployment Script");
        console.log("========================================");
        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance / 1e18, "ETH");
        console.log("Chain ID:", block.chainid);
        console.log("========================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // ==============================================
        // STEP 1: Deploy AssetNFT
        // ==============================================
        console.log("1. Deploying AssetNFT...");
        assetNft = new AssetNFT("Lixa Asset", "LIXA");
        console.log("   AssetNFT deployed at:", address(assetNft));

        // ==============================================
        // STEP 2: Deploy AssetRegistry
        // ==============================================
        console.log("\n2. Deploying AssetRegistry...");
        registry = new AssetRegistry(address(assetNft));
        console.log("   AssetRegistry deployed at:", address(registry));

        // ==============================================
        // STEP 3: Setup AssetNFT permissions
        // ==============================================
        console.log("\n3. Setting up AssetNFT permissions...");
        assetNft.setRegistry(address(registry));
        console.log("   AssetNFT.registry set to:", address(registry));

        // ==============================================
        // STEP 4: Deploy Fractionalizer
        // ==============================================
        console.log("\n4. Deploying Fractionalizer...");
        fractionalizer = new Fractionalizer(address(registry));
        console.log("   Fractionalizer deployed at:", address(fractionalizer));

        // ==============================================
        // STEP 5: Deploy LicenseNFT
        // ==============================================
        console.log("\n5. Deploying LicenseNFT...");
        licenseNft = new LicenseNFT("Lixa License", "LIXLIC");
        console.log("   LicenseNFT deployed at:", address(licenseNft));

        // ==============================================
        // STEP 6: Deploy LicenseManager
        // ==============================================
        console.log("\n6. Deploying LicenseManager...");
        licenseManager = new LicenseManager(
            address(registry),
            address(licenseNft),
            address(fractionalizer)
        );
        console.log("   LicenseManager deployed at:", address(licenseManager));

        // ==============================================
        // STEP 7: Setup LicenseNFT permissions
        // ==============================================
        console.log("\n7. Setting up LicenseNFT permissions...");
        licenseNft.setManager(address(licenseManager));
        console.log("   LicenseNFT.manager set to:", address(licenseManager));

        // ==============================================
        // STEP 8: Deploy SecondaryMarket
        // ==============================================
        console.log("\n8. Deploying SecondaryMarket...");
        secondaryMarket = new SecondaryMarket();
        console.log("   SecondaryMarket deployed at:", address(secondaryMarket));

        vm.stopBroadcast();

        // ==============================================
        // DEPLOYMENT SUMMARY
        // ==============================================
        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("========================================");
        console.log("AssetNFT:        ", address(assetNft));
        console.log("AssetRegistry:   ", address(registry));
        console.log("Fractionalizer:  ", address(fractionalizer));
        console.log("LicenseNFT:      ", address(licenseNft));
        console.log("LicenseManager:  ", address(licenseManager));
        console.log("SecondaryMarket: ", address(secondaryMarket));
        console.log("========================================");

        // Save addresses to file
        string memory addresses = string.concat(
            "# Lixa Deployed Contracts\n\n",
            "Network: ", vm.toString(block.chainid), "\n",
            "Deployer: ", vm.toString(deployer), "\n\n",
            "## Core Contracts\n",
            "AssetNFT: ", vm.toString(address(assetNft)), "\n",
            "AssetRegistry: ", vm.toString(address(registry)), "\n",
            "Fractionalizer: ", vm.toString(address(fractionalizer)), "\n\n",
            "## License System\n",
            "LicenseNFT: ", vm.toString(address(licenseNft)), "\n",
            "LicenseManager: ", vm.toString(address(licenseManager)), "\n\n",
            "## Secondary Market\n",
            "SecondaryMarket: ", vm.toString(address(secondaryMarket)), "\n"
        );

        vm.writeFile("deployments/latest.txt", addresses);
        console.log("\nAddresses saved to: deployments/latest.txt");
    }
}
