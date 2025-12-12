# Lixa Documentation - License Exchange for Game Assets

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Smart Contracts](#smart-contracts)
4. [License System](#license-system)
5. [User Flows](#user-flows)
6. [Tech Stack](#tech-stack)
7. [Installation Guide](#installation-guide)
8. [Usage Guide](#usage-guide)
9. [Testing](#testing)
10. [Security](#security)

---

## 📖 Introduction

### What is Lixa?

**Lixa** is a marketplace for game assets with on-chain licensing and programmable royalties that can be fractionalized and claimed in real-time. With the tagline **"License. Fraction. Earn."**, Lixa enables:

- **Creators** to register assets as on-chain IP with ready-to-use licenses
- **Investors** to purchase fractional tokens for a share of royalty streams
- **License Buyers** to receive on-chain proof of ownership (License NFT)
- **All Parties** to receive transparent revenue sharing from the vault

### Key Features

✅ **Programmable Licensing**: 3 preset licenses (Commercial, Marketing, Edu/Indie)  
✅ **Fractional Royalty**: Split revenue streams into ERC-20 tokens  
✅ **On-chain Receipts**: License NFT as proof of purchase  
✅ **Automatic Distribution**: Claim royalties anytime, pro-rata  
✅ **Transparent & Auditable**: All transactions on-chain

### Problems Solved

1. **License Ambiguity**: Standardized, clear preset licenses
2. **Manual Royalty Payments**: Automated via smart contracts
3. **Lack of Liquidity**: Fractionalization enables small-scale investment
4. **Complex Tracking**: Transparent on-chain records
5. **Barrier to Entry**: Lower costs for indie developers

---

## 🏗️ System Architecture

### Architecture Diagram

```
┌─────────────────┐
│   Creator UI    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      AssetRegistry Contract         │
│  - Register Asset                   │
│  - Mint AssetNFT                    │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│    Fractionalizer Contract          │
│  - Lock NFT                         │
│  - Mint Fractional Tokens           │
│  - Manage Royalty Vault             │
│  - Distribute Dividends             │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│    LicenseManager Contract          │
│  - Create License Offers            │
│  - Sell Licenses                    │
│  - Mint License NFT                 │
│  - Forward Payment to Vault         │
└─────────────────────────────────────┘
```

### Core Components

1. **AssetNFT**: ERC-721 representing IP asset ownership
2. **FractionalToken**: ERC-20 representing fractional royalty ownership
3. **AssetRegistry**: Game asset registration and management
4. **Fractionalizer**: Fractionalization mechanism and royalty vault
5. **LicenseManager**: License sales and management
6. **LicenseNFT**: ERC-721 as proof of license purchase

---

## 🔐 Smart Contracts

### 1. AssetNFT

**Location**: `src/contract/MarketAsset.sol:45-71`  
**Type**: ERC-721

**Main Functions**:
```solidity
constructor(address initialOwner, string memory _name, string memory _symbol)
```

**Description**: NFT representing IP asset ownership. Automatically minted when creators register assets.

**Metadata**:
- Token ID
- Metadata CID (IPFS)
- Creator address
- Timestamp

---

### 2. FractionalToken

**Location**: `src/contract/MarketAsset.sol:74-100`  
**Type**: ERC-20 Burnable

**Main Functions**:
```solidity
constructor(
    address initialOwner,
    string memory _name,
    string memory _symbol,
    uint256 _initialSupply
)

function burn(uint256 amount) public override
```

**Description**: Token representing fractional ownership of asset royalty streams. One token type per asset.

**Properties**:
- Burnable (for recombination)
- Transferable
- Pro-rata dividend rights

---

### 3. AssetRegistry

**Location**: `src/contract/MarketAsset.sol:103-166`

**Main Functions**:
```solidity
function registerAsset(
    string memory metadataCID,
    uint256 royaltyPercentage
) external returns (uint256)

function getAssetInfo(uint256 assetId) 
    external view returns (AssetInfo memory)
```

**Description**: Contract for registering game assets (3D models, sprites, music, UI kits).

**Data Structure**:
```solidity
struct AssetInfo {
    address creator;
    uint256 royaltyPercentage;
    string metadataCID;
    uint256 timestamp;
    bool fractionalized;
}
```

**Flow**:
1. Creator calls `registerAsset()` with metadata CID and royalty percentage
2. Contract mints new AssetNFT
3. AssetInfo stored with assetId
4. `AssetRegistered` event emitted

---

### 4. Fractionalizer

**Location**: `src/contract/MarketAsset.sol:177-436`

**Main Functions**:

**a. Fractionalization**:
```solidity
function fractionalize(
    uint256 assetId,
    uint256 totalSupply,
    uint256 pricePerToken,
    string memory tokenName,
    string memory tokenSymbol
) external
```

**b. Primary Sale**:
```solidity
function buyFractions(uint256 assetId, uint256 amount) 
    external payable
```

**c. Dividend Distribution**:
```solidity
function claimDividends(uint256 assetId) external

function depositRoyalty(uint256 assetId) 
    external payable
```

**d. Recombination**:
```solidity
function recombine(uint256 assetId) external
```

**Royalty Vault Mechanism**:

```solidity
// Dividend accounting
uint256 public dividendsPerToken;
mapping(address => uint256) public lastDividendsPerToken;

// Calculation
uint256 newDividends = currentDPT - lastDPT[user];
uint256 owed = balance[user] * newDividends;
```

**Fractionalization Flow**:
1. Creator locks AssetNFT into Fractionalizer
2. Contract mints fractional ERC-20 tokens
3. Sets primary sale price
4. Tokens available for purchase
5. Payments go to royalty vault
6. Holders can claim dividends anytime

---

### 5. LicenseManager

**Location**: `src/contract/MarketAsset.sol:474-694`

**Main Functions**:

**a. Create License Offer**:
```solidity
function createLicenseOffer(
    uint256 assetId,
    LicensePreset.LicenseType licenseType,
    uint256 price
) external
```

**b. Buy License**:
```solidity
function buyLicense(
    uint256 assetId,
    LicensePreset.LicenseType licenseType
) external payable returns (uint256)
```

**c. Verify License**:
```solidity
function verifyLicense(
    uint256 licenseTokenId,
    LicensePreset.LicenseType expectedType
) external view returns (bool)
```

**Data Structures**:
```solidity
struct LicenseOffer {
    uint256 assetId;
    LicensePreset.LicenseType licenseType;
    uint256 price;
    bool active;
}

struct LicenseInfo {
    uint256 assetId;
    LicensePreset.LicenseType licenseType;
    address licensee;
    uint256 purchaseTime;
}
```

**Flow**:
1. Creator creates license offer with preset type & price
2. Buyer purchases license
3. LicenseNFT minted as proof of purchase
4. Payment forwarded to Fractionalizer vault
5. Dividends distributed to fraction holders

---

### 6. LicensePreset Library

**Location**: `src/contract/LicensePreset.sol`

**Enum Types**:
```solidity
enum LicenseType {
    IN_GAME_COMMERCIAL_V1,
    TRAILER_MARKETING_V1,
    EDU_INDIE_V1
}
```

**Functions**:
```solidity
function getTerms(LicenseType licenseType) 
    internal pure returns (string memory)

function canUseInGame(LicenseType licenseType) 
    internal pure returns (bool)

function hasRevenueCap(LicenseType licenseType) 
    internal pure returns (bool)

function isTransferable(LicenseType licenseType) 
    internal pure returns (bool)
```

---

## 📜 License System

### License Preset Overview

| Preset | Target User | In-Game Use | Marketing | Revenue Cap | Price Range |
|--------|-------------|-------------|-----------|-------------|-------------|
| **IN_GAME_COMMERCIAL** | AAA/Mid-tier Studios | ✅ Unlimited | ✅ Yes | ❌ None | 0.5 - 2 ETH |
| **TRAILER_MARKETING** | Marketing Agencies | ❌ No | ✅ Only | ❌ None | 0.1 - 0.3 ETH |
| **EDU_INDIE** | Students/Indie | ✅ Yes | ✅ Yes | ✅ $100k/year | 0.02 - 0.05 ETH |

---

### 1. IN_GAME_COMMERCIAL_V1

**Target**: Commercial game studios (AAA, mid-tier, commercial indie)

**Rights Granted**:
- ✅ Commercial game usage (unlimited revenue)
- ✅ In-game integration & modification
- ✅ Use in marketing materials
- ✅ Transferable license
- ❌ Cannot resell raw asset

**Obligations**:
- 📝 Attribution required (credit creator)
- 🔒 Non-sublicensable

**Use Case**:
```
Studio purchases 3D dragon model for their Steam game.
✅ Use in game
✅ Modify textures
✅ Feature in trailer and posters
✅ Sell game with unlimited revenue
❌ Cannot sell raw model on marketplace
```

**Validation**:
```solidity
require(canUseInGame(LicenseType.IN_GAME_COMMERCIAL_V1), "Invalid use");
require(!hasRevenueCap(LicenseType.IN_GAME_COMMERCIAL_V1), "No revenue limit");
```

---

### 2. TRAILER_MARKETING_V1

**Target**: Marketing agencies, content creators, game influencers

**Rights Granted**:
- ✅ Promotional materials (trailers, posters, social media)
- ✅ Modification for promotional needs
- ✅ Transferable license
- ❌ **NOT for in-game usage**

**Obligations**:
- 📝 Attribution required
- 🎯 Marketing-only usage
- 🔒 Non-sublicensable

**Use Case**:
```
Marketing agency purchases city model for:
✅ Game trailer on YouTube
✅ Steam banner and promotional images
✅ Social media posts
❌ CANNOT use in actual game
```

**Validation**:
```solidity
require(!canUseInGame(LicenseType.TRAILER_MARKETING_V1), "Marketing only");
require(isTransferable(LicenseType.TRAILER_MARKETING_V1), "Can transfer");
```

---

### 3. EDU_INDIE_V1

**Target**: Students, hobbyists, small-scale indie developers

**Rights Granted**:
- ✅ Educational projects (thesis, portfolio)
- ✅ Indie games with revenue cap
- ✅ Full in-game integration
- ✅ Modification allowed
- ⚠️ **Revenue cap: $100,000/year**
- 🔒 **Non-transferable license**

**Obligations**:
- 📝 Attribution required
- 📊 Revenue reporting (if approaching cap)
- 🔒 Upgrade to Commercial if exceeding cap

**Use Case**:
```
Student uses for:
✅ Thesis game project
✅ Portfolio work
✅ Indie game on itch.io (<$100k revenue)
❌ CANNOT transfer license to others
⚠️ Must upgrade to Commercial if revenue >$100k
```

**Validation**:
```solidity
require(canUseInGame(LicenseType.EDU_INDIE_V1), "Can use in game");
require(hasRevenueCap(LicenseType.EDU_INDIE_V1), "Has revenue cap");
require(!isTransferable(LicenseType.EDU_INDIE_V1), "Non-transferable");
```

---

### License Comparison Matrix

#### Rights Comparison

| Feature | Commercial | Marketing | Edu/Indie |
|---------|-----------|-----------|-----------|
| In-game usage | ✅ Yes | ❌ No | ✅ Yes |
| Marketing materials | ✅ Yes | ✅ Yes | ✅ Yes |
| Modification | ✅ Full | ✅ Promo only | ✅ Full |
| Resale asset | ❌ No | ❌ No | ❌ No |
| Attribution | ✅ Required | ✅ Required | ✅ Required |
| Transferable | ✅ Yes | ✅ Yes | ❌ No |
| Revenue cap | ❌ None | ❌ None | ✅ $100k/year |

#### Pricing Strategy

```
Commercial: 0.5 - 2 ETH
├─ High-quality 3D models: 1-2 ETH
├─ Music/SFX packs: 0.5-1 ETH
└─ UI kits: 0.3-0.8 ETH

Marketing: 0.1 - 0.3 ETH
├─ Limited rights, lower price
└─ Volume sales expected

Edu/Indie: 0.02 - 0.05 ETH
├─ Affordable for students
├─ Revenue cap as compensation
└─ Volume sales, word-of-mouth
```

---

## 👥 User Flows

### 1. Creator Flow (Asset Owner)

```
Step 1: Upload Asset
├─ Upload file to IPFS
├─ Generate metadata JSON
└─ Get IPFS CID

Step 2: Register Asset
├─ Call AssetRegistry.registerAsset()
├─ Input: metadataCID, royaltyPercentage
├─ Output: assetId, AssetNFT minted
└─ Owner receives AssetNFT

Step 3: Fractionalize (Optional)
├─ Call Fractionalizer.fractionalize()
├─ Lock AssetNFT
├─ Mint 10,000 fractional tokens
├─ Set primary sale price
└─ List tokens for sale

Step 4: Create License Offers
├─ Commercial: 0.5 ETH
├─ Marketing: 0.1 ETH
└─ Edu/Indie: 0.02 ETH

Step 5: List on Marketplace
├─ Asset visible in Lixa UI
├─ Show preview & metadata
└─ Display license options
```

**Code Example**:
```solidity
// 1. Register asset
uint256 assetId = assetRegistry.registerAsset(
    "QmXYZ...abc123", // IPFS CID
    10  // 10% royalty
);

// 2. Fractionalize
fractionalizer.fractionalize(
    assetId,
    10000,  // 10k tokens
    0.01 ether,  // 0.01 ETH per token
    "Dragon Model Fractions",
    "DRAG"
);

// 3. Create license offers
licenseManager.createLicenseOffer(
    assetId,
    LicenseType.IN_GAME_COMMERCIAL_V1,
    0.5 ether
);
```

---

### 2. Buyer Flow (License Purchase)

```
Step 1: Browse Catalog
├─ View assets in Lixa marketplace
├─ Filter by category, price, license
└─ Preview asset & metadata

Step 2: Select Asset
├─ Click asset card
├─ View detailed info
├─ See available license types
└─ Check license terms

Step 3: Choose License
├─ Compare license presets
├─ Check rights summary
├─ See pricing
└─ Select appropriate license

Step 4: Purchase License
├─ Call LicenseManager.buyLicense()
├─ Send ETH payment
├─ Receive License NFT
└─ Get license confirmation

Step 5: Use Asset
├─ Download from IPFS
├─ Import to game engine
├─ Use according to license terms
└─ Provide attribution
```

**Code Example**:
```solidity
// Buy commercial license
uint256 licenseId = licenseManager.buyLicense{value: 0.5 ether}(
    assetId,
    LicenseType.IN_GAME_COMMERCIAL_V1
);

// Verify license
bool isValid = licenseManager.verifyLicense(
    licenseId,
    LicenseType.IN_GAME_COMMERCIAL_V1
);
```

---

### 3. Investor Flow (Fraction Holder)

```
Step 1: Browse Fractionalized Assets
├─ View assets with fractional tokens
├─ Check royalty history
├─ Analyze sales volume
└─ Review holder distribution

Step 2: Buy Fractions (Primary Sale)
├─ Check available supply
├─ See price per token
├─ Calculate potential ROI
└─ Purchase tokens

Step 3: Hold & Earn
├─ Licenses sold → payments to vault
├─ Royalties accumulate
├─ Track earnings in dashboard
└─ Watch asset performance

Step 4: Claim Dividends
├─ Call Fractionalizer.claimDividends()
├─ Receive pro-rata share
├─ Automatic calculation
└─ Gas-efficient pull model

Step 5: Trade (Secondary Market)
├─ Sell tokens on DEX
├─ Transfer to other investors
└─ Maintain dividend rights
```

**Code Example**:
```solidity
// Buy fractions (primary sale)
fractionalizer.buyFractions{value: 1 ether}(
    assetId,
    100  // buy 100 tokens
);

// Check claimable dividends
uint256 owed = fractionalizer.calculateOwed(assetId, msg.sender);

// Claim dividends
fractionalizer.claimDividends(assetId);
```

---

### 4. Royalty Distribution Flow

```
License Purchase Event:
├─ Buyer sends payment to LicenseManager
└─ LicenseManager forwards to Fractionalizer vault

Royalty Vault Update:
├─ depositRoyalty() called
├─ Update dividendsPerToken
├─ Dividends pro-rata per token
└─ All holders entitled to claim

Dividend Claim:
├─ Holder calls claimDividends()
├─ Calculate owed amount
├─ Update lastDividendsPerToken
├─ Transfer ETH to holder
└─ Emit DividendsClaimed event
```

**Dividend Math**:
```solidity
// Global tracking
uint256 public dividendsPerToken;

// Per-user tracking
mapping(address => uint256) public lastDividendsPerToken;

// On royalty deposit
dividendsPerToken += royaltyAmount / totalSupply;

// On claim
uint256 newDividends = dividendsPerToken - lastDividendsPerToken[user];
uint256 owed = balanceOf[user] * newDividends;
lastDividendsPerToken[user] = dividendsPerToken;
```

---

## 🛠️ Tech Stack

### Smart Contract Layer

**Framework**:
- **Solidity**: v0.8.24
- **Foundry**: Forge, Cast, Anvil
- **OpenZeppelin Contracts**: v5.x

**Configuration**:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = true
evm_version = "paris"
```

**Libraries**:
- OpenZeppelin ERC-721 (NFTs)
- OpenZeppelin ERC-20 (Fractional tokens)
- OpenZeppelin Ownable (Access control)
- OpenZeppelin ReentrancyGuard (Security)

---

### Storage & Data Layer

**IPFS**:
- Asset file storage
- Metadata JSON
- Pinning service (TBD: Pinata, NFT.Storage)

**On-chain**:
- License terms & rights
- Ownership records
- Royalty accounting
- Transaction history

**Metadata Schema**:
```json
{
  "name": "Dragon Model",
  "description": "High-poly dragon 3D model",
  "image": "ipfs://QmXYZ.../preview.png",
  "animation_url": "ipfs://QmXYZ.../model.glb",
  "attributes": [
    {"trait_type": "Category", "value": "3D Model"},
    {"trait_type": "Format", "value": "GLB"},
    {"trait_type": "Polycount", "value": "50000"},
    {"trait_type": "Creator", "value": "ArtistName"}
  ]
}
```

---

### Frontend (Planned v0.2)

**Framework**: Next.js 14 (App Router)

**Web3 Integration**:
- wagmi (React Hooks for Ethereum)
- RainbowKit (Wallet connection)
- viem (TypeScript Ethereum library)

**State Management**:
- Zustand (Global state)
- TanStack Query (Data fetching & caching)

**UI Libraries**:
- Tailwind CSS
- Shadcn/ui components
- Lucide React (Icons)

**Data Visualization**:
- Recharts (Charts)
- Chart.js (Alternative)

**File Handling**:
- IPFS HTTP client
- File upload utilities

---

## 📦 Installation Guide

### Prerequisites

```bash
# 1. Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. Verify installation
forge --version
cast --version
anvil --version

# 3. Install Git (if not installed)
git --version
```

---

### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/Im-A-Nuel/Lixa.git
cd Lixa

# 2. Install dependencies (git submodules)
forge install

# 3. Build contracts
forge build

# 4. Verify successful build
# Should see: Compiler run successful!
```

---
**⚠️ Security Note**: Never commit `.env` file to git!

---

### Verify Installation

```bash
# Run tests to verify everything works
forge test

# Expected output:
[⠢] Compiling...
[⠆] Compiling 1 files with 0.8.24
[⠰] Solc 0.8.24 finished in X.XXs
Compiler run successful!

Running 5 tests...
Test result: ok. 5 passed; 0 failed
```

---

## 🎮 Usage Guide

### Local Development

#### 1. Start Local Node

```bash
# Terminal 1: Start Anvil (local testnet)
anvil

# Output:
# Available Accounts:
# (0) 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
# (1) 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
# ...
# Private Keys:
# (0) 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

#### 2. Deploy Contracts

```bash
# Terminal 2: Deploy to local node
forge script script/Deploy.s.sol \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Save deployed addresses for testing
```

#### 3. Interact with Contracts

```bash
# Get total registered assets
cast call <ASSET_REGISTRY_ADDRESS> \
  "totalAssets()" \
  --rpc-url http://localhost:8545

# Register a new asset
cast send <ASSET_REGISTRY_ADDRESS> \
  "registerAsset(string,uint256)" \
  "QmTestCID" 10 \
  --private-key 0xac0974... \
  --rpc-url http://localhost:8545

# Check balance
cast balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://localhost:8545
```

---

### Testing Workflows

#### Complete Asset Lifecycle Test

```bash
# 1. Register asset
forge test --match-test testRegisterAsset -vvv

# 2. Fractionalize asset
forge test --match-test testFractionalize -vvv

# 3. Buy fractions
forge test --match-test testBuyFractions -vvv

# 4. Create license offer
forge test --match-test testCreateLicenseOffer -vvv

# 5. Buy license
forge test --match-test testBuyLicense -vvv

# 6. Claim dividends
forge test --match-test testClaimDividends -vvv

# 7. Run all tests
forge test -vvv

# 8. Gas report
forge test --gas-report
```

---

### Deployment to Testnet (Sepolia)

```bash
# 1. Ensure you have Sepolia ETH
# Get from: https://sepoliafaucet.com/

# 2. Update .env with Sepolia RPC
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# 3. Deploy
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# 4. Verify contracts on Etherscan
forge verify-contract <CONTRACT_ADDRESS> \
  src/contract/MarketAsset.sol:AssetRegistry \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

---

### Common Operations

#### As Creator

```bash
# 1. Register asset
cast send $REGISTRY \
  "registerAsset(string,uint256)" \
  "QmYourAssetCID" 10 \
  --private-key $PK

# 2. Approve NFT for fractionalization
cast send $ASSET_NFT \
  "approve(address,uint256)" \
  $FRACTIONALIZER 1 \
  --private-key $PK

# 3. Fractionalize
cast send $FRACTIONALIZER \
  "fractionalize(uint256,uint256,uint256,string,string)" \
  1 10000 10000000000000000 "Asset Fractions" "FRAC" \
  --private-key $PK

# 4. Create license offer
cast send $LICENSE_MGR \
  "createLicenseOffer(uint256,uint8,uint256)" \
  1 0 500000000000000000 \
  --private-key $PK
```

#### As Buyer

```bash
# Buy license (Commercial)
cast send $LICENSE_MGR \
  "buyLicense(uint256,uint8)" \
  1 0 \
  --value 0.5ether \
  --private-key $PK

# Verify license
cast call $LICENSE_MGR \
  "verifyLicense(uint256,uint8)" \
  1 0
```

#### As Investor

```bash
# Buy fractions
cast send $FRACTIONALIZER \
  "buyFractions(uint256,uint256)" \
  1 100 \
  --value 1ether \
  --private-key $PK

# Check claimable dividends
cast call $FRACTIONALIZER \
  "calculateOwed(uint256,address)" \
  1 $YOUR_ADDRESS

# Claim dividends
cast send $FRACTIONALIZER \
  "claimDividends(uint256)" \
  1 \
  --private-key $PK
```

---

## 🧪 Testing

### Test Structure

```
test/
├── Counter.t.sol          # Basic tests (TODO: expand)
├── AssetRegistry.t.sol    # (TODO: Asset registration tests)
├── Fractionalizer.t.sol   # (TODO: Fractionalization tests)
├── LicenseManager.t.sol   # (TODO: License tests)
└── Integration.t.sol      # (TODO: End-to-end tests)
```

---

### Writing Tests

**Example Test Template**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/contract/MarketAsset.sol";

contract AssetRegistryTest is Test {
    AssetRegistry public registry;
    AssetNFT public assetNFT;
    
    address creator = address(0x1);
    address buyer = address(0x2);
    
    function setUp() public {
        // Deploy contracts
        assetNFT = new AssetNFT(address(this), "Asset", "AST");
        registry = new AssetRegistry(address(assetNFT));
        
        // Setup accounts
        vm.deal(creator, 10 ether);
        vm.deal(buyer, 10 ether);
    }
    
    function testRegisterAsset() public {
        vm.startPrank(creator);
        
        uint256 assetId = registry.registerAsset(
            "QmTestCID",
            10
        );
        
        assertEq(assetId, 1);
        assertEq(assetNFT.ownerOf(assetId), creator);
        
        vm.stopPrank();
    }
    
    function testCannotRegisterWithInvalidRoyalty() public {
        vm.startPrank(creator);
        
        vm.expectRevert("Royalty too high");
        registry.registerAsset("QmTest", 101);
        
        vm.stopPrank();
    }
}
```

---

### Running Tests

```bash
# Run all tests
forge test

# Run specific test file
forge test --match-path test/AssetRegistry.t.sol

# Run specific test function
forge test --match-test testRegisterAsset

# Verbose output levels
forge test -v     # Show test names
forge test -vv    # Show test results
forge test -vvv   # Show detailed execution trace
forge test -vvvv  # Show setup trace
forge test -vvvvv # Show all internal calls

# Gas report
forge test --gas-report

# Coverage report
forge coverage

# Watch mode (re-run on file changes)
forge test --watch
```

---

### Test Categories

#### 1. Unit Tests
Test individual functions in isolation.

```bash
forge test --match-path test/unit/
```

#### 2. Integration Tests
Test interactions between multiple contracts.

```bash
forge test --match-path test/integration/
```

#### 3. Fuzz Tests
Foundry automatically fuzzes inputs.

```solidity
function testFuzzRegisterAsset(
    string memory cid,
    uint256 royalty
) public {
    vm.assume(royalty <= 100);
    // Test with random inputs
}
```

#### 4. Invariant Tests
Test properties that should always hold.

```solidity
function invariant_TotalSupplyMatchesSum() public {
    // Total supply should equal sum of all balances
}
```

---

### Best Practices

1. **Use setUp() for initialization**
2. **Test happy path first**
3. **Test edge cases and reverts**
4. **Use vm.prank() for access control tests**
5. **Use vm.expectRevert() for error testing**
6. **Check events with vm.expectEmit()**
7. **Test state changes thoroughly**
8. **Write descriptive test names**

---

## 🔒 Security

### Implemented Security Measures

#### 1. ReentrancyGuard
All payable functions protected from reentrancy attacks.

```solidity
function buyLicense(...) external payable nonReentrant {
    // Safe from reentrancy
}
```

#### 2. CEI Pattern (Checks-Effects-Interactions)
State changes before external calls.

```solidity
function claimDividends(uint256 assetId) external {
    // 1. Checks
    require(amount > 0, "No dividends");
    
    // 2. Effects
    lastDividendsPerToken[msg.sender] = dividendsPerToken;
    
    // 3. Interactions
    payable(msg.sender).transfer(amount);
}
```

#### 3. Access Control
Function modifiers for authorization.

```solidity
modifier onlyCreator(uint256 assetId) {
    require(
        msg.sender == assets[assetId].creator,
        "Not creator"
    );
    _;
}
```

#### 4. Input Validation
Comprehensive validation checks.

```solidity
require(royaltyPercentage <= 100, "Royalty too high");
require(amount > 0, "Amount must be positive");
require(price > 0, "Price must be positive");
```

#### 5. Safe Math
Solidity 0.8.24 built-in overflow protection.

---

### Security Checklist

- [x] ReentrancyGuard on all payable functions
- [x] CEI pattern followed
- [x] Access control modifiers
- [x] Input validation
- [x] Safe math (0.8.x)
- [x] OpenZeppelin audited contracts
- [ ] Comprehensive test coverage (target: >90%)
- [ ] Slither static analysis
- [ ] Mythril security scan
- [ ] External audit (pre-mainnet)
- [ ] Bug bounty program

---

### Running Security Tools

```bash
# Install Slither
pip3 install slither-analyzer

# Run Slither
slither src/contract/MarketAsset.sol

# Install Mythril
pip3 install mythril

# Run Mythril
myth analyze src/contract/MarketAsset.sol

# Foundry's built-in security checks
forge test --gas-report
forge coverage
```

---

### Known Considerations

1. **Oracle Dependency**: EDU_INDIE revenue cap requires oracle (future implementation)
2. **License Enforcement**: Off-chain enforcement needed
3. **Fractional Token Liquidity**: Depends on secondary market adoption
4. **IPFS Availability**: Content availability relies on IPFS pinning
5. **Gas Costs**: Batch operations recommended for large-scale usage

---

### Security Best Practices for Users

**For Creators**:
- ✅ Use hardware wallet for high-value assets
- ✅ Verify contract addresses before interaction
- ✅ Pin IPFS content on multiple services
- ✅ Keep private keys secure

**For Buyers**:
- ✅ Verify license terms on-chain
- ✅ Check License NFT ownership
- ✅ Download and backup assets
- ✅ Follow license compliance

**For Investors**:
- ✅ Review asset performance before buying fractions
- ✅ Diversify holdings across multiple assets
- ✅ Understand royalty distribution mechanism
- ✅ Monitor claimed vs. unclaimed dividends

---

## 📊 Gas Optimization

### Current Optimizations

1. **IR-based Compilation**: `via_ir = true` enables advanced optimizations
2. **Optimizer Runs**: 200 (balanced for deployment vs. runtime costs)
3. **Immutable Variables**: Used where applicable
4. **Storage Packing**: Structs optimized for 32-byte slots
5. **Efficient Loops**: Minimal iterations, early exits
6. **Pull Payments**: Gas-efficient dividend claiming

---

### Gas Report

```bash
# Generate gas report
forge test --gas-report

# Example output:
╭─────────────────────┬─────────────────┬────────┬────────┬────────┬─────────╮
│ Contract            │ Method          │ Min    │ Max    │ Avg    │ Calls   │
├─────────────────────┼─────────────────┼────────┼────────┼────────┼─────────┤
│ AssetRegistry       │ registerAsset   │ 150000 │ 180000 │ 165000 │    10   │
│ Fractionalizer      │ fractionalize   │ 250000 │ 280000 │ 265000 │     5   │
│ LicenseManager      │ buyLicense      │  80000 │ 100000 │  90000 │    20   │
│ Fractionalizer      │ claimDividends  │  40000 │  60000 │  50000 │    15   │
╰─────────────────────┴─────────────────┴────────┴────────┴────────┴─────────╯
```

---

### Optimization Tips

**For Creators**:
- Batch register multiple assets in one transaction (future feature)
- Set reasonable primary sale amounts (avoid dust amounts)

**For Buyers**:
- Buy multiple licenses in batches when available
- Combine license purchase with other operations

**For Investors**:
- Claim dividends when amount justifies gas cost
- Consider batching multiple claims

---

## 🗺️ Roadmap

### ✅ Phase 1: Foundation (Current - v0.1)

- [x] Core smart contracts
- [x] License preset system
- [x] Fractional token mechanism
- [x] Royalty vault & distribution
- [x] Build configuration
- [x] Basic documentation

---

### ⏳ Phase 2: Testing & Security (Q1 2025)

- [ ] Comprehensive unit tests (>90% coverage)
- [ ] Integration tests
- [ ] IFracHook implementation
- [ ] Slither & Mythril scans
- [ ] Internal security review
- [ ] Deploy scripts refinement

---

### 🔮 Phase 3: Frontend & UX (Q2 2025)

- [ ] Next.js frontend
- [ ] Wallet integration (RainbowKit)
- [ ] Asset upload & IPFS integration
- [ ] Marketplace UI
- [ ] Analytics dashboard
- [ ] Search & filtering
- [ ] Responsive design

---

### 🚀 Phase 4: Advanced Features (Q3 2025)

- [ ] Secondary market for fractions (DEX integration)
- [ ] Attestation service (IP verification)
- [ ] Remix/derivative tracking
- [ ] Revenue oracle (EDU/INDIE cap enforcement)
- [ ] Batch operations
- [ ] Governance mechanisms
- [ ] Mobile app (React Native)

---

### 🌐 Phase 5: Scaling & Adoption (Q4 2025)

- [ ] Multi-chain deployment (Polygon, Arbitrum, Base)
- [ ] Cross-chain bridges
- [ ] DAO governance
- [ ] Bug bounty program
- [ ] External audit (Tier-1 firm)
- [ ] Mainnet launch
- [ ] Marketing & partnerships
- [ ] Game engine plugins (Unity, Unreal)

---

### 🎯 Future Considerations

- AI-powered asset recommendations
- Dynamic pricing algorithms
- Subscription-based licenses
- Creator DAOs for collective IP
- Metaverse integration
- VR/AR asset previews
- Creator reputation system
- Dispute resolution mechanism

---

## 🤝 Contributing

### How to Contribute

We welcome contributions from the community! Here's how to contribute:

1. **Fork the Repository**
   ```bash
   git fork https://github.com/Im-A-Nuel/Lixa.git
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/AmazingFeature
   ```

3. **Make Changes**
   - Write clean, documented code
   - Follow Solidity style guide
   - Add tests for new features

4. **Commit Changes**
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```

5. **Push to Branch**
   ```bash
   git push origin feature/AmazingFeature
   ```

6. **Open Pull Request**
   - Describe changes clearly
   - Link related issues
   - Request review

---

### Contribution Guidelines

**Code Style**:
- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use `forge fmt` before committing
- Add NatSpec comments for public functions
- Keep functions under 50 lines when possible

**Testing**:
- Write tests for all new features
- Maintain >90% test coverage
- Include both positive and negative test cases
- Add fuzz tests for complex logic

**Documentation**:
- Update README for significant changes
- Add inline comments for complex logic
- Update CHANGELOG.md
- Create docs for new features

**Git Commit Messages**:
```
feat: Add support for batch license purchases
fix: Correct dividend calculation rounding
docs: Update installation instructions
test: Add fuzz tests for fractionalization
refactor: Optimize gas usage in claim function
```

---

### Areas Needing Help

🔴 **High Priority**:
- Comprehensive test suite
- IFracHook implementation
- Security audit preparation
- Deploy script improvements

🟡 **Medium Priority**:
- Frontend development
- IPFS integration
- Documentation improvements
- Example scripts

🟢 **Nice to Have**:
- Additional license presets
- Analytics tools
- Community plugins
- Localization (i18n)

---

## 📞 Support & Community

### Getting Help

**Documentation**:
- [GitHub README](https://github.com/Im-A-Nuel/Lixa)
- [License Preset Docs](https://github.com/Im-A-Nuel/Lixa/blob/main/docs/LIXA_LICENSE_PRESET.md)
- [Smart Contract Reference](https://github.com/Im-A-Nuel/Lixa/tree/main/src)

**Contact**:
- **Email**: hello@lixa.app (TBD)
- **Discord**: discord.gg/lixa (TBD)
- **Twitter**: [@lixa_xyz](https://twitter.com/lixa_xyz) (TBD)

**Issue Tracking**:
- [GitHub Issues](https://github.com/Im-A-Nuel/Lixa/issues)
- [Feature Requests](https://github.com/Im-A-Nuel/Lixa/issues/new?template=feature_request.md)
- [Bug Reports](https://github.com/Im-A-Nuel/Lixa/issues/new?template=bug_report.md)

---

### Community Resources

**Developer Resources**:
- Foundry Book: https://book.getfoundry.sh/
- Solidity Docs: https://docs.soliditylang.org/
- OpenZeppelin: https://docs.openzeppelin.com/

**Web3 Learning**:
- Ethereum.org: https://ethereum.org/en/developers/
- Crypto Zombies: https://cryptozombies.io/
- Alchemy University: https://university.alchemy.com/

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2024 Lixa Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

**Special Thanks**:

- **Story Protocol**: Inspiration for IPFi framework
- **OpenZeppelin**: Secure and battle-tested contract libraries
- **Foundry Team**: Amazing dev tooling for Solidity
- **Game Asset Community**: Feedback on licensing needs
- **Web3 Builders**: Support and inspiration

**Built With**:
- ❤️ Passion for decentralized creative economy
- 🎮 Understanding of game development workflows
- 🔗 Blockchain technology
- 🌍 Open source spirit

---

## 📊 Project Statistics

**Repository**:
- ⭐ Stars: 0
- 🍴 Forks: 0
- 👀 Watchers: 0
- 🔄 Commits: 13+
- 👥 Contributors: 2

**Code Metrics**:
- 📝 Solidity: 77.1%
- 📝 TypeScript: 21.8%
- 📝 Other: 1.1%
- 📦 Smart Contracts: 7+
- 🧪 Test Coverage: TBD

---

## 🎯 Quick Links

**Essential**:
- [🏠 GitHub Repository](https://github.com/Im-A-Nuel/Lixa)
- [📖 README](https://github.com/Im-A-Nuel/Lixa#readme)
- [📜 License Preset Documentation](https://github.com/Im-A-Nuel/Lixa/blob/main/docs/LIXA_LICENSE_PRESET.md)
- [🔧 Smart Contracts](https://github.com/Im-A-Nuel/Lixa/tree/main/src/contract)

**Development**:
- [🧪 Tests](https://github.com/Im-A-Nuel/Lixa/tree/main/test)
- [📜 Deploy Scripts](https://github.com/Im-A-Nuel/Lixa/tree/main/script)
- [⚙️ Configuration](https://github.com/Im-A-Nuel/Lixa/blob/main/foundry.toml)
- [🔒 Environment Example](https://github.com/Im-A-Nuel/Lixa/blob/main/.env.example)

**Community**:
- [🐛 Issues](https://github.com/Im-A-Nuel/Lixa/issues)
- [🔀 Pull Requests](https://github.com/Im-A-Nuel/Lixa/pulls)
- [📊 Insights](https://github.com/Im-A-Nuel/Lixa/pulse)

---

## 💡 FAQ

### General Questions

**Q: What is Lixa?**  
A: Lixa is a marketplace for game assets with on-chain licensing, fractional royalties, and automated distribution to investors.

**Q: Who can use Lixa?**  
A: Three main user personas:
- **Creators**: Game asset makers (3D artists, musicians, etc.)
- **Buyers**: Game studios, agencies, developers needing licenses
- **Investors**: Anyone wanting to invest in fractional royalties

**Q: What are the benefits of using Lixa?**  
A: 
- Creators: Ongoing monetization, passive income
- Buyers: Clear licenses, on-chain proof of ownership
- Investors: Portfolio diversification, full transparency

---

### Technical Questions

**Q: Which blockchain does Lixa use?**  
A: Currently in development on Ethereum (testnet). Multi-chain plans for Polygon, Arbitrum, and Base.

**Q: How are assets stored?**  
A: Asset files on IPFS, metadata & ownership on-chain.

**Q: Have the smart contracts been audited?**  
A: Not yet. External audit will be conducted before mainnet launch. Internal security review is ongoing.

**Q: What are the gas costs for common operations?**  
A: Estimates (subject to change):
- Register asset: ~165,000 gas
- Fractionalize: ~265,000 gas
- Buy license: ~90,000 gas
- Claim dividends: ~50,000 gas

---

### Licensing Questions

**Q: What license types are available?**  
A: 3 presets:
1. IN_GAME_COMMERCIAL: Full commercial rights
2. TRAILER_MARKETING: Promotional use only
3. EDU_INDIE: Educational/indie with revenue cap

**Q: Are licenses transferable?**  
A: 
- Commercial & Marketing: Yes (transferable)
- Edu/Indie: No (non-transferable)

**Q: How is license enforcement handled?**  
A: On-chain records serve as proof. Off-chain enforcement through DMCA and legal action if necessary.

---

### Investment Questions

**Q: What's the minimum investment for fractional tokens?**  
A: Depends on creator pricing. Typical: 0.01 ETH per token.

**Q: How do I claim dividends?**  
A: Call `claimDividends()` anytime. Pull-based, gas-efficient system.

**Q: Can I sell fractional tokens?**  
A: Yes, they're transferable. Secondary market on DEX (planned).

**Q: What's a typical royalty percentage?**  
A: Creators set their own. Common: 5-15%. Lixa takes no platform fee (v0.1).

---

## 🏁 Conclusion

Lixa is a blockchain solution to democratize access and monetization of game assets. With:

✅ **Clear and Standardized License Presets**  
✅ **Fractionalization for Liquidity and Investment**  
✅ **On-chain Verification for Transparency**  
✅ **Automated Royalties for Efficiency**  

We're building the infrastructure for the future of the game asset economy.

---

**Built with ❤️ for the future of game asset licensing.**

---

*Lixa - License. Fraction. Earn.*

---

**Version**: 0.1.0  
**Last Updated**: December 2024  
**Status**: Active Development  
**License**: MIT

---

## 📮 Feedback

This documentation is still under development. If you find:
- ❌ Errors or inaccurate information
- 💡 Suggestions for improvement
- ❓ Unanswered questions

Please [open an issue](https://github.com/Im-A-Nuel/Lixa/issues/new) or contact the development team.

---

**End of Documentation**
