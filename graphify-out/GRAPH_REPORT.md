# Graph Report - .  (2026-07-01)

## Corpus Check
- 161 files · ~381,312 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 878 nodes · 1847 edges · 39 communities (36 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend UI Components|Frontend UI Components]]
- [[_COMMUNITY_Backend Routers & Middleware|Backend Routers & Middleware]]
- [[_COMMUNITY_2FA & Crypto|2FA & Crypto]]
- [[_COMMUNITY_Admin Router & Schemas|Admin Router & Schemas]]
- [[_COMMUNITY_Domain Concepts & Features|Domain Concepts & Features]]
- [[_COMMUNITY_App Bootstrap & Jobs|App Bootstrap & Jobs]]
- [[_COMMUNITY_Backend Package Config|Backend Package Config]]
- [[_COMMUNITY_Mobile Package Config|Mobile Package Config]]
- [[_COMMUNITY_Frontend Core Domain & Format|Frontend Core Domain & Format]]
- [[_COMMUNITY_Frontend Package Config|Frontend Package Config]]
- [[_COMMUNITY_Auth Routes & Schemas|Auth Routes & Schemas]]
- [[_COMMUNITY_Frontend Core API & Types|Frontend Core API & Types]]
- [[_COMMUNITY_Auth Login Screens|Auth Login Screens]]
- [[_COMMUNITY_Expo App Config|Expo App Config]]
- [[_COMMUNITY_App Shell & Routing|App Shell & Routing]]
- [[_COMMUNITY_Appointment Service Logic|Appointment Service Logic]]
- [[_COMMUNITY_Catalog & Tenant Routes|Catalog & Tenant Routes]]
- [[_COMMUNITY_Frontend TS Config (app)|Frontend TS Config (app)]]
- [[_COMMUNITY_Barber Agenda & Schedule|Barber Agenda & Schedule]]
- [[_COMMUNITY_Frontend TS Config (node)|Frontend TS Config (node)]]
- [[_COMMUNITY_OTP & WhatsApp Service|OTP & WhatsApp Service]]
- [[_COMMUNITY_Availability Service|Availability Service]]
- [[_COMMUNITY_Schedule Block Service|Schedule Block Service]]
- [[_COMMUNITY_Backend TS Config|Backend TS Config]]
- [[_COMMUNITY_Catalog Domain & Primitives|Catalog Domain & Primitives]]
- [[_COMMUNITY_Appointment DTO & Router|Appointment DTO & Router]]
- [[_COMMUNITY_Cashback Service|Cashback Service]]
- [[_COMMUNITY_Notification Service|Notification Service]]
- [[_COMMUNITY_Settings Service|Settings Service]]
- [[_COMMUNITY_Analytics Service|Analytics Service]]
- [[_COMMUNITY_Domain Event Bus|Domain Event Bus]]
- [[_COMMUNITY_Appointment Policy|Appointment Policy]]
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
- **Docker Compose dev stack (postgres+backend+frontend)** — docker_compose_postgres_service, docker_compose_backend_service, docker_compose_frontend_service [EXTRACTED 0.90]
- **Event-driven notification pipeline (bus to outbox to WhatsApp)** — readme_event_bus, readme_notification_outbox, readme_wasenderapi [INFERRED 0.85]

## Communities (39 total, 3 thin omitted)

### Community 0 - "Frontend UI Components"
Cohesion: 0.05
Nodes (80): styles, BrandLogo(), styles, AppHeader(), Card(), EmptyState(), ErrorMessage(), IconName (+72 more)

### Community 1 - "Backend Routers & Middleware"
Cohesion: 0.06
Nodes (48): adminRouter, walletRouter, catalogRouter, barbershopRouter, tenantRouter, asyncHandler(), errorBody(), errorHandler() (+40 more)

### Community 2 - "2FA & Crypto"
Cohesion: 0.07
Nodes (48): verifyLogin2fa(), buildOtpAuthUri(), generateSecret(), verifyCode(), decryptSecret(), encryptSecret(), key(), formatPhoneBR() (+40 more)

### Community 3 - "Admin Router & Schemas"
Cohesion: 0.07
Nodes (47): requireStrictAdmin(), UuidParam, CouponSchema, CreateBarberSchema, CreateServiceSchema, DateQuerySchema, GlobalSettingsSchema, IconSchema (+39 more)

### Community 4 - "Domain Concepts & Features"
Cohesion: 0.07
Nodes (41): backend service, frontend service, postgres service (postgres:16-alpine), Docker Compose Dev Environment, Automation Contract (immutable IDs, statuses), FEAT Appointment Cluster (creation, states, cancel, conclude), FEAT Auth Cluster (register, login, JWT, RBAC), FEAT-047 Razorfy Visual Identity (+33 more)

### Community 5 - "App Bootstrap & Jobs"
Cohesion: 0.11
Nodes (25): app, bootstrap, handler(), createApp(), expirePaymentHold(), config, devBootstrap(), Schema (+17 more)

### Community 6 - "Backend Package Config"
Cohesion: 0.06
Nodes (34): dependencies, bcrypt, cors, express, google-auth-library, jsonwebtoken, otplib, @prisma/client (+26 more)

### Community 7 - "Mobile Package Config"
Cohesion: 0.06
Nodes (34): dependencies, expo, expo-camera, expo-clipboard, expo-font, @expo-google-fonts/montserrat, expo-linear-gradient, expo-secure-store (+26 more)

### Community 8 - "Frontend Core Domain & Format"
Cohesion: 0.09
Nodes (26): BARBER_IMAGES, barberImageFor(), suggestCashback(), Barber, BarberParallax(), dateInputValue(), dateOnlyLabel(), money (+18 more)

### Community 9 - "Frontend Package Config"
Cohesion: 0.06
Nodes (31): dependencies, @fontsource/montserrat, qrcode.react, react, react-dom, recharts, @tanstack/react-query, devDependencies (+23 more)

### Community 10 - "Auth Routes & Schemas"
Cohesion: 0.15
Nodes (23): authRouter, GoogleAuthSchema, LoginSchema, RegisterSchema, Verify2faSchema, VerifyGoogleOtpSchema, consumePreAuthToken(), failTracker (+15 more)

### Community 11 - "Frontend Core API & Types"
Cohesion: 0.12
Nodes (19): ApiError, request(), Appointment, Barbershop, ConnectResult, CouponItem, ServiceIconItem, Session (+11 more)

### Community 12 - "Auth Login Screens"
Cohesion: 0.11
Nodes (15): FloatingField(), PrimaryButton(), maskPhoneBR(), AuthScreen(), GoogleWhatsappScreen(), PhoneOtpScreen(), TwoFactorLoginScreen(), DevLoginScreen() (+7 more)

### Community 13 - "Expo App Config"
Cohesion: 0.09
Nodes (22): backgroundColor, foregroundImage, adaptiveIcon, package, predictiveBackGestureEnabled, expo, android, extra (+14 more)

### Community 14 - "App Shell & Routing"
Cohesion: 0.16
Nodes (15): App(), connectByCode(), parseConnectionCode(), useAuth(), AppRoutes(), ADMIN_NAV_ITEMS, BARBER_NAV_ITEMS, CLIENT_NAV_ITEMS (+7 more)

### Community 15 - "Appointment Service Logic"
Cohesion: 0.13
Nodes (14): applyNoShow(), BLOCKING_STATUSES, cancelAppointment(), cancelOverbookingInTx(), concludeAppointment(), confirmPayment(), createAppointment(), isSubsetSumOfServices() (+6 more)

### Community 16 - "Catalog & Tenant Routes"
Cohesion: 0.21
Nodes (11): findActiveServices(), findBarbers(), createIcon(), listIcons(), OtpSendSchema, OtpVerifySchema, BusinessError, DANGEROUS_TAGS (+3 more)

### Community 17 - "Frontend TS Config (app)"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 18 - "Barber Agenda & Schedule"
Cohesion: 0.11
Nodes (15): AGENDA_PERIOD_CHIPS, AGENDA_STATUS_CHIPS, AGENDA_STATUS_GROUPS, AgendaFilter, AgendaStatus, BarberAgendaPage(), BarberGoal, BarberSchedulePage() (+7 more)

### Community 19 - "Frontend TS Config (node)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 20 - "OTP & WhatsApp Service"
Cohesion: 0.23
Nodes (14): buildSession(), assertSendAllowed(), consumeOtp(), dispatchWhatsapp(), generateCode(), key(), OtpEntry, otpStore (+6 more)

### Community 21 - "Availability Service"
Cohesion: 0.28
Nodes (12): assertWorkingTime(), availableStarts(), BLOCKING_STATUSES, getLocalMinutes(), getUtcFromLocal(), isoWeekday(), localMinutesToUtc(), notAvailable() (+4 more)

### Community 22 - "Schedule Block Service"
Cohesion: 0.16
Nodes (10): ALLOWED_BLOCK_DURATIONS, BlockDuration, BLOCKING_STATUSES, createExpressBlock(), deleteExpressBlock(), listBlocksForDate(), ExpressBlockSchema, scheduleRouter (+2 more)

### Community 23 - "Backend TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, module, moduleResolution, outDir, resolveJsonModule, rootDir (+6 more)

### Community 24 - "Catalog Domain & Primitives"
Cohesion: 0.25
Nodes (12): CATEGORIES, Category, CATEGORY_META, categoryOf(), ServiceItem, Avatar(), CategoryIcon(), ErrorBanner() (+4 more)

### Community 25 - "Appointment DTO & Router"
Cohesion: 0.19
Nodes (9): AppointmentWithRelations, toAppointmentDto(), appointmentRouter, CreateAppointmentSchema, callClient(), listBarberAppointments(), listClientAppointments(), createIntent() (+1 more)

### Community 26 - "Cashback Service"
Cohesion: 0.35
Nodes (10): creditEarned(), debitReserved(), insertTransaction(), penalizeNoShow(), refund(), release(), reserve(), Tx (+2 more)

### Community 27 - "Notification Service"
Cohesion: 0.22
Nodes (3): AppointmentData, OutboxRow, Tx

### Community 28 - "Settings Service"
Cohesion: 0.28
Nodes (6): cache, DEFAULTS, getCashbackRate(), getNoShowToleranceMinutes(), getSettings(), Settings

### Community 29 - "Analytics Service"
Cohesion: 0.36
Nodes (6): ANALYTICS_RANGES, AnalyticsRange, buildDays(), DAY_NAMES, getAnalytics(), localDateString()

### Community 30 - "Domain Event Bus"
Cohesion: 0.33
Nodes (4): DomainEvent, DomainEventHandler, DomainEventType, emitter

### Community 32 - "Vercel Config (crons)"
Cohesion: 0.50
Nodes (3): crons, rewrites, $schema

### Community 33 - "Mobile TS Config"
Cohesion: 0.50
Nodes (3): compilerOptions, strict, extends

## Knowledge Gaps
- **300 isolated node(s):** `bootstrap`, `name`, `version`, `node`, `dev` (+295 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `Backend Package Config` to `Catalog & Tenant Routes`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `BusinessError` connect `Catalog & Tenant Routes` to `Backend Routers & Middleware`, `2FA & Crypto`, `Admin Router & Schemas`, `Auth Routes & Schemas`, `Appointment Service Logic`, `OTP & WhatsApp Service`, `Availability Service`, `Schedule Block Service`, `Cashback Service`, `Analytics Service`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `bootstrap`, `name`, `version` to the rest of the system?**
  _303 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.0501906941266209 - nodes in this community are weakly interconnected._
- **Should `Backend Routers & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.06009615384615385 - nodes in this community are weakly interconnected._
- **Should `2FA & Crypto` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Admin Router & Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.07272727272727272 - nodes in this community are weakly interconnected._