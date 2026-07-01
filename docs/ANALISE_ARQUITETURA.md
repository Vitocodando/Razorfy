# Análise de Arquitetura — Razorfy

> Relatório para revisão de arquitetura de software.
> Base: grafo de conhecimento gerado por `graphify` sobre o repositório completo (2026-07-01).
> Corpus: 161 arquivos · ~381k palavras · **878 nós · 1847 arestas · 39 comunidades**.
> Extração: 99% EXTRACTED (estrutural/AST) · 1% INFERRED (semântica de docs).

---

## 1. Visão geral

Razorfy é um **SaaS multi-tenant de barbearias** com três clientes sobre uma API única (hyperedge `EXTRACTED 0.90`):

```
                    ┌─────────────────────────────┐
   Frontend SPA ───▶│                             │
   (React+Vite)     │   Backend (Express+Prisma)  │───▶ PostgreSQL 16
   Mobile (Expo) ──▶│   API REST /api/v1          │───▶ WaSenderAPI (WhatsApp)
   Backoffice DEV ─▶│                             │
                    └─────────────────────────────┘
```

O grafo confirma **separação em camadas limpa** no backend (serviço-por-domínio) e um frontend web recém-modularizado. A comunidade `Domain Concepts & Features` (C4, 41 nós) mostra que o `docs/FEATURES_BUGS_HOTFIXES.md` funciona como fonte-de-verdade rastreável — features do registro casam semanticamente com o README (5 conexões `semantically_similar_to`), evidência de documentação viva e alinhada ao código.

---

## 2. Estrutura por domínio (comunidades)

O algoritmo de detecção de comunidades separou **39 grupos** que mapeiam quase 1:1 com os limites de domínio pretendidos — sinal de baixa dispersão arquitetural.

### Backend — serviço-por-domínio (padrão consistente)

| Domínio | Comunidade | Coesão | Leitura |
|---|---|---|---|
| Cashback | C26 | **0.35** | Isolado, alta coesão — carteira/reserva/estorno/subset-sum |
| Analytics | C29 | **0.36** | BFF financeiro autocontido |
| Availability | C21 | **0.28** | Cálculo de slots/timezone encapsulado |
| Settings | C28 | **0.28** | Config global + cache |
| OTP & WhatsApp | C20 | **0.23** | Envio/consumo OTP + dispatch |
| Appointment (service/dto/policy) | C15/C25/C31 | 0.13–0.50 | Núcleo de negócio dividido em service, DTO e policy pura |
| Domain Event Bus | C30 | 0.33 | Emissor de eventos de domínio desacoplado |

As comunidades-folha (cashback, analytics, availability, settings) têm **coesão alta (0.23–0.36)**: são módulos bem encapsulados, com dependência externa mínima. Isso é o comportamento desejado de um design orientado a domínio.

### Frontend web — refatoração `core/` + `modules/` (recente, saudável)

| Camada | Comunidade | Coesão | Conteúdo |
|---|---|---|---|
| Core — API & Types | C11 | 0.12 | `request()`, `Session`, `Appointment`, `Barbershop` |
| Core — Domain & Format | C8 | 0.09 | `suggestCashback()`, `categoryOf()`, `money`, datas |
| App Shell & Routing | C14 | **0.16** | `App()`, `AppRoutes()`, `useAuth()`, nav consts |
| Catalog Domain & Primitives | C24 | **0.25** | `CATEGORIES`, `Avatar`, `CategoryIcon`, `ErrorBanner` |
| Auth Login Screens | C12 | 0.11 | `AuthScreen`, `PhoneOtpScreen`, `2FA`, `DevLogin` |
| Barber Agenda & Schedule | C18 | 0.11 | `BarberAgendaPage`, `BarberSchedulePage` |

A separação `core`/`modules` aparece **nitidamente** no grafo — o antigo `App.tsx` monolítico foi dissolvido em clusters distintos. `useAuth()` emergiu como **god node #3 (19 arestas)**, confirmando que o hub de autenticação foi corretamente extraído para `core/hooks` e agora é reusado por todo o app.

---

## 3. Abstrações centrais (god nodes)

| # | Nó | Arestas | Papel |
|---|---|---|---|
| 1 | `prisma` | 28 | Cliente de dados — ponte entre config e todas as rotas de negócio |
| 2 | `BusinessError` | 26 | **Taxonomia de erro de negócio centralizada** |
| 3 | `useAuth()` | 19 | Hub de sessão do frontend |
| 5 | `asyncHandler()` | 16 | Wrapper de rota async (tratamento de erro uniforme) |

**`BusinessError` é o achado arquitetural mais relevante.** Ele conecta **10 comunidades de backend** (Catalog, 2FA, Admin, Auth, Appointment, OTP, Availability, Schedule, Cashback, Analytics) — betweenness 0.021. Interpretação:

- ✅ **Positivo:** existe uma taxonomia de erro única e um contrato de tratamento consistente (`asyncHandler` + `errorHandler`). Nenhum domínio inventa seu próprio esquema de erro. Isso é um padrão forte.
- ⚠️ **Atenção:** é um ponto de acoplamento global. Mudanças na assinatura/códigos de `BusinessError` têm blast radius alto (10 domínios). Manter a interface estável e versionada.

---

## 4. Riscos e pontos de acoplamento

### 4.1 Comunidade C0 — artefato de clustering, NÃO monólito (corrigido)

A comunidade **C0 "Frontend UI Components" (80 nós, coesão 0.05 — a mais baixa do grafo)** agrupa UI e telas do cliente mobile (Expo). **Coesão baixa aqui NÃO indica monólito** — indica que componentes de UI-folha (`BrandLogo`, `Card`, `EmptyState`, `ui.tsx`) e telas independentes são naturalmente pouco acoplados entre si. É comportamento esperado de um "saco de primitivas + telas", agravado pelo clustering do graphify que juntou UI e screens mobile num grupo só.

**Verificação no código-fonte (não no grafo):** o mobile **já é modular**. `mobile/App.tsx` tem **58 linhas** e é apenas o shell (`SafeAreaProvider` + `AuthProvider` + `NavigationContainer` + `RootNavigator`). A estrutura já separa camadas com nomenclatura idiomática React Native:

```
mobile/src/
  context/AuthContext.tsx      → hub de auth (equiv. core/hooks/useAuth)
  services/api.ts              → camada de API (equiv. core/api)
  components/ui.tsx, BrandLogo → primitivas de UI (equiv. core/ui)
  theme.ts · format.ts · types.ts · utils/phone.ts → core utils/types
  navigation/RootNavigator.tsx → roteador
  screens/*.tsx (13 telas)     → telas por domínio
```

Revisão adicional: **zero import tela→tela** (sem acoplamento lateral), cada tela com seu próprio `StyleSheet`. **Não há dívida estrutural no mobile.**

**Oportunidade opcional (baixa prioridade), não dívida:** telas grandes — `AppointmentListScreen` (610 linhas), `AuthScreen` (572). O `AuthScreen` concentra login+OTP+2FA+Google inline; o web já separou isso em sub-telas (`PhoneOtpScreen`, `TwoFactorLoginScreen`, `GoogleWhatsappScreen`). Espelhar esse split seria a única melhoria mobile com paralelo direto ao web — opcional.

> Correção de metodologia: a versão inicial deste relatório classificou C0 como "mobile monolítico P0". Isso foi uma **leitura incorreta da métrica de coesão** — coesão baixa em cluster de UI-folha não implica monólito. A inspeção do código-fonte refutou a hipótese. Lição: métricas de grafo apontam *onde olhar*, não substituem a leitura do código.

### 4.2 Comunidades de baixa coesão — inspecionadas, TODAS refutadas como falso-positivo

A hipótese inicial era que coesão < 0.10 em comunidade grande = módulo fazendo coisas demais. **A inspeção do código-fonte refutou essa leitura em todos os casos:** são artefatos de clustering de um codebase bem-fatorado em arquivos pequenos e single-responsibility. O graphify agrupa por proximidade de tópico/pasta, não por acoplamento real de implementação.

| Comunidade | Coesão | Nós | Achado após ler o código |
|---|---|---|---|
| Frontend UI Components (mobile) | 0.05 | 80 | **Falso-positivo** — mobile já modular; UI-folha é naturalmente pouco acoplada (§4.1) |
| Backend Routers & Middleware | 0.06 | 48 | Agregador de routers — padrão intencional (composição de rotas), não smell |
| 2FA & Crypto | 0.07 | 48 | **Falso-positivo** — `crypto.ts` (34 l, AES-GCM puro) e `twofa.service.ts` (25 l, TOTP) **já são arquivos separados**. O cluster juntou dois arquivos já-desacoplados |
| Admin Router & Schemas | 0.07 | 47 | **Não dividir** — `admin.schemas.ts` (62 l) tem 8 schemas Zod coesos por feature; agregador por domínio é convenção válida. Espalhá-los fragmentaria validação coesa por zero ganho |

Verificação de `crypto.ts` (RN de pureza criptográfica): importa apenas `crypto` (nativo), `config` e `BusinessError` — **sem `services`, `repositories` ou Prisma**. Já é uma função pura. Nada a extrair.

> Lição repetida: coesão de grafo baixa em cluster de arquivos pequenos já-separados NÃO implica dívida. Métrica aponta onde olhar; a leitura do código é o juiz.

### 4.3 Ciclo de importação — falso-positivo confirmado

- `backend/src/common/crypto.ts → crypto.ts` (auto-ciclo de 1 arquivo). **Confirmado falso-positivo:** `crypto.ts` faz `import crypto from 'crypto'` (módulo nativo do Node); o graphify colidiu o ID do arquivo com o do import nativo homônimo, gerando uma self-edge fantasma. Não há ciclo real — os imports do arquivo (`config`, `BusinessError`) apontam pra fora.

### 4.4 Nós isolados

300 nós com ≤1 conexão. **Não é dívida real:** são majoritariamente chaves de config (`package.json`, `tsconfig`, `vercel.json`, deps). Ruído esperado; ignorar para fins de arquitetura de aplicação.

---

## 5. Padrões arquiteturais confirmados pelo grafo

1. **Serviço-por-domínio com DTOs e policies puras** — `appointment.service` / `appointment.dto` / `appointment.policy` separados (C15/C25/C31). Lógica pura (`canCancel`, `calculateEnd`, `cashbackEarned`) isolada em policy testável.
2. **Pipeline de notificação event-driven** — `eventBus → notification outbox → WaSenderAPI` (hyperedge `INFERRED 0.85`). Desacopla efeitos colaterais (WhatsApp/push) do fluxo de negócio via outbox — resiliente a falhas de entrega.
3. **Tratamento de erro uniforme** — `asyncHandler` + `BusinessError` + `errorHandler` cobrem todas as rotas.
4. **Multi-tenant** — `tenant.router`, `barbershop.router` e o gate de tenant permeiam o backend; frontend conecta por código/QR (`connectByCode`, `parseConnectionCode`).
5. **Anti-overbooking** — proteção com `EXCLUDE USING gist` + locks pessimistas (concept confirmado no doc/README).

---

## 6. Recomendações priorizadas

Após inspeção de código, **quase todos os itens candidatos foram refutados**. O que resta:

| Prioridade | Item | Situação |
|---|---|---|
| **Convenção** | Não inflar a interface de `BusinessError` (só adicionar códigos, não campos) | Já é a prática; disciplina de review, sem mudança de código |
| **Opcional** | Split de `AuthScreen` (572 l) / `AppointmentListScreen` (610 l) mobile em sub-telas | Único refinamento com paralelo ao web; não é dívida |
| ~~P0~~ | ~~Modularizar app mobile~~ | **Descartado** — mobile já modular (§4.1) |
| ~~P2~~ | ~~Separar crypto de 2FA~~ | **Descartado** — já separados e `crypto.ts` já puro (§4.2) |
| ~~P2~~ | ~~Co-localizar schemas Zod~~ | **Descartado** — agregador coeso; split seria dano (§4.2) |
| ~~P3~~ | ~~Auto-ciclo crypto.ts~~ | **Descartado** — falso-positivo de ID nativo (§4.3) |

**Não há refatoração de código pendente.** O codebase está bem-fatorado nas três frentes (backend, web, mobile).

---

## 7. Veredito

Arquitetura **sólida e coerente** no backend (serviço-por-domínio, erro centralizado, event-driven, multi-tenant) e no **frontend web** (core/modules recém-extraídos, hub `useAuth` limpo). A separação de domínios é nítida no grafo — 39 comunidades com fronteiras que espelham os limites de negócio pretendidos.

Os três clientes já estão modularizados: backend (serviço-por-domínio), frontend web (core/modules) e **mobile (context/services/components/screens — verificado no código, §4.1)**. Não há monólito remanescente e, após inspeção do código-fonte, **nenhum item de refatoração de código se sustentou** — todas as comunidades de baixa coesão apontadas pelo grafo (§4.2/§4.3) foram refutadas como artefatos de clustering de um codebase bem-fatorado em arquivos pequenos.

A conclusão prática para o arquiteto: o projeto está estruturalmente saudável. A recomendação não é refatorar, mas **manter a disciplina atual** (arquivos pequenos single-responsibility, taxonomia de erro única, serviço-por-domínio). O único refinamento opcional — sem urgência — é espelhar no mobile o split de sub-telas de autenticação já feito no web.

> **Nota metodológica geral.** Este relatório partiu de métricas de grafo (coesão, betweenness, tamanho de comunidade) e as tratou como hipóteses. Cada hipótese de dívida foi então testada contra o código-fonte — e todas caíram. A lição transferível: análise de grafo é excelente para **navegar e priorizar onde olhar**, mas coesão baixa em cluster de arquivos pequenos já-desacoplados é ruído, não sinal. A leitura do código é a autoridade final.

---

### Anexos
- Grafo interativo: `graphify-out/graph.html`
- Relatório bruto: `graphify-out/GRAPH_REPORT.md`
- Dados: `graphify-out/graph.json`
