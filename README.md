<div align="center">

# 💈 Razorfy

**Plataforma SaaS multi-tenant de agendamento para barbearias**

Agendamento inteligente, gestão financeira, fidelidade por cashback e notificações automáticas — web, mobile e backoffice em um só produto.

[![Backend](https://img.shields.io/badge/Backend-Node.js%2022%20%C2%B7%20Express%20%C2%B7%20Prisma-3c873a)]()
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%C2%B7%20Vite%20%C2%B7%20Tailwind-61dafb)]()
[![Mobile](https://img.shields.io/badge/Mobile-Expo%2056%20%C2%B7%20React%20Native-000020)]()
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%C2%B7%20Supabase-336791)]()
[![Deploy](https://img.shields.io/badge/Deploy-Render%20%2B%20Vercel-000000)]()

**Web:** [razorfy.online](https://razorfy.online) · **API:** [razorfy.onrender.com](https://razorfy.onrender.com/actuator/health)

</div>

---

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Stack tecnológico](#stack-tecnológico)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Começando (ambiente local)](#começando-ambiente-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Credenciais de desenvolvimento](#credenciais-de-desenvolvimento)
- [Modelo multi-tenant](#modelo-multi-tenant)
- [Segurança](#segurança)
- [Notificações (WhatsApp)](#notificações-whatsapp)
- [Arquitetura orientada a eventos](#arquitetura-orientada-a-eventos)
- [Referência da API](#referência-da-api)
- [Deploy em produção](#deploy-em-produção)
- [Aplicativo mobile](#aplicativo-mobile)
- [Testes e validação](#testes-e-validação)
- [Documentação complementar](#documentação-complementar)
- [Convenções de contribuição](#convenções-de-contribuição)

---

## Visão geral

Razorfy é uma plataforma **SaaS multi-tenant**: uma única instância atende várias barbearias (tenants), com isolamento rígido de dados. Cada barbearia tem seu próprio catálogo, equipe, clientes, regras financeiras e identidade visual; o cliente conecta o aplicativo a uma barbearia por **código de conexão / QR Code**, criando uma experiência *white-label*.

O produto cobre três audiências:

| Audiência | Onde acessa | O que faz |
| --- | --- | --- |
| **Cliente** | Web + App | Conecta-se à barbearia, agenda, paga, acompanha cashback |
| **Barbeiro / Admin** | Web | Gerencia agenda, catálogo, equipe, comissões, relatórios e análises |
| **Desenvolvedor (plataforma)** | Web (backoffice) | Onboarding e bloqueio de barbearias assinantes |

---

## Funcionalidades

### Cliente
- Conexão à barbearia por **código** ou **QR Code** (deep-link `app.barberflow.com/c/CODE` e `razorfy://connect/CODE`).
- Cadastro e login por **e-mail ou telefone** (identificador unificado), Google OAuth e **verificação de telefone via OTP** no cadastro.
- Agendamento com seleção de serviços, barbeiro e horário (grade dinâmica por duração).
- Pagamento PIX (mock) ou presencial, com **reserva temporária** de horário.
- **Cashback**: acúmulo, reserva durante pagamento e resgate no checkout.
- Cupons de desconto (mutuamente exclusivos com cashback).
- Histórico de agendamentos, carteira e avaliações.

### Barbeiro / Administrador
- **Centro de Comando** (dashboard) com receita, ticket médio, LTV, ociosidade e radar de detratores.
- **Módulo de Análises** com gráficos de faturamento (geral, por barbeiro, por dia da semana) e filtros 7/14 dias e mês atual.
- Gestão de catálogo, equipe, expediente, férias, cupons e regras de comissão.
- Aplicação de **No-Show** com penalidade de cashback após tolerância configurável.
- Campanhas de **Win-back** automáticas e manuais.
- **2FA (TOTP)** opcional para proteger a conta.

### Plataforma (Desenvolvedor / `DEV`)
- **Backoffice mestre** em rota dedicada (`/platform`) para o dono do SaaS.
- Onboarding transacional de barbearias (cria barbearia + usuário-mestre Admin atômico).
- **Kill-switch**: inativa uma barbearia e derruba todos os seus tokens instantaneamente.
- Listagem global paginada de tenants.

### Plataforma técnica
- **Multi-tenant** com isolamento por `tenant_id` em todas as tabelas.
- **Barramento de eventos de domínio** (event-driven) pós-commit, *future-proof* para WebSockets.
- **Notificações** Push e WhatsApp (WaSenderAPI) via outbox persistente com retry.
- Revalidação passiva no front (React Query: window-focus + polling).

> O catálogo completo e versionado de funcionalidades, regras de negócio (RN) e casos de teste está em [`docs/FEATURES_BUGS_HOTFIXES.md`](docs/FEATURES_BUGS_HOTFIXES.md).

---

## Arquitetura

```text
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Web (SPA)  │     │ App (Expo)  │     │ Backoffice /platform │
│ React+Vite  │     │ React Native│     │   (mesma SPA)        │
└──────┬──────┘     └──────┬──────┘     └─────────┬────────┘
       │  HTTPS / REST     │                      │
       └───────────────────┴──────────────────────┘
                           │
                  ┌────────▼─────────┐
                  │  API (Express)   │
                  │  JWT · Prisma    │
                  │  Event Bus       │
                  │  Outbox + Jobs   │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐        ┌──────────────┐
                  │  PostgreSQL      │        │ WaSenderAPI  │
                  │  (Supabase)      │        │  (WhatsApp)  │
                  └──────────────────┘        └──────────────┘
```

Princípios de design do backend:

- **JWT HS256** com expiração por perfil; claim `tnt` (tenant) e claim `type=PRE_AUTH` para o fluxo de 2FA.
- **BCrypt** custo 12; segredo TOTP cifrado em repouso com **AES-256-GCM**.
- **Prisma ORM** com migrations SQL versionadas; `directUrl` dedicado para migrations.
- `SELECT FOR UPDATE` por barbeiro, cupom, agendamento e carteira nos fluxos financeiros.
- Restrição PostgreSQL `EXCLUDE USING gist` como última linha contra overbooking.
- **Outbox** persistente para Push/WhatsApp com até 5 tentativas e backoff.
- Jobs em intervalo: expiração de hold de pagamento, processamento de outbox e Win-back.
- Isolamento de tenant em todas as queries; guarda anti-IDOR (`TENANT_MISMATCH`).

---

## Stack tecnológico

| Camada | Tecnologias |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, React Query, Recharts, qrcode.react |
| **Mobile** | Expo SDK 56, React Native, TypeScript, React Navigation, expo-camera, expo-secure-store |
| **Backend** | Node.js 22, Express, TypeScript, Prisma 6, Zod, otplib, bcrypt, jsonwebtoken |
| **Banco** | PostgreSQL (Supabase) |
| **Integrações** | WaSenderAPI (WhatsApp), Google OAuth 2.0 |
| **Infra** | Render (API), Vercel (web), Docker Compose (dev) |

---

## Estrutura do repositório

```text
Razorfy/
├── backend/                 API Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma     Modelo de dados
│   │   └── migrations/       Migrations SQL versionadas (0001 … 0014)
│   └── src/
│       ├── auth/             Login, registro, OTP, 2FA, Google
│       ├── appointment/      Agendamentos e políticas
│       ├── admin/            Dashboard, analytics, cupons, comissões
│       ├── platform/         Backoffice mestre (role DEV)
│       ├── catalog/          Serviços, barbeiros, tenants
│       ├── cashback/         Carteira e transações
│       ├── notification/     Outbox + adapter WhatsApp (WaSenderAPI)
│       ├── events/           Barramento de eventos de domínio
│       ├── middleware/       authenticate, resolveTenant, requireRole
│       └── common/           crypto, phone, errors
├── frontend/                React SPA (cliente, barbeiro, admin, backoffice)
│   └── src/App.tsx           Aplicação single-file
├── mobile/                  App Expo / React Native
├── docs/
│   └── FEATURES_BUGS_HOTFIXES.md   Catálogo canônico de features e RNs
└── docker-compose.yml      Ambiente de desenvolvimento completo
```

---

## Começando (ambiente local)

### Opção A — Docker Compose (recomendado)

Pré-requisito: **Docker Desktop**.

```bash
docker compose up --build
```

| Serviço | URL |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:8080/api/v1 |
| Health check | http://localhost:8080/actuator/health |

### Opção B — Manual

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # preencha as variáveis (ver tabela abaixo)
npm run db:migrate            # aplica migrations
npm run dev                   # API em http://localhost:8080

# 2. Frontend (novo terminal)
cd frontend
npm install
npm run dev                   # web em http://localhost:5173
```

O aplicativo mobile roda separadamente — ver [Aplicativo mobile](#aplicativo-mobile).

---

## Variáveis de ambiente

Configuradas em `backend/.env` (validadas por Zod no boot). Frontend usa `VITE_API_URL`.

### Backend

| Variável | Obrigatória | Padrão | Descrição |
| --- | :---: | --- | --- |
| `DATABASE_URL` | ✅ | — | Conexão PostgreSQL (runtime) |
| `DIRECT_URL` | ✅¹ | — | Conexão dedicada para migrations (evita esgotar o pool) |
| `JWT_SECRET` | ✅ | — | Segredo HS256 (mín. 32 chars) |
| `JWT_CLIENT_EXPIRATION_HOURS` | | `24` | Validade do token de cliente |
| `JWT_STAFF_EXPIRATION_HOURS` | | `8` | Validade do token de staff |
| `TOTP_ENC_KEY` | | — | Chave AES-256-GCM (64 hex) para 2FA. Ausente ⇒ 2FA desativado |
| `CASHBACK_RATE` | | `0.1` | Taxa padrão de cashback |
| `PAYMENT_HOLD_MINUTES` | | `10` | Tempo de reserva temporária |
| `BUSINESS_TIMEZONE` | | `America/Sao_Paulo` | Fuso de negócio |
| `CORS_ALLOWED_ORIGIN` | | `http://localhost:5173` | Origens permitidas (lista separada por vírgula) |
| `WHATSAPP_GATEWAY_URL` | | — | Endpoint de envio WaSenderAPI. Ausente ⇒ modo simulado |
| `WHATSAPP_API_KEY` | | — | Chave da conta WaSenderAPI (header `Authorization: Bearer`) |
| `NOTIFICATION_MAX_ATTEMPTS` | | `5` | Tentativas máximas do outbox |
| `DEV_BOOTSTRAP_ENABLED` | | `false` | Cria seeds de usuários no boot |
| `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` | | — | Admin seed |
| `DEV_STAFF_PASSWORD` | | — | Senha dos barbeiros seed |
| `DEV_PLATFORM_EMAIL` / `DEV_PLATFORM_PASSWORD` | | — | Usuário-mestre `DEV` (plataforma) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | | — | Login social Google. Ausentes ⇒ `/auth/google` responde 503 |
| `PORT` | | `8080` | Porta da API (Render injeta automaticamente) |

¹ `DIRECT_URL` é exigido pelo `schema.prisma` (`directUrl`). Em ambiente local pode apontar para a mesma conexão com `connection_limit=1`.

### Frontend (Vercel / `.env`)

| Variável | Exemplo |
| --- | --- |
| `VITE_API_URL` | `https://razorfy.onrender.com/api/v1` |
| `VITE_CONNECT_BASE_URL` | *(opcional)* base dos deep-links de conexão/QR |

---

## Banco de dados e migrations

Migrations SQL hand-written e versionadas em `backend/prisma/migrations/`:

```bash
cd backend
npm run db:migrate      # prisma migrate deploy
npm run db:generate     # prisma generate (Prisma Client)
```

Histórico (resumo): inicial → CRM de barbeiro → OAuth Google → módulo de admin → settings → **multi-tenant** → código de conexão → backoffice DEV → 2FA → OTP por telefone.

---

## Credenciais de desenvolvimento

Criadas no boot quando `DEV_BOOTSTRAP_ENABLED=true`. **Apenas locais — substitua fora de desenvolvimento.**

| Papel | Identificador | Senha |
| --- | --- | --- |
| Admin (barbearia) | `admin@razorfy.local` | `Admin@123` |
| Barbeiros | `rafael@razorfy.local` · `bruno@razorfy.local` | `Barber@123` |
| Desenvolvedor (plataforma) | `dev@razorfy.platform` | `Dev@12345` (rota `/platform`) |

Tenant padrão: **Razorfy** — código de conexão **`RAZORFY`**.

---

## Modelo multi-tenant

- Toda tabela de negócio carrega `tenant_id`; constraints únicas são compostas por tenant.
- O JWT carrega o claim `tnt`; o middleware `authenticate` injeta `req.user.tenantId`.
- Rotas públicas contextualizadas: `/api/v1/tenants/:tenantId/...` (via `resolveTenant`).
- O cliente conecta-se a uma barbearia por **código** (`GET /tenants/connect/:code`).
- **Kill-switch**: ao inativar uma barbearia, os tokens existentes caem em `TENANT_SUSPENDED` na próxima requisição (cache curto de status).
- O papel `DEV` **não pertence a nenhum tenant** (`tenant_id` nulo) e opera fora do isolamento territorial.

---

## Segurança

- **Autenticação:** e-mail/telefone + senha, Google OAuth, OTP por telefone (cadastro).
- **2FA (TOTP):** RFC 6238 via otplib; segredo cifrado (AES-256-GCM); login interceptado com `preAuthToken`; rate limit de 5 tentativas / 15 min.
- **Isolamento de plataforma:** rotas `/platform/*` exigem role `DEV` (verificada antes de qualquer leitura de tenant).
- **Anti-overbooking:** locks pessimistas + `EXCLUDE USING gist`.
- **Anti-IDOR:** tenant sempre derivado do token, nunca do corpo da requisição.
- **LGPD:** anonimização de conta de cliente sob demanda.

---

## Notificações (WhatsApp)

Pipeline desacoplado: serviços gravam na tabela `notification_outbox`; um processador (intervalo de 5 s) renderiza o texto pt-BR, respeita o consentimento do destinatário e envia via **WaSenderAPI**, com retry/backoff.

Para ativar o envio real, configure no backend:

```env
WHATSAPP_GATEWAY_URL=https://wasenderapi.com/api/send-message
WHATSAPP_API_KEY=sua_chave_wasenderapi
```

Sem essas variáveis, as mensagens ficam em **modo simulado** (apenas log) e o sistema não quebra. Eventos cobertos: confirmação, cancelamento, conclusão, lembrete (2 h antes), no-show, win-back e OTP de cadastro.

---

## Arquitetura orientada a eventos

Mudanças de estado de agendamento publicam **Domain Events** em um barramento interno (Pub/Sub em memória), **somente após o commit** da transação e sempre com `tenant_id`. Listeners são isolados — uma falha de listener nunca quebra a transação principal.

Na fase atual, o front usa **React Query** (revalidação por foco de janela + polling) para manter o painel atualizado. A evolução para WebSockets/SSE exige apenas um novo *listener* do barramento, sem tocar nos serviços de negócio.

---

## Referência da API

Base: `/api/v1`. Saúde: `GET /actuator/health`.

### Autenticação
| Método | Endpoint | Uso |
| --- | --- | --- |
| `POST` | `/auth/register` | Cadastro (`identifier` = e-mail ou telefone) |
| `POST` | `/auth/login` | Login; pode retornar `202 REQUIRE_2FA` |
| `POST` | `/auth/login/verify-2fa` | Conclui login com código TOTP |
| `GET` | `/auth/google/url` · `POST /auth/google` | Login social Google |

### Conexão de tenant (público)
| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/tenants/connect/:code` | Resolve barbearia pelo código de conexão |
| `POST` | `/tenants/:tenantId/auth/otp/send` | Envia OTP por WhatsApp |
| `POST` | `/tenants/:tenantId/auth/otp/verify` | Verifica OTP e cria/loga cliente |
| `GET` | `/tenants/:tenantId/services` · `/barbers` · `/barbers/:id/availability` | Catálogo e disponibilidade |

### Cliente
| Método | Endpoint | Uso |
| --- | --- | --- |
| `POST` | `/appointments` | Criar agendamento |
| `POST` | `/appointments/:id/cancel` · `/conclude` | Cancelar / concluir (credita cashback) |
| `GET` | `/wallet` | Saldo e extrato de cashback |
| `POST` | `/payments/webhooks/mock` | Compensação PIX local |
| `GET` · `POST` · `DELETE` | `/users/me` · `/users/me/2fa/*` | Perfil e gestão de 2FA |

### Administração (`/admin/*`, role `ADMIN`)
| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/admin/dashboard` | Centro de Comando |
| `GET` | `/admin/analytics?range=` | Gráficos financeiros (7/14 dias, mês) |
| `GET` | `/admin/barbershop` | Código de conexão da barbearia |
| `POST` | `/admin/appointments/:id/no-show` | No-show + penalidade |
| `GET/POST/PUT/DELETE` | `/admin/coupons` · `/admin/commissions` | Cupons e comissões |
| `GET/POST/DELETE` | `/admin/vacation-blocks` | Férias |
| `GET/PATCH` | `/admin/alerts` | Radar de detratores |
| `POST` | `/admin/campaigns/win-back/run` | Win-back manual |
| `GET/PUT` | `/admin/global-settings` | Tolerância de no-show e taxa de cashback |

### Plataforma (`/platform/*`, role `DEV`)
| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/platform/tenants?page&size` | Listagem global paginada |
| `POST` | `/platform/tenants` | Onboarding transacional (barbearia + admin) |
| `PATCH` | `/platform/tenants/:id/status` | Kill-switch (ativar/bloquear) |

---

## Deploy em produção

Topologia atual: **frontend no Vercel**, **backend no Render**, **banco no Supabase**.

> O backend mantém processos persistentes (jobs em intervalo, estado em memória), portanto **não** é adequado a *serverless*. Use um serviço com processo sempre ativo.

### Backend (Render)
1. New → **Web Service** → repositório, **Root Directory** `backend`.
2. **Build Command:** `npm install && npm run build && npx prisma migrate deploy`
3. **Start Command:** `npm start`
4. **Health Check Path:** `/actuator/health`
5. Configure as variáveis de ambiente (ver tabela), incluindo `DATABASE_URL`, `DIRECT_URL` e `CORS_ALLOWED_ORIGIN`.

### Frontend (Vercel)
1. Import do repositório, **Root Directory** `frontend` (framework Vite autodetectado).
2. Variável `VITE_API_URL = https://SEU-BACKEND.onrender.com/api/v1`.
3. O arquivo [`frontend/vercel.json`](frontend/vercel.json) já provê os *rewrites* de SPA (deep-links).

### Fechando o loop
- `CORS_ALLOWED_ORIGIN` no backend = domínio do front (apex + www), sem barra final.
- Google OAuth: registrar o redirect URI de produção e refletir em `GOOGLE_REDIRECT_URI`.

> **Atenção (plano Free do Render):** o serviço hiberna após inatividade — o primeiro acesso sofre *cold start* (~30 s) e os jobs não rodam enquanto dorme. Para notificações/jobs confiáveis, use um plano *always-on*. O estado em memória pressupõe **uma instância** (não habilite autoscaling sem migrar para Redis).

---

## Aplicativo mobile

```bash
cd mobile
npm install
npm start
```

- iOS/Android: use o **Expo Go** (escaneie o QR do terminal). Câmera/scanner de QR funcionam no Expo Go.
- Para dispositivo físico, aponte a API: `EXPO_PUBLIC_API_URL=http://SEU_IP_LAN:8080/api/v1 npm start`.
- Emulador Android usa `10.0.2.2` automaticamente.

Consulte [`mobile/README.md`](mobile/README.md) para detalhes de emulador/aparelho.

---

## Testes e validação

Verificação de build de cada pacote:

```bash
# Backend
cd backend && npm install && npm run db:generate && npm run build

# Frontend
cd frontend && npm install && npm run build

# Mobile
cd mobile && npm install && npm run typecheck && npm run doctor
```

> Observação: `backend` possui o script `test` (Vitest), mas ainda não há arquivos `*.test.ts`/`*.spec.ts` versionados — o Vitest encerra com "No test files found". As features são validadas por *smoke tests* HTTP documentados em [`docs/FEATURES_BUGS_HOTFIXES.md`](docs/FEATURES_BUGS_HOTFIXES.md).

---

## Documentação complementar

[`docs/FEATURES_BUGS_HOTFIXES.md`](docs/FEATURES_BUGS_HOTFIXES.md) é o **catálogo canônico** do projeto: cada feature (`FEAT-NNN`), regra de negócio (`RN-NNN`), bug e hotfix possui ID e campos estáveis para automação de releases. Consulte-o antes de implementar ou alterar comportamento.

---

## Convenções de contribuição

- Branch a partir de `main`; PRs descritivos.
- Toda correção/feature registrada em `docs/FEATURES_BUGS_HOTFIXES.md`.
- Migrations Prisma versionadas e idempotentes (`migrate deploy`).
- TypeScript estrito; `npm run build`/`typecheck` verde antes do merge.
- Segredos **nunca** versionados (`.env` ignorado).

### Decisões de domínio explícitas
- `TIMESTAMPTZ` preserva o instante; a jornada usa `America/Sao_Paulo`.
- A grade de início avança em 15 min, mas aceita qualquer duração acumulada.
- `PENDING_PAYMENT` bloqueia o intervalo por 10 min; o cashback aplicado fica reservado até a confirmação.
- `NO_SHOW` é terminal (não retorna a `CONFIRMED`).
- Comissão incide sobre o valor líquido recebido (após cupom/cashback).
- Férias não são retroativas e conflitam com agendamentos `CONFIRMED`.

---

<div align="center">

Construído com ☕ e 💈 — **Razorfy**

</div>
