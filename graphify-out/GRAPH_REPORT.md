# Graph Report - .  (2026-06-30)

## Corpus Check
- 141 files · ~380,391 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 844 nodes · 1613 edges · 31 communities (26 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend UI Components|Frontend UI Components]]
- [[_COMMUNITY_Frontend Types & Tenant Connect|Frontend Types & Tenant Connect]]
- [[_COMMUNITY_Backend Routers & Middleware|Backend Routers & Middleware]]
- [[_COMMUNITY_Admin Router & Schemas|Admin Router & Schemas]]
- [[_COMMUNITY_2FA & Crypto|2FA & Crypto]]
- [[_COMMUNITY_Appointment Logic & Policy|Appointment Logic & Policy]]
- [[_COMMUNITY_Auth Routes & Schemas|Auth Routes & Schemas]]
- [[_COMMUNITY_Backend package config|Backend package config]]
- [[_COMMUNITY_Mobile package config|Mobile package config]]
- [[_COMMUNITY_App Bootstrap & Jobs|App Bootstrap & Jobs]]
- [[_COMMUNITY_Frontend package config|Frontend package config]]
- [[_COMMUNITY_Domain Concepts & Features|Domain Concepts & Features]]
- [[_COMMUNITY_Expo App Config|Expo App Config]]
- [[_COMMUNITY_Frontend TS config (app)|Frontend TS config (app)]]
- [[_COMMUNITY_Frontend TS config (node)|Frontend TS config (node)]]
- [[_COMMUNITY_Backend TS config|Backend TS config]]
- [[_COMMUNITY_Cashback Service|Cashback Service]]
- [[_COMMUNITY_Settings Service|Settings Service]]
- [[_COMMUNITY_Frontend Date & Calendar Utils|Frontend Date & Calendar Utils]]
- [[_COMMUNITY_Review DTO|Review DTO]]
- [[_COMMUNITY_Auth & Phone Screens|Auth & Phone Screens]]
- [[_COMMUNITY_Vercel config (crons)|Vercel config (crons)]]
- [[_COMMUNITY_Mobile TS config|Mobile TS config]]
- [[_COMMUNITY_TS project references|TS project references]]
- [[_COMMUNITY_Vercel config (rewrites)|Vercel config (rewrites)]]
- [[_COMMUNITY_Service Icons Feature|Service Icons Feature]]
- [[_COMMUNITY_Avatar Component|Avatar Component]]
- [[_COMMUNITY_React Query Setup|React Query Setup]]

## God Nodes (most connected - your core abstractions)
1. `prisma` - 28 edges
2. `BusinessError` - 26 edges
3. `useAuth()` - 19 edges
4. `compilerOptions` - 17 edges
5. `asyncHandler()` - 16 edges
6. `compilerOptions` - 16 edges
7. `config` - 14 edges
8. `colors` - 14 edges
9. `expo` - 13 edges
10. `fonts` - 13 edges

## Surprising Connections (you probably didn't know these)
- `FEAT-086 RLS Supabase` --implements--> `Seguranca`  [EXTRACTED]
  backend/prisma/migrations/0016_enable_rls/migration.sql → README.md
- `Autenticação` --part_of--> `Mobile (Expo)`  [EXTRACTED]
  docs/FEATURES_BUGS_HOTFIXES.md → mobile/README.md
- `FEAT-080 Motor event-driven` --depends_on--> `Agendamentos`  [INFERRED]
  docs/FEATURES_BUGS_HOTFIXES.md → README.md
- `Multi-tenant SaaS` --part_of--> `Backend (Express+Prisma)`  [EXTRACTED]
  docs/FEATURES_BUGS_HOTFIXES.md → README.md
- `Autenticação` --part_of--> `Backend (Express+Prisma)`  [EXTRACTED]
  docs/FEATURES_BUGS_HOTFIXES.md → README.md

## Import Cycles
- 1-file cycle: `backend/src/common/crypto.ts -> backend/src/common/crypto.ts`

## Communities (31 total, 5 thin omitted)

### Community 0 - "Frontend UI Components"
Cohesion: 0.05
Nodes (80): styles, BrandLogo(), styles, AppHeader(), Card(), EmptyState(), ErrorMessage(), IconName (+72 more)

### Community 1 - "Frontend Types & Tenant Connect"
Cohesion: 0.02
Nodes (55): ADMIN_NAV_ITEMS, AdminAlert, AdminBarberRow, AdminDashboard, AdminGrid, AdminHeatmap, AdminServiceRow, AdminTab (+47 more)

### Community 2 - "Backend Routers & Middleware"
Cohesion: 0.05
Nodes (63): requireStrictAdmin(), adminRouter, walletRouter, catalogRouter, findActiveServices(), findBarbers(), createIcon(), listIcons() (+55 more)

### Community 3 - "Admin Router & Schemas"
Cohesion: 0.06
Nodes (64): UuidParam, CouponSchema, CreateBarberSchema, CreateServiceSchema, DateQuerySchema, GlobalSettingsSchema, IconSchema, NoShowSchema (+56 more)

### Community 4 - "2FA & Crypto"
Cohesion: 0.07
Nodes (49): verifyLogin2fa(), buildOtpAuthUri(), generateSecret(), verifyCode(), decryptSecret(), encryptSecret(), key(), formatPhoneBR() (+41 more)

### Community 5 - "Appointment Logic & Policy"
Cohesion: 0.05
Nodes (34): applyNoShow(), AppointmentWithRelations, toAppointmentDto(), calculateEnd(), canCancel(), appointmentRouter, CreateAppointmentSchema, BLOCKING_STATUSES (+26 more)

### Community 6 - "Auth Routes & Schemas"
Cohesion: 0.09
Nodes (38): authRouter, GoogleAuthSchema, LoginSchema, RegisterSchema, Verify2faSchema, VerifyGoogleOtpSchema, buildSession(), consumePreAuthToken() (+30 more)

### Community 7 - "Backend package config"
Cohesion: 0.06
Nodes (34): dependencies, bcrypt, cors, express, google-auth-library, jsonwebtoken, otplib, @prisma/client (+26 more)

### Community 8 - "Mobile package config"
Cohesion: 0.06
Nodes (34): dependencies, expo, expo-camera, expo-clipboard, expo-font, @expo-google-fonts/montserrat, expo-linear-gradient, expo-secure-store (+26 more)

### Community 9 - "App Bootstrap & Jobs"
Cohesion: 0.11
Nodes (24): app, bootstrap, handler(), createApp(), expirePaymentHold(), config, devBootstrap(), expireHolds (+16 more)

### Community 10 - "Frontend package config"
Cohesion: 0.06
Nodes (31): dependencies, @fontsource/montserrat, qrcode.react, react, react-dom, recharts, @tanstack/react-query, devDependencies (+23 more)

### Community 11 - "Domain Concepts & Features"
Cohesion: 0.09
Nodes (27): Backend (Express+Prisma), Frontend (React+Vite), Mobile (Expo), Painel Admin, Analytics (Recharts), Agendamentos, Autenticação, Cashback / Carteira (+19 more)

### Community 12 - "Expo App Config"
Cohesion: 0.09
Nodes (22): backgroundColor, foregroundImage, adaptiveIcon, package, predictiveBackGestureEnabled, expo, android, extra (+14 more)

### Community 13 - "Frontend TS config (app)"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 14 - "Frontend TS config (node)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 15 - "Backend TS config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, resolveJsonModule, rootDir (+6 more)

### Community 16 - "Cashback Service"
Cohesion: 0.35
Nodes (10): creditEarned(), debitReserved(), insertTransaction(), penalizeNoShow(), refund(), release(), reserve(), Tx (+2 more)

### Community 17 - "Settings Service"
Cohesion: 0.28
Nodes (6): cache, DEFAULTS, getCashbackRate(), getNoShowToleranceMinutes(), getSettings(), Settings

### Community 18 - "Frontend Date & Calendar Utils"
Cohesion: 0.29
Nodes (8): AdminCommandCenter(), CalendarPage(), connectUrl(), dateInputValue(), dateTimeLocalInDays(), suggestCashback(), today(), tomorrow()

### Community 19 - "Review DTO"
Cohesion: 0.50
Nodes (4): canSeeComment(), ReviewRow, toReviewDto(), Viewer

### Community 20 - "Auth & Phone Screens"
Cohesion: 0.40
Nodes (5): AuthScreen(), GoogleWhatsappScreen(), maskPhoneBR(), PhoneOtpScreen(), PlatformUserEditModal()

### Community 21 - "Vercel config (crons)"
Cohesion: 0.50
Nodes (3): crons, rewrites, $schema

### Community 22 - "Mobile TS config"
Cohesion: 0.50
Nodes (3): compilerOptions, strict, extends

## Knowledge Gaps
- **320 isolated node(s):** `bootstrap`, `name`, `version`, `node`, `dev` (+315 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `Backend package config` to `Backend Routers & Middleware`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `BusinessError` connect `Backend Routers & Middleware` to `Admin Router & Schemas`, `2FA & Crypto`, `Appointment Logic & Policy`, `Auth Routes & Schemas`, `Cashback Service`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `bootstrap`, `name`, `version` to the rest of the system?**
  _320 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.0501906941266209 - nodes in this community are weakly interconnected._
- **Should `Frontend Types & Tenant Connect` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Backend Routers & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.050724637681159424 - nodes in this community are weakly interconnected._
- **Should `Admin Router & Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.05627705627705628 - nodes in this community are weakly interconnected._