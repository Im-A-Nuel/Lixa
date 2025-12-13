# Lixa - License Exchange for Game Assets
## Project Presentation

> **"License. Fraction. Earn."**

---

## Slide 1: The Problem

### Challenges in Game Asset Licensing

**For Creators:**
- 💸 No upfront funding for asset production
- 📜 Licensing agreements are complex and unverifiable
- 🔒 No liquidity for future revenue streams
- 😞 Difficulty monetizing their work

**For Buyers:**
- ❓ Unclear license terms and rights
- 🚫 Risk of copyright infringement
- 💰 High upfront costs for quality assets
- 🕵️ No way to verify authentic licenses

**For Investors:**
- 🎯 No way to invest in creative talent
- 📊 No transparency in revenue distribution
- 💼 Illiquid investment opportunities

---

## Slide 2: The Solution - Lixa

### A Complete Ecosystem for Game Asset Licensing

**Three Core Innovations:**

1. **📝 Programmable Licensing**
   - Standardized license presets (Commercial, Marketing, Edu/Indie)
   - Smart contract enforcement
   - NFT proof of purchase

2. **🧩 Fractional Ownership**
   - Split royalty streams into tradeable tokens
   - Creators get upfront funding
   - Investors earn passive income

3. **💎 Transparent Distribution**
   - Automatic royalty splitting
   - Real-time claimable dividends
   - Zero intermediaries

---

## Slide 3: How It Works

### The Lixa Flow

```
┌─────────────┐
│   CREATOR   │ Uploads 3D model to IPFS
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Register Asset     │ Mints AssetNFT (IP ownership)
│  on Blockchain      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Fractionalize      │ Lock NFT → Mint 10,000 tokens
│  (Optional)         │ Sell 50% to investors @ 0.001 ETH
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Create Licenses    │ Commercial: 0.5 ETH
│                     │ Marketing: 0.1 ETH
│                     │ Edu/Indie: 0.02 ETH
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Game Studio Buys   │ Pays 0.5 ETH for Commercial License
│  License            │ Receives LicenseNFT
└──────┬──────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Royalty Distribution           │
├─────────────────────────────────┤
│ Creator (50%): 0.25 ETH        │
│ Investors (50%): 0.25 ETH      │
│ → Distributed to 5,000 token holders
└─────────────────────────────────┘
```

---

## Slide 4: License Preset System

### Three Standardized Licenses

#### 1. **IN_GAME_COMMERCIAL_V1** 🎮
**Target**: AAA Studios, Commercial Indie Games

**Rights**:
- ✅ Use in commercial games (unlimited revenue)
- ✅ Modify textures, animations, integrate with engine
- ✅ Include in marketing materials
- ❌ Cannot resell as standalone asset
- 📝 Attribution required

**Price Range**: 0.3 - 2 ETH

---

#### 2. **TRAILER_MARKETING_V1** 🎬
**Target**: Marketing Agencies, Content Creators

**Rights**:
- ✅ Game trailers, promotional videos, social media
- ✅ Modify for promotional purposes
- ❌ **NOT for in-game usage**
- 📝 Attribution required

**Price Range**: 0.05 - 0.3 ETH

---

#### 3. **EDU_INDIE_V1** 🎓
**Target**: Students, Hobbyists, Small Indies

**Rights**:
- ✅ Educational projects, student games
- ✅ Full in-game integration
- ⚠️ **Revenue cap: $100,000/year**
- 🔒 Non-transferable
- 📝 Attribution required

**Price Range**: 0.01 - 0.1 ETH

---

## Slide 5: Technical Architecture

### Smart Contract System

```
┌──────────────────────────────────────────────────────────┐
│                     CORE CONTRACTS                       │
└──────────────────────────────────────────────────────────┘

┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  AssetRegistry  │  │ Fractionalizer   │  │ LicenseManager  │
│  + AssetNFT     │  │+ FractionalToken │  │  + LicenseNFT   │
├─────────────────┤  ├──────────────────┤  ├─────────────────┤
│ • Register IP   │  │ • Lock NFT       │  │ • Create offer  │
│ • Mint NFT      │  │ • Mint FT (ERC20)│  │ • Buy license   │
│ • Track creator │  │ • Primary sale   │  │ • Mint proof    │
│                 │  │ • Royalty vault  │  │ • Forward $$$   │
└─────────────────┘  └──────────────────┘  └─────────────────┘
         │                    │                      │
         └────────────────────┼──────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
┌────────▼────────┐                  ┌─────────────▼──────┐
│ SecondaryMarket │                  │    OrderBook       │
├─────────────────┤                  ├────────────────────┤
│ • On-chain      │                  │ • Off-chain orders │
│ • ASK orders    │                  │ • EIP-712 sigs     │
│ • Instant fill  │                  │ • On-chain settle  │
│ • 2.5% fee      │                  │ • Gas optimized    │
└─────────────────┘                  └────────────────────┘
```

---

## Slide 6: Key Features

### What Makes Lixa Unique?

#### ✅ **On-chain IP Rights**
- Immutable license terms on blockchain
- NFT proof of ownership
- Verifiable and transferable

#### ✅ **Fractional Royalties**
- Split future revenue into ERC-20 tokens
- Trade on secondary market
- Real liquidity for creators

#### ✅ **Automatic Distribution**
- Smart contract-powered payouts
- Claim anytime (pull-based)
- Fair accounting with transfer hooks

#### ✅ **Dual Trading System**
- On-chain: Instant settlement, escrow-based
- Hybrid: Off-chain orders, on-chain execution (gas savings)

#### ✅ **Anti-Duplicate Detection**
- IPFS CID matching (exact duplicates)
- Perceptual hashing (near-duplicates)
- SHA-256 file hash verification

---

## Slide 7: Technology Stack

### Built on Cutting-Edge Tech

#### **Blockchain Layer**
- **Solidity 0.8.24** - Smart contracts
- **Foundry** - Development framework
- **OpenZeppelin** - Battle-tested libraries
- **Story Network** - IPFi-focused blockchain

#### **Frontend Layer**
- **Next.js 16** - React framework (App Router)
- **wagmi + viem** - Ethereum interactions
- **RainbowKit** - Wallet connection
- **Prisma** - Database ORM
- **Tailwind CSS** - Styling

#### **Storage Layer**
- **IPFS** - Decentralized file storage
- **Pinata** - IPFS pinning service
- **PostgreSQL** - Off-chain data (orders, analytics)

---

## Slide 8: User Flows

### Three User Personas

#### **1. Creator (Asset Producer)**
```
1. Upload 3D model → IPFS
2. Register asset → Get AssetNFT
3. Fractionalize (optional) → Sell 50% for 5 ETH
4. Create license offers → Commercial, Marketing, Edu
5. Earn royalties → Automatic distribution
```

**Value**: Upfront funding + ongoing royalties

---

#### **2. Buyer (Game Studio)**
```
1. Browse marketplace
2. Find dragon model
3. Buy Commercial license → 0.5 ETH
4. Receive LicenseNFT
5. Download & use in game
```

**Value**: Clear rights, on-chain proof, instant access

---

#### **3. Investor (Token Holder)**
```
1. Buy 1,000 fraction tokens → 1 ETH (primary sale)
2. Hold or trade on secondary market
3. When licenses sold → Royalties accumulate
4. Claim dividends → 0.15 ETH earned
5. Sell tokens when price increases → 2 ETH (100% profit)
```

**Value**: Passive income + capital appreciation

---

## Slide 9: Revenue Model

### How Lixa Makes Money

#### **Platform Fees**

1. **Primary License Sales**
   - Fee: 0% (to attract creators)
   - Revenue goes 100% to royalty pool

2. **Secondary Market (On-chain)**
   - Fee: 2.5% per trade
   - Charged on FT token trades

3. **Hybrid Order Book**
   - Fee: 2.5% per matched trade
   - Covers gas + matching service

4. **Future Revenue Streams**
   - Premium creator tools (5-10 USD/month)
   - Featured listings (0.1-0.5 ETH)
   - IP verification service (0.2-1 ETH)
   - Enterprise licensing (custom pricing)

---

## Slide 10: Market Opportunity

### The Game Asset Market

#### **Total Addressable Market (TAM)**
- **Game Asset Market**: $2.5B/year (Unity, Unreal marketplaces)
- **NFT Gaming Market**: $4.6B (2024)
- **IP Licensing (Digital)**: $8.2B/year

#### **Target Market**
- **Creators**: 500K+ game asset creators (Unity Asset Store, Sketchfab)
- **Buyers**: 10M+ game developers (indies, studios)
- **Investors**: Crypto investors seeking yield (100M+ wallets)

#### **Competitive Advantage**
- ✅ Only platform with fractional IP royalties
- ✅ Standardized smart contract licenses
- ✅ Dual trading system (on-chain + hybrid)
- ✅ Built on Story Network (IPFi native)

---

## Slide 11: Competitive Analysis

### How Lixa Compares

| Feature | Lixa | Unity Asset Store | Sketchfab | OpenSea |
|---------|------|-------------------|-----------|---------|
| **On-chain Licensing** | ✅ | ❌ | ❌ | ❌ |
| **Fractional Ownership** | ✅ | ❌ | ❌ | ❌ |
| **Royalty Automation** | ✅ | ❌ | ❌ | Limited |
| **Secondary Market** | ✅ | ❌ | ❌ | ✅ |
| **License Presets** | ✅ 3 presets | Custom | Custom | None |
| **IP Verification** | 🔜 Planned | ❌ | ❌ | ❌ |
| **Blockchain Native** | ✅ | ❌ | ❌ | ✅ |
| **Game-Specific** | ✅ | ✅ | Partial | ❌ |

**Conclusion**: Lixa combines best of all worlds - game focus + blockchain + fractional IP

---

## Slide 12: Roadmap

### Development Timeline

#### **✅ Phase 1: MVP (Current)**
- Core smart contracts deployed
- Frontend marketplace live
- IPFS integration
- Story Testnet deployment
- License preset system

#### **⏳ Phase 2: Beta (Q1 2025)**
- Comprehensive testing
- Security audit
- Mainnet deployment (Story Network)
- Creator onboarding program
- Marketing campaign

#### **🔮 Phase 3: Growth (Q2-Q3 2025)**
- Analytics dashboard
- IP attestation service
- Revenue oracle (for EDU cap enforcement)
- Mobile app (React Native)
- Multi-chain (Polygon, Base, Arbitrum)

#### **🚀 Phase 4: Scale (Q4 2025+)**
- Governance DAO
- Remix/derivative tracking
- AI-powered asset discovery
- Enterprise partnerships (Unreal, Unity)
- Cross-chain asset transfers

---

## Slide 13: Security & Trust

### How We Keep Users Safe

#### **Smart Contract Security**
- ✅ OpenZeppelin libraries (audited)
- ✅ ReentrancyGuard on all critical functions
- ✅ CEI pattern (Checks-Effects-Interactions)
- ✅ Access control (Ownable, modifiers)
- 🔜 External audit (Q1 2025)
- 🔜 Bug bounty program

#### **Anti-Fraud Measures**
- ✅ Duplicate detection (IPFS CID + perceptual hashing)
- ✅ EIP-712 signatures (prevent order replay)
- ✅ Nonce tracking (order uniqueness)
- 🔜 IP attestation (verify original creators)
- 🔜 Reputation system

#### **User Protection**
- ✅ Pull-based payments (user controls claims)
- ✅ Fair dividend distribution (transfer hooks)
- ✅ License NFT as immutable proof
- ✅ Transparent on-chain accounting

---

## Slide 14: Demo Scenario

### Example: Dragon Model

#### **Setup**
- **Creator**: Alice (3D artist)
- **Asset**: Epic Dragon Model (10,000 polygons, rigged, animated)
- **Production Cost**: 200 hours @ $50/hr = $10,000
- **Fractionalization**: 10,000 tokens @ 0.002 ETH = 20 ETH total value

#### **Timeline**

**Day 1**: Alice uploads & fractionalizes
- Sells 5,000 tokens (50%) → Earns 10 ETH (~$25,000)
- **Upfront funding secured!**

**Week 2**: Studio buys Commercial license
- Price: 1 ETH
- Payment → Royalty vault
- Distributed: 0.5 ETH to Alice, 0.5 ETH to token holders
- **Investor dividend: 0.0001 ETH per token**

**Month 3**: 10 more licenses sold
- Total: 10 ETH in royalties
- Alice earned: 5 ETH + 5 ETH (from tokens) = 10 ETH
- Investors earned: 5 ETH total (0.001 ETH per token)

**Month 6**: Investor exits
- Bought 1,000 tokens @ 0.002 ETH = 2 ETH
- Earned dividends: 0.5 ETH
- Sells tokens @ 0.003 ETH = 3 ETH
- **Total profit: 1.5 ETH (75% ROI)**

**Everyone wins!**

---

## Slide 15: Team & Vision

### Built by Blockchain Enthusiasts

#### **Core Team**
- **Imanuel** - Full-stack Blockchain Developer
  - Smart contract architecture
  - Frontend development
  - IPFS integration

#### **Advisors** (Seeking)
- Game industry veterans
- IP law experts
- DeFi protocol designers

#### **Vision**
*"To become the standard for digital asset licensing in the game industry, empowering creators with fair compensation and giving investors access to creative talent."*

---

## Slide 16: Call to Action

### Join the Lixa Ecosystem

#### **For Creators**
- 🎨 List your assets on testnet
- 💰 Get upfront funding via fractionalization
- 📈 Earn ongoing royalties

**Sign up**: [lixa.app/creators](https://lixa.app/creators)

---

#### **For Investors**
- 📊 Browse fractional opportunities
- 💎 Earn passive income from royalties
- 📈 Trade on secondary market

**Start investing**: [lixa.app/invest](https://lixa.app/invest)

---

#### **For Developers**
- 🛠️ Build on Lixa smart contracts
- 🔌 Integrate licensing into your tools
- 🤝 Partnership opportunities

**Developer docs**: [docs.lixa.app](https://docs.lixa.app)

---

#### **For Everyone**
- ⭐ **Star us on GitHub**: [github.com/lixa-xyz](https://github.com/lixa-xyz)
- 🐦 **Follow on Twitter**: [@lixa_xyz](https://twitter.com/lixa_xyz)
- 💬 **Join Discord**: [discord.gg/lixa](https://discord.gg/lixa)

---

## Slide 17: Key Metrics (Projected)

### Success Indicators - Year 1

| Metric | Target |
|--------|--------|
| **Assets Listed** | 1,000+ |
| **Licenses Sold** | 5,000+ |
| **Total Volume** | 500 ETH (~$1.25M) |
| **Active Creators** | 200+ |
| **Active Investors** | 1,000+ |
| **Secondary Trades** | 10,000+ |
| **TVL (Fractions)** | 100 ETH (~$250K) |

### Revenue Projection
- **Platform Fees**: 12.5 ETH (~$31K)
- **Premium Features**: 50 creators @ $10/mo = $6K
- **IP Verification**: 100 @ 0.5 ETH = 50 ETH (~$125K)
- **Total Year 1**: ~$160K

---

## Slide 18: Investment Opportunity

### Seeking Funding

#### **Current Status**
- Stage: Pre-seed / MVP
- Raised: $0 (self-funded)
- Seeking: $200K - $500K

#### **Use of Funds**
- **40% - Development**
  - Smart contract audit ($50K)
  - Full-time developers (2)
  - Frontend/UX improvements

- **30% - Marketing**
  - Creator acquisition
  - Community building
  - Content creation

- **20% - Operations**
  - Legal (IP compliance)
  - Infrastructure (IPFS, servers)
  - Business development

- **10% - Reserve**
  - Bug bounties
  - Partnerships
  - Contingency

#### **Investment Terms**
- Token launch planned (Q3 2025)
- Early investor allocation: 10-20% of token supply
- Vesting: 1 year cliff, 3 year linear

---

## Slide 19: Why Now?

### Market Timing is Perfect

#### **Macro Trends**
1. **🎮 Gaming Boom**
   - 3.2B gamers worldwide
   - Indie game explosion (Steam: 14K new games/year)
   - Asset demand at all-time high

2. **💎 Web3 Adoption**
   - NFT market recovering post-2022 crash
   - Real utility > speculation
   - Builder focus vs. hype

3. **📜 IP Financialization**
   - Story Protocol raising awareness
   - "IPFi" narrative gaining traction
   - Traditional IP industry noticing blockchain

4. **🤝 Creator Economy**
   - 50M+ creators worldwide
   - Platform fatigue (high fees, no ownership)
   - Demand for fair monetization

**Lixa is at the intersection of all four mega-trends.**

---

## Slide 20: Summary

### Why Lixa Will Win

#### **The Problem**
- Game asset licensing is broken
- Creators lack funding and fair compensation
- Buyers lack clarity and verification
- Investors can't access creative talent

#### **The Solution**
- **Lixa**: On-chain licensing + fractional royalties + dual trading
- Standardized licenses (Commercial, Marketing, Edu)
- Transparent smart contract automation
- Built on Story Network (IPFi native)

#### **The Opportunity**
- $2.5B+ game asset market
- 500K+ creators, 10M+ developers
- First-mover in fractional IP licensing

#### **The Ask**
- **$200K - $500K seed funding**
- **Creator partnerships** (Unity, Unreal, Sketchfab)
- **Advisor network** (game industry, legal, DeFi)

---

## Contact

**Website**: [lixa.app](https://lixa.app) (coming soon)
**Email**: hello@lixa.app
**GitHub**: [github.com/lixa-xyz](https://github.com/lixa-xyz)
**Twitter**: [@lixa_xyz](https://twitter.com/lixa_xyz)
**Discord**: [discord.gg/lixa](https://discord.gg/lixa)

---

# Thank You!

## Questions?

> **"License. Fraction. Earn."**

*Building the future of game asset licensing, one blockchain transaction at a time.*

---

## Appendix A: Contract Addresses

### Story Testnet Deployment

**Chain ID**: 1315
**Explorer**: https://aeneid.storyscan.xyz

**Contracts** (check `deployments/latest.txt` for current addresses):
- AssetNFT: `0x...`
- AssetRegistry: `0x...`
- Fractionalizer: `0x...`
- LicenseNFT: `0x...`
- LicenseManager: `0x...`
- SecondaryMarket: `0x...`
- OrderBook: `0x...`

---

## Appendix B: Technical Specs

### Smart Contracts
- **Language**: Solidity 0.8.24
- **Framework**: Foundry
- **Libraries**: OpenZeppelin v5
- **Optimization**: IR-based, 200 runs
- **EVM**: Paris
- **Test Coverage**: Target 90%+

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS 4
- **Web3**: wagmi 2.19, viem 2.39
- **Database**: Prisma + PostgreSQL
- **Hosting**: Vercel

### Infrastructure
- **Blockchain**: Story Network (testnet)
- **Storage**: IPFS (Pinata pinning)
- **Database**: Neon PostgreSQL
- **CI/CD**: GitHub Actions + Vercel

---

## Appendix C: License Preset Details

### Full Terms Comparison

| Feature | Commercial | Marketing | Edu/Indie |
|---------|-----------|-----------|-----------|
| **In-game usage** | ✅ | ❌ | ✅ |
| **Commercial use** | ✅ | ✅ | Limited |
| **Revenue cap** | Unlimited | N/A | $100K/year |
| **Marketing materials** | ✅ | ✅ | ❌ |
| **Modification** | ✅ | ✅ | ✅ |
| **Resale asset** | ❌ | ❌ | ❌ |
| **Transferable** | ✅ | ✅ | ❌ |
| **Attribution** | Required | Required | Required |
| **Price range** | 0.3-2 ETH | 0.05-0.3 ETH | 0.01-0.1 ETH |

---

## Appendix D: Glossary

**AssetNFT**: ERC-721 token representing IP ownership of a game asset

**Fractionalization**: Process of locking an NFT and minting fungible tokens (ERC-20) that represent fractional ownership

**Dividend**: Share of license sales revenue distributed to fractional token holders

**License NFT**: ERC-721 token proving purchase of a license (receipt)

**Royalty Vault**: Smart contract pool holding license payments for distribution

**Order Book**: System for matching buy and sell orders (on-chain or hybrid)

**EIP-712**: Ethereum standard for typed structured data hashing and signing

**IPFS**: InterPlanetary File System - decentralized storage network

**IPFi**: Intellectual Property Finance - DeFi for IP assets

**Story Protocol**: Blockchain platform focused on IP management and licensing

---

*End of Presentation*
