# Lixa - License Exchange for Game Assets

> **"License. Fraction. Earn."**

Lixa adalah marketplace aset game dengan lisensi on-chain dan royalti terprogram yang bisa di-fractional dan diklaim real-time.

---

## 🎯 What is Lixa?

Dengan Lixa, kreator mendaftarkan aset sebagai IP on-chain, menetapkan lisensi siap pakai, lalu memecah arus royalti menjadi token fraksional. Pembeli lisensi mendapat bukti on-chain, investor memegang fraction, dan semua pihak menerima bagi hasil transparan dari vault. **Cepat, jelas, dan likuid.**

### 30-Second Pitch
Dengan Lixa, kreator mendaftarkan aset sebagai IP on-chain, menetapkan lisensi siap pakai, lalu memecah arus royalti menjadi token fraksional. Pembeli lisensi mendapat bukti on-chain, investor memegang fraction, dan semua pihak menerima bagi hasil transparan dari vault. Cepat, jelas, dan likuid — sesuai misi IPFi.

### Key Features
- ✅ **Programmable Licensing**: 3 preset licenses (Commercial, Marketing, Edu/Indie)
- ✅ **Fractional Royalty**: Split revenue streams into ERC-20 tokens
- ✅ **On-chain Receipts**: License NFT as proof of purchase
- ✅ **Automatic Distribution**: Claim royalties anytime, pro-rata
- ✅ **Transparent & Auditable**: All transactions on-chain

### Alternative Taglines
- License. Fraction. Earn. ⭐ (Primary)
- Program your royalties.
- Own the rights, share the upside.
- Where game assets become income.
- Mint IP, split the value.
- License smarter, earn together.

---

## 🏗️ Smart Contracts Architecture

### Core Contracts

1. **AssetNFT** (`src/contract/MarketAsset.sol:45-71`)
   - ERC-721 representing IP asset ownership
   - Minted when creator registers asset
   - Stores metadata CID (IPFS)

2. **AssetRegistry** (`src/contract/MarketAsset.sol:103-166`)
   - Register game assets (3D models, sprites, music, UI kits)
   - Automatic AssetNFT minting
   - Tracks creator, royalty percentage, metadata

3. **FractionalToken** (`src/contract/MarketAsset.sol:74-100`)
   - ERC-20 burnable token
   - Represents fractional ownership of royalty stream
   - One token type per asset

4. **Fractionalizer** (`src/contract/MarketAsset.sol:177-436`)
   - Lock NFT → mint fractional tokens
   - Manage primary sale of fractions (fixed price)
   - Royalty vault with dividend distribution (pull-based)
   - Support recombine (burn all fractions → unlock NFT)
   - Fair dividend accounting with `dividendsPerToken`

5. **LicenseNFT** (`src/contract/MarketAsset.sol:439-465`)
   - ERC-721 as proof of license purchase
   - Could be made non-transferable (SBT) in future

6. **LicenseManager** (`src/contract/MarketAsset.sol:474-694`)
   - Create license offers with preset terms
   - Sell licenses → mint License NFT
   - Forward payments to Fractionalizer vault
   - Support EXCLUSIVE/NON_EXCLUSIVE/DERIVATIVE types
   - Integrated with LicensePreset library

7. **LicensePreset** (`src/contract/LicensePreset.sol`)
   - Library defining 3 preset license types
   - **IN_GAME_COMMERCIAL_V1**: Full commercial rights
   - **TRAILER_MARKETING_V1**: Promo materials only
   - **EDU_INDIE_V1**: Educational/indie with revenue cap
   - Built-in validation logic

---

## 🎮 License Preset System

Lixa menyediakan **3 preset license** yang terstandar:

### 1. IN_GAME_COMMERCIAL_V1
**Target:** Studio game komersial (AAA, mid-tier, commercial indie)

**Rights:**
- ✅ Commercial game usage (unlimited revenue)
- ✅ In-game integration & modification
- ✅ Marketing materials allowed
- ❌ Cannot resell raw asset
- 📝 Attribution required

**Example:** Studio buys 3D dragon model, uses in Steam game, modifies texture, uses in trailer ✅

---

### 2. TRAILER_MARKETING_V1
**Target:** Marketing agencies, content creators

**Rights:**
- ✅ Promotional materials (trailers, posters, social media)
- ❌ **NOT for in-game usage**
- ✅ Modification for promo needs
- 📝 Attribution required

**Example:** Agency buys city model for game trailer and Steam banner, but NOT in actual game ✅

---

### 3. EDU_INDIE_V1
**Target:** Students, hobbyists, small indie developers

**Rights:**
- ✅ Educational projects & indie games
- ✅ Full in-game integration
- ⚠️ **Revenue cap: $100,000/year**
- 🔒 Non-transferable license
- 📝 Attribution required

**Example:** Student uses for thesis game, indie dev releases on itch.io with <$100k revenue ✅

📚 **Full Documentation:** [docs/LIXA_LICENSE_PRESET.md](docs/LIXA_LICENSE_PRESET.md)

---

## 🔄 User Flows

### Creator Flow
```
1. Upload asset to IPFS
2. Register asset → AssetNFT minted
3. Fractionalize (optional) → Lock NFT, mint 10,000 fraction tokens
4. Create license offers:
   - Commercial: 0.5 ETH
   - Marketing: 0.1 ETH
   - Edu/Indie: 0.02 ETH
5. List on Lixa marketplace
```

### Buyer Flow (License Purchase)
```
1. Browse Lixa catalog
2. Find asset, see license preset badge
3. Check license terms (rights summary)
4. Buy license → License NFT minted
5. Payment goes to Royalty Vault
6. Use asset according to license terms
```

### Investor Flow (Fraction Holder)
```
1. Browse fractionalized assets
2. Buy fraction tokens (primary or secondary market)
3. When licenses are sold → royalties accumulate in vault
4. Claim dividends anytime (pro-rata to token holdings)
```

---

## 🛠️ Tech Stack

### Smart Contracts
- **Solidity**: 0.8.24
- **Framework**: Foundry (Forge, Cast, Anvil)
- **Libraries**: OpenZeppelin Contracts v5
- **Compiler**: Solc with IR optimization (`via_ir = true`)
- **EVM Version**: Paris

### Storage
- **IPFS**: Asset files & metadata (pinning service TBD)
- **On-chain**: License terms, ownership, royalty accounting

### Frontend (Planned)
- **Framework**: Next.js
- **Wallet**: wagmi + RainbowKit
- **State**: Zustand
- **Data**: TanStack Query
- **Charts**: Recharts / Chart.js

---

## 🚀 Quick Start

### Prerequisites
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify installation
forge --version
```

### Installation
```bash
# Clone repository
git clone <repo-url>
cd ipmarket

# Install dependencies
forge install

# Build contracts
forge build
```

### Testing
```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testFractionalize

# Gas report
forge test --gas-report
```

### Local Development
```bash
# Start local node (Anvil)
anvil

# Deploy to local node (in another terminal)
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Interact with contracts
cast call <contract-address> "totalAssets()" --rpc-url http://localhost:8545
```

### Format Code
```bash
# Format all Solidity files
forge fmt

# Check formatting
forge fmt --check
```

---

## 📁 Project Structure

```
.
├── src/
│   ├── contract/
│   │   ├── MarketAsset.sol       # Main contracts (AssetNFT, Registry, Fractionalizer, etc.)
│   │   └── LicensePreset.sol     # License preset library
│   └── interface/
│       └── IFracHook.sol         # Hook interface for fraction transfer tracking
├── test/
│   └── Counter.t.sol             # Tests (TODO: expand)
├── script/
│   └── Counter.s.sol             # Deploy scripts (TODO: update)
├── docs/
│   └── LIXA_LICENSE_PRESET.md    # License preset documentation
├── lib/                          # Dependencies (git submodules)
│   ├── forge-std/
│   └── openzeppelin-contracts/
├── foundry.toml                  # Foundry configuration
└── README.md                     # This file
```

---

## 📋 Development Status

### ✅ Completed (v0.1)
- [x] Core smart contracts (AssetNFT, Registry, Fractionalizer, LicenseManager)
- [x] License preset system (3 presets)
- [x] Fractional token mechanism
- [x] Royalty vault with dividend distribution
- [x] Primary fraction sale
- [x] License NFT minting
- [x] Build configuration fixed

### ⏳ In Progress
- [ ] Comprehensive unit tests
- [ ] IFracHook implementation (transfer tracking)
- [ ] Secondary market for fractions
- [ ] Deploy scripts

### 🔮 Roadmap (v0.2+)
- [ ] Frontend UI (Next.js)
- [ ] IPFS integration & pinning
- [ ] Analytics dashboard (sales, royalties, holders)
- [ ] Attestation service (IP verification)
- [ ] Remix/derivative tracking
- [ ] Revenue oracle integration (for EDU/INDIE cap)
- [ ] Multi-chain deployment
- [ ] Governance DAO

---

## 🧪 Testing Guide

```bash
# Test asset registration
forge test --match-test testRegisterAsset -vvv

# Test fractionalization
forge test --match-test testFractionalize -vvv

# Test license purchase flow
forge test --match-test testBuyLicense -vvv

# Test royalty claim
forge test --match-test testClaimDividends -vvv

# Test preset license terms
forge test --match-test testGetPresetTerms -vvv
```

---

## 🔐 Security Considerations

### Implemented
- ✅ ReentrancyGuard on all payable functions
- ✅ CEI pattern (Checks-Effects-Interactions)
- ✅ Access control (Ownable, custom modifiers)
- ✅ Overflow-safe math (Solidity 0.8.24)
- ✅ OpenZeppelin battle-tested contracts

### TODO
- [ ] Full test coverage (target: >90%)
- [ ] Slither static analysis
- [ ] Mythril security scan
- [ ] External audit (pre-mainnet)
- [ ] Bug bounty program

---

## 📊 Gas Optimization

Current optimizations:
- IR-based compilation (`via_ir = true`)
- Optimizer runs: 200
- Immutable variables where applicable
- Storage packing

Run gas report:
```bash
forge test --gas-report
```

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Code Style
- Follow Solidity style guide
- Use `forge fmt` before committing
- Add NatSpec comments for public functions
- Write tests for new features

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🔗 Links

- **Website**: lixa.app (TBD)
- **Documentation**: docs.lixa.app (TBD)
- **Twitter**: [@lixa_xyz](https://twitter.com/lixa_xyz) (TBD)
- **Discord**: discord.gg/lixa (TBD)
- **GitHub**: [github.com/lixa](https://github.com/lixa) (TBD)

---

## 📞 Contact

For questions, feedback, or partnership inquiries:
- Email: hello@lixa.app (TBD)
- Discord: Join our community (TBD)

---

## 🙏 Acknowledgments

- **Story Protocol**: For IPFi framework inspiration
- **OpenZeppelin**: For secure contract libraries
- **Foundry**: For amazing dev tooling
- **Game Asset Community**: For feedback on licensing needs

---

**Built with ❤️ for the future of game asset licensing.**

*Lixa - License. Fraction. Earn.*
