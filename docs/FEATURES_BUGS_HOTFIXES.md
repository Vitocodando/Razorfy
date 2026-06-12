---
document_id: BARBERFLOW-FEATURE-REGISTRY
schema_version: 1
project: BarberFlow
language: pt-BR
last_updated: 2026-06-11
source_of_truth: true
automation_ready: true
---

# Registro de Funcionalidades, Bugs e Hotfixes

Este documento é a fonte canônica do BarberFlow para:

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
| JWT e autorização por perfil | `IMPLEMENTED` |
| Catálogo público de serviços | `IMPLEMENTED` para consulta |
| Gestão administrativa de serviços | `PLANNED` |
| Consulta de barbeiros | `IMPLEMENTED` |
| Disponibilidade dinâmica | `IMPLEMENTED` |
| Gestão da jornada pelo barbeiro | `PLANNED` |
| Agendamento de múltiplos serviços | `IMPLEMENTED` |
| PIX local/simulado | `IMPLEMENTED` |
| Gateway PIX real | `PLANNED` |
| Cartão online | `PARTIAL` no domínio, sem gateway/UI |
| Pagamento presencial | `IMPLEMENTED` |
| Cashback e extrato | `IMPLEMENTED` |
| Cancelamento e janela mínima | `IMPLEMENTED` |
| Estorno em gateway real | `PARTIAL`, atualmente simulado |
| Push | `PARTIAL`, processado localmente |
| WhatsApp | `PARTIAL`, integração REST configurável |
| Outbox e retentativas | `IMPLEMENTED` |
| Relatório administrativo via API | `IMPLEMENTED` |
| Dashboard administrativo React | `PLANNED` |
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

- `status`: `PARTIAL`
- `area`: `SCHEDULE`
- `actors`: `BARBER`, `ADMIN`
- `description`: Jornada semanal, início, fim e intervalo de almoço persistidos por profissional.
- `implemented`: modelo, migration, validação e dados de desenvolvimento.
- `missing`: endpoints e interface para edição da jornada e bloqueios extraordinários.
- `acceptance`: jornada válida não pode ter fim anterior ao início; almoço deve estar contido na jornada.

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
- `description`: Aplica desconto parcial ou total até o menor valor entre saldo disponível e total.
- `rules`: valor reservado durante pagamento pendente; debitado somente na confirmação.
- `errors`: `CASHBACK_INSUFFICIENT_FUNDS`, `CASHBACK_EXCEEDS_TOTAL`.
- `tests`: saldo insuficiente validado com HTTP `422`.

### FEAT-020 - Geração de cashback

- `status`: `IMPLEMENTED`
- `area`: `CASHBACK`
- `actors`: `BARBER`, `ADMIN`, `SYSTEM`
- `description`: Credita cashback quando o atendimento muda para `CONCLUDED`.
- `default_rate`: `5%`
- `formula`: `amount_paid * cashback_rate`.
- `rules`: valor pago com cashback não gera novo cashback.
- `tests`: R$ 30,00 pagos geram R$ 1,50; R$ 80,00 geram R$ 4,00.

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
- `api`: `GET /api/v1/reports/summary`
- `metrics`: confirmados, concluídos, cancelados, receita e produtividade por barbeiro.
- `frontend`: não implementado.

### FEAT-032 - Dashboard administrativo

- `status`: `PLANNED`
- `area`: `REPORT`
- `actors`: `ADMIN`
- `description`: Interface React para métricas, profissionais, serviços e configurações.
- `depends_on`: `FEAT-005`, `FEAT-031`, `FEAT-033`

### FEAT-033 - Gestão de barbeiros e jornadas

- `status`: `PLANNED`
- `area`: `ADMIN`
- `actors`: `ADMIN`, `BARBER`
- `description`: Cadastro de barbeiro, edição de jornada, almoço, férias e bloqueios.
- `acceptance`: mudanças futuras não podem invalidar silenciosamente agendamentos existentes.

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
- `acceptance`: não há referências visuais ao nome BarberFlow no frontend; lint e build de produção aprovados.
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

## 4. Regras de negócio rastreadas

| ID | Regra | Features |
| --- | --- | --- |
| `RN-001` | Duração total é a soma dos serviços | `FEAT-008`, `FEAT-009`, `FEAT-010` |
| `RN-002` | Cancelamento autônomo exige pelo menos 2 horas | `FEAT-023` |
| `RN-003` | Cashback incide somente sobre dinheiro efetivamente pago | `FEAT-020` |
| `RN-004` | Cashback é creditado apenas na conclusão | `FEAT-020`, `FEAT-024` |
| `RN-005` | Intervalos do mesmo barbeiro não podem se sobrepor | `FEAT-012` |
| `RN-006` | Agendamento deve respeitar jornada e almoço | `FEAT-007`, `FEAT-008`, `FEAT-010` |
| `RN-007` | Cashback reservado não pode ser gasto em outra compra | `FEAT-018`, `FEAT-019` |
| `RN-008` | Pagamento pendente bloqueia o horário por 10 minutos | `FEAT-011` |

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
| 3 | `FEAT-033` | Permitir gestão real de profissionais e jornadas |
| 4 | `FEAT-032` | Dar autonomia ao administrador |
| 5 | `FEAT-028` | Concluir integração WhatsApp de produção |
| 6 | `FEAT-027` | Concluir Push com provedor real |
| 7 | `FEAT-034` | Versionar taxa de cashback |
| 8 | `FEAT-016` | Adicionar cartão com tokenização segura |
| 9 | `FEAT-045` | Criar console DEV protegido |
| 10 | `FEAT-046` | Evoluir para múltiplas filiais |

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
