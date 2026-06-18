# Razorfy

Implementacao full stack da plataforma Razorfy, usando Node.js, Express, Prisma, React, React Native e PostgreSQL.

## Documentacao operacional

O catalogo canonico de funcionalidades, backlog, bugs e hotfixes esta em
[`docs/FEATURES_BUGS_HOTFIXES.md`](docs/FEATURES_BUGS_HOTFIXES.md). Esse arquivo possui IDs e
campos estaveis para futura automacao de features, correcoes e releases.

## Executar

Requisito: Docker Desktop.

```bash
docker compose up --build
```

- Aplicacao web: http://localhost:5173
- API: http://localhost:8080/api/v1
- Health check: http://localhost:8080/actuator/health

O aplicativo mobile e executado separadamente com Expo:

```bash
cd mobile
npm install
npm start
```

Consulte [`mobile/README.md`](mobile/README.md) para configurar emulador ou aparelho fisico.

O cadastro pela interface cria clientes. Para desenvolvimento, o Compose tambem prepara:

- Admin: `admin@razorfy.local` / `Admin@123`
- Barbeiros: `rafael@razorfy.local` ou `bruno@razorfy.local` / `Barber@123`

As credenciais sao apenas locais e devem ser substituidas fora do ambiente de desenvolvimento.

## Arquitetura

```text
frontend/   React 19 + TypeScript + Vite
mobile/     Expo 56 + React Native + TypeScript
backend/    Node.js 22 + Express + TypeScript + Prisma
postgres    PostgreSQL com restricao de exclusao para impedir sobreposicao
```

O backend usa:

- JWT HS256 com expiracao por perfil.
- BCrypt com custo 12.
- Prisma ORM com migrations SQL versionadas.
- `SELECT FOR UPDATE` por barbeiro, cupom, agendamento e carteira em fluxos financeiros.
- Restricao PostgreSQL `EXCLUDE USING gist` como ultima linha contra overbooking.
- Reserva de cashback durante pagamentos pendentes.
- Cupons mutuamente exclusivos com cashback no checkout.
- Outbox persistente para Push/WhatsApp, com ate cinco tentativas.
- Job de expiracao de hold, outbox e Win-back.
- Historico de status e logs estruturados para mutacoes criticas.
- Rotas administrativas sob `/api/v1/admin/*` restritas ao papel estrito `ADMIN`.

## Endpoints principais

| Metodo | Endpoint | Uso |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Cadastro de cliente |
| `POST` | `/api/v1/auth/login` | Login |
| `GET` | `/api/v1/services` | Catalogo |
| `GET` | `/api/v1/barbers` | Profissionais |
| `GET` | `/api/v1/barbers/{id}/availability` | Horarios por duracao |
| `POST` | `/api/v1/appointments` | Criar agendamento |
| `POST` | `/api/v1/appointments/{id}/cancel` | Cancelar |
| `POST` | `/api/v1/appointments/{id}/conclude` | Concluir e creditar cashback |
| `GET` | `/api/v1/wallet` | Saldo e extrato |
| `POST` | `/api/v1/payments/webhooks/mock` | Compensacao PIX local |
| `GET` | `/api/v1/reports/summary` | Relatorio administrativo legado |
| `GET` | `/api/v1/admin/dashboard` | Centro de Comando do dono |
| `POST` | `/api/v1/admin/appointments/{id}/no-show` | Aplica No-Show e penalidade de cashback |
| `GET/POST/PUT/DELETE` | `/api/v1/admin/coupons` | CRUD de cupons |
| `GET/POST/PUT/DELETE` | `/api/v1/admin/commissions` | Regras de repasse |
| `GET/POST/DELETE` | `/api/v1/admin/vacation-blocks` | Ferias de barbeiros |
| `GET/PATCH` | `/api/v1/admin/alerts` | Radar de detratores |
| `POST` | `/api/v1/admin/campaigns/win-back/run` | Disparo manual de Win-back |

## Decisoes explicitas

- `TIMESTAMPTZ` e usado para preservar o instante; a jornada usa `America/Sao_Paulo`.
- A grade de inicio avanca em 15 minutos, mas aceita qualquer duracao acumulada.
- `PENDING_PAYMENT` bloqueia o intervalo por 10 minutos.
- O saldo aplicado fica reservado e so e debitado apos confirmacao.
- `NO_SHOW` e terminal e nao volta para `CONFIRMED`.
- Comissao incide sobre o valor liquido recebido, depois de cupom ou cashback.
- Ferias nao podem ser retroativas e conflitam com agendamentos `CONFIRMED`.

## Validacao local

```bash
cd backend
npm install
npm run db:generate
npm run build
```

```bash
cd frontend
npm install
npm run build
```

```bash
cd mobile
npm install
npm run typecheck
npm run doctor
```

Observacao: o script `backend/npm test` existe, mas atualmente nao ha arquivos `*.test.ts` ou
`*.spec.ts` versionados; o Vitest encerra com "No test files found".
