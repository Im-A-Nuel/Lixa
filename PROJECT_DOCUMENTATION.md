# Lixa - Project Technical Documentation

> **"License. Fraction. Earn."**

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Smart Contracts](#smart-contracts)
4. [Frontend Application](#frontend-application)
5. [Database Schema](#database-schema)
6. [Implementation Details](#implementation-details)
7. [Technology Stack](#technology-stack)
8. [Features](#features)
9. [User Flows](#user-flows)
10. [Security](#security)
11. [Deployment](#deployment)

---

## Project Overview

### What is Lixa?

Lixa adalah marketplace aset game berbasis blockchain yang memungkinkan:
- **Lisensi On-chain**: Kreator mendaftarkan aset game sebagai IP dengan lisensi terprogram
- **Fraksionalisasi Royalti**: Pemecahan arus royalti menjadi token fraksional (ERC-20) yang dapat diperdagangkan
- **Distribusi Otomatis**: Pembeli lisensi mendapat NFT sebagai bukti, holder fraksi menerima royalti secara transparan

### Problem Statement

Game developers dan kreator aset menghadapi tantangan:
- Lisensi aset game tidak standar dan sulit diverifikasi
- Tidak ada transparansi dalam pembagian royalti
- Kesulitan mendapatkan pendanaan awal untuk produksi aset
- Tidak ada likuiditas untuk revenue stream dari aset digital

### Solution

Lixa memberikan solusi komprehensif:
1. **Standardized Licensing**: 3 preset lisensi yang jelas (Commercial, Marketing, Edu/Indie)
2. **Fractional Ownership**: Investor dapat membeli fraksi dari future revenue stream
3. **Transparent Distribution**: Smart contract otomatis membagi royalti secara proporsional
4. **Secondary Market**: Likuiditas untuk fraksi token melalui order book
5. **On-chain Proof**: NFT sebagai bukti kepemilikan lisensi yang tidak dapat dipalsukan

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                      │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐ │
│  │Marketplace│ Create  │ License  │  Secondary Market   │ │
│  │  Browse  │Fractional│ Purchase │ (Order Book Trading)│ │
│  └──────────┴──────────┴──────────┴──────────────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│    IPFS      │ │   Prisma DB  │ │  Blockchain  │
│  (Storage)   │ │ (Off-chain)  │ │  (On-chain)  │
└──────────────┘ └──────────────┘ └──────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
┌──────────────┐              ┌──────────────────┐           ┌──────────────────┐
│Asset Registry│              │  Fractionalizer  │           │ License Manager  │
│   + AssetNFT │              │+ FractionalToken │           │  + LicenseNFT   │
└──────────────┘              └──────────────────┘           └──────────────────┘
                                       │
                        ┌──────────────┼──────────────┐
                        │                             │
                        ▼                             ▼
              ┌──────────────────┐         ┌──────────────────┐
              │ SecondaryMarket  │         │   OrderBook      │
              │  (On-chain AMM)  │         │(Hybrid Off/On)   │
              └──────────────────┘         └──────────────────┘
```

### Contract Interaction Flow

```
1. Asset Registration:
   Creator → AssetRegistry.registerAsset() → AssetNFT.mintFor()

2. Fractionalization:
   Owner → Fractionalizer.fractionalize()
         → Lock NFT in contract
         → Deploy FractionalToken (ERC-20)
         → Mint tokens to creator

3. License Sale:
   Buyer → LicenseManager.buyLicense()
         → LicenseNFT.mintLicense()
         → Payment → Fractionalizer.depositToPool()
         → Update dividendsPerToken

4. Royalty Claim:
   Token Holder → Fractionalizer.claimDividends()
                → Transfer proportional dividends
```

---

## Smart Contracts

### 1. AssetNFT Contract
**File**: `src/contract/MarketAsset.sol:55-81`

**Purpose**: ERC-721 representing ownership of registered game assets

**Key Features**:
- Minted when creator registers an asset
- Stores metadata CID (IPFS)
- Only AssetRegistry can mint
- Transferable ownership

**Functions**:
```solidity
function mintFor(address to, string calldata tokenURI_) external onlyRegistry returns (uint256)
function setRegistry(address _r) external onlyOwner
```

**Events**:
- Transfer (inherited from ERC721)

---

### 2. AssetRegistry Contract
**File**: `src/contract/MarketAsset.sol:129-192`

**Purpose**: Central registry for all game assets

**Key Features**:
- Register game assets (3D models, sprites, music, UI kits)
- Automatic AssetNFT minting
- Tracks creator, royalty percentage, metadata
- ReentrancyGuard protection

**Struct**:
```solidity
struct Asset {
    uint256 assetId;
    address creator;
    string metadataURI;
    uint16 defaultRoyaltyBPS; // out of 10,000
    uint256 tokenId; // AssetNFT token id
    address nftContract;
    bool exists;
}
```

**Functions**:
```solidity
function registerAsset(string calldata metadataURI, uint16 defaultRoyaltyBPS) external nonReentrant returns (uint256)
function getAsset(uint256 assetId) external view returns (Asset memory)
function totalAssets() external view returns (uint256)
```

**Events**:
```solidity
event AssetRegistered(
    uint256 indexed assetId,
    address indexed creator,
    address nftContract,
    uint256 tokenId,
    string metadataURI,
    uint16 royaltyBPS
)
```

---

### 3. FractionalToken Contract
**File**: `src/contract/MarketAsset.sol:84-126`

**Purpose**: ERC-20 burnable token representing fractional ownership

**Key Features**:
- One token type per fractionalized asset
- Supports ERC20Permit (gasless approvals)
- Hook callback on transfers (IFracHook)
- Only Fractionalizer can mint
- Burnable for recombination

**Functions**:
```solidity
function setPoolId(uint256 _poolId) external onlyFractionalizer
function mintByFractionalizer(address to, uint256 amount) external onlyFractionalizer
function _update(address from, address to, uint256 amount) internal virtual override
```

**Hook System**:
- Calls `IFracHook.onFTTransfer()` before every transfer
- Updates dividend accounting to prevent gaming

---

### 4. Fractionalizer Contract
**File**: `src/contract/MarketAsset.sol:203-491`

**Purpose**: Core contract for fractional ownership and royalty distribution

**Key Features**:
- Lock NFT → mint fractional tokens
- Primary sale of fractions (fixed price)
- Royalty vault with dividend distribution (pull-based)
- Recombine: burn all fractions → unlock NFT
- Fair dividend accounting with `dividendsPerToken`

**Struct**:
```solidity
struct Pool {
    uint256 poolId;
    uint256 assetId;
    address nftContract;
    uint256 tokenId;
    address ftAddress;
    uint256 totalFractions;
    address originalOwner;
    uint256 salePricePerToken;
    uint256 amountForSale;
    uint256 sold;
    bool active;
    uint256 dividendsPerToken; // scaled by 1e18
    mapping(address => uint256) withdrawn;
}
```

**Key Functions**:

**Fractionalization**:
```solidity
function fractionalize(
    uint256 assetId,
    address nftContract,
    uint256 tokenId,
    string calldata name_,
    string calldata symbol_,
    uint256 totalSupply_,
    uint256 salePricePerToken_,
    uint256 amountForSale_,
    address toReceiveInitial
) external nonReentrant returns (uint256)
```

**Primary Sale**:
```solidity
function buyFractions(uint256 poolId, uint256 amount) external payable nonReentrant
```

**Dividend System**:
```solidity
function depositToPool(uint256 poolId) external payable nonReentrant
function claimDividends(uint256 poolId) external nonReentrant
function claimableAmount(uint256 poolId, address holder) external view returns (uint256)
```

**Recombination**:
```solidity
function recombineAndWithdraw(uint256 poolId) external nonReentrant
```

**Hook Implementation** (`src/contract/MarketAsset.sol:478-490`):
```solidity
function onFTTransfer(uint256 poolId, address from, address to, uint256 amount) external override {
    // Updates receiver's withdrawn amount to prevent claiming
    // dividends earned before they owned the tokens
    uint256 accumulatedDividends = (amount * p.dividendsPerToken) / 1e18;
    p.withdrawn[to] += accumulatedDividends;
}
```

**Events**:
```solidity
event Fractionalized(uint256 indexed poolId, uint256 indexed assetId, address indexed ft, address owner, uint256 totalSupply, uint256 salePricePerToken, uint256 amountForSale)
event FractionsBought(uint256 indexed poolId, address buyer, uint256 amount, uint256 paid)
event DividendsDeposited(uint256 indexed poolId, address from, uint256 amount)
event DividendClaimed(uint256 indexed poolId, address claimer, uint256 amount)
event Recombined(uint256 indexed poolId, address claimer)
```

---

### 5. LicenseNFT Contract
**File**: `src/contract/MarketAsset.sol:494-532`

**Purpose**: ERC-721 as proof of license purchase

**Key Features**:
- Minted when license is purchased
- Tracks all licenses owned by user
- Could be made non-transferable (SBT) in future
- Only LicenseManager can mint

**Functions**:
```solidity
function mintLicense(address to, string calldata uri) external onlyManager returns (uint256)
function tokensOfOwner(address owner) external view returns (uint256[] memory)
function totalSupply() external view returns (uint256)
```

---

### 6. LicenseManager Contract
**File**: `src/contract/MarketAsset.sol:541-762`

**Purpose**: Create and sell licenses with preset terms

**Key Features**:
- Create license offers linked to assets
- Support EXCLUSIVE/NON_EXCLUSIVE/DERIVATIVE types
- Integrated with LicensePreset library
- Forward payments to Fractionalizer vault
- Track exclusive locks & expiry times

**Enums**:
```solidity
enum LicenseType { NON_EXCLUSIVE, EXCLUSIVE, DERIVATIVE }
```

**Struct**:
```solidity
struct Offer {
    uint256 offerId;
    uint256 assetId;
    address seller;
    uint256 price;
    uint16 royaltyBPS;
    LicenseType ltype;
    LicensePreset.PresetType preset;
    uint256 maxSupply;
    uint256 sold;
    uint256 duration;
    bool active;
    string uri;
}
```

**Functions**:

**Create Offer**:
```solidity
function createOffer(
    uint256 assetId,
    uint256 price,
    uint16 royaltyBPS,
    LicenseType ltype,
    LicensePreset.PresetType preset,
    uint256 maxSupply,
    uint256 duration,
    string calldata uri
) external returns (uint256)
```

**Buy License**:
```solidity
function buyLicense(uint256 offerId) external payable nonReentrant returns (uint256)
```

**Preset Helper Functions**:
```solidity
function getLicenseTerms(uint256 offerId) external view returns (LicensePreset.Terms memory)
function getRightsSummary(uint256 offerId) external view returns (string[5] memory)
function isUseCaseAllowed(uint256 offerId, uint8 useCase) external view returns (bool)
function validateRevenue(uint256 offerId, uint256 currentRevenue) external view returns (bool)
```

**Events**:
```solidity
event LicenseOfferCreated(uint256 indexed offerId, uint256 indexed assetId, address seller, uint256 price, LicenseType ltype, LicensePreset.PresetType preset, uint256 maxSupply)
event LicensePurchased(uint256 indexed offerId, uint256 indexed licenseTokenId, address buyer, uint256 price)
```

---

### 7. LicensePreset Library
**File**: `src/contract/LicensePreset.sol`

**Purpose**: Define standardized license types for game assets

**License Types**:

#### 1. IN_GAME_COMMERCIAL_V1
**Target**: Commercial game studios (AAA, mid-tier, commercial indie)

**Rights**:
- ✅ Commercial game usage (unlimited revenue)
- ✅ In-game integration & modification
- ✅ Marketing materials allowed
- ❌ Cannot resell raw asset
- 📝 Attribution required

**Use Case**: Studio buys 3D dragon model, uses in Steam game, modifies texture

#### 2. TRAILER_MARKETING_V1
**Target**: Marketing agencies, content creators

**Rights**:
- ✅ Promotional materials (trailers, posters, social media)
- ❌ NOT for in-game usage
- ✅ Modification for promo needs
- 📝 Attribution required

**Use Case**: Agency buys city model for game trailer and Steam banner

#### 3. EDU_INDIE_V1
**Target**: Students, hobbyists, small indie developers

**Rights**:
- ✅ Educational projects & indie games
- ✅ Full in-game integration
- ⚠️ Revenue cap: $100,000/year
- 🔒 Non-transferable license
- 📝 Attribution required

**Use Case**: Student uses for thesis game, indie dev releases on itch.io

**Functions**:
```solidity
function getPresetTerms(PresetType preset) internal pure returns (Terms memory)
function getRightsSummary(PresetType preset) internal pure returns (string[5] memory)
function isAllowed(PresetType preset, uint8 useCase) internal pure returns (bool)
function validateRevenueCap(PresetType preset, uint256 currentRevenue) internal pure returns (bool)
```

---

### 8. SecondaryMarket Contract
**File**: `src/contract/SecondaryMarket.sol`

**Purpose**: On-chain ASK-only order book for trading FractionalTokens

**Key Features**:
- Simple fixed-price sell orders
- Platform fee (2.5% default)
- ERC20Permit support (gasless approvals)
- Order cancellation
- Per-pool and per-seller order tracking

**Struct**:
```solidity
struct Order {
    uint256 orderId;
    uint256 poolId;
    address ftAddress;
    address seller;
    uint256 amount;
    uint256 pricePerToken;
    bool active;
    uint256 createdAt;
}
```

**Functions**:
```solidity
function createSellOrder(uint256 poolId, address ftAddress, uint256 amount, uint256 pricePerToken) external nonReentrant returns (uint256)
function createSellOrderWithPermit(...) external nonReentrant returns (uint256)
function buyFromOrder(uint256 orderId, uint256 amount) external payable nonReentrant
function cancelOrder(uint256 orderId) external nonReentrant
function getPoolOrders(uint256 poolId) external view returns (uint256[] memory)
```

**Events**:
```solidity
event OrderCreated(uint256 indexed orderId, uint256 indexed poolId, address indexed seller, address ftAddress, uint256 amount, uint256 pricePerToken)
event OrderFilled(uint256 indexed orderId, address indexed buyer, uint256 amount, uint256 totalPrice)
event OrderCancelled(uint256 indexed orderId, address indexed seller)
```

---

### 9. OrderBook Contract
**File**: `src/contract/OrderBook.sol`

**Purpose**: Hybrid off-chain/on-chain settlement for bid/ask orders using EIP-712

**Key Features**:
- Users sign orders off-chain (no gas cost)
- Backend matches orders
- On-chain settlement with signature verification
- Supports partial fills
- Platform fee (2.5% default)
- EIP-712 typed signatures

**Flow**:
1. User signs bid/ask order off-chain (EIP-712)
2. Backend stores order in database
3. Backend matches compatible orders
4. Anyone can call `executeTrade()` with both signatures
5. Contract verifies signatures and executes transfers

**Struct**:
```solidity
struct Order {
    string orderId;
    string side; // "BID" or "ASK"
    uint256 poolId;
    address ftAddress;
    uint256 amount;
    uint256 pricePerToken;
    address userAddress;
    uint256 nonce;
    uint256 expiresAt;
}
```

**EIP-712 Domain**:
```solidity
name: "Lixa Order Book"
version: "1"
```

**Type Hash**:
```solidity
bytes32 private constant ORDER_TYPEHASH = keccak256(
    "Order(string orderId,string side,uint256 poolId,address ftAddress,uint256 amount,uint256 pricePerToken,address userAddress,uint256 nonce,uint256 expiresAt)"
);
```

**Functions**:
```solidity
function executeTrade(
    Order calldata buyOrder,
    bytes calldata buySignature,
    Order calldata sellOrder,
    bytes calldata sellSignature,
    uint256 amount
) external payable

function cancelOrder(Order calldata order, bytes calldata signature) external
function getRemainingAmount(Order calldata order) external view returns (uint256)
```

**Events**:
```solidity
event OrderMatched(string indexed buyOrderId, string indexed sellOrderId, address indexed buyer, address seller, address ftAddress, uint256 amount, uint256 pricePerToken, uint256 totalValue)
event OrderCancelled(string indexed orderId, address indexed user)
```

---

## Frontend Application

### Technology Stack

**Framework**: Next.js 16.0.3 (App Router)
**React**: 19.2.0
**Styling**: Tailwind CSS 4
**Web3**:
- wagmi 2.19.5
- viem 2.39.3
- @rainbow-me/rainbowkit 2.2.9
- MetaMask SDK 0.34.0

**State Management**:
- @tanstack/react-query 5.90.10
- valtio 2.2.0

**Database**:
- Prisma 5.8.0 (ORM)
- SQLite (development)

**Other**:
- Safe Global SDK (multi-sig wallet support)
- bs58 (IPFS CID encoding)
- uuid (order ID generation)

### Pages

#### 1. Home Page (`src/app/page.tsx`)
- Landing page
- Overview of Lixa platform
- Call-to-action buttons

#### 2. Marketplace (`src/app/marketplace/page.tsx`)
- Browse all registered assets
- Filter by category, price, license type
- View asset details
- Purchase licenses

#### 3. Create Asset (`src/app/create/page.tsx`)
- Upload asset files to IPFS
- Register asset on-chain
- Set royalty percentage
- Set metadata (name, description, tags)

#### 4. Fractionalize (`src/app/fractionalize/page.tsx`)
- Select owned AssetNFT
- Configure fractionalization:
  - Token name & symbol
  - Total supply
  - Primary sale price
  - Amount for sale
- Execute fractionalization transaction

#### 5. Secondary Market (`src/app/secondary-market/page.tsx`)
- View all fractionalized assets
- See active sell orders
- Buy fraction tokens
- Create sell orders

#### 6. Pool Detail (`src/app/secondary-market/[poolId]/page.tsx`)
- Detailed view of specific fractional pool
- Order book (bids & asks)
- Trade history
- Price charts
- Claim dividends

#### 7. Licenses (`src/app/licenses/page.tsx`)
- View all owned licenses
- Download licensed assets
- Check license terms
- View transaction history

#### 8. Portfolio (`src/app/portfolio/page.tsx`)
- View owned AssetNFTs
- View fractional token holdings
- View claimable dividends
- Total value tracking

#### 9. Trade History (`src/app/trade-history/page.tsx`)
- All past transactions
- License purchases
- Fraction trades
- Dividend claims

#### 10. Pools (`src/app/pools/page.tsx`)
- View all active fractional pools
- Pool statistics (TVL, ROI, holders)
- Buy fractions (primary sale)

### Components

#### MarketplaceNav (`src/components/MarketplaceNav.tsx`)
- Navigation bar for marketplace
- Wallet connection (RainbowKit)
- User menu (profile, portfolio, settings)

#### FileUpload (`src/components/FileUpload.tsx`)
- Drag-and-drop file upload
- IPFS upload with progress
- File preview
- Duplicate detection

#### OrderForm (`src/components/OrderForm.tsx`)
- Create buy/sell orders
- Price input with validation
- Amount slider
- Total calculation
- EIP-712 signature flow

#### OrderBook (`src/components/OrderBook.tsx`)
- Real-time order book display
- Bid/Ask ladder
- Spread visualization
- Order depth chart

#### ErrorMessage (`src/components/ErrorMessage.tsx`)
- Consistent error display
- Transaction error handling
- User-friendly messages

### Hooks

#### useOrderBook (`src/hooks/useOrderBook.ts`)
- Fetch order book data
- Real-time updates (polling)
- Order matching logic
- WebSocket support (planned)

#### useOffchainOrders (`src/hooks/useOffchainOrders.ts`)
- CRUD operations for off-chain orders
- API integration with backend
- Order status tracking

#### useSignOrder (`src/hooks/useSignOrder.ts`)
- EIP-712 typed data signing
- Signature verification
- Nonce management

#### useSpotTrading (`src/hooks/useSpotTrading.ts`)
- Execute spot trades
- Calculate fees
- Transaction confirmation
- Error handling

### API Routes

#### Asset Management
- `POST /api/asset/register` - Register asset metadata
- `POST /api/asset/check-duplicate` - Check for duplicate uploads
- `GET /api/download-asset` - Download licensed assets

#### License Management
- `POST /api/license/purchase` - Purchase license
- `GET /api/license/check` - Check license ownership
- `GET /api/licenses` - List user's licenses

#### IPFS
- `POST /api/ipfs` - Upload to IPFS (pinning service)

#### Order Management (Off-chain)
- `POST /api/orders/create` - Create signed order
- `GET /api/orders/list` - List active orders
- `GET /api/orders/[orderId]` - Get order details
- `POST /api/orders/cancel` - Cancel order
- `POST /api/orders/match` - Match orders
- `POST /api/orders/auto-match` - Auto-match compatible orders
- `GET /api/orders/pending-matches` - Get pending settlements
- `POST /api/orders/execute-settlement` - Execute on-chain settlement

---

## Database Schema

### Models (Prisma)

#### Order
Stores off-chain orders for hybrid trading system

**Fields**:
```prisma
id           String   @id @default(cuid())
orderId      String   @unique
userAddress  String
side         String   // "BUY" or "SELL"
poolId       String
ftAddress    String
amount       String   // 18 decimals (stored as string)
pricePerToken String
totalValue   String
status       String   @default("OPEN") // OPEN, PARTIALLY_FILLED, FILLED, CANCELLED, EXPIRED
filledAmount String   @default("0")
createdAt    DateTime @default(now())
expiresAt    DateTime
signature    String?
nonce        Int
chainId      Int
```

**Relations**:
- `buyMatches` - OrderMatch[] (orders this order bought from)
- `sellMatches` - OrderMatch[] (orders this order sold to)

**Indexes**:
- userAddress, status, side, poolId, chainId

#### OrderMatch
Represents matched orders pending settlement

**Fields**:
```prisma
id               String   @id @default(cuid())
buyOrderId       String
sellOrderId      String
matchedAmount    String
matchedPrice     String
gasFeePercentage Decimal  @default(0.001) // 0.1%
gasFeeAmount     String
status           String   @default("PENDING") // PENDING, SETTLED, FAILED
txHash           String?
createdAt        DateTime @default(now())
settledAt        DateTime?
```

**Relations**:
- `buyOrder` - Order
- `sellOrder` - Order

**Indexes**:
- status, buyOrderId, sellOrderId

#### FractionalToken
Metadata for fractional tokens

**Fields**:
```prisma
id          String   @id @default(cuid())
poolId      String   @unique
ftAddress   String   @unique
ftName      String
ftSymbol    String   @unique
assetId     Int
imageUrl    String?
description String?
```

**Indexes**:
- ftSymbol, ftAddress, poolId

#### Asset
Off-chain asset metadata with deduplication

**Fields**:
```prisma
id               String   @id @default(cuid())
assetId          Int?     @unique // null if not yet registered on-chain
creator          String
ipfsCid          String   @unique // Primary deduplication key
fileHash         String   // SHA-256 hash
fileName         String
fileSize         Int
mimeType         String
perceptualHash   String?  // pHash for near-duplicate detection
perceptualType   String?  // "phash", "dhash", "chromaprint", "geometric"
canonicalWidth   Int?
canonicalHeight  Int?
canonicalFormat  String?
metadataURI      String?
status           String   @default("UPLOADED") // UPLOADED, REGISTERED, REJECTED, DUPLICATE_FLAGGED
```

**Deduplication Strategy**:
1. **Exact duplicates**: Same `ipfsCid` or `fileHash`
2. **Near duplicates**: Similar `perceptualHash` (Hamming distance < threshold)
3. **Canonicalization**: Images normalized before hashing (resize, format, orientation)

**Indexes**:
- creator, ipfsCid, fileHash, perceptualHash, status, assetId, mimeType

#### License
Tracks purchased licenses

**Fields**:
```prisma
id          String   @id @default(cuid())
assetId     Int
buyer       String
licenseType String   @default("NON_EXCLUSIVE")
price       String   // in wei
txHash      String?
status      String   @default("ACTIVE") // ACTIVE, REVOKED, EXPIRED
uri         String?
createdAt   DateTime @default(now())
expiresAt   DateTime?
```

**Indexes**:
- buyer, assetId, status

#### TradeStatistics
Daily trading statistics per pool

**Fields**:
```prisma
poolId       String
ftAddress    String
dailyVolume  String   @default("0")
highPrice    String   @default("0")
lowPrice     String   @default("0")
lastPrice    String   @default("0")
totalTrades  Int      @default(0)
totalMatches Int      @default(0)
date         DateTime
```

**Indexes**:
- poolId, ftAddress
- Unique constraint: (ftAddress, date)

#### OrderHistory
Audit log for order events

**Fields**:
```prisma
orderId   String
action    String   // CREATED, FILLED, PARTIALLY_FILLED, CANCELLED, EXPIRED
amount    String
details   String?  // JSON
createdAt DateTime @default(now())
```

---

## Implementation Details

### 1. Asset Registration Flow

**Frontend** (`src/app/create/page.tsx`):
```typescript
1. User uploads file (drag-and-drop or file picker)
2. Calculate file hash (SHA-256)
3. Check for duplicates via API /api/asset/check-duplicate
4. If unique, upload to IPFS (pinning service)
5. Receive IPFS CID
6. Create metadata JSON (name, description, tags, image)
7. Upload metadata to IPFS
8. Call AssetRegistry.registerAsset(metadataURI, royaltyBPS)
9. Receive AssetNFT minted to creator
10. Save to database via /api/asset/register
```

**Smart Contract** (`AssetRegistry.registerAsset()`):
```solidity
1. Validate royaltyBPS <= 10000
2. Increment asset counter
3. Call AssetNFT.mintFor(creator, metadataURI)
4. Store Asset struct in mapping
5. Emit AssetRegistered event
```

**Duplicate Detection**:
- **Exact**: IPFS CID match (same file = same CID)
- **Hash**: SHA-256 comparison
- **Perceptual**: pHash for images, Chromaprint for audio
- **Threshold**: Hamming distance < 10 for near-duplicates

### 2. Fractionalization Flow

**Frontend** (`src/app/fractionalize/page.tsx`):
```typescript
1. User selects owned AssetNFT (fetch from AssetRegistry)
2. Configure fractionalization parameters:
   - Token name & symbol
   - Total supply (e.g., 10,000 tokens)
   - Sale price per token (e.g., 0.001 ETH)
   - Amount for sale (e.g., 5,000 tokens)
3. Approve AssetNFT to Fractionalizer contract
4. Call Fractionalizer.fractionalize(...)
5. Wait for transaction confirmation
6. FractionalToken deployed & minted
7. NFT locked in Fractionalizer
8. Save fractional token metadata to database
```

**Smart Contract** (`Fractionalizer.fractionalize()`):
```solidity
1. Validate parameters (totalSupply > 0, amountForSale <= totalSupply, etc.)
2. Check asset exists in AssetRegistry
3. Check asset not already fractionalized
4. Transfer AssetNFT from owner to Fractionalizer (requires approval)
5. Deploy new FractionalToken contract
6. Mint totalSupply to toReceiveInitial (creator)
7. Create Pool struct with sale parameters
8. Set assetToPool mapping
9. Set poolId in FractionalToken (for hook callback)
10. Emit Fractionalized event
```

### 3. Primary Fraction Sale Flow

**Frontend** (`src/app/pools/page.tsx`):
```typescript
1. Display all active pools with sale data
2. User enters amount to buy
3. Calculate cost: (amount * salePricePerToken) / 1e18
4. User approves seller to spend their FT (if buying from creator)
5. Call Fractionalizer.buyFractions(poolId, amount) with ETH value
6. Transaction confirmed
7. FT tokens transferred to buyer
8. ETH sent to seller (creator)
```

**Smart Contract** (`Fractionalizer.buyFractions()`):
```solidity
1. Validate pool active & amount available
2. Calculate cost = (amount * salePricePerToken) / 1e18
3. Check msg.value == cost
4. Get FractionalToken contract
5. Transfer FT from originalOwner to buyer (requires allowance)
6. Increment sold counter
7. Send ETH to seller (originalOwner)
8. Emit FractionsBought event
```

### 4. License Purchase Flow

**Frontend** (`src/app/marketplace/page.tsx`):
```typescript
1. Browse assets and license offers
2. Select asset & license preset (Commercial / Marketing / Edu)
3. Review license terms (via LicensePreset.getRightsSummary())
4. Confirm purchase
5. Call LicenseManager.buyLicense(offerId) with ETH value
6. Receive LicenseNFT
7. Download asset file (via /api/download-asset with license proof)
8. Save license to database via /api/license/purchase
```

**Smart Contract** (`LicenseManager.buyLicense()`):
```solidity
1. Validate offer active & payment sufficient
2. Check supply (maxSupply) if applicable
3. Handle exclusive lock (set exclusiveExpiry if EXCLUSIVE)
4. Mint LicenseNFT to buyer
5. Increment sold counter
6. Get poolId for asset (if fractionalized)
7. If poolId exists:
   - Forward payment to Fractionalizer.depositToPool()
   - Royalties distributed to FT holders
8. Else:
   - Send payment directly to seller
9. Refund overpayment
10. Deactivate offer if maxSupply reached (e.g., EXCLUSIVE)
11. Emit LicensePurchased event
```

### 5. Royalty Distribution Flow

**Payment** (`LicenseManager.buyLicense()` → `Fractionalizer.depositToPool()`):
```solidity
1. License payment received
2. Call Fractionalizer.depositToPool(poolId) with payment value
3. Update dividendsPerToken:
   dividendsPerToken += (msg.value * 1e18) / totalFractions
4. Emit DividendsDeposited event
```

**Claiming** (`Fractionalizer.claimDividends()`):
```solidity
1. Get FT balance of msg.sender
2. Calculate totalEntitled = (balance * dividendsPerToken) / 1e18
3. Subtract already withdrawn amount
4. Calculate claimable = totalEntitled - withdrawn[msg.sender]
5. Update withdrawn[msg.sender] = totalEntitled
6. Transfer claimable ETH to msg.sender
7. Emit DividendClaimed event
```

**Fair Distribution via Hook**:

When FT transfers from A → B:
```solidity
function onFTTransfer(poolId, from, to, amount) {
    // Prevent B from claiming dividends earned before they owned tokens
    uint256 accumulatedDividends = (amount * dividendsPerToken) / 1e18;
    withdrawn[to] += accumulatedDividends;
}
```

**Example**:
- Pool has 10,000 FT, dividendsPerToken = 2e18 (means 2 ETH distributed per token)
- Alice holds 1,000 FT
- Total entitled = (1,000 * 2e18) / 1e18 = 2,000 ETH
- Alice already withdrew 500 ETH
- Claimable = 2,000 - 500 = 1,500 ETH

- Alice transfers 100 FT to Bob
- Bob's withdrawn updated: withdrawn[Bob] += (100 * 2e18) / 1e18 = 200 ETH
- Bob can only claim dividends earned AFTER receiving tokens

### 6. Secondary Market Trading (On-chain)

**Create Sell Order** (`SecondaryMarket.createSellOrder()`):
```solidity
1. Validate ftAddress, amount > 0, pricePerToken > 0
2. Check seller has sufficient FT balance
3. Check seller approved contract (or use permit)
4. Transfer FT from seller to contract (escrow)
5. Increment order counter
6. Create Order struct
7. Add to poolOrders & sellerOrders mappings
8. Emit OrderCreated event
```

**Buy from Order** (`SecondaryMarket.buyFromOrder()`):
```solidity
1. Validate order active & amount available
2. Calculate totalPrice = (amount * pricePerToken) / 1e18
3. Calculate platform fee (2.5% default)
4. Deduct amount from order (or deactivate if filled)
5. Transfer FT from contract to buyer
6. Send (totalPrice - fee) to seller
7. Send fee to feeRecipient
8. Refund excess ETH to buyer
9. Emit OrderFilled event
```

### 7. Hybrid Order Book Trading (Off-chain + On-chain)

**Off-chain Order Creation**:
```typescript
// Frontend (src/hooks/useSignOrder.ts)
1. User creates order (BID or ASK)
2. Generate orderId (UUID)
3. Build EIP-712 typed data:
   const domain = {
     name: "Lixa Order Book",
     version: "1",
     chainId: 1315,
     verifyingContract: orderBookAddress
   };

   const types = {
     Order: [
       { name: "orderId", type: "string" },
       { name: "side", type: "string" },
       { name: "poolId", type: "uint256" },
       { name: "ftAddress", type: "address" },
       { name: "amount", type: "uint256" },
       { name: "pricePerToken", type: "uint256" },
       { name: "userAddress", type: "address" },
       { name: "nonce", type: "uint256" },
       { name: "expiresAt", type: "uint256" }
     ]
   };

   const value = { orderId, side, poolId, ... };

4. Sign with wallet: signTypedData(domain, types, value)
5. Send order + signature to backend API: POST /api/orders/create
6. Backend stores in database (Order model)
```

**Order Matching**:
```typescript
// Backend (src/app/api/orders/match/route.ts)
1. Receive new order
2. Find compatible counter-orders:
   - BID matches ASK with same/lower price
   - ASK matches BID with same/higher price
   - Same poolId & ftAddress
   - Not expired
3. Create OrderMatch record (status: PENDING)
4. Return match details to frontend
```

**On-chain Settlement**:
```typescript
// Frontend calls executeTrade
1. Get matched orders from database
2. Prepare transaction data:
   - buyOrder (Order struct)
   - buySignature (bytes)
   - sellOrder (Order struct)
   - sellSignature (bytes)
   - amount (matched amount)
3. Call OrderBook.executeTrade() with ETH value
4. Contract verifies signatures (EIP-712 recover)
5. Execute transfers:
   - Buyer's ETH → Seller (minus platform fee)
   - Seller's FT → Buyer
6. Update executedAmounts mapping
7. Backend updates OrderMatch (status: SETTLED, txHash)
8. Backend updates Order filledAmount & status
```

**EIP-712 Signature Verification** (`OrderBook._verifyOrderSignature()`):
```solidity
1. Hash order struct:
   bytes32 structHash = keccak256(abi.encode(
     ORDER_TYPEHASH,
     keccak256(bytes(orderId)),
     keccak256(bytes(side)),
     poolId, ftAddress, amount, pricePerToken,
     userAddress, nonce, expiresAt
   ));

2. Get EIP-712 digest:
   bytes32 digest = _hashTypedDataV4(structHash);

3. Recover signer:
   address recovered = ECDSA.recover(digest, signature);

4. Verify:
   require(recovered == order.userAddress, "Invalid signature");
```

### 8. Recombination Flow

**Requirements**:
- User must own 100% of FT supply
- User must approve Fractionalizer to burn their FT

**Smart Contract** (`Fractionalizer.recombineAndWithdraw()`):
```solidity
1. Validate pool active
2. Check caller owns all fractions (balance == totalFractions)
3. Burn all FT from caller (requires approval)
4. Transfer AssetNFT from contract back to caller
5. Set pool.active = false
6. Clear assetToPool mapping
7. Emit Recombined event
```

---

## Technology Stack

### Smart Contracts
- **Solidity**: 0.8.24
- **Framework**: Foundry (Forge, Cast, Anvil)
- **Libraries**: OpenZeppelin Contracts v5
- **Compiler**: Solc with IR optimization (`via_ir = true`)
- **Optimizer Runs**: 200
- **EVM Version**: Paris

### Storage
- **IPFS**: Asset files & metadata (CID-based addressing)
- **On-chain**: License terms, ownership, royalty accounting
- **Database**: SQLite (dev), PostgreSQL (production)

### Frontend
- **Framework**: Next.js 16 (App Router, React 19)
- **Styling**: Tailwind CSS 4
- **Web3**: wagmi, viem, RainbowKit
- **State**: TanStack Query, Valtio
- **Database ORM**: Prisma

### Build & Deployment
- **Foundry**: Smart contract compilation & testing
- **Vercel**: Frontend hosting (Next.js)
- **Story Network**: Blockchain deployment (testnet)
- **Pinata / Infura**: IPFS pinning service

---

## Features

### Core Features
✅ **Programmable Licensing**: 3 preset licenses (Commercial, Marketing, Edu/Indie)
✅ **Fractional Royalty**: Split revenue streams into ERC-20 tokens
✅ **On-chain Receipts**: License NFT as proof of purchase
✅ **Automatic Distribution**: Claim royalties anytime, pro-rata
✅ **Transparent & Auditable**: All transactions on-chain

### Advanced Features
✅ **Secondary Market**: Trade fraction tokens (on-chain order book)
✅ **Hybrid Trading**: Off-chain orders, on-chain settlement (gas optimization)
✅ **EIP-712 Signatures**: Gasless order creation
✅ **Duplicate Detection**: Multi-layer (exact + perceptual hashing)
✅ **Recombination**: Burn fractions → unlock NFT
✅ **Fair Dividends**: Transfer hook prevents gaming
✅ **Permit Support**: Gasless approvals (ERC20Permit)

### Planned Features
🔮 **Analytics Dashboard**: Sales, royalties, holders tracking
🔮 **Attestation Service**: IP verification (Story Protocol integration)
🔮 **Remix Tracking**: Derivative asset lineage
🔮 **Revenue Oracle**: Off-chain revenue verification (for EDU/INDIE cap)
🔮 **Multi-chain**: Deploy to multiple EVM chains
🔮 **Governance DAO**: Community-driven platform decisions

---

## User Flows

### Creator Flow
```
1. Upload asset to IPFS (via frontend)
2. Register asset → AssetNFT minted
3. (Optional) Fractionalize:
   - Lock NFT
   - Mint 10,000 fraction tokens
   - Set primary sale price (e.g., 0.001 ETH per token)
4. Create license offers:
   - Commercial: 0.5 ETH
   - Marketing: 0.1 ETH
   - Edu/Indie: 0.02 ETH
5. List on Lixa marketplace
6. Receive royalties when licenses are sold
```

### Buyer Flow (License Purchase)
```
1. Browse Lixa catalog
2. Find asset, see license preset badge
3. Check license terms (rights summary)
4. Buy license → License NFT minted
5. Payment goes to Royalty Vault (if fractionalized) or seller
6. Download asset file
7. Use asset according to license terms
```

### Investor Flow (Fraction Holder)
```
1. Browse fractionalized assets
2. Buy fraction tokens:
   - Primary sale (from creator)
   - Secondary market (from other holders)
3. When licenses are sold → royalties accumulate in vault
4. Claim dividends anytime (pro-rata to token holdings)
5. Trade FT on secondary market for liquidity
```

### Trader Flow (Secondary Market)
```
1. View order book for fractional pool
2. Option A (On-chain order book):
   - Create sell order (escrow FT)
   - Buyer fills order (instant settlement)
3. Option B (Hybrid order book):
   - Sign order off-chain (no gas)
   - Backend matches with counter-order
   - Execute settlement on-chain (single tx for both parties)
4. Monitor portfolio & PnL
```

---

## Security

### Implemented Security Measures
✅ **ReentrancyGuard**: All payable/state-changing functions
✅ **CEI Pattern**: Checks-Effects-Interactions ordering
✅ **Access Control**: Ownable, custom modifiers (onlyRegistry, onlyManager)
✅ **Overflow-safe Math**: Solidity 0.8.24 built-in checks
✅ **OpenZeppelin**: Battle-tested contract libraries
✅ **Pull Payments**: Claim dividends (vs. push pattern)
✅ **Input Validation**: Require statements for all parameters
✅ **Fair Accounting**: Transfer hook for dividend distribution

### Potential Attack Vectors & Mitigations

**1. Dividend Gaming Attack**
- **Attack**: Transfer FT just before dividend deposit, claim, transfer back
- **Mitigation**: `onFTTransfer()` hook updates `withdrawn` mapping for receiver

**2. Reentrancy**
- **Attack**: Reenter contract during ETH transfer
- **Mitigation**: ReentrancyGuard + CEI pattern (update state before external calls)

**3. Front-running**
- **Attack**: Front-run license purchase to fractionalize and capture royalties
- **Mitigation**: Asset can only be fractionalized once (check `assetToPool` mapping)

**4. Signature Replay**
- **Attack**: Reuse old signatures for order execution
- **Mitigation**:
  - Nonce tracking (`userNonces` mapping)
  - Order expiration (`expiresAt` timestamp)
  - `executedAmounts` prevents double-execution

**5. Order Griefing**
- **Attack**: Create orders, never settle
- **Mitigation**:
  - Order expiration
  - Off-chain matching engine filters expired orders
  - On-chain validation of expiry

### Security Roadmap
🔜 **Full Test Coverage**: Target >90% (currently basic tests)
🔜 **Static Analysis**: Slither, Mythril scans
🔜 **Formal Verification**: Key functions (dividend math, transfer hook)
🔜 **External Audit**: Professional security audit before mainnet
🔜 **Bug Bounty**: Immunefi program post-audit

---

## Deployment

### Development (Local)

**1. Start Local Node**:
```bash
anvil
```

**2. Deploy Contracts**:
```bash
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

**3. Save Deployment Addresses**:
Contract addresses saved to `deployments/anvil.txt`

**4. Start Frontend**:
```bash
cd frontend
npm install
npm run dev
```

**5. Configure Environment**:
```bash
# frontend/.env.local
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_ASSET_NFT_ADDRESS="0x..."
NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS="0x..."
NEXT_PUBLIC_FRACTIONALIZER_ADDRESS="0x..."
NEXT_PUBLIC_LICENSE_NFT_ADDRESS="0x..."
NEXT_PUBLIC_LICENSE_MANAGER_ADDRESS="0x..."
NEXT_PUBLIC_SECONDARY_MARKET_ADDRESS="0x..."
NEXT_PUBLIC_ORDER_BOOK_ADDRESS="0x..."
NEXT_PUBLIC_CHAIN_ID="31337"
```

### Testnet Deployment (Story Network)

**1. Configure Environment**:
```bash
# .env
STORY_TESTNET_RPC_URL="https://rpc.testnet.story.xyz"
PRIVATE_KEY="0x..."
ETHERSCAN_API_KEY="..."
```

**2. Deploy Contracts**:
```bash
forge script script/Deploy.s.sol \
  --rpc-url $STORY_TESTNET_RPC_URL \
  --broadcast \
  --verify
```

**3. Update Frontend Config**:
Update contract addresses in `frontend/.env.local`

**4. Deploy Frontend (Vercel)**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod
```

**5. Configure Vercel Environment**:
- Set all `NEXT_PUBLIC_*` variables in Vercel dashboard
- Set `DATABASE_URL` for PostgreSQL (Neon, Supabase, etc.)
- Enable Prisma build: `prisma generate` in build command

### Current Deployment

**Chain**: Story Testnet (Chain ID: 1315)
**Explorer**: https://aeneid.storyscan.xyz

**Contract Addresses** (from `deployments/latest.txt`):
- AssetNFT: [Check deployments/latest.txt]
- AssetRegistry: [Check deployments/latest.txt]
- Fractionalizer: [Check deployments/latest.txt]
- LicenseNFT: [Check deployments/latest.txt]
- LicenseManager: [Check deployments/latest.txt]
- SecondaryMarket: [Check deployments/latest.txt]
- OrderBook: [Check deployments/latest.txt]

**Frontend**: [Vercel deployment URL]

---

## Development Workflow

### Testing Smart Contracts

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testFractionalize

# Gas report
forge test --gas-report

# Coverage report
forge coverage
```

### Formatting Code

```bash
# Format Solidity
forge fmt

# Check formatting
forge fmt --check

# Format TypeScript/React
cd frontend
npm run lint
```

### Database Migrations

```bash
cd frontend

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# View data
npx prisma studio
```

### Running Frontend

```bash
cd frontend

# Development
npm run dev

# Build
npm run build

# Production
npm run start

# Check types
npx tsc --noEmit
```

---

## Project Status

### ✅ Completed (v0.1)
- [x] Core smart contracts (7 contracts)
- [x] License preset system (3 presets)
- [x] Fractional token mechanism
- [x] Royalty vault with dividend distribution
- [x] Primary fraction sale
- [x] License NFT minting
- [x] Secondary market (on-chain)
- [x] Hybrid order book (off-chain + on-chain)
- [x] EIP-712 signature system
- [x] Frontend UI (Next.js)
- [x] IPFS integration
- [x] Duplicate detection (exact + perceptual)
- [x] Database schema (Prisma)
- [x] Deployment to Story Testnet
- [x] Vercel frontend deployment

### ⏳ In Progress
- [ ] Comprehensive unit tests
- [ ] Integration tests (frontend + contracts)
- [ ] Analytics dashboard
- [ ] WebSocket for real-time order book
- [ ] Improve UX/UI design

### 🔮 Roadmap (v0.2+)
- [ ] Attestation service (IP verification)
- [ ] Remix/derivative tracking
- [ ] Revenue oracle integration (for EDU/INDIE cap)
- [ ] Multi-chain deployment (Polygon, Arbitrum, Base)
- [ ] Governance DAO
- [ ] Mobile app (React Native)
- [ ] Creator tools (asset templates, license builder)
- [ ] Advanced analytics (ROI calculator, market trends)

---

## Resources

### Documentation
- Smart Contracts: `src/contract/*.sol`
- Frontend: `frontend/src/**`
- Database: `frontend/prisma/schema.prisma`
- API Routes: `frontend/src/app/api/**`

### External Links
- **Foundry**: https://book.getfoundry.sh/
- **OpenZeppelin**: https://docs.openzeppelin.com/contracts/5.x/
- **Next.js**: https://nextjs.org/docs
- **Prisma**: https://www.prisma.io/docs
- **wagmi**: https://wagmi.sh/
- **RainbowKit**: https://www.rainbowkit.com/docs/introduction
- **Story Protocol**: https://docs.story.foundation/
- **IPFS**: https://docs.ipfs.tech/

### Repository Structure
```
Lixa/
├── src/
│   ├── contract/
│   │   ├── MarketAsset.sol       # Main contracts
│   │   ├── LicensePreset.sol     # License library
│   │   ├── SecondaryMarket.sol   # On-chain order book
│   │   └── OrderBook.sol         # Hybrid order book
│   └── interface/
│       └── IFracHook.sol         # Hook interface
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js pages (App Router)
│   │   ├── components/           # React components
│   │   ├── hooks/                # Custom hooks
│   │   └── lib/                  # Utilities
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── public/                   # Static assets
├── script/
│   └── Deploy.s.sol              # Deployment scripts
├── test/
│   └── *.t.sol                   # Contract tests
├── deployments/                  # Deployment records
├── lib/                          # Dependencies (git submodules)
├── foundry.toml                  # Foundry config
└── README.md                     # Project overview
```

---

## Contributors

**Imanuel** - Full-stack Blockchain Developer
- Smart contract architecture
- Frontend development
- IPFS integration
- Deployment & DevOps

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

**Built with ❤️ for the future of game asset licensing.**

*Lixa - License. Fraction. Earn.*