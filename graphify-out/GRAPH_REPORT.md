# Graph Report - .  (2026-07-01)

## Corpus Check
- 162 files · ~383,099 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 896 nodes · 1872 edges · 41 communities (39 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend UI Components (mobile)|Frontend UI Components (mobile)]]
- [[_COMMUNITY_Admin Router & Schemas|Admin Router & Schemas]]
- [[_COMMUNITY_Appointment Service & DTO|Appointment Service & DTO]]
- [[_COMMUNITY_Domain Concepts & Features|Domain Concepts & Features]]
- [[_COMMUNITY_Backend Package Config|Backend Package Config]]
- [[_COMMUNITY_Mobile Package Config|Mobile Package Config]]
- [[_COMMUNITY_Frontend Core Domain & Format|Frontend Core Domain & Format]]
- [[_COMMUNITY_Frontend Package Config|Frontend Package Config]]
- [[_COMMUNITY_App Bootstrap & Jobs|App Bootstrap & Jobs]]
- [[_COMMUNITY_Platform Backoffice (DEV)|Platform Backoffice (DEV)]]
- [[_COMMUNITY_2FA & Crypto|2FA & Crypto]]
- [[_COMMUNITY_Frontend Core API & Types|Frontend Core API & Types]]
- [[_COMMUNITY_Auth Login Screens|Auth Login Screens]]
- [[_COMMUNITY_Expo App Config|Expo App Config]]
- [[_COMMUNITY_Auth Middleware & Tenant Guard|Auth Middleware & Tenant Guard]]
- [[_COMMUNITY_App Shell & Routing|App Shell & Routing]]
- [[_COMMUNITY_Auth Service (GoogleLogin)|Auth Service (Google/Login)]]
- [[_COMMUNITY_Frontend TS Config (app)|Frontend TS Config (app)]]
- [[_COMMUNITY_Architecture Analysis Findings|Architecture Analysis Findings]]
- [[_COMMUNITY_Barber Agenda & Schedule|Barber Agenda & Schedule]]
- [[_COMMUNITY_Frontend TS Config (node)|Frontend TS Config (node)]]
- [[_COMMUNITY_CatalogWalletTenant Routes|Catalog/Wallet/Tenant Routes]]
- [[_COMMUNITY_Schedule Block Service|Schedule Block Service]]
- [[_COMMUNITY_Backend TS Config|Backend TS Config]]
- [[_COMMUNITY_Catalog Domain & Primitives|Catalog Domain & Primitives]]
- [[_COMMUNITY_App Routers & Error Handler|App Routers & Error Handler]]
- [[_COMMUNITY_OTP Service|OTP Service]]
- [[_COMMUNITY_Notification Dispatch (WhatsAppOutbox)|Notification Dispatch (WhatsApp/Outbox)]]
- [[_COMMUNITY_Cashback Service|Cashback Service]]
- [[_COMMUNITY_CRM  Client Notes|CRM / Client Notes]]
- [[_COMMUNITY_Auth Routes & Schemas|Auth Routes & Schemas]]
- [[_COMMUNITY_Barber Goals|Barber Goals]]
- [[_COMMUNITY_Settings Service|Settings Service]]
- [[_COMMUNITY_Review DTO|Review DTO]]
- [[_COMMUNITY_Vercel Config (crons)|Vercel Config (crons)]]
- [[_COMMUNITY_Mobile TS Config|Mobile TS Config]]
- [[_COMMUNITY_TS Project References|TS Project References]]
- [[_COMMUNITY_Vercel Config (rewrites)|Vercel Config (rewrites)]]

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
- `FEAT Auth Cluster (register, login, JWT, RBAC)` --semantically_similar_to--> `JWT HS256 Authentication`  [INFERRED] [semantically similar]
  docs/FEATURES_BUGS_HOTFIXES.md → README.md
- `FEAT-026 Notification Outbox` --semantically_similar_to--> `Notification Outbox (Push/WhatsApp)`  [INFERRED] [semantically similar]
  docs/FEATURES_BUGS_HOTFIXES.md → README.md
- `FEAT-012 Overbooking Protection` --semantically_similar_to--> `Anti-overbooking (EXCLUDE USING gist + pessimistic locks)`  [INFERRED] [semantically similar]
  docs/FEATURES_BUGS_HOTFIXES.md → README.md
- `FEAT Cashback Cluster (wallet, generation, usage, subset-sum)` --semantically_similar_to--> `Cashback System`  [INFERRED] [semantically similar]
  docs/FEATURES_BUGS_HOTFIXES.md → README.md
- `FEAT-048 Razorfy Mobile App` --semantically_similar_to--> `Mobile App (Expo SDK 56 + React Native)`  [INFERRED] [semantically similar]
  docs/FEATURES_BUGS_HOTFIXES.md → README.md

## Import Cycles
- 1-file cycle: `backend/src/common/crypto.ts -> backend/src/common/crypto.ts`

## Hyperedges (group relationships)
- **Three-client architecture over shared Express API** — readme_frontend_spa, readme_mobile_expo, readme_platform_backoffice, readme_backend_express [EXTRACTED 0.90]
- **Event-driven notification pipeline (bus to outbox to WhatsApp)** — readme_event_bus, readme_notification_outbox, readme_wasenderapi [INFERRED 0.85]
- **Docker Compose dev stack (postgres+backend+frontend)** — docker_compose_postgres_service, docker_compose_backend_service, docker_compose_frontend_service [EXTRACTED 0.90]

## Communities (41 total, 2 thin omitted)

### Community 0 - "Frontend UI Components (mobile)"
Cohesion: 0.05
Nodes (80): styles, BrandLogo(), styles, AppHeader(), Card(), EmptyState(), ErrorMessage(), IconName (+72 more)

### Community 1 - "Admin Router & Schemas"
Cohesion: 0.05
Nodes (66): requireStrictAdmin(), UuidParam, CouponSchema, CreateBarberSchema, CreateServiceSchema, DateQuerySchema, GlobalSettingsSchema, IconSchema (+58 more)

### Community 2 - "Appointment Service & DTO"
Cohesion: 0.05
Nodes (31): applyNoShow(), AppointmentWithRelations, toAppointmentDto(), calculateEnd(), canCancel(), appointmentRouter, CreateAppointmentSchema, BLOCKING_STATUSES (+23 more)

### Community 3 - "Domain Concepts & Features"
Cohesion: 0.07
Nodes (41): backend service, frontend service, postgres service (postgres:16-alpine), Docker Compose Dev Environment, Automation Contract (immutable IDs, statuses), FEAT Appointment Cluster (creation, states, cancel, conclude), FEAT Auth Cluster (register, login, JWT, RBAC), FEAT-047 Razorfy Visual Identity (+33 more)

### Community 4 - "Backend Package Config"
Cohesion: 0.06
Nodes (34): dependencies, bcrypt, cors, express, google-auth-library, jsonwebtoken, otplib, @prisma/client (+26 more)

### Community 5 - "Mobile Package Config"
Cohesion: 0.06
Nodes (34): dependencies, expo, expo-camera, expo-clipboard, expo-font, @expo-google-fonts/montserrat, expo-linear-gradient, expo-secure-store (+26 more)

### Community 6 - "Frontend Core Domain & Format"
Cohesion: 0.09
Nodes (26): BARBER_IMAGES, barberImageFor(), suggestCashback(), Barber, BarberParallax(), dateInputValue(), dateOnlyLabel(), money (+18 more)

### Community 7 - "Frontend Package Config"
Cohesion: 0.06
Nodes (31): dependencies, @fontsource/montserrat, qrcode.react, react, react-dom, recharts, @tanstack/react-query, devDependencies (+23 more)

### Community 8 - "App Bootstrap & Jobs"
Cohesion: 0.13
Nodes (20): app, bootstrap, handler(), addDays(), runWinBackCampaign(), createApp(), expirePaymentHold(), config (+12 more)

### Community 9 - "Platform Backoffice (DEV)"
Cohesion: 0.13
Nodes (25): formatPhoneBR(), invalidateTenantActiveCache(), requireDev(), UuidParam, CreateTenantInput, CreateTenantSchema, ListTenantsQuery, PageQuery (+17 more)

### Community 10 - "2FA & Crypto"
Cohesion: 0.15
Nodes (23): verifyLogin2fa(), buildOtpAuthUri(), generateSecret(), verifyCode(), decryptSecret(), encryptSecret(), key(), userRouter (+15 more)

### Community 11 - "Frontend Core API & Types"
Cohesion: 0.12
Nodes (19): ApiError, request(), Appointment, Barbershop, ConnectResult, CouponItem, ServiceIconItem, Session (+11 more)

### Community 12 - "Auth Login Screens"
Cohesion: 0.11
Nodes (15): FloatingField(), PrimaryButton(), maskPhoneBR(), AuthScreen(), GoogleWhatsappScreen(), PhoneOtpScreen(), TwoFactorLoginScreen(), DevLoginScreen() (+7 more)

### Community 13 - "Expo App Config"
Cohesion: 0.09
Nodes (22): backgroundColor, foregroundImage, adaptiveIcon, package, predictiveBackGestureEnabled, expo, android, extra (+14 more)

### Community 14 - "Auth Middleware & Tenant Guard"
Cohesion: 0.16
Nodes (16): authenticate(), denySuspended(), ensureTenantActive(), optionalAuthenticate(), Request, tenantActiveCache, TokenPayload, requireRole() (+8 more)

### Community 15 - "App Shell & Routing"
Cohesion: 0.16
Nodes (15): App(), connectByCode(), parseConnectionCode(), useAuth(), AppRoutes(), ADMIN_NAV_ITEMS, BARBER_NAV_ITEMS, CLIENT_NAV_ITEMS (+7 more)

### Community 16 - "Auth Service (Google/Login)"
Cohesion: 0.20
Nodes (18): buildSession(), failTracker, getGoogleClient(), googleAuthUrl(), googlePreAuthToken(), login(), loginResult(), LoginUser (+10 more)

### Community 17 - "Frontend TS Config (app)"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 18 - "Architecture Analysis Findings"
Cohesion: 0.14
Nodes (18): Anti-Overbooking (EXCLUDE gist + locks), asyncHandler, Split de AuthScreen (Refinamento Opcional), Backend Serviço-por-Domínio, BusinessError (God Node), Auto-Ciclo crypto.ts (Falso-Positivo), crypto.ts Puro (Verdito), Falsos-Positivos de Clustering (+10 more)

### Community 19 - "Barber Agenda & Schedule"
Cohesion: 0.11
Nodes (15): AGENDA_PERIOD_CHIPS, AGENDA_STATUS_CHIPS, AGENDA_STATUS_GROUPS, AgendaFilter, AgendaStatus, BarberAgendaPage(), BarberGoal, BarberSchedulePage() (+7 more)

### Community 20 - "Frontend TS Config (node)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 21 - "Catalog/Wallet/Tenant Routes"
Cohesion: 0.26
Nodes (9): walletRouter, catalogRouter, findActiveServices(), findBarbers(), OtpSendSchema, OtpVerifySchema, asyncHandler(), resolveTenant() (+1 more)

### Community 22 - "Schedule Block Service"
Cohesion: 0.16
Nodes (10): ALLOWED_BLOCK_DURATIONS, BlockDuration, BLOCKING_STATUSES, createExpressBlock(), deleteExpressBlock(), listBlocksForDate(), ExpressBlockSchema, scheduleRouter (+2 more)

### Community 23 - "Backend TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, resolveJsonModule, rootDir (+6 more)

### Community 24 - "Catalog Domain & Primitives"
Cohesion: 0.25
Nodes (12): CATEGORIES, Category, CATEGORY_META, categoryOf(), ServiceItem, Avatar(), CategoryIcon(), ErrorBanner() (+4 more)

### Community 25 - "App Routers & Error Handler"
Cohesion: 0.18
Nodes (11): adminRouter, confirmPayment(), barbershopRouter, tenantRouter, errorBody(), errorHandler(), HTTP_STATUS_TEXT, goalRouter (+3 more)

### Community 26 - "OTP Service"
Cohesion: 0.24
Nodes (10): assertSendAllowed(), generateCode(), key(), OtpEntry, otpStore, sendOtp(), sendTracker, BusinessError (+2 more)

### Community 27 - "Notification Dispatch (WhatsApp/Outbox)"
Cohesion: 0.27
Nodes (10): dispatchWhatsapp(), channelAllowed(), processOutbox(), send(), fmtDateTime(), fmtTime(), Payload, renderMessage() (+2 more)

### Community 28 - "Cashback Service"
Cohesion: 0.35
Nodes (10): creditEarned(), debitReserved(), insertTransaction(), penalizeNoShow(), refund(), release(), reserve(), Tx (+2 more)

### Community 29 - "CRM / Client Notes"
Cohesion: 0.33
Nodes (9): crmRouter, NoteBodySchema, staffOnly, assertAuthorOrStaff(), assertClient(), createNote(), deleteNote(), listNotes() (+1 more)

### Community 30 - "Auth Routes & Schemas"
Cohesion: 0.31
Nodes (8): authRouter, GoogleAuthSchema, LoginSchema, RegisterSchema, Verify2faSchema, VerifyGoogleOtpSchema, consumePreAuthToken(), googleOAuthEnabled

### Community 31 - "Barber Goals"
Cohesion: 0.39
Nodes (6): GoalBodySchema, createGoal(), deleteGoal(), listBarberGoals(), parseDate(), updateGoal()

### Community 32 - "Settings Service"
Cohesion: 0.28
Nodes (6): cache, DEFAULTS, getCashbackRate(), getNoShowToleranceMinutes(), getSettings(), Settings

### Community 33 - "Review DTO"
Cohesion: 0.50
Nodes (4): canSeeComment(), ReviewRow, toReviewDto(), Viewer

### Community 34 - "Vercel Config (crons)"
Cohesion: 0.50
Nodes (3): crons, rewrites, $schema

### Community 35 - "Mobile TS Config"
Cohesion: 0.50
Nodes (3): compilerOptions, strict, extends

## Knowledge Gaps
- **302 isolated node(s):** `bootstrap`, `name`, `version`, `node`, `dev` (+297 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `crypto.ts Puro (Verdito)` connect `Architecture Analysis Findings` to `2FA & Crypto`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **What connects `bootstrap`, `name`, `version` to the rest of the system?**
  _308 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI Components (mobile)` be split into smaller, more focused modules?**
  _Cohesion score 0.0501906941266209 - nodes in this community are weakly interconnected._
- **Should `Admin Router & Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.051490514905149054 - nodes in this community are weakly interconnected._
- **Should `Appointment Service & DTO` be split into smaller, more focused modules?**
  _Cohesion score 0.05429864253393665 - nodes in this community are weakly interconnected._
- **Should `Domain Concepts & Features` be split into smaller, more focused modules?**
  _Cohesion score 0.07195121951219512 - nodes in this community are weakly interconnected._
- **Should `Backend Package Config` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._