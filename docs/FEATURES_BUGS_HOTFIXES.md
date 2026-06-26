---
document_id: RAZORFY-FEATURE-REGISTRY
schema_version: 1
project: Razorfy
language: pt-BR
last_updated: 2026-06-26T15:30:00
source_of_truth: true
automation_ready: true
---

# Registro de Funcionalidades, Bugs e Hotfixes

Este documento é a fonte canônica do Razorfy para:

- inventário das funcionalidades implementadas e planejadas;
- criação automatizada de tarefas de feature;
- registro, correção e rastreabilidade de bugs;
- abertura e acompanhamento de hotfixes;
- geração futura de changelog, release notes e planos de teste.

Não remova registros históricos. Funcionalidades descontinuadas e bugs inválidos devem ter o
status alterado para `DEPRECATED`, `CANCELLED` ou `REJECTED`, preservando seu ID.

## 1. Contrato para automação

### 1.1 IDs imutáveis

| Tipo | Formato | Exemplo |
| --- | --- | --- |
| Funcionalidade | `FEAT-NNN` | `FEAT-001` |
| Bug | `BUG-AAAA-NNN` | `BUG-2026-001` |
| Hotfix | `HOTFIX-AAAA-NNN` | `HOTFIX-2026-001` |
| Decisão técnica | `ADR-NNN` | `ADR-001` |
| Release | `REL-X.Y.Z` | `REL-1.0.0` |

Um ID nunca deve ser reutilizado, mesmo se o item for cancelado.

### 1.2 Valores permitidos

**Status de funcionalidade**

- `PLANNED`: definida, ainda não iniciada.
- `READY`: refinada e pronta para implementação.
- `IN_PROGRESS`: em desenvolvimento.
- `PARTIAL`: parte utilizável, mas ainda há entregas obrigatórias.
- `IMPLEMENTED`: implementada e validada.
- `BLOCKED`: impedida por dependência conhecida.
- `DEPRECATED`: mantida apenas por compatibilidade.
- `CANCELLED`: retirada do escopo.

**Status de bug ou hotfix**

- `OPEN`
- `TRIAGED`
- `IN_PROGRESS`
- `FIXED`
- `VERIFIED`
- `RELEASED`
- `REJECTED`
- `DUPLICATE`

**Prioridade**

- `P0`: indisponibilidade, perda de dados ou vulnerabilidade crítica.
- `P1`: fluxo principal bloqueado ou resultado financeiro incorreto.
- `P2`: comportamento incorreto com alternativa operacional.
- `P3`: problema visual, textual ou de baixo impacto.

**Risco**

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### 1.3 Regras de edição

1. Datas devem usar `AAAA-MM-DD`.
2. Novas funcionalidades entram primeiro no catálogo com status `PLANNED` ou `READY`.
3. Todo bug deve referenciar ao menos uma feature em `feature_ids`.
4. Todo hotfix deve referenciar ao bug que o originou em `bug_ids`.
5. Um item só pode virar `VERIFIED` quando os testes descritos tiverem sido executados.
6. Alterações de banco devem informar a migration em `database_changes`.
7. Alterações de API devem informar compatibilidade em `api_compatibility`.
8. Segredos, tokens, senhas reais e dados pessoais não podem ser registrados neste arquivo.
9. A automação deve ignorar exemplos dentro de blocos marcados como `TEMPLATE_ONLY`.
10. Campos desconhecidos devem ser preservados por ferramentas que atualizem o documento.

## 2. Resumo de cobertura

| Área | Situação |
| --- | --- |
| Cadastro e login de clientes | `IMPLEMENTED` |
| Login social Google (OAuth 2.0) | `IMPLEMENTED` |
| JWT e autorização por perfil | `IMPLEMENTED` |
| Catálogo público de serviços | `IMPLEMENTED` para consulta |
| Gestão administrativa de serviços | `PLANNED` |
| Consulta de barbeiros | `IMPLEMENTED` |
| Disponibilidade dinâmica | `IMPLEMENTED` |
| Gestão da jornada pelo barbeiro | `IMPLEMENTED` |
| Agendamento de múltiplos serviços | `IMPLEMENTED` |
| PIX local/simulado | `IMPLEMENTED` |
| Gateway PIX real | `PLANNED` |
| Cartão online | `PARTIAL` no domínio, sem gateway/UI |
| Pagamento presencial | `IMPLEMENTED` |
| Cashback e extrato | `IMPLEMENTED` |
| Cancelamento e janela mínima | `IMPLEMENTED` |
| Bloqueio express da agenda | `IMPLEMENTED` |
| Avaliações com privacidade | `IMPLEMENTED` |
| Metas de performance | `IMPLEMENTED` |
| Notas CRM por cliente | `IMPLEMENTED` |
| Chamar cliente (push) | `IMPLEMENTED` |
| Lista de espera / Timeline / Recorrência | `PLANNED` |
| Estorno em gateway real | `PARTIAL`, atualmente simulado |
| Push | `PARTIAL`, processado localmente |
| WhatsApp | `PARTIAL`, integração REST configurável |
| Outbox e retentativas | `IMPLEMENTED` |
| Relatório administrativo via API | `IMPLEMENTED` |
| Dashboard administrativo React | `IMPLEMENTED` |
| Cupons administrativos | `IMPLEMENTED` |
| Repasse por comissão | `IMPLEMENTED` |
| Férias de barbeiros | `IMPLEMENTED` |
| No-Show com penalidade de cashback | `IMPLEMENTED` |
| Radar de detratores | `IMPLEMENTED` |
| Campanha Win-back | `IMPLEMENTED` |
| Aplicativo mobile do cliente | `IMPLEMENTED` |
| Infraestrutura Docker Compose | `IMPLEMENTED` |

## 3. Catálogo de funcionalidades

### FEAT-001 - Cadastro de cliente

- `status`: `IMPLEMENTED`
- `area`: `AUTH`
- `actors`: `CLIENT`
- `description`: Cadastro com nome, e-mail, telefone E.164 e senha.
- `business_rules`: e-mail e telefone únicos; nome com no mínimo 3 caracteres; senha com no mínimo 8 caracteres.
- `security`: senha armazenada com BCrypt de custo 12.
- `api`: `POST /api/v1/auth/register`
- `frontend`: tela de criação de conta.
- `acceptance`: cria usuário `CLIENT`, carteira com saldo zero e retorna JWT.
- `tests`: validado por fluxo HTTP integrado.

### FEAT-002 - Login e sessão JWT

- `status`: `IMPLEMENTED`
- `area`: `AUTH`
- `actors`: `CLIENT`, `BARBER`, `ADMIN`, `DEV`
- `description`: Autenticação por e-mail e senha com token JWT HS256.
- `business_rules`: expiração de 24 horas para cliente e 8 horas para equipe.
- `api`: `POST /api/v1/auth/login`
- `frontend`: persistência da sessão no `localStorage` e ação de logout.
- `acceptance`: credenciais válidas retornam token e perfil; credenciais inválidas retornam `401`.

### FEAT-003 - Autorização por perfil

- `status`: `IMPLEMENTED`
- `area`: `SECURITY`
- `actors`: `CLIENT`, `BARBER`, `ADMIN`, `DEV`
- `description`: Proteção de endpoints por papéis presentes no JWT.
- `rules`: conclusão restrita à equipe; relatórios restritos a `ADMIN` e `DEV`.
- `acceptance`: usuário sem papel permitido recebe `403`.

### FEAT-004 - Catálogo público de serviços

- `status`: `IMPLEMENTED`
- `area`: `CATALOG`
- `actors`: `PUBLIC`, `CLIENT`
- `description`: Lista serviços ativos com nome, duração e preço.
- `api`: `GET /api/v1/services`
- `frontend`: cartões selecionáveis na criação do agendamento.
- `acceptance`: somente serviços ativos são retornados.

### FEAT-005 - Gestão administrativa de serviços

- `status`: `PLANNED`
- `area`: `CATALOG`
- `actors`: `ADMIN`
- `description`: Criar, editar, ativar e desativar serviços.
- `required_api`: `POST`, `PUT` e `PATCH /api/v1/admin/services`.
- `required_ui`: tela administrativa de serviços.
- `acceptance`: preço não negativo, duração positiva e nome com até 50 caracteres.
- `depends_on`: `FEAT-003`, `FEAT-004`

### FEAT-006 - Consulta de barbeiros

- `status`: `IMPLEMENTED`
- `area`: `SCHEDULE`
- `actors`: `PUBLIC`, `CLIENT`
- `description`: Lista profissionais com papel `BARBER`.
- `api`: `GET /api/v1/barbers`
- `frontend`: seletor de profissional.

### FEAT-007 - Jornada individual do barbeiro

- `status`: `IMPLEMENTED`
- `area`: `SCHEDULE`
- `actors`: `BARBER`, `ADMIN`
- `description`: Jornada semanal, início, fim e intervalo de almoço persistidos por profissional.
- `implemented`: modelo, migration, validação, dados de desenvolvimento, endpoints REST e interface de configuração.
- `api`: `GET /barbers/:id/slots`, `PUT /barbers/:id/slots`
- `frontend`: painel de expediente em `BarberSchedulePage` (FEAT-055).
- `acceptance`: jornada válida não pode ter fim anterior ao início; almoço deve estar contido na jornada.
- `depends_on`: `FEAT-055`

### FEAT-008 - Disponibilidade dinâmica

- `status`: `IMPLEMENTED`
- `area`: `SCHEDULE`
- `actors`: `PUBLIC`, `CLIENT`
- `description`: Calcula inícios disponíveis conforme barbeiro, data e duração acumulada.
- `api`: `GET /api/v1/barbers/{id}/availability?date=AAAA-MM-DD&duration=N`
- `rules`: grade de início em 15 minutos; não retorna passado, almoço, fora da jornada ou intervalos ocupados.
- `acceptance`: todo horário retornado comporta integralmente a duração solicitada.
- `tests`: teste unitário de almoço e validação HTTP integrada.

### FEAT-009 - Seleção de múltiplos serviços

- `status`: `IMPLEMENTED`
- `area`: `APPOINTMENT`
- `actors`: `CLIENT`
- `description`: Permite combinar serviços e acumular duração e preço.
- `rules`: `end_timestamp` é a soma exata das durações; serviços duplicados são rejeitados.
- `frontend`: cálculo imediato de duração e valor.
- `tests`: duração `30 + 30 + 15 = 75` minutos validada.

### FEAT-010 - Criação de agendamento

- `status`: `IMPLEMENTED`
- `area`: `APPOINTMENT`
- `actors`: `CLIENT`
- `api`: `POST /api/v1/appointments`
- `description`: Cria agendamento com snapshots dos serviços, preço, cashback e método de pagamento.
- `rules`: deve estar no futuro, dentro da jornada e sem sobreposição.
- `states`: `PENDING_PAYMENT` para online; `CONFIRMED` para presencial.
- `acceptance`: retorna início, fim, totais, status e payload de pagamento quando aplicável.

### FEAT-011 - Reserva temporária de horário

- `status`: `IMPLEMENTED`
- `area`: `APPOINTMENT`
- `actors`: `CLIENT`, `SYSTEM`
- `description`: Pagamentos online bloqueiam o intervalo durante 10 minutos.
- `states`: `PENDING_PAYMENT` e `EXPIRED_PAYMENT`.
- `scheduler`: verificação a cada 60 segundos.
- `acceptance`: após expiração, horário e cashback reservado são liberados.

### FEAT-012 - Proteção contra overbooking

- `status`: `IMPLEMENTED`
- `area`: `APPOINTMENT`
- `actors`: `SYSTEM`
- `description`: Impede sobreposição em qualquer nível de minuto.
- `mechanisms`: lock pessimista do barbeiro, consulta transacional e constraint PostgreSQL `EXCLUDE USING gist`.
- `error`: `SLOT_ALREADY_BOOKED`, HTTP `409`.
- `tests`: conflito integrado validado com retorno `409`.

### FEAT-013 - Pagamento presencial

- `status`: `IMPLEMENTED`
- `area`: `PAYMENT`
- `actors`: `CLIENT`
- `description`: Confirma imediatamente o agendamento para pagamento no balcão.
- `method`: `PRESENTIAL`
- `acceptance`: não gera QR Code e agenda notificações de confirmação.

### FEAT-014 - Pagamento PIX simulado

- `status`: `IMPLEMENTED`
- `area`: `PAYMENT`
- `actors`: `CLIENT`, `SYSTEM`
- `description`: Gera referência, código copia e cola e representação Base64 para desenvolvimento.
- `method`: `ONLINE_PIX`
- `api`: `POST /api/v1/payments/webhooks/mock`
- `warning`: não processa dinheiro real.
- `acceptance`: webhook válido muda `PENDING_PAYMENT` para `CONFIRMED`.

### FEAT-015 - Gateway de pagamento real

- `status`: `PLANNED`
- `area`: `PAYMENT`
- `actors`: `SYSTEM`, `PAYMENT_GATEWAY`
- `description`: Adaptador para Mercado Pago, Asaas ou provedor equivalente.
- `requirements`: assinatura de webhook, idempotência persistente, consulta de status e estorno real.
- `depends_on`: `FEAT-014`
- `acceptance`: nenhuma confirmação pode depender apenas de dados enviados pelo cliente.

### FEAT-016 - Pagamento online com cartão

- `status`: `PARTIAL`
- `area`: `PAYMENT`
- `actors`: `CLIENT`
- `description`: O método `ONLINE_CARD` existe no domínio e banco.
- `missing`: gateway, tokenização segura, endpoints e interface.
- `security`: dados brutos de cartão nunca devem ser persistidos.

### FEAT-017 - Webhook de compensação idempotente

- `status`: `IMPLEMENTED`
- `area`: `PAYMENT`
- `actors`: `PAYMENT_GATEWAY`, `SYSTEM`
- `description`: Reprocessar confirmação de pagamento não duplica débito de cashback.
- `current_scope`: endpoint mock.
- `acceptance`: agendamento já confirmado permanece confirmado sem nova mutação financeira.

### FEAT-018 - Carteira de cashback

- `status`: `IMPLEMENTED`
- `area`: `CASHBACK`
- `actors`: `CLIENT`
- `description`: Mantém saldo total, saldo reservado e saldo disponível.
- `api`: `GET /api/v1/wallet`
- `frontend`: cartão de saldo e extrato.
- `rules`: saldo nunca pode ficar negativo.

### FEAT-019 - Uso de cashback no agendamento

- `status`: `IMPLEMENTED`
- `area`: `CASHBACK`
- `actors`: `CLIENT`
- `description`: Cashback paga **serviços completos** — o valor aplicado deve corresponder à soma de um subconjunto dos serviços selecionados (nunca abatimento parcial de um serviço, pois não há pagamento no app). Pode cobrir 1, alguns ou todos os serviços; o restante é pago no balcão.
- `rules`: `cashbackAmountToApply` deve ser uma soma de subconjunto dos preços dos serviços (validado por subset-sum em centavos); exige saldo disponível ≥ valor aplicado; valor reservado durante pagamento pendente, debitado na confirmação (presencial: na criação). Sugestão automática em `FEAT-068`. Histórico: parcial → total (2026-06-17) → subconjunto de serviços completos (2026-06-17).
- `errors`: `CASHBACK_PARTIAL_SERVICE` (422, valor não corresponde a serviços inteiros), `CASHBACK_INSUFFICIENT_FUNDS` (422, saldo < valor aplicado).
- `tests`: valor = preço de 1 serviço → aceito pela regra (cai em `CASHBACK_INSUFFICIENT_FUNDS` sem saldo); valor parcial (R$ 29 de serviço R$ 30) → `422 CASHBACK_PARTIAL_SERVICE`.

### FEAT-020 - Geração de cashback

- `status`: `IMPLEMENTED`
- `area`: `CASHBACK`
- `actors`: `BARBER`, `ADMIN`, `SYSTEM`
- `description`: Credita cashback quando o atendimento muda para `CONCLUDED`.
- `default_rate`: `10%` (`CASHBACK_RATE`, default `0.1`).
- `formula`: `amount_paid * cashback_rate` — incide sobre o valor efetivamente pago em dinheiro.
- `rules`: valor pago com cashback não gera novo cashback (ex.: total R$ 35, R$ 10 em cashback, R$ 25 pagos → gera R$ 2,50).
- `tests`: R$ 25,00 pagos geram R$ 2,50; R$ 35,00 pagos geram R$ 3,50.

### FEAT-021 - Extrato de cashback

- `status`: `IMPLEMENTED`
- `area`: `CASHBACK`
- `actors`: `CLIENT`
- `description`: Lista créditos, débitos, reservas e liberações em ordem decrescente.
- `transaction_types`: `CREDIT`, `DEBIT`, `RESERVE`, `RELEASE`.
- `frontend`: tela “Minha carteira”.

### FEAT-022 - Histórico do cliente

- `status`: `IMPLEMENTED`
- `area`: `APPOINTMENT`
- `actors`: `CLIENT`
- `api`: `GET /api/v1/appointments/mine`
- `description`: Lista agendamentos e serviços do cliente em ordem decrescente.
- `frontend`: tela “Meus horários”.

### FEAT-023 - Cancelamento pelo cliente

- `status`: `IMPLEMENTED`
- `area`: `APPOINTMENT`
- `actors`: `CLIENT`, `ADMIN`, `DEV`
- `api`: `POST /api/v1/appointments/{id}/cancel`
- `rules`: permitido quando início menos horário atual for maior ou igual a 2 horas.
- `error`: `INVALID_CANCEL_WINDOW`, HTTP `422`.
- `refund`: cashback é liberado ou devolvido; estorno online usa adaptador atualmente simulado.
- `tests`: cancelamento abaixo de 2 horas validado com HTTP `422`.

### FEAT-024 - Conclusão do atendimento

- `status`: `IMPLEMENTED`
- `area`: `APPOINTMENT`
- `actors`: `BARBER`, `ADMIN`, `DEV`
- `api`: `POST /api/v1/appointments/{id}/conclude`
- `rules`: barbeiro só conclui os próprios atendimentos; somente `CONFIRMED` pode virar `CONCLUDED`.
- `effects`: credita cashback, registra auditoria e cria notificações.

### FEAT-025 - Estados completos do agendamento

- `status`: `IMPLEMENTED`
- `area`: `APPOINTMENT`
- `states`: `PENDING_PAYMENT`, `CONFIRMED`, `CONCLUDED`, `CANCELLED`, `EXPIRED_PAYMENT`, `CANCELLED_OVERBOOKING`.
- `description`: Estados adicionais preservam causa operacional de expiração e conflito.

### FEAT-026 - Outbox de notificações

- `status`: `IMPLEMENTED`
- `area`: `NOTIFICATION`
- `actors`: `SYSTEM`
- `description`: Persiste eventos antes do envio para evitar perda em indisponibilidades externas.
- `channels`: `PUSH`, `WHATSAPP`.
- `retry`: a cada 5 minutos, máximo de 5 tentativas.
- `states`: `PENDING`, `SENT`, `FAILED`.
- `tests`: processamento integrado validado.

### FEAT-027 - Notificação Push

- `status`: `PARTIAL`
- `area`: `NOTIFICATION`
- `description`: Eventos Push são criados e processados pela outbox.
- `missing`: integração com FCM, APNs ou provedor equivalente.
- `current_behavior`: envio local simulado em log.

### FEAT-028 - Notificação WhatsApp

- `status`: `PARTIAL`
- `area`: `NOTIFICATION`
- `description`: Integração REST configurável por `WHATSAPP_GATEWAY_URL`.
- `implemented`: payload, outbox, tentativas e fallback local.
- `missing`: adaptador específico, autenticação e testes contratuais com provedor real.

### FEAT-029 - Lembrete duas horas antes

- `status`: `IMPLEMENTED`
- `area`: `NOTIFICATION`
- `description`: Ao confirmar, agenda Push e WhatsApp para duas horas antes.
- `rules`: não agenda lembrete quando o instante já passou.

### FEAT-030 - Auditoria de status e cashback

- `status`: `IMPLEMENTED`
- `area`: `AUDIT`
- `description`: Histórico de status em banco e logs JSON para mutações críticas.
- `required_fields`: `timestamp`, `user_id`, `appointment_id`, `payload`.
- `storage`: `appointment_status_history` e console estruturado Logstash.
- `tests`: formato JSON e presença de `user_id` e `payload` validados.

### FEAT-031 - Relatório administrativo

- `status`: `IMPLEMENTED`
- `area`: `REPORT`
- `actors`: `ADMIN`, `DEV`
- `api`: `GET /api/v1/reports/summary`; `GET /api/v1/admin/dashboard`; `POST /api/v1/admin/reports/daily/rebuild`
- `metrics`: confirmados, concluídos, no-show, receita bruta/líquida, ticket médio, LTV estimado, ociosidade e ocupação por barbeiro.
- `frontend`: Centro de Comando em `frontend/src/App.tsx`.
- `database_changes`: `0005_admin_owner_module` (`daily_admin_reports`).

### FEAT-032 - Dashboard administrativo

- `status`: `IMPLEMENTED`
- `area`: `REPORT`
- `actors`: `ADMIN`
- `description`: Interface React para métricas executivas, radar de detratores, grid global, cupons, repasses, férias e disparo manual de Win-back.
- `api`: rotas sob `/api/v1/admin/*`, com RBAC estrito `ADMIN`.
- `frontend`: `AdminCommandCenter` em `frontend/src/App.tsx`.
- `depends_on`: `FEAT-031`, `FEAT-069`

### FEAT-033 - Gestão de barbeiros e jornadas

- `status`: `PARTIAL`
- `area`: `ADMIN`
- `actors`: `ADMIN`, `BARBER`
- `description`: Jornadas e bloqueios existentes; férias administrativas implementadas com validação de conflito. Cadastro/edição de barbeiro permanece planejado.
- `api`: `GET/POST/DELETE /api/v1/admin/vacation-blocks`
- `acceptance`: férias não retroativas; período final >= início; conflito com agendamentos `CONFIRMED` retorna `409 VACATION_OVERLAP` com clientes a remarcar.

### FEAT-034 - Configuração da taxa de cashback

- `status`: `PARTIAL`
- `area`: `ADMIN`
- `actors`: `ADMIN`
- `implemented`: taxa configurável por variável `CASHBACK_RATE`.
- `missing`: persistência versionada, endpoint e interface administrativa.
- `acceptance`: alteração deve afetar apenas conclusões posteriores à vigência.

### FEAT-035 - Tratamento padronizado de erros

- `status`: `IMPLEMENTED`
- `area`: `API`
- `description`: Respostas incluem instante, HTTP status, código interno, mensagem e caminho.
- `codes`: inclui `SLOT_ALREADY_BOOKED`, `INVALID_CANCEL_WINDOW`, `BARBER_NOT_AVAILABLE` e erros de cashback.

### FEAT-036 - Interface de autenticação

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `description`: Cadastro, login, mensagens de erro, sessão e logout.
- `responsive`: desktop e mobile.

### FEAT-037 - Interface de agendamento

- `status`: `DEPRECATED`
- `area`: `FRONTEND`
- `description`: Serviços, duração, profissional, data, horários, pagamento, cashback e resumo.
- `acceptance`: botão de confirmação permanece desabilitado sem serviços e horário.
- `deprecated_at`: `2026-06-11`, substituída pelo fluxo MVP de `FEAT-049`.

### FEAT-038 - Interface de pagamento PIX

- `status`: `DEPRECATED`
- `area`: `FRONTEND`
- `description`: Exibe código PIX simulado e ação de aprovação para desenvolvimento.
- `warning`: deve ser substituída pelo fluxo do gateway real antes de produção financeira.
- `deprecated_at`: `2026-06-11`, removida do frontend no MVP (`FEAT-049`); a API `POST /api/v1/payments/webhooks/mock` permanece ativa.

### FEAT-039 - Interface de histórico

- `status`: `DEPRECATED`
- `area`: `FRONTEND`
- `description`: Exibe status, data, horário, barbeiro, serviços, valor e cancelamento permitido.
- `deprecated_at`: `2026-06-11`, removida do frontend no MVP (`FEAT-049`); a API `GET /api/v1/appointments/mine` permanece ativa.

### FEAT-040 - Interface da carteira

- `status`: `DEPRECATED`
- `area`: `FRONTEND`
- `description`: Exibe saldo disponível e extrato de cashback.
- `deprecated_at`: `2026-06-11`, removida do frontend no MVP (`FEAT-049`); a API `GET /api/v1/wallet` permanece ativa.

### FEAT-041 - Responsividade

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `description`: Layout adaptado para desktop, tablet e celular, com navegação móvel.

### FEAT-042 - Persistência PostgreSQL e migrations

- `status`: `IMPLEMENTED`
- `area`: `INFRA`
- `description`: Schema gerenciado pelo Flyway, UUIDs, índices, checks e integridade referencial.
- `migrations`: `V1__initial_schema.sql`, `V2__seed_development_catalog.sql`.

### FEAT-043 - Ambiente Docker Compose

- `status`: `IMPLEMENTED`
- `area`: `INFRA`
- `description`: Serviços PostgreSQL, backend e frontend com health checks.
- `command`: `docker compose up --build`

### FEAT-044 - Bootstrap de desenvolvimento

- `status`: `IMPLEMENTED`
- `area`: `DEVELOPMENT`
- `description`: Cria administrador e define senhas de barbeiros somente quando habilitado.
- `flag`: `DEV_BOOTSTRAP_ENABLED`
- `security`: deve permanecer desabilitado em produção.
- `dev_accounts`: contas de teste para desenvolvimento local, validadas por login HTTP em `2026-06-11`:
  - `ADMIN`: `admin@razorfy.local` (e-mail definido por `DEV_ADMIN_EMAIL`; senha definida por `DEV_ADMIN_PASSWORD`).
  - `BARBER`: `rafael@razorfy.local` (Rafael Martins) e `bruno@razorfy.local` (Bruno Costa), criados pelo seed `0002_seed_dev`; senha definida por `DEV_STAFF_PASSWORD`.
  - `CLIENT`: `usuario.teste@razorfy.dev` e `teste.cliente@razorfy.dev`, criados via `POST /api/v1/auth/register` (o segundo possui um agendamento `CONFIRMED` no histórico para testes de fluxo).
  - As senhas não são registradas aqui (regra 8 da seção 1.3); estão nas variáveis do `backend/.env` local.
- `usage`: contas destinadas a smoke tests do fluxo completo — barbeiro conclui atendimento (`/conclude`, gera cashback), admin acessa `GET /api/v1/reports/summary`.
- `production_checklist`: antes de qualquer deploy em produção é obrigatório (1) alterar todas as senhas das contas de desenvolvimento (`DEV_ADMIN_PASSWORD`, `DEV_STAFF_PASSWORD` e contas de cliente de teste) e (2) definir `DEV_BOOTSTRAP_ENABLED=false` após o primeiro deploy que criar o admin.

### FEAT-045 - Acesso operacional do perfil DEV

- `status`: `PARTIAL`
- `area`: `DEVELOPMENT`
- `actors`: `DEV`
- `implemented`: papel no domínio e autorização para operações administrativas existentes.
- `missing`: console protegido para logs, configurações e diagnóstico.

### FEAT-046 - Multi-tenant e filiais

- `status`: `PLANNED`
- `area`: `PLATFORM`
- `description`: Isolamento por estabelecimento e suporte à entidade `branch_shops`.
- `risk`: `HIGH`
- `requirements`: isolamento em todas as queries, tokens, constraints e relatórios.

### FEAT-047 - Identidade visual Razorfy

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `description`: Aplicação da marca Razorfy em toda a experiência do cliente.
- `brand_assets`: logo oficial `frontend/public/razorfy.png`.
- `colors`: vermelho `#e53935`, azul `#283593` e creme `#f6f5ea`.
- `typography`: Montserrat local via `@fontsource/montserrat`.
- `implemented`: autenticação, navegação, agendamento, carteira, histórico, favicon, metadados e textos da marca.
- `responsive`: desktop, tablet e celular.
- `acceptance`: não há referências visuais ao nome legado BarberFlow no frontend; lint e build de produção aprovados.
- `risk`: `LOW`

### FEAT-048 - Aplicativo mobile Razorfy

- `status`: `IMPLEMENTED`
- `area`: `MOBILE`
- `actors`: `CLIENT`
- `description`: Aplicativo nativo para Android e iOS com os fluxos essenciais da jornada do cliente.
- `stack`: Expo SDK 56, React Native, TypeScript e React Navigation.
- `brand_assets`: logo oficial `mobile/assets/razorfy.png`, Montserrat e cores `#e53935`, `#283593`, `#f6f5ea`.
- `implemented`: cadastro, login, sessão segura, início, catálogo, seleção de múltiplos serviços, disponibilidade dinâmica, checkout, cashback, PIX, pagamento presencial, agenda, cancelamento, carteira, extrato, perfil e logout.
- `security`: JWT persistido com `expo-secure-store`; credenciais e segredos não são armazenados no código.
- `api`: reutiliza os contratos existentes em `/api/v1`; nenhuma alteração incompatível.
- `configuration`: `EXPO_PUBLIC_API_URL` diferencia emulador, aparelho físico e ambientes publicados.
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-001`, `FEAT-002`, `FEAT-004`, `FEAT-006`, `FEAT-008`, `FEAT-010`, `FEAT-023`, `FEAT-040`, `FEAT-047`
- `acceptance`: o cliente consegue autenticar, consultar dados, montar e confirmar um agendamento, acompanhar a agenda, cancelar dentro da janela permitida e consultar o cashback.
- `tests`: TypeScript sem erros, Expo Doctor `21/21`, bundle Android exportado e autenticação inspecionada visualmente em viewport mobile.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-049 - MVP de agendamento simplificado

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `CLIENT`
- `description`: Fluxo enxuto em duas telas — home com catálogo agrupado por categoria (Cabelo, Barba, Sobrancelha, Especiais) e CTA de agendamento em destaque; calendário com pergunta de preferência de profissional ("sem preferência" agrega horários de todos os barbeiros), escolha de dia e horário em cascata.
- `business_rules`: sem preferência, o horário escolhido é atribuído ao primeiro barbeiro livre naquele instante; pagamento fixo `PRESENTIAL` (confirma imediatamente); categorização do catálogo derivada do nome do serviço.
- `api`: reutiliza `GET /services`, `GET /barbers`, `GET /barbers/{id}/availability` e `POST /appointments`; nenhuma alteração de backend.
- `frontend`: `frontend/src/App.tsx` reescrito; telas removidas: carteira, histórico, pagamento PIX e controles de cashback (`FEAT-037` a `FEAT-040` marcadas `DEPRECATED`).
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-002`, `FEAT-004`, `FEAT-006`, `FEAT-008`, `FEAT-010`, `FEAT-013`
- `acceptance`: cliente autenticado escolhe serviços na home, abre o calendário, responde sobre preferência de profissional, escolhe dia e horário e confirma; agendamento criado como `CONFIRMED`.
- `tests`: build de produção aprovado (`tsc -b && vite build`); fluxo validado via API simulando a sequência da UI (disponibilidade agregada dos 2 barbeiros + agendamento presencial confirmado).
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-050 - Catálogo em lista seccionada e shell de navegação do app

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `CLIENT`
- `description`: Substitui as abas de categoria do catálogo por uma lista única seccionada (Cabelo, Barba, Sobrancelha, Especiais visíveis ao mesmo tempo, cada uma com cabeçalho próprio com ícone e descrição), permitindo selecionar serviços de categorias diferentes sem alternar telas. Introduz o componente `AppShell` com menu de navegação entre features: menu lateral fixo no desktop (breakpoint `lg`) e menu inferior no mobile.
- `business_rules`: o menu navega entre features do app (não entre categorias); itens declarados no array central `NAV_ITEMS` — inicialmente apenas `home` (Início); novas features entram adicionando item ao array e um caso no switch de páginas do `App`; logout no rodapé do menu lateral (desktop) e na top bar (mobile); o fluxo de agendamento (calendário) abre em tela cheia, fora do shell.
- `api`: `NONE` — nenhuma alteração de backend.
- `frontend`: `frontend/src/App.tsx` (novos `NAV_ITEMS`, `NavKey` e `AppShell`; `HomePage` reescrita como lista seccionada; novo mapa `CATEGORY_META` com ícone e descrição por categoria); CTA fixo posicionado acima do menu inferior no mobile e ao lado do menu lateral no desktop.
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-049`
- `acceptance`: cliente vê todas as categorias em uma única rolagem e seleciona serviços de categorias distintas sem trocar de aba; menu lateral (desktop) e inferior (mobile) exibem as features do app, com `Início` ativo; estrutura comporta novos itens de menu sem retrabalho de layout.
- `tests`: build de produção aprovado (`tsc -b && vite build`).
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-051 - Meus Horários do cliente

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `CLIENT`
- `description`: Tela que lista todos os agendamentos do cliente em ordem decrescente, com badge de status, horário, barbeiro, serviços e botão de cancelamento.
- `business_rules`: botão "Cancelar" visível somente para `CONFIRMED` e `PENDING_PAYMENT`; desabilitado quando faltar menos de 2 horas para o atendimento; confirmação inline antes de chamar a API; estado local atualizado na resposta.
- `api`: `GET /api/v1/appointments/mine`, `POST /api/v1/appointments/{id}/cancel`
- `frontend`: `AppointmentsPage` em `frontend/src/App.tsx`; acessível pelo item "Meus Horários" no `AppShell`.
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-023`, `FEAT-050`
- `acceptance`: cliente vê histórico; cancelamento dentro da janela atualiza o badge na mesma tela; cancelamento fora da janela fica desabilitado.
- `tests`: build de produção aprovado (`tsc -b && vite build`).
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-052 - Carteira digital de cashback (frontend)

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `CLIENT`
- `description`: Tela com três cards de saldo (disponível em destaque, total e reservado) e extrato de transações com tipo, ícone, descrição e valor assinado.
- `business_rules`: `CREDIT` verde `+`; `DEBIT` vermelho `-`; `RESERVE`/`RELEASE` amarelo; empty state quando sem transações.
- `api`: `GET /api/v1/wallet`
- `frontend`: `WalletPage` em `frontend/src/App.tsx`; acessível pelo item "Carteira" no `AppShell`.
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-018`, `FEAT-021`, `FEAT-050`
- `acceptance`: saldos batem com a resposta da API; extrato exibe tipo e valor corretos.
- `tests`: build de produção aprovado.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-053 - Cashback no checkout com sugestão (frontend)

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `CLIENT`
- `description`: No checkout (web `CalendarPage` e mobile `CheckoutScreen`), um toggle "Usar cashback" aplica a sugestão de `FEAT-068` (pagar os serviços completos mais baratos que o saldo cobrir). Mostra quais serviços o cashback paga e o restante a pagar no balcão.
- `business_rules`: toggle habilitado quando a sugestão cobre ≥ 1 serviço; marcado → `cashbackAmountToApply = suggestion.amount`, `paymentMethod = PRESENTIAL`; restante (`total − cashback`) pago presencial. Backend valida subset-sum (`CASHBACK_PARTIAL_SERVICE`) e saldo (`CASHBACK_INSUFFICIENT_FUNDS`).
- `api`: `GET /api/v1/wallet`; `POST /api/v1/appointments` com `useCashback` e `cashbackAmountToApply = soma dos serviços sugeridos`.
- `frontend`: `CalendarPage` (`frontend/src/App.tsx`) e `CheckoutScreen` (`mobile/src/screens/CheckoutScreen.tsx`).
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-019`, `FEAT-049`, `FEAT-052`, `FEAT-068`
- `acceptance`: cliente com saldo que cobre ao menos o serviço mais barato vê a sugestão; ao confirmar, `cashback_used` = soma dos serviços cobertos e `amount_paid` = restante.
- `tests`: builds de produção (web `vite build`, mobile `tsc`) aprovados; regra validada por smoke HTTP.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`
- `history`: parcial → integral (tudo-ou-nada) → sugestão por serviços completos (2026-06-17).

### FEAT-054 - Agenda do barbeiro

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `BARBER`
- `description`: Tela com date picker (padrão hoje) que filtra a lista de agendamentos do dia. Exibe nome do cliente, horário, serviços, status badge e botão "Concluir atendimento" para agendamentos `CONFIRMED`.
- `business_rules`: fetch único na montagem; filtro de data no cliente; concluir chama `POST /appointments/:id/conclude`; status atualizado localmente na resposta.
- `api`: `GET /api/v1/appointments/mine`, `POST /api/v1/appointments/{id}/conclude`
- `frontend`: `BarberAgendaPage` em `frontend/src/App.tsx`; acessível pelo item "Agenda" no `AppShell` de barbeiros.
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-024`, `FEAT-050`
- `acceptance`: barbeiro vê apenas seus clientes do dia; clicar "Concluir" muda o badge para `CONCLUDED` e gera cashback ao cliente.
- `tests`: build de produção aprovado.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-055 - Configuração de expediente (frontend)

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `BARBER`
- `description`: Painel com 7 linhas (Segunda a Domingo). Cada linha possui toggle de ativo, inputs de entrada/saída e inputs de almoço (início/fim). Ao salvar, envia apenas dias ativos via `PUT /barbers/:id/slots`.
- `business_rules`: dias inativos não são enviados (backend deleta os ausentes); almoço opcional por dia; validação no backend (início < fim, almoço dentro do expediente).
- `api`: `GET /barbers/:id/slots`, `PUT /barbers/:id/slots`
- `frontend`: `BarberSchedulePage` em `frontend/src/App.tsx`; acessível pelo item "Expediente" no `AppShell` de barbeiros.
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-007`, `FEAT-050`
- `acceptance`: barbeiro ativa Segunda 09:00–18:00 com almoço 12:00–13:00 e salva; disponibilidade reflete o expediente configurado.
- `tests`: build de produção aprovado.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-056 - Concluir atendimento (frontend)

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `BARBER`
- `description`: Botão "Concluir atendimento" na `BarberAgendaPage` para agendamentos `CONFIRMED`. Chama `POST /appointments/:id/conclude`, atualiza o card localmente para `CONCLUDED`.
- `business_rules`: visível somente para `CONFIRMED`; barbeiro só conclui atendimentos próprios (validado no backend); após conclusão o badge muda para azul "Concluído" e o botão desaparece; cashback é creditado ao cliente.
- `api`: `POST /api/v1/appointments/{id}/conclude`
- `frontend`: inline em `BarberAgendaPage` (`FEAT-054`).
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-024`, `FEAT-054`
- `acceptance`: barbeiro clica "Concluir", status muda para `CONCLUDED` e saldo de cashback do cliente é incrementado.
- `tests`: build de produção aprovado.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-057 - Login social com Google (OAuth 2.0)

- `status`: `IMPLEMENTED`
- `area`: `AUTH`
- `actors`: `CLIENT`, `BARBER`, `ADMIN`, `DEV`
- `description`: Login e cadastro via Google usando OAuth 2.0 Authorization Code. O frontend gera `state` (CSRF, em `sessionStorage`), redireciona para a URL de autorização do Google; o Google retorna a `/auth/google/callback?code&state`; o frontend valida o `state` e envia o `code` ao backend, que troca por tokens, valida o ID token (assinatura, `aud`, `iss`, `email_verified`) e abre sessão Razorfy (mesmo contrato `{ accessToken, user }`).
- `business_rules`: o `client_secret` é confidencial e fica apenas no backend (cliente confidencial faz a troca do code); estratégia de conta — vincula por `google_id`; senão por e-mail verificado preservando o papel existente (BARBER/ADMIN continuam staff); senão cria novo `CLIENT`. Convive com login por e-mail/senha (FEAT-001/002). Contas criadas só via Google não têm senha local nem telefone: tentativa de login por senha retorna `USE_GOOGLE_LOGIN`; notificações WhatsApp são omitidas quando não há telefone (push continua).
- `api`: `GET /api/v1/auth/google/status` (`{ enabled }`), `GET /api/v1/auth/google/url?state=` (`{ url }`), `POST /api/v1/auth/google` (`{ code }` → sessão). Quando as variáveis de ambiente não estão configuradas, os endpoints de URL/troca respondem `503 OAUTH_DISABLED` e o status responde `{ enabled: false }`.
- `frontend`: `frontend/src/App.tsx` — botão "Entrar/Cadastrar com Google" (renderizado só quando `enabled`), `startGoogleLogin`, tratamento do callback no `App()` com tela de transição, tipo `User.phone` agora `string | null`.
- `configuration`: backend `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (ver `backend/.env.example`); o redirect URI deve ser registrado no Google Cloud Console e casar exatamente. Em produção estática, a rota `/auth/google/callback` precisa de fallback para `index.html` (SPA).
- `security`: `client_secret` nunca versionado (placeholders vazios no `.env.example`); ID token verificado via `google-auth-library`; e-mails não verificados rejeitados; `state` valida CSRF no retorno.
- `database_changes`: `0003_oauth_google` — `users.password` e `users.phone` passam a aceitar `NULL`; nova coluna `google_id VARCHAR(255)` com `UNIQUE`; `CHECK (password IS NOT NULL OR google_id IS NOT NULL)` garante ao menos um meio de autenticação.
- `api_compatibility`: `COMPATIBLE` (campos de auth inalterados; `phone` pode vir `null` para contas Google).
- `depends_on`: `FEAT-002`, `FEAT-036`
- `acceptance`: com credenciais configuradas, o usuário entra com Google e recebe sessão; novo usuário vira `CLIENT`; e-mail já existente como BARBER/ADMIN é vinculado preservando o papel; sem credenciais, o botão não aparece e o e-mail/senha continua funcionando.
- `tests`: `tsc` backend e build de produção do frontend aprovados; smoke test sem credenciais — `status: {enabled:false}`, `url` e `POST /google` retornam `503 OAUTH_DISABLED`, login por e-mail/senha mantém `200`. Fluxo OAuth completo requer credenciais reais do Google (não exercitado aqui).
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-058 - Redesign UI/UX da tela "Minha Agenda" (barbeiro)

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `BARBER`
- `description`: Refinamento de usabilidade/visual da agenda do barbeiro. Filtros de período reduzidos a chips "Hoje", "Semana" e "Mês"; trimestre/semestre/ano substituídos por um ícone de calendário que abre seletor de data específica (filtro `custom`). Nova linha de subfiltros de status (chips discretos com borda fina): "Todos", "Pendentes", "Concluídos", "Cancelados". Cards redesenhados com avatar de iniciais do cliente, nome em destaque, data+hora em tom neutro (não mais vermelho), serviços listados com preço alinhado à direita, total e ação "Concluir" no rodapé, sombra leve. Bottom navigation no estilo nativo (indicador superior + pílula no ícone ativo em vermelho da marca; inativo neutro). Header mobile ganha avatar do profissional à direita para equilíbrio.
- `business_rules`: subfiltros mapeiam status do domínio — Pendentes = `CONFIRMED` + `PENDING_PAYMENT`; Concluídos = `CONCLUDED`; Cancelados = `CANCELLED` + `EXPIRED_PAYMENT` + `CANCELLED_OVERBOOKING`. Período `semana` = semana corrente (segunda a domingo); `custom` = dia escolhido. Fonte da marca (Montserrat, FEAT-047) preservada — não trocada por Inter/Roboto.
- `api`: `NONE` — reutiliza `GET /appointments/mine` e `POST /appointments/{id}/conclude`.
- `frontend`: `frontend/src/App.tsx` — `BarberAgendaPage` (filtros, subfiltros, card), novo componente `Avatar` + helper `initials`, `agendaRange(filter, customDate)`, `TopBar` com slot `right`, bottom nav do `AppShell` reestilizado.
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-054`, `FEAT-050`
- `acceptance`: barbeiro filtra por Hoje/Semana/Mês ou data específica; filtra por status; cada card mostra cliente (com avatar), data e hora em tom neutro, serviço com preço e total; bottom nav destaca a aba ativa em vermelho.
- `tests`: build de produção aprovado (`tsc -b && vite build`).
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-059 - Bloqueio Express da agenda

- `status`: `IMPLEMENTED`
- `area`: `SCHEDULE`
- `actors`: `BARBER`, `ADMIN`
- `description`: Barbeiro bloqueia a própria agenda a partir de agora por 15, 30 ou 60 minutos (pausa rápida). O bloqueio remove horários da disponibilidade e impede novos agendamentos no intervalo.
- `business_rules`: **RN04** — `start = agora`, `end = agora + duração`; recusa se houver interseção com `appointments` `CONFIRMED`/`PENDING_PAYMENT` ou outro bloqueio (lock pessimista do barbeiro). **V01** — duração ∈ {15,30,60}, senão `400 INVALID_BLOCK_DURATION`. Conflito → `409 BLOCK_COLLISION` com `conflictDetails`. Recusa gera log JSON estruturado.
- `api`: `POST/GET /api/v1/barbers/{id}/express-blocks`, `DELETE .../{blockId}`. Integrado em `GET /barbers/{id}/availability` e `POST /appointments` (novo erro `SLOT_BLOCKED`).
- `frontend`: web `BarberAgendaPage` (botão "Bloquear agenda" 15/30/60 + chips de bloqueios ativos com remoção).
- `database_changes`: `0004_barber_crm` — tabela `schedule_blocks`.
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-008`, `FEAT-010`, `FEAT-054`
- `acceptance`: 30min → 201; conflito → 409 com horário do cliente; 45min → 400; disponibilidade e booking respeitam o bloqueio.
- `tests`: smoke HTTP (201/409/400, GET lista, DELETE 204); `tsc` backend e build web aprovados.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-060 - Avaliações com privacidade de comentário

- `status`: `IMPLEMENTED`
- `area`: `REVIEW`
- `actors`: `CLIENT`, `BARBER`, `ADMIN`
- `description`: Cliente avalia (nota 1–5 + comentário opcional) um atendimento `CONCLUDED` próprio. Nota média e contagem são públicas; o comentário é restrito.
- `business_rules`: **V02** — 1 avaliação por `appointment_id` (UNIQUE) → `409 REVIEW_ALREADY_EXISTS`. `barberId`/`clientId` derivados do agendamento (não confia no corpo). **RN02/V03** — `average`/`count` públicos; `comment` revelado apenas ao barbeiro avaliado ou ADMIN/DEV; para CLIENT/anônimo vira `"***"`. Média 2 casas (ex.: 5,4,4 → 4.33).
- `api`: `POST /api/v1/reviews` (CLIENT), `GET /api/v1/reviews?barberId=` (público, role-aware via `optionalAuthenticate`), `GET /api/v1/barbers/{id}/rating` (público).
- `frontend`: web `BarberAgendaPage` (card de avaliações com média + comentários); mobile `AppointmentListScreen` (modal de avaliar com estrelas) + nota do barbeiro em `ScheduleScreen`.
- `database_changes`: `0004_barber_crm` — tabela `reviews`.
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-024`, `FEAT-048`, `FEAT-054`
- `acceptance`: avaliar concluído → 201; reavaliar → 409; GET como CLIENT/anônimo/barbeiro-não-dono → `comment:"***"`; dono/ADMIN → comentário real.
- `tests`: smoke HTTP completo (201/409 + mascaramento nas 4 roles, média 5); builds aprovados.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-061 - Metas de performance do barbeiro

- `status`: `IMPLEMENTED`
- `area`: `REPORT`
- `actors`: `BARBER`, `ADMIN`
- `description`: Admin define metas de atendimentos por período; barbeiro acompanha o progresso (concluídos vs alvo).
- `business_rules`: **RN03** — leitura (GET) pelo barbeiro próprio/ADMIN; mutação (POST/PUT/DELETE) restrita a ADMIN/DEV (`403` para barbeiro). `period_end >= period_start`, `target > 0`. `completed` = atendimentos `CONCLUDED` no período; `progressPct` limitado a 100.
- `api`: `GET /api/v1/barbers/{id}/goals`; `POST/PUT/DELETE /api/v1/barber-goals[/:id]` (ADMIN/DEV).
- `frontend`: web `BarberAgendaPage` (card "Meta do período" com barra de progresso). Centro de Comando administrativo implementado em `FEAT-032`, embora a mutação de metas ainda permaneça via API.
- `database_changes`: `0004_barber_crm` — tabela `barber_goals`.
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-024`, `FEAT-003`
- `acceptance`: ADMIN cria meta; barbeiro vê `completed/progressPct`; barbeiro tentando mutar → 403.
- `tests`: smoke HTTP (201 admin, GET completed:2/progress 20%, 403 barbeiro); builds aprovados.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-062 - Prancheta de notas CRM por cliente

- `status`: `IMPLEMENTED`
- `area`: `CRM`
- `actors`: `BARBER`, `ADMIN`
- `description`: Notas em texto livre atreladas ao cliente, identificando o autor. Auxilia padronização do atendimento.
- `business_rules`: **RN05** — qualquer barbeiro/staff lê o histórico do cliente; cada nota mostra `authorName`. Criar exige `note_text` não-vazio e cliente válido. Editar/excluir apenas pelo autor ou ADMIN/DEV. Clientes não acessam o CRM.
- `api`: `POST/GET /api/v1/clients/{clientId}/notes`, `PUT/DELETE .../{noteId}` (todas staff-only).
- `frontend`: web `BarberAgendaPage` (botão "Notas" no card → modal `ClientNotesModal`). Requer `clientId` no DTO de agendamento (adicionado, presente só na view do barbeiro).
- `database_changes`: `0004_barber_crm` — tabela `client_notes`.
- `api_compatibility`: `COMPATIBLE` (DTO de agendamento ganhou `clientId` opcional)
- `depends_on`: `FEAT-054`
- `acceptance`: barbeiro cria/lista/edita nota; outro barbeiro lê (RN05); não-autor editando → 403.
- `tests`: smoke HTTP (201 + leitura cruzada com authorName); builds aprovados.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-063 - Chamar cliente (push "Sua vez chegou")

- `status`: `IMPLEMENTED`
- `area`: `NOTIFICATION`
- `actors`: `BARBER`, `ADMIN`
- `description`: Barbeiro aciona uma notificação push isolada para o cliente do atendimento confirmado.
- `business_rules`: **RF06** — barbeiro só chama o próprio atendimento; status deve ser `CONFIRMED`. Enfileira 1 linha em `notification_outbox` (canal `PUSH`, `eventType: BARBER_CALL`, `destination = clientId`) processada pelo outbox existente (push simulado — FCM real é follow-up de infra).
- `api`: `POST /api/v1/appointments/{id}/call-client` (BARBER/ADMIN/DEV).
- `frontend`: web `BarberAgendaPage` (botão "Chamar" no card confirmado).
- `database_changes`: `NONE` (reusa `notification_outbox`).
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-026`, `FEAT-054`
- `acceptance`: `POST call-client` → 200 e nova linha `BARBER_CALL` na outbox.
- `tests`: smoke HTTP (200 + contagem de outbox); builds aprovados.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-064 - Lista de Espera com broadcast (First-to-Checkout)

- `status`: `PLANNED`
- `area`: `APPOINTMENT`
- `actors`: `CLIENT`, `BARBER`, `SYSTEM`, `PUSH_GATEWAY`
- `description`: Inscrição em lista de espera por barbeiro/dia; ao liberar um horário (cancelamento), broadcast de push para inscritos com alocação *First-to-Checkout* (lock de 10 min ao primeiro a iniciar checkout).
- `business_rules`: RN01 (sem ordem; primeiro a fazer checkout leva), V04 (1 inscrição por cliente/barbeiro/data, duplicata ignorada), tratamento de corrida sem dupla reserva.
- `requirements`: tabela `waitlist_entries`, controle de concorrência (`SELECT FOR UPDATE SKIP LOCKED`), despacho assíncrono (fila Redis/broker), push real (FCM).
- `depends_on`: `FEAT-023`, `FEAT-026`
- `risk`: `HIGH`
- `target_release`: `UNPLANNED` (Fatia 2)

### FEAT-065 - Timeline "Modo Cadeira" (tempo real)

- `status`: `PLANNED`
- `area`: `SCHEDULE`
- `actors`: `BARBER`
- `description`: Dashboard em tempo real do atendimento atual (cronômetro, status do próximo cliente), idealmente via SSE/WebSocket. CT02: cronômetro não fica negativo; após estourar a duração muda para "Em atraso".
- `requirements`: SSE/WebSocket (evitar short-polling), possível `barber_stats` consolidado.
- `depends_on`: `FEAT-054`
- `risk`: `MEDIUM`
- `target_release`: `UNPLANNED` (Fatia 2)

### FEAT-066 - Motor de Recorrência

- `status`: `PLANNED`
- `area`: `APPOINTMENT`
- `actors`: `CLIENT`, `BARBER`
- `description`: Na conclusão do atendimento, sugere pré-agendamento futuro recorrente.
- `depends_on`: `FEAT-024`
- `risk`: `LOW`
- `target_release`: `UNPLANNED` (Fatia 2)

### FEAT-067 - Retratos dos barbeiros com seleção em parallax

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `actors`: `CLIENT`
- `description`: No passo de escolha do profissional (`CalendarPage` web), um hero exibe o retrato do barbeiro selecionado com efeito parallax (imagem e rótulo se deslocam em camadas conforme o mouse). Cada opção de barbeiro mostra a miniatura do retrato; "Sem preferência" exibe placeholder neutro.
- `assets`: retratos gerados via Higgsfield (modelo `soul_2`) em `frontend/public/barbers/{rafael,bruno}.png`. Mapa nome→imagem por substring (`barberImageFor`).
- `business_rules`: mapeamento por nome do seed (Rafael, Bruno); barbeiros sem imagem caem no avatar de iniciais. Não há `avatarUrl` no banco — mapeamento é no frontend (follow-up: persistir imagem por barbeiro).
- `api`: `NONE`.
- `frontend`: `frontend/src/App.tsx` (`BarberParallax`, `BARBER_IMAGES`, miniaturas na lista).
- `database_changes`: `NONE`
- `api_compatibility`: `NOT_APPLICABLE`
- `depends_on`: `FEAT-049`
- `acceptance`: ao selecionar um barbeiro, o hero mostra o retrato dele com parallax; miniatura aparece em cada opção.
- `tests`: build de produção aprovado.
- `notes`: PNGs ~4MB cada (não otimizados) — candidato a compressão/WebP antes de produção.
- `target_release`: `UNRELEASED`

### FEAT-068 - Sugestão de uso de cashback por serviços completos

- `status`: `IMPLEMENTED`
- `area`: `CASHBACK`
- `actors`: `CLIENT`
- `description`: Dado o saldo de cashback e os serviços selecionados, sugere quais serviços pagar inteiramente com cashback. Algoritmo: ordena os serviços por preço crescente e acumula enquanto o saldo cobrir, **parando no primeiro que não couber** (paga sempre os mais baratos primeiro). Ex.: saldo R$ 15, serviços [Sobrancelha R$ 10, Cabelo R$ 35] → sugere pagar Sobrancelha (R$ 10); Cabelo segue em dinheiro.
- `business_rules`: nunca abate parcialmente um serviço; só sugere o próximo se couber o menor + o próximo da ordem; restante pago no balcão. O backend valida que o valor enviado é uma soma de subconjunto dos serviços (`FEAT-019`).
- `api`: `NONE` — sugestão calculada no cliente a partir de `GET /wallet` + preços dos serviços. `POST /appointments` recebe `cashbackAmountToApply` = soma sugerida.
- `frontend`: `suggestCashback()` em `frontend/src/App.tsx` (`CalendarPage`) e `mobile/src/screens/CheckoutScreen.tsx`.
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-018`, `FEAT-019`
- `acceptance`: com saldo 15 e [10, 35], a UI sugere usar R$ 10 no serviço de R$ 10; com saldo < menor serviço, nenhuma sugestão.
- `tests`: builds web/mobile aprovados; regra de subconjunto validada por smoke HTTP (`CASHBACK_PARTIAL_SERVICE`).
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-069 - Centro de Comando do Administrador Dono

- `status`: `IMPLEMENTED`
- `area`: `ADMIN`
- `actors`: `ADMIN`
- `description`: Painel executivo restrito ao dono da barbearia com BI diário, grid global, cupons, matriz de comissão, férias, No-Show com penalidade, Radar de Detratores e Win-back.
- `business_rules`: rotas `/api/v1/admin/*` exigem usuário com `role = ADMIN` consultado na base; cupom e cashback são mutuamente exclusivos; comissão incide sobre valor líquido recebido; No-Show só após 15 minutos de tolerância e vira estado terminal `NO_SHOW`; férias não podem ser retroativas e conflitam com agendamentos confirmados; avaliação `rating <= 2` cria alerta `BAD_REVIEW`; Win-back seleciona clientes cujo último `CONCLUDED` ocorreu há exatos 45 dias e sem `CONFIRMED` futuro.
- `api`: `GET /api/v1/admin/dashboard`; `POST /api/v1/admin/appointments/{id}/no-show`; `GET/POST/PUT/DELETE /api/v1/admin/coupons`; `GET/POST/PUT/DELETE /api/v1/admin/commissions`; `GET /api/v1/admin/commissions/settlement`; `GET/POST/DELETE /api/v1/admin/vacation-blocks`; `GET/PATCH /api/v1/admin/alerts`; `POST /api/v1/admin/campaigns/win-back/run`.
- `frontend`: `AdminCommandCenter` em `frontend/src/App.tsx`, navegação exclusiva para `ADMIN`.
- `jobs`: `startWinBackJob()` e endpoint interno `/api/internal/jobs/win-back`.
- `database_changes`: `backend/prisma/migrations/0005_admin_owner_module/migration.sql`
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-003`, `FEAT-018`, `FEAT-026`, `FEAT-031`, `FEAT-060`
- `acceptance`: build backend e frontend aprovados; `npm test` backend não executa regressões por ausência de arquivos de teste versionados.
- `risk`: `HIGH`
- `target_release`: `UNRELEASED`

### FEAT-070 - Gestão de barbeiros e serviços (soft-delete)

- `status`: `IMPLEMENTED`
- `area`: `ADMIN`
- `actors`: `ADMIN`
- `description`: Painéis do Admin para listar e governar o quadro de barbeiros e o catálogo de serviços, com inativação por soft-delete (preserva histórico financeiro).
- `business_rules`: **RN06** — sem `DELETE` físico; inativação via flag (`users.is_active` / `services.active`). **RN07** — listagem do Admin ignora filtro de ativação (retorna ativos + inativos); cliente continua vendo só ativos. **RN08** — ao inativar barbeiro, retorna `orphanedAppointments` (futuros `CONFIRMED` a realocar). **V05** — não ativa serviço com nome igual a outro já ativo (`DUPLICATE_ACTIVE_SERVICE`). **V06** — não altera status de usuário `ADMIN` (`CANNOT_MODIFY_ADMIN`). Barbeiro/serviço inativo é rejeitado em novos agendamentos (`BARBER_INACTIVE` / `SERVICE_NOT_FOUND`). Toda alteração gera log de auditoria (`admin_audit`).
- `api`: `GET /api/v1/admin/barbers`, `PATCH /api/v1/admin/barbers/{id}/status`, `GET /api/v1/admin/services`, `PATCH /api/v1/admin/services/{id}/status`.
- `frontend`: painéis "Barbeiros" e "Serviços" no `AdminCommandCenter` (`frontend/src/App.tsx`).
- `database_changes`: `0006_admin_soft_delete` (`users.is_active`; `services.active` reutilizado).
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-003`, `FEAT-004`, `FEAT-006`, `FEAT-069`
- `acceptance`: Admin lista todos (ativos+inativos) com contadores; inativar barbeiro/serviço some do app do cliente e barra novos agendamentos; histórico preservado; ADMIN não pode ser alterado.
- `tests`: build backend ✓ e smoke HTTP — listas, toggle, filtro público, RBAC `403`, `CANNOT_MODIFY_ADMIN`, soft-delete preservando contadores.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-071 - Criação e deleção física de barbeiros e serviços (Admin)

- `status`: `IMPLEMENTED`
- `area`: `ADMIN`
- `actors`: `ADMIN`
- `description`: O Admin cria barbeiros (com senha provisória) e serviços, e exclui fisicamente (hard-delete) apenas registros sem histórico; registros com agendamentos só podem ser inativados (soft-delete, `FEAT-070`).
- `business_rules`: **RN01** — hard-delete só com zero `appointments` atrelados (`ENTITY_IN_USE 409` + `suggestion` de inativação caso contrário); a deleção limpa em transação as linhas próprias (slots, blocos, férias, metas, comissões, reviews, notas autoradas para barbeiro; comissões para serviço). **RN02** — senha inicial criptografada com BCrypt (custo 12). **RN03** — e-mail/telefone de barbeiro únicos (`DUPLICATE_EMAIL`/`DUPLICATE_PHONE`); nome de serviço único case-insensitive (`DUPLICATE_SERVICE_NAME`). **V01** — payload de criação de barbeiro não aceita `role`; backend força `BARBER` (anti privilege-escalation). **V02** — contagem de agendamentos antes do delete. ADMIN não pode ser excluído (`CANNOT_MODIFY_ADMIN`). FKs em `appointments` permanecem `RESTRICT` (guardião do banco). Toda ação gera `admin_audit`.
- `api`: `POST /api/v1/admin/barbers`, `DELETE /api/v1/admin/barbers/{id}`, `POST /api/v1/admin/services`, `DELETE /api/v1/admin/services/{id}`.
- `frontend`: formulários "Novo barbeiro"/"Novo serviço" + botão de exclusão (visível só quando contador = 0) nas abas Barbeiros/Serviços do `AdminCommandCenter`.
- `database_changes`: `NONE` (reusa tabelas existentes).
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-001`, `FEAT-070`
- `acceptance`: criar barbeiro/serviço → 201; e-mail/nome duplicado → 422; hard-delete sem histórico → 204; com histórico → 409 `ENTITY_IN_USE` + `suggestion`; barbeiro criado nasce `BARBER`/ativo e disponível no app do cliente.
- `tests`: build backend/web ✓; smoke HTTP — criação, duplicidade (email + nome CI), hard-delete 204, `ENTITY_IN_USE` em barbeiro e serviço com histórico.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-072 - Módulo de Configurações (conta, segurança, LGPD e parâmetros globais)

- `status`: `IMPLEMENTED`
- `area`: `SETTINGS`
- `actors`: `CLIENT`, `BARBER`, `ADMIN`
- `description`: Central de conta por role — edição de perfil (nome/telefone), toggles de notificação (push/WhatsApp) e troca de senha para todos; exclusão de conta com anonimização LGPD para clientes; e parametrização global (tolerância de No-Show e taxa de cashback) exclusiva do Admin.
- `business_rules`: **RN01** — exclusão de cliente é soft-delete + anonimização: `is_active=false`, `is_anonymized=true`, nome "Cliente Anônimo", e-mail/telefone substituídos por valores aleatórios (V03), senha vira hash inutilizável (satisfaz `chk_users_auth_method`), carteira de cashback zerada. **RN02** — bloqueia exclusão se houver agendamento futuro `CONFIRMED`/`PENDING_PAYMENT` (`HAS_PENDING_APPOINTMENTS`). **RN03** — outbox respeita `notification_*_enabled` (push e WhatsApp); win-back filtra clientes com WhatsApp ligado, ativos e não anonimizados. **RN04/V02** — troca de senha e exclusão exigem `currentPassword` válido (`CURRENT_PASSWORD_INVALID`); nova senha ≠ atual (`SAME_PASSWORD`). **V01** — `global_settings` é singleton (id=1) com cache em memória invalidado no `PUT`. E-mail não é editável; `user_id` vem sempre do JWT (anti-IDOR).
- `api`: `GET/PATCH /api/v1/users/me`, `PUT /api/v1/users/me/password`, `DELETE /api/v1/users/me`; `GET/PUT /api/v1/admin/global-settings`.
- `frontend`: `SettingsPage` (aba "Conta" para CLIENT/BARBER: perfil, notificações, senha, excluir conta) e aba "Regras" no `AdminCommandCenter` (`frontend/src/App.tsx`).
- `database_changes`: `0007_settings_module` — `users.notification_push_enabled`, `users.notification_whatsapp_enabled`, `users.is_anonymized`; tabela `global_settings` (singleton com seed id=1).
- `wiring`: No-Show lê `noShowToleranceMinutes` do settings (antes const 15); crédito de cashback lê `defaultCashbackPct` (antes `CASHBACK_RATE` do env).
- `api_compatibility`: `COMPATIBLE`
- `depends_on`: `FEAT-002`, `FEAT-018`, `FEAT-026`, `FEAT-069`
- `acceptance`: usuário edita perfil/notificações e troca senha; cliente sem agendamento futuro exclui conta → anonimizado e deslogado; com agendamento futuro → `422 HAS_PENDING_APPOINTMENTS`; Admin altera tolerância/cashback com efeito imediato.
- `tests`: builds backend/web ✓; smoke HTTP — `global-settings` GET/PUT + validação (5–60) + RBAC 403; `PATCH /me` toggles; `PUT password` válida 204; anonimização verificada no banco (nome/PII mascarados, `is_active=false`).
- `notes`: invalidação de sessões ativas pós-troca de senha (§16) fora de escopo — JWT é stateless e não há refresh tokens.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-073 - Arquitetura SaaS Multi-Tenant (Fase 1: fundação + rotas quentes)

- `status`: `IMPLEMENTED`
- `area`: `PLATFORM`
- `actors`: `PLATFORM_OWNER`, `ADMIN`, `BARBER`, `CLIENT`
- `description`: Evolução de single-tenant para multi-tenant SaaS. Entidade `barbershops` (Tenant) centraliza o negócio; `tenant_id` em todas as tabelas; isolamento de dados em TODO o backend; discovery (seleção de barbearia) no app/web. **Fase 1:** fundação + rotas quentes. **Fase 2:** isolamento de query de todo o backend + `global_settings` por tenant + discovery no frontend (web + mobile). Mantém o sistema funcionando via um **tenant default** ("Razorfy", `aaaaaaaa-0000-0000-0000-000000000001`) para o qual todos os dados existentes foram migrados; novos clientes escolhem a barbearia no discovery.
- `business_rules`: **RN01/V01** — `createAppointment` valida que barbeiro e serviços pertencem ao tenant do cliente (do JWT), senão `TENANT_MISMATCH 403`. **RN04** — rotas públicas trazem o tenant no path (`/api/v1/tenants/:tenantId/...`, UUID ou slug); rotas autenticadas extraem o tenant do claim `tnt` do JWT (anti-IDOR). **V02** — unicidade composta por tenant (`users(tenant_id,email|phone|google_id)`, `coupons(tenant_id,code)`). **RF03/CT02** — login bloqueado se a barbearia estiver inativa (`TENANT_SUSPENDED 403`). **RN03** — cashback/saldo isolado por cliente (cliente pertence a um tenant). Tenant inexistente → `TENANT_NOT_FOUND 404`.
- `api`: `GET /api/v1/barbershops?q=` e `GET /api/v1/barbershops/:slug` (discovery público); `GET /api/v1/tenants/:tenantId/{services,barbers,barbers/:id/availability}` (públicas, via `resolveTenant`); rotas legadas (`/services`, `/barbers`, `/appointments`) resolvem o tenant default; JWT ganha claim `tnt`; `/auth/register|login` aceitam `tenantSlug`.
- `frontend`: web (`TenantDiscovery` + tenant no `AuthScreen` + catálogo/availability tenant-scoped via `session.user.tenantId`) e mobile (`TenantDiscoveryScreen` + tenant no `AuthContext`/`AuthScreen` + `api.services/barbers/availability(tenantId)`). Tenant selecionado persistido (`razorfy.tenant`); botão "trocar barbearia".
- `database_changes`: `0008_multi_tenant` — tabela `barbershops` + seed default; coluna `tenant_id` (NOT NULL DEFAULT default-tenant, FK) em ~19 tabelas; uniques compostas; `global_settings` deixa de ser singleton.
- `scope_phase_1`: catálogo, disponibilidade, agendamento, cashback isolados; auth com tenant; admin `createService`/`createBarber`/`setServiceStatus` escopados por tenant.
- `phase_2_entregue (backend)`: **isolamento de query de TODO o backend por tenant** — admin (dashboard, grid, no-show, cupons CRUD, comissões + settlement, férias, alertas, win-back, daily report, list/delete barbeiro+serviço), review/goal/CRM/blocks/slots gravam `tenant_id` do parent, carteira+transações de cashback por tenant; `global_settings` agora é **1 registro por tenant** (`tenant_id` é PK, cache por tenant; no-show/cashback lêem o tenant do agendamento); win-back roda por barbearia ativa. Migrations `0009_tenant_daily_report` (unique `(tenant_id, report_date)`) e `0010_global_settings_pk`.
- `phase_2_frontend (entregue)`: discovery de barbearia (web `TenantDiscovery`, mobile `TenantDiscoveryScreen`) consumindo `GET /barbershops`; tenant persistido e injetado no login/registro (`tenantSlug`) e nas chamadas de catálogo/disponibilidade (`/tenants/:id/...`). Cliente verificado: registro com `tenantSlug=tenant-b` → `user.tenantId = B`; catálogo do app passa a vir da barbearia escolhida.
- `deep_link (entregue)`: web `/app/:slug` (resolve via `GET /barbershops/:slug` e pré-fixa o tenant, limpando a URL) e mobile `razorfy://app/:slug` (RN `Linking` no `RootNavigator`, initial URL + evento). Slug inválido/inativo cai no discovery. Permite link/QR (ex.: Instagram) fixar a barbearia.
- `api_compatibility`: `COMPATIBLE` (contratos do app inalterados; `accessToken`/`user` ganham `tenantId`, aditivo).
- `depends_on`: `FEAT-002`, `FEAT-010`, `FEAT-069`, `FEAT-072`
- `acceptance`: dados existentes migrados para o tenant default; `/tenants/B/services` isola; CT01 OK; `TENANT_MISMATCH`/`TENANT_NOT_FOUND`/`TENANT_SUSPENDED` corretos; **Fase 2** — admin de cada barbearia só vê seus cupons/barbeiros/serviços/relatórios; `global_settings` de B (25/5) não afeta o default (20/7,5); dashboard/settlement de B não vazam dados do default.
- `tests`: builds backend ✓; smoke HTTP com 2 tenants (default + Tenant B com admin/barbeiro/serviço/cupom próprios) — isolamento de catálogo, CT01, `404`/`403`, regressão de agendamento; **Fase 2** isolamento de coupons/barbers/services/dashboard/settlement por admin e `global_settings` por tenant verificados.
- `risk`: `HIGH`
- `target_release`: `UNRELEASED`

### FEAT-074 - Conexão de Tenant por Código / QR Code (white-label discovery)

- `status`: `IMPLEMENTED`
- `area`: `PLATFORM`
- `actors`: `ADMIN`, `CLIENT`
- `description`: Substitui o discovery por busca aberta (lista global de barbearias) por **conexão por código + QR Code** (ilusão white-label). Cada barbearia tem um `connection_code` único, alfanumérico MAIÚSCULO; o cliente conecta o app genérico a uma barbearia digitando o código ou escaneando o QR. **Não inclui** listagem global, busca por nome/cidade/GPS. Uma vez conectado, o app não reexibe a tela de conexão até o cliente "Desconectar barbearia".
- `business_rules`: **RN01** — `connection_code` gerado na criação da barbearia, `VARCHAR(10)`, UNIQUE, regex `^[A-Z0-9]+$`. **RN02/V01** — case-insensitive: `trim()` + `toUpperCase()` antes da validação/busca (front e back). **RN03/CT-inativa** — barbearia `is_active=false` → `TENANT_INACTIVE 403`. **RN04/CT02** — desconectar limpa o tenant persistido e a sessão; reabrir o app volta à tela "Conecte-se". **NFR-segurança** — endpoint público de conexão **nunca** retorna dados sensíveis (faturamento, proprietário, PIX); só `id`, `name`, `logo_url` (+ `slug`/`connectionCode` para o fluxo de login escopado).
- `api`: `GET /api/v1/tenants/connect/:code` (público; trim+uppercase; formato inválido → `BAD_REQUEST_FORMAT 400`; não encontrado → `INVALID_CONNECTION_CODE 404`; inativa → `TENANT_INACTIVE 403`; sucesso → `{ tenantId, name, slug, connectionCode, logoUrl }`). `GET /api/v1/admin/barbershop` (autenticado; barbearia do admin: `{ id, name, slug, connectionCode, logoUrl }`).
- `frontend`: web — `TenantDiscovery` reescrito (input com máscara MAIÚSCULA + leitor de QR via `BarcodeDetector` nativo com fallback gracioso para digitação); "Desconectar barbearia" em `SettingsPage` (cliente); painel admin nova aba **Conexão** mostra o código + QR (`qrcode.react`) com "Copiar" e "Baixar QR" (PNG do canvas). Mobile — `TenantDiscoveryScreen` reescrito (código + scanner `expo-camera`, fallback digitação); "Desconectar barbearia" em `ProfileScreen`; `api.connect(code)`.
- `deep_link`: web `/c/:code` (universal, `connectUrl` aponta o QR para `app.barberflow.com/c/CODE` via `VITE_CONNECT_BASE_URL` ou origin) e mobile `razorfy://connect/:code` / `.../c/:code` (RN `Linking`). Rotas legadas `/app/:slug` e `razorfy://app/:slug` mantidas.
- `database_changes`: `0011_connection_code` — `barbershops.connection_code VARCHAR(10) NOT NULL UNIQUE CHECK (~ '^[A-Z0-9]+$')` + `logo_url VARCHAR(500)`; backfill do code a partir do slug (`razorfy`→`RAZORFY`, `tenant-b`→`TENANTB`).
- `api_compatibility`: `COMPATIBLE` (rota de busca `/barbershops` permanece; novas rotas aditivas).
- `depends_on`: `FEAT-073`
- `acceptance`: CT01 `"  razorfy  "` → trim/upper → conecta (200); código inexistente → `404 INVALID_CONNECTION_CODE`; formato inválido (`AB@C`) → `400 BAD_REQUEST_FORMAT`; barbearia inativa → `403 TENANT_INACTIVE`; admin obtém o próprio código; desconectar → reabrir mostra "Conecte-se".
- `tests`: build backend ✓, web `tsc`/`vite build` ✓, mobile `tsc` ✓; smoke HTTP — CT01 (lowercase+spaces) 200, 404, 400, Tenant B 200, toggle `is_active=false` → 403 e revertido 200, `GET /admin/barbershop` retorna `RAZORFY`.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-075 - Módulo do Desenvolvedor (Backoffice Mestre da Plataforma)

- `status`: `IMPLEMENTED`
- `area`: `PLATFORM`
- `actors`: `DEV` (Platform Owner), `ADMIN` (criado como resultado)
- `description`: Painel de controle global exclusivo do proprietário do SaaS (`role = 'DEV'`). Gerencia o ciclo de vida das barbearias assinantes (Tenants): onboarding transacional (cria barbearia + usuário-mestre ADMIN no mesmo request), kill-switch (inativação lógica que bloqueia todos os usuários da barbearia instantaneamente) e listagem global paginada. **Não inclui** faturamento/assinaturas nem o DEV operar como cliente (LGPD). Substitui scripts manuais no banco para criar/bloquear clientes.
- `business_rules`: **RN01** — todo usuário `DEV` tem `tenant_id` NULO (não pertence a barbearia); CHECK no banco garante `role='DEV' ⟺ tenant_id IS NULL`. **RN02/RN13** — rotas `/api/v1/platform/*` exigem role `DEV` (lida do JWT, avaliada ANTES de tocar tenant); demais roles → `PLATFORM_ACCESS_DENIED 403`. **RN03** — criação atômica: se o usuário-mestre falhar, a barbearia sofre rollback. **RN04** — `connection_code` imutável (sem endpoint de UPDATE). **V01** — role do `adminUser` forçada para `ADMIN`. **V03** — `connection_code` único em TODA a tabela (ativo ou inativo) → `DUPLICATE_CONNECTION_CODE 422`.
- `kill_switch`: `authenticate` checa `barbershop.is_active` por requisição (cache TTL 10s, invalidado no PATCH) → token de barbearia suspensa cai em `TENANT_SUSPENDED 403` na próxima request; rota pública de conexão (QR) já barra com `TENANT_INACTIVE 403`.
- `api`: `GET /api/v1/platform/tenants?page&size` (paginado: `{ content[], totalPages, totalElements }`, com `adminContact`); `POST /api/v1/platform/tenants` (transacional `{ tenant{name,slug,connectionCode}, adminUser{name,email,phone,initialPassword} }` → 201); `PATCH /api/v1/platform/tenants/:id/status` `{ isActive }`. Todas sob `authenticate + requireDev`.
- `frontend`: web — rota obscura `/platform` com `DevLoginScreen` (login sem discovery de tenant); `PlatformConsole` (lista paginada com status/código/contato do dono, criar barbearia+admin, bloquear/reativar com confirmação). DEV autenticado renderiza o console ignorando o gate de tenant.
- `seed`: usuário DEV criado no boot via `devBootstrap` (env `DEV_PLATFORM_EMAIL`/`DEV_PLATFORM_PASSWORD`), `tenant_id` NULL. NFR: nunca há endpoint aberto para criar o primeiro DEV.
- `database_changes`: `0012_dev_platform` — `users.tenant_id` passa a aceitar NULL; `CHECK ((role = 'DEV') = (tenant_id IS NULL))`.
- `api_compatibility`: `COMPATIBLE` (rotas novas; JWT do DEV omite claim `tnt`).
- `depends_on`: `FEAT-073`, `FEAT-074`
- `acceptance`: DEV lista/cria/bloqueia; ADMIN em `/platform/*` → 403 `PLATFORM_ACCESS_DENIED`; onboarding cria 1 `barbershops` + 1 `users` ADMIN vinculado; código duplicado → 422; bloqueio derruba token existente na próxima request (`TENANT_SUSPENDED`).
- `tests`: build backend ✓, web `tsc`/`vite build` ✓; smoke HTTP — DEV login (sem `tnt`), lista com `adminContact`, ADMIN→403, criar NAVALHA→201 + login do novo admin→200, dup code/slug→422, payload inválido→400 (sem criar tenant), kill-switch 200→PATCH false→403 `TENANT_SUSPENDED`→connect 403→reativa→200.
- `risk`: `HIGH`
- `target_release`: `UNRELEASED`

### FEAT-076 - Segurança: Autenticação em Duas Etapas (2FA TOTP)

- `status`: `IMPLEMENTED`
- `area`: `SECURITY`
- `actors`: `CLIENT`, `BARBER`, `ADMIN`, `DEV` (qualquer usuário)
- `description`: 2FA via apps autenticadores (Google Authenticator/Authy/Microsoft) usando TOTP (RFC 6238). Ativação exige provar o 1º código; login de conta com 2FA é interceptado (token intermediário) e só libera o JWT após o código de 6 dígitos. Toggle em Configurações > Segurança. **Não inclui** 2FA por SMS/e-mail nem backup codes (futuro). Backend Node (projeto migrado de Java): lib `otplib` v13.
- `business_rules`: **RN01** — tolerância de drift ±30s (janela 90s) via `epochTolerance`. **RN02** — `is_2fa_enabled` só vira `true` após validar o 1º código (nunca por clique). **RN03** — `totp_secret` jamais trafega em leitura (`GET /users/me` só expõe o flag). **RN04** — issuer da URI carrega o nome da barbearia: `Razorfy (<tenant>)`. **V01** — código `^\d{6}$`. **V02** — `preAuthToken` tem claim `type=PRE_AUTH`; rejeitado em rotas normais (`PRE_AUTH_NOT_ALLOWED 401`).
- `security_nfr`: **Cripto em repouso** — `totp_secret` cifrado com AES-256-GCM (`iv|tag|ciphertext` base64); chave-mestra em `TOTP_ENC_KEY` (env, 32 bytes hex). **Rate limiting** — verify-2fa bloqueia o usuário após 5 falhas por 15 min (`TOO_MANY_ATTEMPTS 429`).
- `api`: `POST /auth/login` → 202 `{ status:'REQUIRE_2FA', preAuthToken }` quando 2FA ligado (senão 200 sessão); `POST /auth/login/verify-2fa` (Bearer preAuthToken + `{code}`) → JWT final; `POST /users/me/2fa/setup` → `{ otpAuthUri, manualSecretKey }`; `POST /users/me/2fa/enable` `{code}`; `DELETE /users/me/2fa` `{currentPassword, code}`. `GET /users/me` ganha `is2faEnabled`.
- `frontend`: web — `TwoFactorLoginScreen` (código no login, web + DEV backoffice) e card Segurança em `SettingsPage` (`TwoFactorSettings`: setup com QR via `qrcode.react` + chave manual + ativar; desativar com senha+código). mobile — interceptação no `AuthScreen` (tela de código) + `ProfileScreen` Segurança (`TwoFactorSection`: chave manual sem QR, ativar/desativar); `AuthContext.login` retorna `{require2fa, preAuthToken}` + `verify2fa`.
- `database_changes`: `0013_2fa` — `users.is_2fa_enabled BOOLEAN NOT NULL DEFAULT false`, `users.totp_secret VARCHAR(255)` (cifrado, nulo quando off).
- `flow`: setup grava segredo cifrado como **pendente** (is2faEnabled false); enable valida e consolida (flag true); disable limpa segredo + flag. DEV (tenant nulo) também suportado: issuer cai para `Razorfy`.
- `api_compatibility`: `COMPATIBLE` (login mantém 200 para contas sem 2FA; 202 é aditivo). Clientes antigos sem tela de código não conseguem concluir login de contas com 2FA — esperado.
- `depends_on`: `FEAT-072`, `FEAT-075`
- `acceptance`: ativar exige 1º código (código errado → 401, flag permanece false); login de conta 2FA → 202 + preAuthToken; preAuthToken barrado em rota normal; verify-2fa correto → JWT; 5 erros → 429; desativar exige senha + código (sem código → 400).
- `tests`: build backend ✓, web `tsc`/`vite build` ✓, mobile `tsc` ✓; smoke HTTP (otplib gerando códigos) — setup (uri+secret, issuer `Razorfy (Razorfy)`), enable errado→401 e flag false sem vazar secret, enable ok→is2fa true, login→202, preAuth em `/me`→401 `PRE_AUTH_NOT_ALLOWED`, verify-2fa→JWT, disable sem código→400, disable ok→flag false, rate-limit 5→`429 TOO_MANY_ATTEMPTS`.
- `risk`: `HIGH`
- `target_release`: `UNRELEASED`

### FEAT-077 - Autenticação via Telefone (OTP por WhatsApp)

- `status`: `IMPLEMENTED`
- `area`: `AUTH`
- `actors`: `CLIENT`, `Gateway WhatsApp/SMS` (externo)
- `description`: Cadastro/login de clientes por telefone com código de uso único (OTP, 6 dígitos) enviado por WhatsApp (fallback SMS). Reduz fricção de cadastro e garante base com telefones válidos. **Não inclui** magic link nem voice OTP. **Nota arquitetural:** STS pedia Redis; projeto usa Postgres/Supabase → OTP armazenado em **memória** (Map + TTL, mesma estratégia do rate-limiter do 2FA). Single-instance OK; produção multi-instância → trocar por Redis (chave `otp:verification:{tenantId}:{e164}`, TTL 300s).
- `business_rules`: **RN01** — OTP válido por 5 min (300s), destruído após expirar. **RN02** — rate limit de envio: 3 por hora por (tenant, telefone) → `RATE_LIMIT_EXCEEDED 429`. **RN03** — código numérico de 6 dígitos. **RN04** — telefone único por tenant. **V01** — normalização E.164 (assume +55 se sem DDI; tira parênteses/espaços/traços). **V02** — código destruído (`delete`) imediatamente após acerto (anti-replay). **FA01/CT01** — 3 erros consecutivos invalidam o OTP (`TOO_MANY_OTP_ATTEMPTS`).
- `api`: `POST /api/v1/tenants/:tenantId/auth/otp/send` `{phone}` → `{message, expiresInSeconds:300, action:'OTP_DISPATCHED'}`; `POST /api/v1/tenants/:tenantId/auth/otp/verify` `{phone, code, name?}` → `{accessToken, user, isNewUser}`. Públicas, via `resolveTenant` (tenant existente/ativo). Erros: `OTP_INVALID 401`, `OTP_EXPIRED_OR_NOT_FOUND 410`, `RATE_LIMIT_EXCEEDED 429`, `GATEWAY_UNAVAILABLE 503`, `NAME_REQUIRED 422` (novo usuário sem nome).
- `dispatch`: envia via `WHATSAPP_GATEWAY_URL`; gateway configurado e falhando → 503 **sem gravar** o OTP (dependência SLA). Sem gateway (dev) → loga o código e grava (testável).
- `frontend`: mobile — botão "Entrar com telefone (WhatsApp)" no `AuthScreen` → telefone → código (+ nome no 1º acesso); `AuthContext.otpSend`/`otpVerify` (escopados ao tenant conectado). Web: backend pronto; UI OTP não adicionada (web é orientado a barbearia/admin).
- `database_changes`: `0014_phone_otp` — `users.email` vira NULL-able; `users.is_phone_verified BOOLEAN NOT NULL DEFAULT false`; `chk_users_auth_method` relaxado para aceitar `is_phone_verified = true` como meio de auth (além de senha/Google).
- `api_compatibility`: `COMPATIBLE` (e-mail opcional é aditivo; rotas novas).
- `depends_on`: `FEAT-073` (multi-tenant), `FEAT-074` (tenant conectado)
- `acceptance`: send→200 + código; verify novo→cria conta `is_phone_verified=true` + JWT (isNewUser true); verify existente→JWT (isNewUser false); replay do mesmo código→410; 3 erros→`TOO_MANY_OTP_ATTEMPTS` e código correto seguinte→410; 4º envio na janela→429; `(11) 96000-1122`→`+5511960001122`.
- `tests`: build backend ✓, mobile `tsc` ✓; smoke HTTP (dev, código via log) — send 200, verify novo→token, replay→`410 OTP_EXPIRED_OR_NOT_FOUND`, verify existente→token, 3x errado→`OTP_INVALID`/`OTP_INVALID`/`TOO_MANY_OTP_ATTEMPTS`, correto após 3 erros→410, 4º envio→`429 RATE_LIMIT_EXCEEDED`, normalização E.164.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-078 - Credencial unificada (e-mail OU telefone) + paridade web/app

- `status`: `IMPLEMENTED`
- `area`: `AUTH`
- `actors`: `CLIENT`, `ADMIN`, `BARBER`, `DEV`
- `description`: Login e cadastro por senha passam a aceitar um único campo **identifier** que pode ser e-mail OU telefone. Backend classifica o identificador (contém `@` → e-mail; senão → telefone normalizado E.164) e busca/cria o usuário pelo campo correspondente. Além disso, a **aplicação web ganha paridade com o app**: fluxo de login por telefone (OTP via WhatsApp, FEAT-077) agora também na web.
- `business_rules`: identifier com `@` → validado como e-mail (minúsculo); senão → `normalizeE164` (+55 default). Login busca por e-mail OU telefone no tenant; DEV continua só por e-mail. Registro grava o campo informado (o outro fica nulo); unicidade por tenant → `EMAIL_ALREADY_EXISTS`/`PHONE_ALREADY_EXISTS 409`. Identificador inválido → `INVALID_IDENTIFIER 422`. Reaproveita `is_phone_verified`/e-mail opcional do `0014`.
- `api`: `POST /auth/login` `{ identifier, password, tenantSlug? }`; `POST /auth/register` `{ name, identifier, password, tenantSlug? }`. Contrato anterior (`email`/`phone` separados) substituído por `identifier`.
- `frontend`: web — `AuthScreen` login/registro com campo "E-mail ou telefone"; botão "Entrar com telefone (WhatsApp)" → `PhoneOtpScreen` (telefone → código → nome no 1º acesso) consumindo `/tenants/:id/auth/otp/*`. mobile — mesmo campo unificado; `api.login`/`register` e `AuthContext` por identifier (fluxo OTP já existia em FEAT-077).
- `refactor`: `normalizeE164` movido para `common/phone.ts` + novo `classifyIdentifier` (evita ciclo `auth.service` ↔ `otp.service`).
- `api_compatibility`: `BREAKING` no corpo de `/auth/login` e `/auth/register` (passa a exigir `identifier`); web e app atualizados no mesmo release.
- `depends_on`: `FEAT-002`, `FEAT-077`
- `acceptance`: registrar/logar por telefone e por e-mail; admin (e-mail) intacto; senha errada → `INVALID_CREDENTIALS`; telefone em formatos diferentes resolve o mesmo usuário; web faz login por OTP igual ao app.
- `tests`: build backend ✓, web `tsc`/`vite build` ✓, mobile `tsc` ✓; smoke HTTP — register telefone→token, login telefone (formato diferente)→token, register e-mail→token, login e-mail→token, admin e-mail→200, senha errada→`INVALID_CREDENTIALS`.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-079 - Integração de notificações WhatsApp (WaSenderAPI)

- `status`: `IMPLEMENTED`
- `area`: `NOTIFICATION`
- `actors`: `CLIENT`, `WaSenderAPI` (gateway externo)
- `description`: Adapter WaSenderAPI para o envio real das notificações WhatsApp já orquestradas (outbox + processor). Renderiza o texto pt-BR a partir do `eventType`/payload, autentica com `Authorization: Bearer <API_KEY>` e envia no contrato `{to, text}` (telefone em E.164). Cobre lembrete (2h antes), confirmação, cancelamento, conclusão, no-show, win-back e o OTP de cadastro (FEAT-077). Texto livre → não exige template HSM da Meta. (Originalmente Z-API; trocado por WaSenderAPI — só o adapter muda.)
- `implementation`: `notification/whatsapp.ts` — `renderMessage(eventType, payload)` (mapa de eventos → texto pt-BR; eventos com `body` pronto reusam o texto), `sendWhatsappText(destination, message)` (header `Authorization: Bearer`, POST `{to, text}`; lança em !ok → retry/backoff do processor). `outboxProcessor.send` e `otp.service` usam o adapter.
- `config`: `WHATSAPP_GATEWAY_URL` = endpoint de envio (`https://wasenderapi.com/api/send-message`); `WHATSAPP_API_KEY` = chave da conta (Bearer). Ausentes → modo simulado (log), sistema não quebra.
- `pending_ops` (fora do código): criar conta WaSenderAPI, conectar o WhatsApp, preencher as 2 variáveis, reiniciar. Sem isso, notificações ficam em modo simulado.
- `depends_on`: `FEAT-077`
- `acceptance`: render correto por evento; com gateway configurado, mensagens saem via WaSenderAPI; falha do gateway → retry (5x, backoff 5min) e `FAILED` ao esgotar; consentimento (`notificationWhatsappEnabled`) respeitado.
- `tests`: build backend ✓; render validado para todos os eventos (CONFIRMED/CANCELLED/CONCLUDED/REMINDER/NO_SHOW_PENALTY/WIN_BACK).
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-080 - Motor event-driven para dashboard (future-proof)

- `status`: `IMPLEMENTED`
- `area`: `PLATFORM`
- `actors`: `CLIENT` (dispara indireto), `ADMIN` (consome via React Query), `Event Bus` (interno)
- `description`: Infraestrutura desacoplada — mudanças de estado de agendamento publicam Domain Events em um barramento interno em memória (Pub/Sub). Fase 1: front consome passivamente via React Query (window-focus refetch + polling). Fase 2 (futuro): basta um novo listener (WebSocket/SSE) assinar o bus, sem tocar nos serviços de negócio. **Não inclui** WebSocket físico nem mensageria externa (Kafka/RabbitMQ) na Fase 1.
- `business_rules`: **RN01** — evento despachado SOMENTE após o commit (publish fora do `prisma.$transaction`, com o resultado já commitado). **RN02** — todo evento carrega `tenantId` (isolamento de broadcast futuro). **RN03** — front invalida só a query afetada (`['admin-dashboard']`), não a aplicação inteira. **V01/CT01** — listener com erro é isolado (cada handler em `Promise.resolve().catch`); nunca quebra a transação/venda. Publicação assíncrona (`setImmediate`) → não adiciona latência à requisição HTTP.
- `backend`: `events/eventBus.ts` — `DomainEvent { eventId, tenantId, eventType, timestamp, payload }`, `publishDomainEvent()`, `onDomainEvent()` (handlers isolados), listener default de log (Fase 1). Eventos emitidos pós-commit em `appointment.service` (CREATED/CONFIRMED/CANCELED/CONCLUDED) e `admin.service` (NO_SHOW).
- `frontend`: `@tanstack/react-query` — `QueryClientProvider` em `main.tsx` (`refetchOnWindowFocus`, `refetchOnReconnect`, `staleTime 60s`, `refetchInterval 120s`); `AdminCommandCenter` lê o dashboard/grid via `useQuery(['admin-dashboard', date])` (troca de data = refetch granular); ações que alteram o painel (no-show, resolver alerta) fazem `invalidateQueries(['admin-dashboard'])`.
- `upgrade_path` (Fase 2): criar `RealTimeNotifierGateway` que faz `onDomainEvent` → empurra no socket filtrando por `tenantId`; front troca a invalidação por focus/polling por invalidação on-message. Zero alteração nos serviços de negócio.
- `error_codes`: `EVENT_DISPATCH_FAILED` (não bloqueante, só log).
- `api_compatibility`: `COMPATIBLE` (nenhum endpoint novo; só infraestrutura interna + libs de cache no front).
- `depends_on`: `FEAT-073`
- `acceptance`: evento só após commit, com `tenantId`; falha de listener não quebra agendamento (201 mantido); painel do admin refaz fetch em window-focus sem loading agressivo; troca de data refaz só a query do dashboard.
- `tests`: build backend ✓, web `tsc`/`vite build` ✓; CT01 (isolamento) — listener que lança `throw` não propaga em `publishDomainEvent`, demais listeners ainda recebem, evento traz `eventId`/`tenantId`/`timestamp`.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-081 - Motor de análise gráfica financeira (BFF Analytics)

- `status`: `IMPLEMENTED`
- `area`: `ADMIN`
- `actors`: `ADMIN`
- `description`: BFF de analytics — uma chamada retorna 3 datasets para os gráficos: faturamento geral cronológico (linha), por barbeiro (barras) e por dia da semana (barras horizontais). Filtros temporais `LAST_7_DAYS` (padrão), `LAST_14_DAYS`, `CURRENT_MONTH`. Descritivo de dados históricos reais; sem projeções/IA, sem fluxo de caixa líquido.
- `business_rules`: **RN01** — faturamento = soma de `amount_paid` apenas de agendamentos `CONCLUDED` (cancelados/no-show/pendentes ignorados). **RN02** — gap filling: todo dia do intervalo tem um nó (`0.00` se vazio). **RN03** — `CURRENT_MONTH` = dia 1 do mês corrente até hoje (fuso do negócio). **RN04** — barbeiro inativo com histórico aparece como `Nome (Inativo)`. **V01** — `range` fora do enum → `400 INVALID_ANALYTICS_RANGE`. **V02** — `dayOfWeekBreakdown` sempre com 7 itens ordenados 1..7. **NFR** — agrupamento por dia da semana via ISO weekday (Seg=1..Dom=7).
- `api`: `GET /api/v1/admin/analytics?range=` (autenticado + `requireStrictAdmin`, tenant do JWT). Resposta `{ range, generalTimeline[], barberBreakdown[], dayOfWeekBreakdown[] }`. (Nota: usa tenant do JWT como os demais endpoints admin, em vez de `:tenantId` no path; mantém o contrato dos datasets.)
- `backend`: `admin/analytics.service.ts` — `buildDays` (gap-fill no fuso `BUSINESS_TIMEZONE`), agregação em memória por dia/barbeiro/ISODOW; `isoWeekday`/`localDayRangeUtc`/`localDateString` reusados de `availability.service`.
- `frontend`: `recharts` — aba **Análises** no `AdminCommandCenter` com seletor de período (7/14/mês) e 3 gráficos (`LineChart`/`BarChart`/`BarChart` horizontal). Via `useQuery(['admin-analytics', range])` → revalidação passiva (FEAT-080); dias da semana ordenados maior→menor na renderização (RF03).
- `cache_future`: pronto para cache curto invalidado por `AppointmentConcludedEvent` (FEAT-080) numa fase futura.
- `api_compatibility`: `COMPATIBLE` (endpoint novo).
- `depends_on`: `FEAT-073`, `FEAT-080`
- `acceptance`: 7/14 dias → timeline com exatamente 7/14 nós; mês atual a partir do dia 1; gap-fill com `0.00`; só `CONCLUDED` computa; dia da semana acumula por ISODOW; inativo com `(Inativo)`; range inválido → 400; não-admin → 403.
- `tests`: build backend ✓, web `tsc`/`vite build` ✓; smoke HTTP — LAST_7_DAYS=7, LAST_14_DAYS=14 (CT01), CURRENT_MONTH=24 (01→24/jun), dow sempre 7 e agrupado por ISODOW (CT02: terça acumula), barbeiros agregados e ordenados desc, `LAST_YEAR`→`400 INVALID_ANALYTICS_RANGE`, cliente→`403`.
- `risk`: `LOW`
- `target_release`: `UNRELEASED`

### FEAT-082 - Catálogo de ícones SVG + remoção de repasses/comissões

- `status`: `IMPLEMENTED`
- `area`: `ADMIN` / `PLATFORM`
- `actors`: `ADMIN`, `DEV` (ícones globais), `CLIENT` (renderização)
- `description`: Duas mudanças: (A) **remoção completa** do comissionamento (tabela `barber_commissions`, endpoints `/admin/commissions[/settlement]`, cálculos e UI "Repasses"); o faturamento passa a ser 100% do tenant. (B) **biblioteca de ícones SVG** para serviços — ícones globais (plataforma) + upload de SVGs próprios pelo admin, com sanitização anti-XSS; renderização vetorial que herda a cor do tema (`currentColor`). Suporte estrito a `image/svg+xml`.
- `business_rules`: **RN01** — ícone com `tenant_id` NULO = global; preenchido = privado da barbearia. **RN02** — sem divisão de valores com o barbeiro na aplicação. **RN03** — SVG ≤ 50 KB.
- `security_nfr` (XSS): `sanitizeSvg` remove `<script>/<iframe>/<foreignObject>/object/embed/use/animate/set`, atributos `on*`, `javascript:`/`data:text/html` e `DOCTYPE/ENTITY` antes de persistir. Front usa `dangerouslySetInnerHTML` (justificado — sanitização no backend).
- `api`: `GET /tenants/:tenantId/icons` (público; `type` GLOBAL/CUSTOM); `GET`/`POST /admin/icons`; `POST /admin/services` aceita `iconId`. Erros: `SVG_FILE_TOO_LARGE 413`, `INVALID_SVG_FORMAT 422`, `ICON_NOT_FOUND 404`.
- `database_changes`: `0015_service_icons` — `DROP TABLE barber_commissions`; `CREATE TABLE service_icons`; `services.icon_id` (FK); seed de 5 ícones globais (Tesoura/Máquina/Navalha/Barba/Toalha) com `currentColor`.
- `frontend`: aba "Repasses" e lógica de comissão/settlement removidas; form de serviço com galeria de ícones + upload de SVG; ícone renderizado na lista admin e nos cards do catálogo (`SafeSvg`).
- `api_compatibility`: `BREAKING` para `/admin/commissions*` (removidos); aditivo para ícones.
- `depends_on`: `FEAT-073`, `FEAT-075`
- `acceptance`: `/admin/commissions`→404; 5 globais; upload com `<script>`/`onclick`→salvo limpo + "Código inseguro removido"; >50 KB→413; não-SVG→422; custom no list do tenant; serviço com `iconId` renderiza o vetor.
- `tests`: build backend ✓, web `tsc`/`vite build` ✓; smoke HTTP — commissions 404, 5 globais, sanitização (script/onclick removidos), 422 formato, 413 tamanho, custom no list.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

### FEAT-083 - Cadastro Google em duas fases (validação obrigatória de WhatsApp)

- `status`: `IMPLEMENTED`
- `area`: `AUTH`
- `actors`: `CLIENT`, `Google` (OAuth), `WaSenderAPI` (OTP)
- `description`: Telefone passa a ser requisito para emitir o JWT final. **Cadastro por senha**: telefone obrigatório e e-mail opcional (`POST /auth/register` `{name, phone, email?, password}`) — backend normaliza para E.164 e valida unicidade por tenant. **Login Google**: usuário existente segue direto; **novo usuário** é interceptado — o backend NÃO cria a conta, retorna `202 REQUIRE_WHATSAPP` + `preAuthToken`; o front coleta o telefone (máscara BR), dispara OTP e conclui com `verify-google`.
- `business_rules`: máquina de estados em 2 fases. **Fase A** (`POST /auth/google`): por Google/e-mail existente → sessão; novo → `202` + `preAuthToken` (claim `type=GOOGLE_PREAUTH`, 15 min, carrega gid/email/name/tnt). **Fase B** (`POST /auth/otp/verify-google`): Bearer preAuthToken + `{phone, code}` → valida OTP, cria/loga CLIENT com telefone verificado e googleId. Telefone já existente no tenant → vincula o Google à conta. Sanitização: máscara `99 9 9999-9999` no front; backend faz `replace(/\D/g)` + prefixo `+55` (E.164). Reaproveita rate-limit de OTP (3/h).
- `api`: `POST /auth/google` `{code, tenantSlug?}` → 200 sessão **ou** `202 {status:'REQUIRE_WHATSAPP', preAuthToken}`. `POST /auth/otp/verify-google` (Bearer preAuthToken, `{phone, code}`) → JWT final. Envio de OTP reutiliza `POST /tenants/:tenantId/auth/otp/send`. Tokens `GOOGLE_PREAUTH`/`PRE_AUTH` são barrados em rotas normais (`PRE_AUTH_NOT_ALLOWED 401`).
- `refactor`: `otp.service` expõe `consumeOtp(tenantId, phone, code)` (valida+destrói o OTP, anti-replay) reutilizado por `verifyOtp` e pelo fluxo Google.
- `frontend`: web — callback Google trata `202`, renderiza `GoogleWhatsappScreen` (telefone com máscara → OTP → "Concluir cadastro"); `/auth/google` passa `tenantSlug` do tenant conectado.
- `database`: sem migração — `email` já opcional (FEAT-077), `google_id`/`is_phone_verified` já existentes. **Nota:** `phone NOT NULL` global não foi aplicado para não quebrar contas `DEV`/staff sem telefone; a obrigatoriedade é garantida no fluxo de cadastro de cliente.
- `api_compatibility`: `COMPATIBLE` (login Google de conta existente inalterado; `202` é aditivo). Clientes antigos sem a tela de WhatsApp não concluem cadastro Google novo — esperado.
- `depends_on`: `FEAT-077`, `FEAT-078`
- `acceptance`: Google novo → 202 + preAuthToken; verify-google com OTP correto → cria CLIENT (nome/email do Google + telefone verificado + googleId); máscara `62 9 8888-7777` → `+5562988887777`; preAuthToken barrado em rota normal; login por senha nesse telefone → `USE_GOOGLE_LOGIN`.
- `tests`: build backend ✓, web `tsc`/`vite build` ✓; smoke HTTP — send OTP, `verify-google` (token GOOGLE_PREAUTH forjado) cria CLIENT com telefone normalizado, `PRE_AUTH_NOT_ALLOWED` em `/users/me`, login por telefone → `USE_GOOGLE_LOGIN`.
- `risk`: `MEDIUM`
- `target_release`: `UNRELEASED`

## 4. Regras de negócio rastreadas

| ID | Regra | Features |
| --- | --- | --- |
| `RN-001` | Duração total é a soma dos serviços | `FEAT-008`, `FEAT-009`, `FEAT-010` |
| `RN-002` | Cancelamento autônomo exige pelo menos 2 horas | `FEAT-023` |
| `RN-003` | Cashback = 10% sobre o valor efetivamente pago em dinheiro (`amount_paid`); cashback usado não gera novo cashback | `FEAT-020` |
| `RN-004` | Cashback é creditado apenas na conclusão | `FEAT-020`, `FEAT-024` |
| `RN-005` | Intervalos do mesmo barbeiro não podem se sobrepor | `FEAT-012` |
| `RN-006` | Agendamento deve respeitar jornada e almoço | `FEAT-007`, `FEAT-008`, `FEAT-010` |
| `RN-007` | Cashback reservado não pode ser gasto em outra compra | `FEAT-018`, `FEAT-019` |
| `RN-014` | Cashback paga serviços completos (subconjunto dos selecionados), nunca abatimento parcial de um serviço; sugestão escolhe os mais baratos primeiro | `FEAT-019`, `FEAT-053`, `FEAT-068` |
| `RN-008` | Pagamento pendente bloqueia o horário por 10 minutos | `FEAT-011` |
| `RN-009` | Bloqueio express negado se houver interseção com agendamento/bloqueio ativo | `FEAT-059` |
| `RN-010` | Comentário de avaliação é restrito ao barbeiro avaliado e admin; nota é pública | `FEAT-060` |
| `RN-011` | Apenas ADMIN/DEV mutam metas; barbeiro tem leitura | `FEAT-061` |
| `RN-012` | Qualquer barbeiro lê o histórico de notas do cliente; só o autor/admin edita | `FEAT-062` |
| `RN-013` | Uma avaliação por agendamento concluído | `FEAT-060` |
| `RN-015` | Cupom e cashback são mutuamente exclusivos no checkout | `FEAT-069` |
| `RN-016` | Comissão é calculada sobre valor líquido recebido | `FEAT-069` |
| `RN-017` | No-Show só após 15 minutos e zera a carteira de cashback | `FEAT-069` |
| `RN-018` | Férias não retroativas conflitam com agendamentos confirmados | `FEAT-033`, `FEAT-069` |
| `RN-019` | Avaliação com nota menor ou igual a 2 gera alerta administrativo | `FEAT-060`, `FEAT-069` |
| `RN-020` | Win-back exige último atendimento concluído há exatos 45 dias e nenhum confirmado futuro | `FEAT-069` |
| `RN-021` | Barbeiros e serviços com histórico nunca são deletados fisicamente — apenas soft-delete (`is_active=false`) | `FEAT-070` |
| `RN-022` | Listagem do Admin retorna ativos + inativos; cliente vê só ativos | `FEAT-070` |
| `RN-023` | Inativar barbeiro alerta sobre agendamentos futuros confirmados; status de ADMIN é imutável | `FEAT-070` |
| `RN-024` | Hard-delete de barbeiro/serviço só com zero agendamentos; caso contrário `ENTITY_IN_USE` (inativar) | `FEAT-071` |
| `RN-025` | Criação de barbeiro força role `BARBER` (anti privilege-escalation) e senha BCrypt; e-mail/telefone/nome de serviço únicos | `FEAT-071` |
| `RN-026` | Exclusão de cliente é anonimização LGPD (soft-delete + PII mascarado + carteira zerada); bloqueada com agendamento futuro | `FEAT-072` |
| `RN-027` | Notificações respeitam consentimento (`notification_*_enabled`); canal desligado não dispara (inclui win-back) | `FEAT-072` |
| `RN-028` | Parâmetros globais (no-show, cashback) são singleton com cache; mutação exclusiva do Admin com efeito imediato | `FEAT-072` |
| `RN-029` | Toda operação filtra por `tenant_id`; nenhum dado vaza entre barbearias (Fase 1: rotas quentes) | `FEAT-073` |
| `RN-030` | Unicidade é composta por tenant (e-mail/telefone/google por barbearia; nome de serviço por barbearia) | `FEAT-073` |
| `RN-031` | Barbeiro/serviço de outra barbearia no agendamento → `TENANT_MISMATCH 403` | `FEAT-073` |
| `RN-032` | Login/acesso bloqueado quando a barbearia está inativa (`TENANT_SUSPENDED`) | `FEAT-073` |
| `RN-033` | Conexão por código: `connection_code` único, `VARCHAR(10)`, alfanumérico MAIÚSCULO (`^[A-Z0-9]+$`) | `FEAT-074` |
| `RN-034` | Código case-insensitive: `trim()` + `toUpperCase()` antes de validar/buscar (front e back) | `FEAT-074` |
| `RN-035` | Conectar a barbearia inativa → `TENANT_INACTIVE 403` | `FEAT-074` |
| `RN-036` | Endpoint público de conexão nunca retorna dados sensíveis; só `id`, `name`, `logo_url` | `FEAT-074` |
| `RN-037` | Após conectar, app não reexibe a tela de conexão até "Desconectar barbearia" | `FEAT-074` |
| `RN-038` | Usuário `DEV` tem `tenant_id` NULO; CHECK garante `role='DEV' ⟺ tenant_id IS NULL` | `FEAT-075` |
| `RN-039` | Rotas `/platform/*` exigem role `DEV` (do JWT, antes do tenant); outras → `PLATFORM_ACCESS_DENIED 403` | `FEAT-075` |
| `RN-040` | Onboarding atômico: falha ao criar admin → rollback da barbearia | `FEAT-075` |
| `RN-041` | `connection_code` imutável após criação (sem UPDATE); único em toda a tabela | `FEAT-075` |
| `RN-042` | Kill-switch: barbearia inativa derruba tokens existentes na próxima request (`TENANT_SUSPENDED`) | `FEAT-075` |
| `RN-043` | 2FA: ativação só após validar o 1º código TOTP (nunca por clique) | `FEAT-076` |
| `RN-044` | 2FA: tolerância de drift ±30s (janela 90s) | `FEAT-076` |
| `RN-045` | `totp_secret` cifrado (AES-256-GCM) e nunca exposto em leitura | `FEAT-076` |
| `RN-046` | Login de conta com 2FA → 202 `REQUIRE_2FA` + `preAuthToken` (claim `PRE_AUTH`, barrado em rotas normais) | `FEAT-076` |
| `RN-047` | verify-2fa: 5 falhas → bloqueio de 15 min (`TOO_MANY_ATTEMPTS`) | `FEAT-076` |
| `RN-048` | Desativar 2FA exige senha atual E código TOTP válido | `FEAT-076` |
| `RN-049` | OTP de telefone válido por 5 min, destruído após expirar | `FEAT-077` |
| `RN-050` | Envio de OTP: 3 por hora por (tenant, telefone) → `RATE_LIMIT_EXCEEDED` | `FEAT-077` |
| `RN-051` | OTP destruído imediatamente após acerto (anti-replay) | `FEAT-077` |
| `RN-052` | 3 erros consecutivos invalidam o OTP (`TOO_MANY_OTP_ATTEMPTS`) | `FEAT-077` |
| `RN-053` | Telefone normalizado para E.164 (+55 default) antes de cache/consulta | `FEAT-077` |
| `RN-054` | Conta verificada por telefone é meio de auth válido (e-mail opcional) | `FEAT-077` |
| `RN-055` | Login/registro por senha aceitam identifier = e-mail OU telefone (E.164) | `FEAT-078` |
| `RN-056` | Web e app têm paridade de autenticação (inclui login por telefone/OTP) | `FEAT-078` |
| `RN-057` | Domain event despachado só após commit da transação | `FEAT-080` |
| `RN-058` | Todo domain event carrega `tenantId` (isolamento de broadcast) | `FEAT-080` |
| `RN-059` | Falha em listener de evento nunca quebra a transação principal (isolada) | `FEAT-080` |
| `RN-060` | Front invalida apenas a query afetada (revalidação granular) | `FEAT-080` |
| `RN-061` | Analytics: faturamento só de `CONCLUDED` (soma `amount_paid`) | `FEAT-081` |
| `RN-062` | Analytics: gap filling — todo dia do intervalo tem nó (0.00 se vazio) | `FEAT-081` |
| `RN-063` | Analytics: `dayOfWeekBreakdown` sempre 7 itens (ISODOW Seg=1..Dom=7) | `FEAT-081` |
| `RN-064` | Analytics: barbeiro inativo com histórico aparece como `Nome (Inativo)` | `FEAT-081` |

## 5. Registro de bugs

### BUG-2026-001 - Encoder JWT sem algoritmo explícito

- `status`: `VERIFIED`
- `priority`: `P1`
- `risk`: `HIGH`
- `feature_ids`: `FEAT-002`
- `reported_at`: `2026-06-10`
- `fixed_at`: `2026-06-10`
- `symptom`: cadastro era revertido porque o Nimbus não selecionava uma chave de assinatura.
- `root_cause`: o cabeçalho JWS não declarava `HS256`.
- `resolution`: criação explícita de `JwsHeader` com `MacAlgorithm.HS256`.
- `files_changed`: `backend/src/main/java/com/barberflow/auth/AuthService.java`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `verification`: cadastro e login integrados retornaram JWT válido.
- `regression_test`: recomendado adicionar teste automatizado de emissão e validação do token.
- `release`: `UNRELEASED`

### BUG-2026-002 - LazyInitializationException na resposta de conclusão

- `status`: `VERIFIED`
- `priority`: `P1`
- `risk`: `MEDIUM`
- `feature_ids`: `FEAT-022`, `FEAT-024`
- `reported_at`: `2026-06-10`
- `fixed_at`: `2026-06-10`
- `symptom`: conclusão era persistida, mas a resposta HTTP retornava `500`.
- `root_cause`: coleção de serviços era acessada após o fechamento da transação com `open-in-view=false`.
- `resolution`: inicialização transacional no retorno e `EntityGraph` no histórico.
- `files_changed`: `AppointmentApplicationService.java`, `AppointmentRepository.java`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `verification`: conclusão retornou `CONCLUDED` e histórico carregou os serviços.
- `release`: `UNRELEASED`

### BUG-2026-003 - Data mínima do frontend calculada em UTC

- `status`: `VERIFIED`
- `priority`: `P2`
- `risk`: `LOW`
- `feature_ids`: `FEAT-037`
- `reported_at`: `2026-06-10`
- `fixed_at`: `2026-06-10`
- `symptom`: em horários próximos à meia-noite, a data local poderia divergir da data do campo.
- `root_cause`: uso de `toISOString()` para preencher um input de data local.
- `resolution`: formatação com ano, mês e dia do timezone local do navegador.
- `files_changed`: `frontend/src/App.tsx`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `verification`: lint e build de produção aprovados.
- `release`: `UNRELEASED`

### BUG-2026-004 - Arquivo .env não era carregado pelo backend Node.js

- `status`: `VERIFIED`
- `priority`: `P1`
- `risk`: `MEDIUM`
- `feature_ids`: `FEAT-043`, `FEAT-044`
- `reported_at`: `2026-06-11`
- `reported_by`: execução local de `npm run dev` após migração Java → Node.js.
- `environment`: desenvolvimento local, backend Node.js 22 + tsx.
- `symptom`: `npm run dev` abortava com `ZodError: JWT_SECRET Required` mesmo com `.env` presente.
- `expected_behavior`: variáveis do `.env` disponíveis em `process.env` na inicialização.
- `reproduction_steps`: criar `backend/.env` válido e executar `npm run dev`.
- `root_cause`: `config.ts` lia apenas `process.env`; nem `tsx` nem o Node carregam `.env` automaticamente (o Spring Boot anterior usava variáveis injetadas pelo Docker Compose).
- `resolution`: chamada a `process.loadEnvFile()` (nativo do Node 20.12+) no topo de `config.ts`, com `try/catch` para ambientes sem arquivo (Vercel, Docker).
- `files_changed`: `backend/src/config.ts`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `verification`: `npm run dev` inicializou e validou todas as variáveis via zod.
- `regression_test`: recomendado teste de inicialização do config com `.env` ausente e presente.
- `release`: `UNRELEASED`

### BUG-2026-005 - Violação de unicidade do Prisma retornava 500 em vez de 409

- `status`: `VERIFIED`
- `priority`: `P1`
- `risk`: `MEDIUM`
- `feature_ids`: `FEAT-001`, `FEAT-035`
- `reported_at`: `2026-06-11`
- `reported_by`: smoke test HTTP de cadastro com telefone duplicado.
- `environment`: desenvolvimento local, backend Node.js + Prisma 6 + Supabase PostgreSQL.
- `symptom`: `POST /api/v1/auth/register` com telefone já cadastrado retornava `500 INTERNAL_ERROR`.
- `expected_behavior`: HTTP `409` com código de negócio (`PHONE_ALREADY_EXISTS` ou `EMAIL_ALREADY_EXISTS`).
- `reproduction_steps`: registrar usuário com telefone de um usuário existente (o serviço pré-validava apenas e-mail).
- `evidence`: log `PrismaClientKnownRequestError code P2002, target: ['phone']`.
- `root_cause`: o `errorHandler` tratava apenas o código PostgreSQL cru `23505`, mas o Prisma embrulha violações de unicidade em `PrismaClientKnownRequestError` com código `P2002`, que caía no fallback 500.
- `resolution`: tratamento de `P2002` no `errorHandler` mapeando `meta.target` para `EMAIL_ALREADY_EXISTS`, `PHONE_ALREADY_EXISTS` ou `DATA_CONFLICT`, todos HTTP `409`.
- `files_changed`: `backend/src/common/errorHandler.ts`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `verification`: cadastro duplicado retornou `409`; cadastro com telefone único retornou `201` com JWT.
- `regression_test`: recomendado teste de integração de register com e-mail e telefone duplicados.
- `release`: `UNRELEASED`

### BUG-2026-006 - Colunas TIME mapeadas como String quebravam a disponibilidade

- `status`: `VERIFIED`
- `priority`: `P1`
- `risk`: `HIGH`
- `feature_ids`: `FEAT-007`, `FEAT-008`
- `reported_at`: `2026-06-11`
- `reported_by`: smoke test HTTP de disponibilidade.
- `environment`: desenvolvimento local, backend Node.js + Prisma 6 + Supabase PostgreSQL.
- `symptom`: `GET /api/v1/barbers/{id}/availability` retornava `500 INTERNAL_ERROR` para qualquer barbeiro e data.
- `expected_behavior`: lista de horários disponíveis na grade de 15 minutos.
- `reproduction_steps`: consultar disponibilidade de qualquer barbeiro do seed.
- `evidence`: log `P2032: Error converting field "startTime" of expected non-nullable type "String", found incompatible value of "1970-01-01 09:00:00 +00:00"`.
- `root_cause`: as colunas `TIME` de `barber_slots` estavam declaradas como `String @db.VarChar(8)` no `schema.prisma` (contorno de validação aplicado na migração Java → Node.js); o schema passava na validação, mas o client falhava na leitura porque o driver entrega `TIME` como timestamp ancorado em 1970-01-01.
- `resolution`: campos remapeados para `DateTime @db.Time(0)` e conversão para minutos via `getUTCHours()/getUTCMinutes()` no helper `timeToMinutes` de `availability.service.ts`, substituindo `parseTimeToMinutes` baseado em string.
- `files_changed`: `backend/prisma/schema.prisma`, `backend/src/schedule/availability.service.ts`
- `database_changes`: `NONE` (apenas mapeamento; o schema SQL permaneceu intacto)
- `api_compatibility`: `COMPATIBLE`
- `verification`: disponibilidade retornou a grade correta (início 09:00 America/Sao_Paulo = 12:00Z) respeitando jornada do seed.
- `regression_test`: recomendado teste de integração lendo `barber_slots` e calculando a janela de trabalho.
- `release`: `UNRELEASED`

### BUG-2026-007 - Timeout de transação do Prisma com banco remoto

- `status`: `VERIFIED`
- `priority`: `P1`
- `risk`: `HIGH`
- `feature_ids`: `FEAT-010`, `FEAT-012`
- `reported_at`: `2026-06-11`
- `reported_by`: smoke test HTTP de criação de agendamento contra Supabase.
- `environment`: desenvolvimento local com banco Supabase (região sa-east-1) via session pooler.
- `symptom`: `POST /api/v1/appointments` retornava `500` com `P2028: Transaction already closed (timeout 5000 ms, 11365 ms decorridos)`.
- `expected_behavior`: agendamento criado dentro da transação interativa, independentemente da latência do banco.
- `reproduction_steps`: criar agendamento com o banco hospedado remotamente (latência de rede por query).
- `root_cause`: a transação interativa do fluxo de agendamento executa várias queries sequenciais (locks, validações, criação, cashback, auditoria); com banco remoto, as idas e voltas excedem o timeout padrão de 5 s do Prisma.
- `resolution`: `transactionOptions` globais no `PrismaClient` (`maxWait: 15s`, `timeout: 30s`) e `connect_timeout=30&pool_timeout=30` na `DATABASE_URL`.
- `files_changed`: `backend/src/prisma.ts`, `backend/.env.example`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `verification`: criação de agendamento concluída com sucesso contra o Supabase.
- `regression_test`: recomendado monitorar duração das transações; avaliar redução de round-trips no fluxo de criação.
- `release`: `UNRELEASED`

### BUG-2026-008 - Resposta de agendamento quebrava ao serializar BigInt

- `status`: `VERIFIED`
- `priority`: `P1`
- `risk`: `MEDIUM`
- `feature_ids`: `FEAT-010`, `FEAT-035`
- `reported_at`: `2026-06-11`
- `reported_by`: smoke test HTTP de criação de agendamento.
- `environment`: desenvolvimento local, backend Node.js + Prisma 6.
- `symptom`: agendamento era persistido, mas a resposta HTTP retornava `500` (`TypeError: Do not know how to serialize a BigInt`).
- `expected_behavior`: HTTP `201` com o agendamento criado e payload de pagamento.
- `reproduction_steps`: criar agendamento e observar a serialização da resposta.
- `evidence`: stack trace do `JSON.stringify` em `express/lib/response.js` via `res.json`.
- `root_cause`: a coluna `version BIGINT` (lock otimista) chega como `BigInt` do Prisma, e `JSON.stringify` nativo não serializa `BigInt`.
- `resolution`: `BigInt.prototype.toJSON` global definido em `app.ts` convertendo para `Number` (seguro: os valores são contadores de versão).
- `files_changed`: `backend/src/app.ts`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `verification`: criação retornou `201`; webhook mock confirmou (`CONFIRMED`) e `GET /appointments/mine` listou o agendamento.
- `regression_test`: recomendado teste de contrato serializando entidades com coluna `version`.
- `release`: `UNRELEASED`

### BUG-2026-009 - Contrato da API divergente após migração causava tela em branco no login

- `status`: `VERIFIED`
- `priority`: `P0`
- `risk`: `HIGH`
- `feature_ids`: `FEAT-002`, `FEAT-010`, `FEAT-022`, `FEAT-036`
- `reported_at`: `2026-06-11`
- `reported_by`: usuário, ao fazer login no frontend local.
- `environment`: desenvolvimento local, frontend React + backend Node.js migrado.
- `symptom`: após o login a aplicação exibia tela em branco (crash do React sem fallback).
- `expected_behavior`: redirecionar para a tela de agendamento autenticada.
- `reproduction_steps`: fazer login no frontend com o backend Node.js; a UI quebra ao acessar `session.user.name`.
- `evidence`: frontend espera `Session = { accessToken, user: {...} }` (`frontend/src/App.tsx`), backend retornava `{ id, name, email, role, token }`.
- `root_cause`: a migração Java → Node.js não reproduziu fielmente os DTOs do contrato da API em três pontos: (1) resposta de auth sem envelope `accessToken`/`user`; (2) agendamentos retornando a entidade crua do Prisma em vez do DTO (`appointmentId`, `amountToPay`, `barberName`, `services[].name`, `paymentPayload.copyPasteCode`); (3) `Prisma.Decimal` serializado como string em vez de número JSON (Jackson serializava `BigDecimal` como número).
- `resolution`: (1) `sessionFor()` em `auth.service.ts` retornando `{ accessToken, user }`; (2) novo `appointment.dto.ts` com `toAppointmentDto()` aplicado em todas as respostas do `appointment.router.ts`; (3) `Prisma.Decimal.prototype.toJSON` global em `app.ts` convertendo para número.
- `files_changed`: `backend/src/auth/auth.service.ts`, `backend/src/appointment/appointment.dto.ts`, `backend/src/appointment/appointment.router.ts`, `backend/src/app.ts`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE` (restaura o contrato original consumido por frontend e mobile)
- `verification`: login retornou `{ accessToken, user }` com todos os campos; `GET /appointments/mine` retornou DTO com `appointmentId`, `amountToPay: 35` (número), `barberName` e `services[].name`; preços do catálogo como números JSON.
- `regression_test`: recomendado teste de contrato (schema JSON) das respostas de auth, appointments, services e wallet — candidato prioritário para o futuro script de TDD.
- `release`: `UNRELEASED`

### BUG-2026-010 - Conclusão de atendimento falhava ao creditar cashback (Decimal em raw dentro de transação)

- `status`: `VERIFIED`
- `priority`: `P1`
- `risk`: `HIGH`
- `feature_ids`: `FEAT-020`, `FEAT-024`, `FEAT-056`
- `reported_at`: `2026-06-13`
- `reported_by`: usuário, ao concluir atendimento pela agenda do barbeiro.
- `environment`: desenvolvimento local, backend Node.js + Prisma 6.19.3 + Supabase PostgreSQL.
- `symptom`: `POST /api/v1/appointments/{id}/conclude` retornava `500 INTERNAL_ERROR`; o status do agendamento permanecia `CONFIRMED` (transação revertida) e nenhum cashback era creditado.
- `expected_behavior`: status muda para `CONCLUDED`, cashback é creditado e a resposta retorna o DTO do agendamento (`200`).
- `reproduction_steps`: logar como `BARBER`, concluir um agendamento `CONFIRMED` cujo `amount_paid * CASHBACK_RATE` resulte em valor maior que zero.
- `evidence`: `PrismaClientValidationError` em `updateWallet` (`cashback.service.ts:120`): `Could not convert from "JSON decimal value" to "PrismaValue". Expected Flat JSON array (no nesting)`, com `parameters` contendo `{"prisma__type":"decimal","prisma__value":7}`.
- `root_cause`: `updateWallet` passava instâncias de `Prisma.Decimal` como parâmetros de `$executeRaw` executado dentro de uma transação interativa (`prisma.$transaction(async tx => ...)`). O engine do Prisma 6.x não serializa o wrapper `{prisma__type:"decimal"}` nesse caminho, exigindo um array JSON plano. O bug só se manifestava quando o cashback creditado era maior que zero (caminho `creditEarned` → `updateWallet`); os fluxos de criação presencial sem cashback retornavam cedo e nunca exercitavam o `UPDATE` com Decimal.
- `resolution`: `updateWallet` reescrito para usar `tx.cashbackWallet.updateMany({ where: { id, version }, data: { balance, reservedBalance, version: { increment: 1 } } })`, mantendo a guarda de versão (lock otimista) com a API tipada do Prisma, eliminando a serialização de Decimal em SQL cru.
- `files_changed`: `backend/src/cashback/cashback.service.ts`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `verification`: conclusão via HTTP retornou `200` com DTO `CONCLUDED`; cashback de R$ 3,50 (sobre R$ 35,00 a 10%) creditado na carteira do cliente; `tsc --noEmit` sem erros.
- `regression_test`: recomendado teste de integração de conclusão exercitando o crédito de cashback (valor > 0) — auditar demais usos de `$executeRaw`/`$queryRaw` com `Prisma.Decimal` em transações.
- `release`: `UNRELEASED`

### BUG-2026-011 - Token expirado prendia o usuário em tela de erro

- `status`: `VERIFIED`
- `priority`: `P2`
- `risk`: `MEDIUM`
- `feature_ids`: `FEAT-002`, `FEAT-036`
- `reported_at`: `2026-06-13`
- `reported_by`: usuário, ao retornar ao app após expiração da sessão.
- `environment`: desenvolvimento local, frontend React + backend Node.js.
- `symptom`: com a sessão persistida no `localStorage` expirada, o app exibia "Token inválido ou expirado." num banner de erro e ficava preso, sem caminho para reautenticar.
- `expected_behavior`: sessão expirada deve encerrar o login automaticamente e voltar à tela de autenticação.
- `reproduction_steps`: autenticar, aguardar a expiração do JWT (cliente 24h, equipe 8h) e abrir qualquer tela que faça chamada autenticada.
- `root_cause`: o helper `request()` apenas lançava o erro; nenhuma página tratava `401` globalmente, então o token expirado preso no `localStorage` produzia erro recorrente sem logout.
- `resolution`: `request()` passou a detectar `401` em chamadas autenticadas (com token), limpar a sessão do `localStorage` e disparar o evento `razorfy:unauthorized`; o `App()` escuta o evento e executa `signOut()`, retornando ao login. Chamadas não autenticadas (login/registro/google) não são afetadas — `401` de credencial inválida continua exibindo a mensagem.
- `files_changed`: `frontend/src/App.tsx`
- `database_changes`: `NONE`
- `api_compatibility`: `COMPATIBLE`
- `verification`: backend confirmado saudável (token novo → `200`, token inválido/expirado → `401 INVALID_TOKEN`); build de produção do frontend aprovado.
- `regression_test`: recomendado teste de fluxo simulando `401` em chamada autenticada e verificando o retorno ao login.
- `release`: `UNRELEASED`

## 6. Registro de hotfixes

Nenhum hotfix de produção foi registrado até `2026-06-10`.

Um hotfix é uma correção urgente aplicada sobre uma versão já publicada. Correções feitas antes
da primeira release permanecem no registro de bugs e não devem ser artificialmente classificadas
como hotfix.

## 7. Backlog recomendado

| Ordem | ID | Motivo |
| --- | --- | --- |
| 1 | `FEAT-015` | Remover dependência do pagamento simulado |
| 2 | `FEAT-005` | Permitir operação real do catálogo |
| 3 | `FEAT-033` | Completar cadastro/edição administrativa de profissionais |
| 4 | `FEAT-028` | Concluir integração WhatsApp de produção |
| 5 | `FEAT-027` | Concluir Push com provedor real |
| 6 | `FEAT-034` | Versionar taxa de cashback |
| 7 | `FEAT-016` | Adicionar cartão com tokenização segura |
| 8 | `FEAT-045` | Criar console DEV protegido |
| 9 | `FEAT-046` | Evoluir para múltiplas filiais |

## 8. Template de nova funcionalidade

<!-- TEMPLATE_ONLY -->

```markdown
### FEAT-NNN - Título curto

- `status`: `PLANNED`
- `area`: `AREA`
- `actors`: `ACTOR`
- `description`: descrição objetiva.
- `business_value`: resultado esperado.
- `business_rules`: regras aplicáveis.
- `api`: endpoints novos ou alterados.
- `frontend`: telas ou componentes.
- `database_changes`: migrations necessárias ou `NONE`.
- `api_compatibility`: `COMPATIBLE`, `BREAKING` ou `NOT_APPLICABLE`.
- `depends_on`: IDs ou `NONE`.
- `acceptance`: condições verificáveis.
- `tests`: testes unitários, integração e interface.
- `risk`: `LOW`, `MEDIUM`, `HIGH` ou `CRITICAL`.
- `target_release`: release ou `UNPLANNED`.
```

## 9. Template de bug

<!-- TEMPLATE_ONLY -->

```markdown
### BUG-AAAA-NNN - Título curto

- `status`: `OPEN`
- `priority`: `P2`
- `risk`: `MEDIUM`
- `feature_ids`: `FEAT-NNN`
- `reported_at`: `AAAA-MM-DD`
- `reported_by`: origem sem dados sensíveis.
- `environment`: ambiente e versão.
- `symptom`: comportamento observado.
- `expected_behavior`: comportamento esperado.
- `reproduction_steps`: passos mínimos e determinísticos.
- `evidence`: logs sanitizados, teste ou referência.
- `root_cause`: preencher após diagnóstico.
- `resolution`: preencher após correção.
- `files_changed`: preencher após correção.
- `database_changes`: migration ou `NONE`.
- `api_compatibility`: `COMPATIBLE`, `BREAKING` ou `NOT_APPLICABLE`.
- `verification`: testes executados.
- `regression_test`: teste permanente adicionado.
- `release`: versão ou `UNRELEASED`.
```

## 10. Template de hotfix

<!-- TEMPLATE_ONLY -->

```markdown
### HOTFIX-AAAA-NNN - Título curto

- `status`: `OPEN`
- `priority`: `P0`
- `risk`: `CRITICAL`
- `bug_ids`: `BUG-AAAA-NNN`
- `feature_ids`: `FEAT-NNN`
- `opened_at`: `AAAA-MM-DD`
- `production_version`: `X.Y.Z`
- `impact`: usuários, dados e serviços afetados.
- `containment`: ação temporária adotada.
- `root_cause`: causa confirmada.
- `resolution`: correção mínima aplicada.
- `rollback_plan`: procedimento de reversão.
- `database_changes`: migration ou `NONE`.
- `api_compatibility`: `COMPATIBLE`, `BREAKING` ou `NOT_APPLICABLE`.
- `verification`: smoke tests e regressões.
- `monitoring`: métricas e período de observação.
- `released_at`: `AAAA-MM-DD` ou `PENDING`.
- `release`: `REL-X.Y.Z`.
```

## 11. Checklist para automação

Uma automação que consumir este documento deve:

1. Ler o front matter e rejeitar versões de schema não suportadas.
2. Descobrir itens pelos títulos `### FEAT-*`, `### BUG-*` e `### HOTFIX-*`.
3. Validar IDs únicos.
4. Validar status, prioridade e risco contra os valores permitidos.
5. Criar tarefa somente para itens `READY`, `OPEN` ou `TRIAGED`.
6. Resolver dependências antes de iniciar uma feature.
7. Não editar itens marcados `TEMPLATE_ONLY`.
8. Anexar commits, testes e migrations ao atualizar um item para `FIXED` ou `IMPLEMENTED`.
9. Bloquear release quando existir bug `P0` ou `P1` ainda aberto.
10. Gerar changelog usando itens com `release` diferente de `UNRELEASED`.

## 12. Critério de pronto

Uma funcionalidade somente pode ser marcada como `IMPLEMENTED` quando:

- critérios de aceite estiverem atendidos;
- testes adequados ao risco estiverem verdes;
- API e frontend estiverem integrados, quando aplicável;
- migration estiver validada em banco vazio, quando aplicável;
- documentação e este registro estiverem atualizados;
- observabilidade e tratamento de erros estiverem definidos;
- não houver bug conhecido `P0` ou `P1` relacionado ainda aberto.

Um bug somente pode ser marcado como `VERIFIED` quando:

- causa raiz estiver registrada;
- correção estiver implementada;
- teste de regressão ou justificativa estiver registrada;
- build relevante estiver verde;
- comportamento corrigido tiver sido reproduzido no ambiente apropriado.
