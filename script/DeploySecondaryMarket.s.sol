// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/contract/SecondaryMarket.sol";

/**
 * @title DeploySecondaryMarket
 * @notice Deploy SecondaryMarket separately (for phased deployment)
 * @dev Can be deployed after core contracts are live
 *
 * Usage:
 *   forge script script/DeploySecondaryMarket.s.sol --rpc-url $RPC_URL --broadcast
 */
contract DeploySecondaryMarket is Script {
    SecondaryMarket public secondaryMarket;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("Deploying SecondaryMarket");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("========================================\n");

        vm.startBroadcast(deployerPrivateKey);

        secondaryMarket = new SecondaryMarket();
        console.log("SecondaryMarket deployed at:", address(secondaryMarket));

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("========================================\n");

        // Save address
        string memory addresses = string.concat(
            "# SecondaryMarket\n\n",
            "Network: ",
            vm.toString(block.chainid),
            "\n",
            "Deployer: ",
            vm.toString(deployer),
            "\n\n",
            "SecondaryMarket: ",
            vm.toString(address(secondaryMarket)),
            "\n"
        );

        vm.writeFile("deployments/secondary-market.txt", addresses);
        console.log("Address saved to: deployments/secondary-market.txt\n");
    }
}
