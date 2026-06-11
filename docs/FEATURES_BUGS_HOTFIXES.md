---
document_id: BARBERFLOW-FEATURE-REGISTRY
schema_version: 1
project: BarberFlow
language: pt-BR
last_updated: 2026-06-10
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

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `description`: Serviços, duração, profissional, data, horários, pagamento, cashback e resumo.
- `acceptance`: botão de confirmação permanece desabilitado sem serviços e horário.

### FEAT-038 - Interface de pagamento PIX

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `description`: Exibe código PIX simulado e ação de aprovação para desenvolvimento.
- `warning`: deve ser substituída pelo fluxo do gateway real antes de produção financeira.

### FEAT-039 - Interface de histórico

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `description`: Exibe status, data, horário, barbeiro, serviços, valor e cancelamento permitido.

### FEAT-040 - Interface da carteira

- `status`: `IMPLEMENTED`
- `area`: `FRONTEND`
- `description`: Exibe saldo disponível e extrato de cashback.

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
