# Razorfy

Implementação full stack da plataforma Razorfy, usando Spring Boot, React, React Native e
PostgreSQL.

## Documentação operacional

O catálogo canônico de funcionalidades, backlog, bugs e hotfixes está em
[`docs/FEATURES_BUGS_HOTFIXES.md`](docs/FEATURES_BUGS_HOTFIXES.md). Esse arquivo possui IDs e
campos estáveis para futura automação de features, correções e releases.

## Executar

Requisito: Docker Desktop.

```bash
docker compose up --build
```

- Aplicação: http://localhost:5173
- API: http://localhost:8080/api/v1
- Health check: http://localhost:8080/actuator/health

O aplicativo mobile é executado separadamente com Expo:

```bash
cd mobile
npm install
npm start
```

Consulte [`mobile/README.md`](mobile/README.md) para configurar emulador ou aparelho físico.

O cadastro pela interface cria clientes. Para desenvolvimento, o Compose também prepara:

- Admin: `admin@razorfy.local` / `Admin@123`
- Barbeiros: `rafael@razorfy.local` ou `bruno@razorfy.local` / `Barber@123`

As credenciais são apenas locais e devem ser substituídas fora do ambiente de desenvolvimento.

## Arquitetura

```text
frontend/   React 19 + TypeScript + Vite
mobile/     Expo 56 + React Native + TypeScript
backend/    Java 21 + Spring Boot 3.5 + Spring Security + JPA + Flyway
postgres    PostgreSQL com restrição de exclusão para impedir sobreposição
```

O backend usa:

- JWT HS256 com expiração por perfil.
- BCrypt com custo 12.
- `SELECT FOR UPDATE` por barbeiro e carteira.
- Restrição PostgreSQL `EXCLUDE USING gist` como última linha contra overbooking.
- Reserva de cashback durante pagamentos pendentes.
- Outbox persistente para Push/WhatsApp, com até cinco tentativas.
- Histórico de status e logs estruturados para mutações críticas.

## Endpoints principais

| Método | Endpoint | Uso |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Cadastro de cliente |
| `POST` | `/api/v1/auth/login` | Login |
| `GET` | `/api/v1/services` | Catálogo |
| `GET` | `/api/v1/barbers` | Profissionais |
| `GET` | `/api/v1/barbers/{id}/availability` | Horários por duração |
| `POST` | `/api/v1/appointments` | Criar agendamento |
| `POST` | `/api/v1/appointments/{id}/cancel` | Cancelar |
| `POST` | `/api/v1/appointments/{id}/conclude` | Concluir e creditar cashback |
| `GET` | `/api/v1/wallet` | Saldo e extrato |
| `POST` | `/api/v1/payments/webhooks/mock` | Compensação PIX local |
| `GET` | `/api/v1/reports/summary` | Relatório administrativo |

## Decisões explícitas

- `TIMESTAMPTZ` é usado para preservar o instante; a jornada usa `America/Sao_Paulo`.
- A grade de início avança em 15 minutos, mas aceita qualquer duração acumulada.
- `PENDING_PAYMENT` bloqueia o intervalo por 10 minutos.
- O saldo aplicado fica reservado e só é debitado após confirmação.
- Foram adicionados `EXPIRED_PAYMENT` e `CANCELLED_OVERBOOKING` para representar os fluxos da própria STS.

## Testes

```bash
cd backend
./mvnw test

cd ../frontend
npm install
npm run lint
npm run build

cd ../mobile
npm install
npm run typecheck
npm run doctor
```
