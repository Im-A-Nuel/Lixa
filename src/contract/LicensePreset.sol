// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LicensePreset
 * @notice Defines preset license types for Lixa - License Exchange for Game Assets
 * @dev Provides standardized, clear license terms for different use cases
 *
 * Lixa: "License. Fraction. Earn."
 * Program your royalties with on-chain license management.
 */
library LicensePreset {
    // Preset license types for game assets
    enum PresetType {
        CUSTOM, // Custom terms (backwards compatibility)
        IN_GAME_COMMERCIAL_V1, // Commercial game usage
        TRAILER_MARKETING_V1, // Marketing/promotional materials only
        EDU_INDIE_V1 // Educational/indie with revenue cap
    }

    // License terms metadata
    struct Terms {
        string name; // Human-readable name
        string description; // Brief description
        bool commercialUse; // Allow commercial use
        bool inGameUse; // Allow in-game usage
        bool marketingUse; // Allow in marketing materials
        bool modificationAllowed; // Can modify the asset
        bool resaleAllowed; // Can resell raw asset
        bool attributionRequired; // Must credit creator
        bool transferable; // License can be transferred
        uint256 revenueCap; // Revenue limit (0 = unlimited, in wei for simplicity)
        string additionalTermsURI; // IPFS link to full legal terms
    }

    /**
     * @notice Get preset license terms
     * @param preset The preset type
     * @return Terms struct with all license conditions
     */
    function getPresetTerms(PresetType preset) internal pure returns (Terms memory) {
        if (preset == PresetType.IN_GAME_COMMERCIAL_V1) {
            return Terms({
                name: "In-Game Commercial License v1",
                description: "Full commercial usage rights for game integration",
                commercialUse: true,
                inGameUse: true,
                marketingUse: true, // Can also use in marketing
                modificationAllowed: true,
                resaleAllowed: false, // Cannot resell raw asset
                attributionRequired: true,
                transferable: false, // License bound to buyer
                revenueCap: 0, // No revenue limit
                additionalTermsURI: "ipfs://QmCommercialTermsV1" // Placeholder
            });
        } else if (preset == PresetType.TRAILER_MARKETING_V1) {
            return Terms({
                name: "Trailer/Marketing License v1",
                description: "For promotional materials only, not in-game usage",
                commercialUse: true,
                inGameUse: false, // NOT allowed in actual game
                marketingUse: true,
                modificationAllowed: true,
                resaleAllowed: false,
                attributionRequired: true,
                transferable: false,
                revenueCap: 0,
                additionalTermsURI: "ipfs://QmMarketingTermsV1" // Placeholder
            });
        } else if (preset == PresetType.EDU_INDIE_V1) {
            return Terms({
                name: "Educational/Indie License v1",
                description: "Discounted license for students and indie developers with revenue cap",
                commercialUse: true, // Can sell game, but with revenue cap
                inGameUse: true,
                marketingUse: true,
                modificationAllowed: true,
                resaleAllowed: false,
                attributionRequired: true,
                transferable: false, // Non-transferable
                revenueCap: 100000 ether, // Example: 100k USD equivalent (adjust decimals as needed)
                additionalTermsURI: "ipfs://QmEduIndieTermsV1" // Placeholder
            });
        } else {
            // CUSTOM - return empty terms (must be filled by creator)
            return Terms({
                name: "Custom License",
                description: "Custom terms defined by creator",
                commercialUse: false,
                inGameUse: false,
                marketingUse: false,
                modificationAllowed: false,
                resaleAllowed: false,
                attributionRequired: false,
                transferable: false,
                revenueCap: 0,
                additionalTermsURI: ""
            });
        }
    }

    /**
     * @notice Get human-readable summary of license rights
     * @param preset The preset type
     * @return Array of right descriptions
     */
    function getRightsSummary(PresetType preset) internal pure returns (string[5] memory) {
        if (preset == PresetType.IN_GAME_COMMERCIAL_V1) {
            return [
                "Commercial game usage allowed",
                "Can modify and integrate",
                "Marketing materials allowed",
                "Attribution required",
                "Cannot resell raw asset"
            ];
        } else if (preset == PresetType.TRAILER_MARKETING_V1) {
            return [
                "Marketing/trailer use only",
                "NOT for in-game usage",
                "Can modify for promos",
                "Attribution required",
                "Cannot resell raw asset"
            ];
        } else if (preset == PresetType.EDU_INDIE_V1) {
            return [
                "Indie/educational use",
                "Revenue cap: $100k/year",
                "Full game integration",
                "Non-transferable license",
                "Attribution required"
            ];
        } else {
            return ["Custom terms", "See full license details", "", "", ""];
        }
    }

    /**
     * @notice Check if preset allows specific use case
     * @param preset The preset type
     * @param useCase Use case identifier (0=commercial, 1=in-game, 2=marketing, 3=modification)
     * @return bool Whether the use case is allowed
     */
    function isAllowed(PresetType preset, uint8 useCase) internal pure returns (bool) {
        Terms memory terms = getPresetTerms(preset);

        if (useCase == 0) return terms.commercialUse;
        if (useCase == 1) return terms.inGameUse;
        if (useCase == 2) return terms.marketingUse;
        if (useCase == 3) return terms.modificationAllowed;

        return false;
    }

    /**
     * @notice Validate that revenue doesn't exceed cap for EDU/INDIE licenses
     * @param preset The preset type
     * @param revenue Current revenue
     * @return bool Whether revenue is within allowed limits
     */
    function validateRevenueCap(PresetType preset, uint256 revenue) internal pure returns (bool) {
        Terms memory terms = getPresetTerms(preset);

        // If no cap (0), always valid
        if (terms.revenueCap == 0) return true;

        // Check if revenue is within cap
        return revenue <= terms.revenueCap;
    }
}
