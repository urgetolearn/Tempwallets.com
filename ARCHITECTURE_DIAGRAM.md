# Production Architecture: Vercel + Railway

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION SETUP                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│       Users         │
│   (Global/Anywhere) │
└──────────┬──────────┘
           │ HTTPS
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                             │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Next.js Application (apps/web)                        │    │
│  │  - React Components                                    │    │
│  │  - UI/UX Layer                                         │    │
│  │  - Client-side Logic                                   │    │
│  │                                                         │    │
│  │  Env Variables:                                        │    │
│  │  └─ NEXT_PUBLIC_API_URL=https://backend.railway.app   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Features:                                                       │
│  ✅ Global CDN (fast worldwide)                                 │
│  ✅ Edge Functions                                              │
│  ✅ Automatic HTTPS                                             │
│  ✅ Preview Deployments (PRs)                                   │
│  ✅ Image Optimization                                          │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS + CORS
                           │ API Requests
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RAILWAY (Backend)                             │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  NestJS API (apps/backend)                             │    │
│  │  - REST API Endpoints                                  │    │
│  │  - Business Logic                                      │    │
│  │  - Wallet Management                                   │    │
│  │  - Blockchain Integration (WDK)                        │    │
│  │                                                         │    │
│  │  Endpoints:                                            │    │
│  │  - POST /wallet/seed                                   │    │
│  │  - GET  /wallet/addresses                              │    │
│  │  - GET  /wallet/balances                               │    │
│  │  - GET  /health                                        │    │
│  │                                                         │    │
│  │  Env Variables:                                        │    │
│  │  └─ FRONTEND_URL=https://your-app.vercel.app          │    │
│  │  └─ DATABASE_URL=postgresql://...                      │    │
│  │  └─ WALLET_ENC_KEY=***                                 │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Features:                                                       │
│  ✅ Automatic Scaling                                           │
│  ✅ Health Checks                                               │
│  ✅ Auto-restart on Failure                                     │
│  ✅ Environment Variables Management                            │
└──────────────────────────┬───────────────────────────────────────┘
                           │ SQL Queries
                           │ (Prisma ORM)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              RAILWAY (PostgreSQL Database)                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Database Tables:                                      │    │
│  │  - User                                                │    │
│  │  - Wallet                                              │    │
│  │  - WalletAddress                                       │    │
│  │  - WalletSeed (encrypted)                              │    │
│  │                                                         │    │
│  │  Security:                                             │    │
│  │  ✅ Encrypted connections                               │    │
│  │  ✅ Automatic backups                                   │    │
│  │  ✅ Connection pooling                                  │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ RPC Calls
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              BLOCKCHAIN NETWORKS (External)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │  Ethereum  │  │    Base    │  │  Arbitrum  │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │  Polygon   │  │   Bitcoin  │  │   Solana   │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│                                                                  │
│  Via: Alchemy, Biconomy, Public RPCs                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Example: Create Wallet

```
1. User Action
   └─ User clicks "Create Wallet" on Vercel frontend

2. Frontend (Vercel)
   └─ React component calls API function
   └─ fetch(`${NEXT_PUBLIC_API_URL}/wallet/seed`, {...})
   └─ Request sent to Railway backend

3. Backend (Railway)
   └─ POST /wallet/seed endpoint receives request
   └─ WalletService.createOrImportSeed()
      ├─ Generates BIP-39 seed phrase (WDK)
      ├─ Encrypts seed with AES-256-GCM
      └─ Stores encrypted seed in PostgreSQL

4. Database (Railway)
   └─ INSERT INTO WalletSeed (userId, ciphertext, iv, authTag)
   └─ Returns success

5. Backend Response
   └─ Returns { ok: true } to frontend

6. Frontend Update
   └─ Shows success message to user
   └─ Redirects to dashboard
```

---

## 🌐 Request Flow with CORS

```
Frontend (Vercel)                    Backend (Railway)
https://app.vercel.app               https://api.railway.app
│                                    │
│  1. OPTIONS (Preflight)            │
│ ──────────────────────────────────▶│
│    Origin: https://app.vercel.app  │
│                                    │
│                                    │  Check FRONTEND_URL env
│                                    │  Is origin allowed?
│                                    │
│  2. 200 OK (CORS Headers)          │
│ ◀──────────────────────────────────│
│    Access-Control-Allow-Origin:    │
│    https://app.vercel.app          │
│                                    │
│  3. POST /wallet/seed              │
│ ──────────────────────────────────▶│
│    { userId, mode, ... }           │
│                                    │
│                                    │  Process request
│                                    │  Save to database
│                                    │
│  4. 200 OK (Response)              │
│ ◀──────────────────────────────────│
│    { ok: true }                    │
│                                    │
```

---

## 🔐 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                       Security Layers                            │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Transport Security
├─ HTTPS Everywhere (TLS 1.3)
├─ Vercel: Automatic HTTPS
└─ Railway: Automatic HTTPS

Layer 2: CORS Protection
├─ Backend validates origin
├─ Only allows specific frontend domain
└─ Rejects unauthorized origins

Layer 3: Environment Variables
├─ Secrets stored in platform (not code)
├─ Vercel: Encrypted environment variables
└─ Railway: Encrypted environment variables

Layer 4: Database Security
├─ PostgreSQL encrypted connections
├─ Connection string not exposed
└─ Automatic backups

Layer 5: Data Encryption
├─ Wallet seeds encrypted at rest (AES-256-GCM)
├─ Encryption key in Railway env only
└─ Unique IV per encryption

Layer 6: Input Validation
├─ DTOs with class-validator
├─ ValidationPipe in NestJS
└─ Type checking with TypeScript
```

---

## 📊 Deployment Workflow

```
Developer                      GitHub                   Vercel                 Railway
    │                            │                        │                      │
    │  git push origin wdk       │                        │                      │
    ├──────────────────────────▶ │                        │                      │
    │                            │                        │                      │
    │                            │  Webhook (Frontend)    │                      │
    │                            ├───────────────────────▶│                      │
    │                            │                        │                      │
    │                            │                        │  Build Frontend      │
    │                            │                        │  (Turbo: web)        │
    │                            │                        │                      │
    │                            │  Webhook (Backend)     │                      │
    │                            ├───────────────────────────────────────────────▶│
    │                            │                        │                      │
    │                            │                        │                      │  Build Backend
    │                            │                        │                      │  (Turbo: backend)
    │                            │                        │                      │  Run Migrations
    │                            │                        │                      │
    │                            │                        │  ✅ Deploy Complete  │
    │                            │                        │◀─────────────────────┤
    │                            │                        │                      │  ✅ Deploy Complete
    │  Deployment Success        │                        │                      │
    │ ◀──────────────────────────┴────────────────────────┴──────────────────────┤
    │                                                                             │
    │  Frontend: https://app.vercel.app                                          │
    │  Backend:  https://api.railway.app                                         │
```

---

## 💰 Cost Breakdown (Estimated)

```
Platform    Service           Free Tier      Cost (After Free)
─────────────────────────────────────────────────────────────
Vercel      Frontend          Yes            $20/month (Pro)
                              100GB bandwidth
                              Unlimited builds

Railway     Backend           $5 credit/mo   $5/month per service
            + PostgreSQL      Trial: $10/mo  $10/month for DB
                                             (~512MB RAM)

Alchemy     RPC Calls         300M/month     Pay-as-you-go
                              (generous)

Biconomy    Bundler/Paymaster Free tier      Pay-as-you-go
                              available

─────────────────────────────────────────────────────────────
TOTAL       Development       FREE           ~$35/month
            Production        ~$10/month     ~$50-100/month
                              (Railway trial)
```

---

## 🎯 Why This Setup?

### Vercel for Frontend ✅
- **Performance**: Global CDN, edge functions
- **Developer Experience**: Best for Next.js
- **Features**: Preview deployments, analytics, ISR
- **Cost**: Generous free tier

### Railway for Backend ✅
- **Simplicity**: Easy deployment, auto-scaling
- **Database**: Integrated PostgreSQL
- **Monitoring**: Built-in metrics and logs
- **Cost**: Reasonable pricing, free trial

### Separation of Concerns ✅
- Frontend and backend can scale independently
- Different deployment strategies
- Easier to debug and monitor
- Industry best practice

---

## 🚀 Next Steps

1. ✅ Backend deployed to Railway
2. ⏭️ Deploy frontend to Vercel
3. ⏭️ Set environment variables on both
4. ⏭️ Test the integration
5. ⏭️ Monitor and optimize

See `VERCEL_RAILWAY_SETUP.md` for detailed instructions!
