# Prompt: Especificação de UI — Razorfy (para IA geradora de interfaces)

> Gerado a partir da análise do código real: rotas Express (`backend/src/**/*.router.ts`), schema do banco (`backend/prisma/schema.prisma`), DTOs (`appointment.dto.ts`, `auth.service.ts`) e frontend MVP atual (`frontend/src/App.tsx`). Atualizado em 2026-06-11.

---

## PROMPT PARA A IA-B

Você é um **Designer de UI sênior, especialista em design systems escaláveis para SaaS**. Sua tarefa é projetar a interface web do **Razorfy**, um sistema de agendamento de barbearia. Siga rigorosamente a especificação abaixo — ela foi extraída do backend real e do contrato de API vigente. Não invente campos, endpoints ou fluxos que não estejam listados.

### Identidade visual (obrigatória)

- **Cores**: vermelho `#e53935` (primária/ação), azul `#283593` (secundária), creme `#f6f5ea` (fundo).
- **Tipografia**: Montserrat (400, 500, 600, 700, 800).
- **Tom**: direto, confiante, masculino-contemporâneo. Microcopy em pt-BR ("Seu estilo. Seu horário. Do seu jeito.").
- **Logo**: `razorfy.png` (símbolo + wordmark).

### Contexto técnico

- Frontend: React 19 + TypeScript + Vite, CSS puro (sem framework de UI — os componentes que você definir serão a base do design system próprio).
- API REST JSON em `/api/v1`; autenticação JWT Bearer; papéis: `CLIENT`, `BARBER`, `ADMIN`, `DEV`.
- Toda resposta de erro tem o formato `{ status, code, message }` — `message` é exibível ao usuário em pt-BR.

---

## 1. Mapeamento de Fluxos e Telas

### Fluxo A — Autenticação (papel: público)

| Tela | Rota da API | Caso de uso |
|---|---|---|
| A1. Cadastro | `POST /auth/register` | Cliente cria conta e já entra autenticado |
| A2. Login | `POST /auth/login` | Qualquer papel entra; resposta `{ accessToken, user: { id, name, email, phone, role } }` decide o fluxo seguinte por `role` |

### Fluxo B — Cliente: agendar (MVP atual, prioridade P0)

| Tela | Rotas da API | Caso de uso |
|---|---|---|
| B1. Home / Catálogo | `GET /services` | Exibe serviços ativos agrupados em 4 categorias derivadas do nome: **Cabelo, Barba, Sobrancelha, Especiais**. Seleção múltipla. CTA fixo de agendar (mostra duração e total acumulados) |
| B2. Calendário | `GET /barbers`, `GET /barbers/{id}/availability?date=AAAA-MM-DD&duration=N` | Cascata: (1) "Tem profissional de preferência?" — opção **Sem preferência** agrega horários de todos; (2) dia; (3) grade de horários de 15 min |
| B3. Confirmação | `POST /appointments` (`paymentMethod: PRESENTIAL`) | Resumo do agendamento criado (`CONFIRMED`): profissional, data/hora, valor. Ação: "Fazer novo agendamento" |

### Fluxo C — Cliente: gestão (API pronta, UI a projetar, prioridade P1)

| Tela | Rotas da API | Caso de uso |
|---|---|---|
| C1. Meus horários | `GET /appointments/mine`, `POST /appointments/{id}/cancel` | Lista em ordem decrescente; cancelar permitido só com ≥ 2h de antecedência e status `CONFIRMED`/`PENDING_PAYMENT` |
| C2. Carteira | `GET /wallet` | Saldo disponível + extrato de cashback (últimas 50 transações) |
| C3. Pagamento PIX | `POST /appointments` (`ONLINE_PIX`) + `POST /api/payments/webhooks/mock` | Reserva de 10 min, QR Code + copia-e-cola, polling/ação de confirmação |

### Fluxo D — Equipe (API pronta, UI a projetar, prioridade P2)

| Tela | Rotas da API | Papel | Caso de uso |
|---|---|---|---|
| D1. Agenda do barbeiro | `GET /appointments/mine`*, `POST /appointments/{id}/conclude` | `BARBER` | Concluir atendimento (gera cashback do cliente) — *endpoint de agenda do barbeiro ainda não existe; sinalizar como dependência de backend |
| D2. Relatório admin | `GET /reports/summary` | `ADMIN`, `DEV` | KPIs: confirmados, concluídos, cancelados, receita, produtividade por barbeiro |

---

## 2. Dicionário de Dados de Interface

### A1 Cadastro — coleta
| Campo | Tipo | Validação |
|---|---|---|
| name | text | mín. 3 caracteres |
| email | email | único (erro `EMAIL_ALREADY_EXISTS` → 409) |
| phone | tel | E.164 `^\+?[1-9]\d{1,14}$`, único (`PHONE_ALREADY_EXISTS` → 409) |
| password | password | mín. 8 caracteres |

### A2 Login — coleta
| Campo | Tipo | Erro |
|---|---|---|
| email, password | email, password | `INVALID_CREDENTIALS` → 401, mensagem genérica |

### B1 Catálogo — exibe (por serviço)
| Campo | Origem (`Service`) | Formato |
|---|---|---|
| name | `services.name` | até 50 chars |
| durationMinutes | `services.duration_minutes` | "30 min" |
| price | `services.price` | BRL `R$ 35,00` (número JSON) |
| — agregados da seleção | soma local | duração total (min) e total (BRL) no CTA |

### B2 Calendário — coleta/exibe
| Elemento | Dado | Observação |
|---|---|---|
| Preferência | `Barber { id, name }` | card extra "Sem preferência" |
| Data | date input | mín. hoje; dias sem expediente retornam lista vazia |
| Horários | `availableStarts: string[]` (ISO UTC) | renderizar em hora local pt-BR; sem preferência = união dos horários de todos os barbeiros |

### B3/C1 Agendamento — exibe (DTO `Appointment`)
| Campo | Tipo | Formato |
|---|---|---|
| appointmentId | uuid | interno (key) |
| status | enum | `PENDING_PAYMENT`, `CONFIRMED`, `CONCLUDED`, `CANCELLED`, `EXPIRED_PAYMENT`, `CANCELLED_OVERBOOKING` — badge com cor por estado |
| startTimestamp / endTimestamp | ISO UTC | data + faixa horária local |
| barberName | string | — |
| services[] | `{ name, durationMinutes, price }` | nomes unidos por " + " |
| totalPrice / cashbackUsed / amountToPay | número | BRL |
| paymentPayload? | `{ qrCodeBase64, copyPasteCode }` | só em `ONLINE_PIX` pendente |

### C2 Carteira — exibe
| Campo | Origem | Formato |
|---|---|---|
| availableBalance / balance / reservedBalance | `cashback_wallets` | BRL em destaque |
| transactions[] | `cashback_transactions` | `{ type: CREDIT\|DEBIT\|RESERVE\|RELEASE, amount, description, createdAt }` — sinal +/− e cor por tipo |

### D2 Relatório — exibe
KPIs numéricos (confirmados, concluídos, cancelados, receita BRL) + tabela de produtividade por barbeiro.

---

## 3. Arquitetura de Componentes Reutilizáveis (Design System)

Projete estes componentes como **globais e tematizáveis** — eles devem cobrir todas as telas acima sem variações ad-hoc:

**Fundações**
- Tokens: cores (primária/secundária/fundo/feedback), espaçamento em escala de 4px, raios, sombras, tipografia Montserrat com escala definida.

**Componentes base**
1. `Button` — variantes: primária (vermelho, alto destaque), ghost/secundária, compacta; estados disabled/loading ("Reservando...").
2. `SelectionCard` — card selecionável com ícone, título, subtítulo e indicador ✓/+ (usado para serviços E para barbeiros — mesma anatomia).
3. `TimeChip` — botão de horário em grade responsiva, estado selecionado.
4. `StatusBadge` — mapeia os 6 estados de agendamento para cor + label pt-BR.
5. `MoneyText` / `DurationText` — formatadores visuais consistentes (BRL, "N min").
6. `FormField` — wrapper de label + input + erro inline; variantes text/email/tel/password/date/number.
7. `Panel` / `SectionStep` — container de seção com numeração de passo ("01 · Escolha os serviços").
8. `StickyCTA` — barra de ação fixa inferior com resumo dinâmico (duração + total).
9. `EmptyState` — ícone + título + texto de apoio (reutilizado em listas e grades vazias).
10. `ErrorBox` / `Toast` — exibição da `message` da API.
11. `ConfirmDialog` — modal de confirmação para ações destrutivas (cancelar agendamento).
12. `ResultScreen` — tela de sucesso com ícone, resumo em card (`ResultCard`) e ação principal.
13. `AppShell` — layout com sidebar (desktop) / header + nav inferior (mobile), slot de perfil e logout.
14. `KPICard` e `DataTable` — para o fluxo D (admin): valor em destaque + label; tabela ordenável simples.
15. `TransactionRow` — linha de extrato com sinal, descrição, data e valor.

**Regra de escalabilidade**: nenhuma tela pode introduzir um padrão visual novo sem promovê-lo a componente; variantes via props, nunca cópias.

---

## 4. Estados de Tela (obrigatório prever todos)

Para **cada** tela, entregue os estados:

| Estado | Comportamento esperado |
|---|---|
| **Carregando** | Skeleton nos cards/grades (catálogo, horários, extrato); botões com label de progresso; nunca tela branca |
| **Vazio** | `EmptyState` com microcopy própria: catálogo sem serviços; "Não há horários livres para esta data. Tente outro dia."; agenda sem agendamentos ("Seu próximo visual vai aparecer aqui."); extrato vazio |
| **Erro de validação** | Inline no `FormField` (HTML5 + mensagens da API por campo); erros 409 de cadastro destacam o campo correspondente |
| **Erro de negócio** | `ErrorBox` com a `message` da API — casos críticos a tratar: `SLOT_ALREADY_BOOKED` (409, horário tomado durante o fluxo → recarregar grade), `INVALID_CANCEL_WINDOW` (422), `PAYMENT_HOLD_EXPIRED` (422), `CASHBACK_EXCEEDS_TOTAL` (422) |
| **Erro de rede/servidor** | Mensagem genérica amigável + ação de tentar novamente |
| **Sucesso** | `ResultScreen` (agendamento confirmado); `Toast` para ações secundárias (cancelamento efetuado) |
| **Sessão expirada** | 401 em qualquer chamada autenticada → limpar sessão e voltar ao login com aviso |

### Restrições finais

- Mobile-first; breakpoints para tablet e desktop (sidebar só em desktop).
- Acessibilidade: foco visível, labels associados, contraste AA sobre o creme `#f6f5ea`.
- Horários sempre exibidos no fuso local do navegador (a API envia UTC; o negócio opera em `America/Sao_Paulo`).
- Priorize o fluxo B (P0/MVP); entregue C e D como extensões do mesmo design system, sem novos padrões.

**Entregáveis esperados da IA-B**: wireframes de alta fidelidade das telas A1–B3 (P0), biblioteca de componentes com variantes e estados, e specs de C1–D2 (P1/P2) reutilizando a biblioteca.
