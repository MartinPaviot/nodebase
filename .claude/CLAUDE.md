# CLAUDE.md — Nodebase

> **Dernière mise à jour :** Février 2026
> **Document de référence :** `.claude/idea_scoping_v6.md`

---

## 1. ÉTAT ACTUEL DU REPO

### 1.1 Stack en place

| Composant | Actuel | Version |
|-----------|--------|---------|
| **Runtime** | Node.js | 20.x (via Next.js) |
| **Framework** | Next.js (App Router) | 15.5.4 |
| **UI Library** | React | 19.1.0 |
| **Langage** | TypeScript | 5.x |
| **ORM** | Prisma | 6.16.3 |
| **Base de données** | PostgreSQL | via Prisma |
| **Auth** | Better Auth + Polar | 1.3.28 |
| **API Layer** | tRPC + TanStack Query | 11.6.0 / 5.90.5 |
| **State (client)** | Jotai | 2.15.0 |
| **URL State** | Nuqs | 2.7.2 |
| **UI Components** | shadcn/ui + Radix UI | Latest |
| **Styling** | Tailwind CSS | 4.x |
| **Workflow Editor** | React Flow (@xyflow/react) | 12.9.0 |
| **LLM SDKs** | Vercel AI SDK (@ai-sdk/*) + @anthropic-ai/sdk | 5.0.76 / 0.71.2 |
| **Queue/Jobs** | Inngest | 3.44.3 |
| **Monitoring** | Sentry | 10.20.0 |
| **Linting** | Biome | 2.2.0 |
| **IDs** | @paralleldrive/cuid2 | 3.1.0 |
| **Dates** | date-fns | 4.1.0 |
| **Encryption** | Cryptr | 6.4.0 |
| **Forms** | React Hook Form + Zod | 7.65.0 / 4.1.12 |

### 1.2 Tables Prisma existantes (51 éléments)

**Core Auth & User:**
- `User`, `Session`, `Account`, `Verification`

**Workflows (legacy):**
- `Workflow`, `Node`, `Connection`, `Execution`
- Enums: `NodeType`, `ExecutionStatus`

**Credentials:**
- `Credential`
- Enum: `CredentialType` (OPENAI, ANTHROPIC, GEMINI)

**Agents (nouveau):**
- `Agent`, `AgentConnection`, `AgentTool`
- `Conversation`, `Message`, `ConversationActivity`
- `AgentMemory`, `AgentTrigger`
- `AgentTemplate`
- `AgentEmbed`, `AgentEmailAddress`
- `AgentSwarm`, `SwarmTask`
- `AgentPhoneNumber`, `PhoneCall`
- `AgentMetric`
- Enums: `AgentModel`, `ConversationSource`, `MessageRole`, `ActivityType`, `MemoryCategory`, `TriggerType`, `TemplateCategory`, `TemplateRole`, `TemplateUseCase`, `EmbedPosition`, `SwarmStatus`, `SwarmTaskStatus`, `CallDirection`, `CallStatus`

**Knowledge Base:**
- `KnowledgeDocument`, `KnowledgeChunk`, `KnowledgeSettings`
- Enums: `KnowledgeSourceType`, `KnowledgeSyncStatus`

**Integrations:**
- `Integration`, `MeetingRecording`
- Enums: `IntegrationType`, `MeetingPlatform`, `RecordingStatus`

### 1.3 Pages/Routes existantes

```
/login, /signup                           # Auth
/home                                     # Dashboard principal
/agents                                   # Liste des agents
/agents/new                               # Créer un agent
/agents/build                             # Agent builder conversationnel
/agents/[agentId]                         # Détail agent
/agents/[agentId]/chat/[conversationId]   # Chat avec agent
/agents/[agentId]/flow                    # Éditeur de workflow agent
/chat                                     # Chat global
/templates                                # Catalogue des templates
/workflows                                # Workflows (legacy)
/workflows/[workflowId]                   # Éditeur workflow
/credentials, /credentials/new, /credentials/[id]
/executions, /executions/[id]
/integrations                             # Connexions OAuth
/settings/*                               # billing, members, connections, notifications, security, phone, speech, workspace
/onboarding                               # Wizard d'onboarding
/shared/[token]                           # Partage de conversation
```

### 1.4 Patterns actuels

| Pattern | Implémentation |
|---------|---------------|
| **Data fetching** | tRPC + TanStack Query (server state) |
| **API routes** | Next.js App Router (`/api/*`) + tRPC |
| **Auth** | Better Auth avec adapters Prisma |
| **State client** | Jotai pour atoms, Nuqs pour URL params |
| **Jobs async** | Inngest (event-driven) |
| **LLM calls** | Vercel AI SDK (multi-provider) |
| **Streaming** | Vercel AI SDK streaming |

### 1.5 Features existantes

```
src/features/
├── agents/          # Agents IA, chat, builder, flow editor
├── auth/            # Login, register
├── credentials/     # Gestion des clés API
├── editor/          # Workflow editor (React Flow)
├── executions/      # Historique d'exécutions
├── subscriptions/   # Gestion abonnements Polar
├── templates/       # Catalogue de templates
├── triggers/        # Triggers pour workflows
└── workflows/       # Gestion workflows
```

### 1.6 Libs existantes

```
src/lib/
├── activity-logger.ts    # Logging des activités agent
├── agent-analytics.ts    # Métriques agents
├── auth.ts               # Config Better Auth
├── auth-client.ts        # Client auth
├── db.ts                 # Prisma client
├── embeddings.ts         # Embeddings pour knowledge base
├── encryption.ts         # Cryptr wrapper
├── integrations/         # Google, Microsoft, Notion, Slack, Twilio
├── knowledge-base.ts     # RAG / knowledge
├── meeting-recorder.ts   # Enregistrement meetings
├── polar.ts              # Client Polar
├── swarm-executor.ts     # Exécution multi-agents
└── workflow-executor.ts  # Exécution workflows
```

### 1.7 Dépendances à GARDER

| Package | Raison |
|---------|--------|
| `@prisma/client` | ORM, ça fonctionne |
| `@trpc/*` | API type-safe, bien intégré |
| `@tanstack/react-query` | Server state, cache |
| `@xyflow/react` | Workflow editor, déjà en place |
| `@radix-ui/*` | Composants accessibles |
| `@sentry/nextjs` | Monitoring, nécessaire |
| `zod` | Validation, utilisé partout |
| `react-hook-form` | Forms, fonctionne bien |
| `tailwind-merge`, `clsx`, `class-variance-authority` | Styling utils |
| `sonner` | Toasts |

### 1.8 Dépendances à REMPLACER

| Actuel | Cible V6 | Raison |
|--------|----------|--------|
| `@ai-sdk/*` (Vercel AI SDK) | `@anthropic-ai/sdk` | SDK direct = moins de couches, meilleur debug |
| `inngest` | `bullmq` + `ioredis` | Control total, pas de vendor lock-in, graceful shutdown |
| `biome` | `eslint` + `prettier` | Écosystème ESLint plus riche (plugins custom) |
| `jotai` | `zustand` | Plus simple pour le state client |
| `@paralleldrive/cuid2` | `nanoid` | IDs plus courts, URL-safe |
| `date-fns` | `luxon` | Meilleur support timezones |
| `better-auth` | `supabase-auth` | Intégré à Supabase PostgreSQL |
| `cryptr` | Custom AES-256 | Plus de contrôle, rotation de clés |

### 1.9 Ce qui fonctionne — NE PAS CASSER

1. **Auth flow** — Login/signup avec GitHub/Google fonctionne
2. **Chat agents** — Interface de chat avec streaming (via Vercel AI SDK)
3. **Templates** — 93 templates **DÉFINIS** dans `prisma/seed-templates.ts` (métadonnées seulement, **NON CONFIGURÉS** pour exécution autonome — voir section 3.1)
4. **Workflow editor** — React Flow intégré
5. **tRPC setup** — Type-safe API fonctionne
6. **Prisma schema** — Modèles agents complets
7. **Integrations OAuth** — Google, Microsoft, Slack, Notion connectés
8. **Settings pages** — UI complète

---

## 2. VISION CIBLE (V6)

### 2.1 Le produit

**Plateforme d'agents AI pour PME non-tech.**

Deux features différenciantes :
1. **Le Scan** — "Connecte tes outils, on te montre ce qui tombe entre les mailles" (deals dormants, tickets proches SLA, candidatures non traitées, factures overdue)
2. **Style Learner** — Les drafts deviennent ceux de l'utilisateur via few-shot learning sur les corrections

~93 templates couvrant sales, marketing, support, HR, ops, research/product.

### 2.2 Stack cible complète

| Composant | Cible V6 | Justification |
|-----------|----------|---------------|
| **Runtime** | Node.js 22 LTS | Latest LTS |
| **Framework** | Next.js 14+ (App Router) | SSR, API routes, un seul déploiement |
| **ORM + DB** | Prisma 6 + PostgreSQL (Supabase) | Type-safety, managed DB |
| **Auth** | Supabase Auth | OAuth + magic link + sessions, intégré à Supabase |
| **API** | tRPC + TanStack Query | Type-safety end-to-end |
| **UI** | shadcn/ui + Tailwind CSS v4 + Radix | Accessible, customizable |
| **State client** | Zustand | Simple, performant |
| **State serveur** | TanStack Query | Cache, mutations, invalidation |
| **LLM** | @anthropic-ai/sdk (direct) | Pas d'abstraction, meilleur debug |
| **Queue** | BullMQ + Redis (Upstash) | Open-source, graceful shutdown, stall detection |
| **Workflow editor** | React Flow (@xyflow/react) | Déjà en place |
| **Monitoring** | Sentry | Error tracking + performance |
| **Linting** | ESLint + Prettier | Écosystème riche |
| **Monorepo** | pnpm + Turborepo | Builds parallèles, caching |
| **IDs** | nanoid | Courts, URL-safe |
| **Dates** | luxon | Timezones |
| **Validation** | Zod | TypeScript-first |
| **Intégrations** | Pipedream Connect | 2,800+ APIs, OAuth géré |

### 2.3 Architecture monorepo cible

```
nodebase/
├── apps/
│   └── web/                          # Next.js App Router
│       ├── app/                      # Routes
│       ├── components/               # shadcn/ui + custom
│       └── lib/                      # Hooks, utils
│
├── packages/
│   ├── @nodebase/types/              # Interfaces partagées
│   ├── @nodebase/db/                 # Prisma + Resource pattern
│   ├── @nodebase/config/             # @Env() + Zod validation
│   ├── @nodebase/crypto/             # AES-256 encryption + redaction
│   ├── @nodebase/ai/                 # Anthropic SDK + events + tiering
│   ├── @nodebase/core/               # Scan engine + Agent engine + Eval + Hooks
│   ├── @nodebase/connectors/         # BaseConnector + intégrations
│   └── @nodebase/queue/              # BullMQ workers
│
├── templates/                        # ~93 agent templates (JSON + prompts)
│   ├── sales/
│   ├── support/
│   ├── marketing/
│   ├── hr/
│   ├── finance/
│   └── operations/
│
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

### 2.4 Les 8 patterns obligatoires

| # | Pattern | Description | Source |
|---|---------|-------------|--------|
| 1 | **Resource Pattern** | Jamais exposer un modèle Prisma brut. Toujours via une classe `*Resource` avec vérification des permissions. | Dust |
| 2 | **Lifecycle Hooks** | `agent.before` / `agent.after` pour logging, cost tracking, notifications. Injectables sans modifier le moteur core. | n8n |
| 3 | **Credential Encryption** | AES-256 pour TOUS les credentials. Redaction côté frontend (jamais de secret en clair dans le browser). | n8n |
| 4 | **Error Type Hierarchy** | `ScanError`, `AgentExecutionError`, `ConnectorError`, `CredentialError`. Chaque erreur porte le contexte complet. | n8n |
| 5 | **Config @Env() + Zod** | Variables d'environnement mappées aux propriétés typées avec validation. L'app refuse de démarrer si config invalide. | n8n |
| 6 | **AI Event Logging** | Chaque appel LLM loggé : `model`, `tokens_in`, `tokens_out`, `cost`, `latency`, `agent_id`, `user_id`. | n8n |
| 7 | **SSE via Redis PubSub** | Streaming des réponses agents via Redis PubSub → SSE. Pas de WebSocket. Plus simple à scaler. | Dust |
| 8 | **Graceful Shutdown** | 30s timeout. BullMQ attend que les exécutions en cours se terminent. Aucune exécution coupée mid-run. | n8n |

---

## 3. DELTA — Ce qui manque

### P0 — Bloque tout le reste

| Item | État actuel | Action |
|------|-------------|--------|
| **Structure monorepo** | Flat (`src/`) | Migrer vers `apps/web` + `packages/*` |
| **pnpm + Turborepo** | npm | Migrer npm → pnpm, ajouter turbo.json |
| **Package @nodebase/types** | Types dispersés | Centraliser interfaces partagées |
| **Package @nodebase/db** | Prisma direct partout | Resource pattern + permissions |
| **Package @nodebase/config** | `.env` direct | @Env() decorator + Zod validation |

### P1 — Produit core

| Item | État actuel | Action |
|------|-------------|--------|
| **Pipedream Connect** | NON INTÉGRÉ | **CRITIQUE** — Intégrer Pipedream Connect pour 2,800+ APIs (OAuth, tokens, refresh, rate limits gérés). Voir section 3.2 |
| **Scan Engine** | Non implémenté | Créer `@nodebase/core/scan-engine/` — détection metadata-only sur CRM, support, marketing, HR, finance, projets |
| **Agent Engine** | Basique (chat) | Refactor vers `@nodebase/core/agent-engine/` — exécution avec hooks, eval, maxStepsPerRun |
| **Eval Layer (L1/L2/L3)** | Non implémenté | L1 assertions, L2 scoring rule-based, L3 LLM-as-Judge |
| **Package @nodebase/ai** | Vercel AI SDK (+ @anthropic-ai/sdk déjà installé mais non utilisé) | Migrer vers @anthropic-ai/sdk direct + tiering (Haiku/Sonnet/Opus) + AI event logging |
| **Package @nodebase/queue** | Inngest | Migrer vers BullMQ + Redis workers |
| **Package @nodebase/connectors** | Intégrations ad-hoc | BaseConnector interface + Pipedream Connect |
| **Package @nodebase/crypto** | Cryptr basique | AES-256 avec rotation de clés + redaction |
| **Style Learner** | Non implémenté | Capturer diffs, few-shot injection |
| **Daily Briefing** | Non implémenté | Agrégation scan par persona |

### 3.2 Intégration Pipedream Connect (CRITIQUE)

**État actuel :** Intégrations OAuth custom dans `src/lib/integrations/` (Google, Microsoft, Notion, Slack, Twilio) — 5 connecteurs manuels.

**Cible V6 :** Pipedream Connect gère TOUTE la plomberie OAuth pour 2,800+ APIs.

**Pourquoi Pipedream :**
- OAuth, tokens, refresh, rate limits, retries gérés automatiquement
- 2,800+ APIs prêtes (HubSpot, Salesforce, Pipedrive, Zendesk, Freshdesk, Stripe, etc.)
- C'est ce qu'utilise Lindy pour ses "4,000+ intégrations"
- Coût : $150/mois + $2/user/mois (~1.2% du revenue à €160/mois client)

**Ce qu'on doit faire :**

1. **Créer un compte Pipedream** et configurer Pipedream Connect
2. **Remplacer les intégrations manuelles** :
   ```
   src/lib/integrations/google.ts   → Pipedream Connect
   src/lib/integrations/microsoft.ts → Pipedream Connect
   src/lib/integrations/slack.ts    → Pipedream Connect
   src/lib/integrations/notion.ts   → Pipedream Connect
   src/lib/integrations/twilio.ts   → Pipedream Connect
   ```
3. **Créer `@nodebase/connectors`** avec :
   - `BaseConnector` interface
   - Wrapper Pipedream pour chaque catégorie (CRM, Support, Marketing, HR, Finance)
4. **Mapper les `suggestedIntegrations`** des templates vers des connecteurs Pipedream

**Catégories d'outils à supporter via Pipedream :**

| Catégorie | Outils prioritaires | Agents concernés |
|-----------|---------------------|------------------|
| **CRM** | HubSpot, Salesforce, Pipedrive | Deal Revival, Follow-Up, Lead Scorer |
| **Support** | Zendesk, Freshdesk, Intercom | Ticket Alert, FAQ Generator |
| **Email** | Gmail, Outlook | Tous les agents |
| **Calendar** | Google Calendar, Outlook Calendar | Meeting Prep, Scheduler |
| **Marketing** | Mailchimp, ActiveCampaign | Campaign Monitor, Newsletter |
| **HR** | Workable, BambooHR, Lever | Resume Screening, Candidate Follow-Up |
| **Finance** | Stripe, QuickBooks, Pennylane | Invoice Follow-Up, Churn Alert |
| **Projets** | Asana, Monday, Notion, Trello | Task Nudger, Status Updater |
| **Messaging** | Slack, Teams, Discord | Notifications, Alerts |

### P2 — Frontend pages + templates

| Item | État actuel | Action |
|------|-------------|--------|
| **Scan UI** | Non implémenté | Page `/scan` avec résultats par métier |
| **Approval Queue** | Non implémenté | UI pour approuver/modifier/rejeter les drafts |
| **Agent Dashboard** | Basique | Métriques, historique, performance |
| **Template customization** | View only | Permettre modification via React Flow |
| **Templates seed** | 93 templates DÉFINIS mais NON CONFIGURÉS | Voir section 3.1 ci-dessous |

### 3.1 État des 93 templates (`prisma/seed-templates.ts`)

**Ce qui EXISTE dans chaque template :**
```typescript
{
  name: "...",
  subtitle: "...",
  description: "...",
  systemPrompt: "...",           // Prompt générique, non optimisé
  model: AgentModel.ANTHROPIC,
  temperature: 0.3,
  category: TemplateCategory.X,
  role: TemplateRole.X,
  useCase: TemplateUseCase.X,
  icon: "📧",
  color: "#3B82F6",
  suggestedTools: ["..."],       // Labels texte, pas de config
  suggestedIntegrations: ["..."], // Identifiants Lindy, pas Pipedream
  suggestedTriggers: [...],
  isPublic: true,
}
```

**Ce qui MANQUE pour qu'ils soient opérationnels (selon V6) :**

| Champ manquant | Description | Exemple attendu |
|----------------|-------------|-----------------|
| `fetch` | Sources de données à fetcher via Pipedream | `[{ source: "hubspot", query: "deals.where(lastActivity < 7d)" }]` |
| `llm_tier` | Niveau LLM (fast/smart/deep) | `"smart"` → Claude Sonnet |
| `maxStepsPerRun` | Guard-rail coût | `5` |
| `eval_rules.assertions` | Checks L1 déterministes | `[{ check: "contains_recipient_name", severity: "block" }]` |
| `eval_rules.min_confidence` | Seuil L2 | `0.6` |
| `eval_rules.l3_trigger` | Quand déclencher L3 | `"on_irreversible_action"` |
| `eval_rules.auto_send_threshold` | Seuil pour auto-send | `0.85` |
| `actions` | Actions possibles | `[{ type: "draft_email", require_approval: true }]` |

**Exemple de template COMPLET (cible V6) :**
```typescript
const dealRevivalAgent: AgentTemplate = {
  id: "deal-revival",
  name: "Deal Revival Agent",
  trigger: { type: "cron", schedule: "0 9 * * *" },

  // CE QUI MANQUE - fetch sources
  fetch: [
    { source: "hubspot", query: "deals.where(lastActivity < 7d AND stage != 'closed')" },
    { source: "gmail", query: "threads.with(contact).last(5)" },
    { source: "calendar", query: "events.with(contact).next(7d)" }
  ],

  llm_tier: "smart",              // MANQUE
  maxStepsPerRun: 5,              // MANQUE

  systemPrompt: "...",            // EXISTE mais générique

  // CE QUI MANQUE - eval rules
  eval_rules: {
    assertions: [
      { check: "contains_recipient_name", severity: "block" },
      { check: "no_placeholders", severity: "block" },
      { check: "references_real_exchange", severity: "block" },
      { check: "correct_language", severity: "warn" }
    ],
    min_confidence: 0.6,
    l3_trigger: "on_irreversible_action",
    require_approval: true,
    auto_send_threshold: 0.85
  },

  // CE QUI MANQUE - actions
  actions: [
    { type: "draft_email", require_approval: true },
    { type: "update_crm", field: "last_followup_date" }
  ]
}
```

**Travail restant :**
- [ ] Définir le schéma TypeScript complet pour `AgentTemplate` (avec fetch, eval_rules, actions)
- [ ] Mettre à jour le model Prisma `AgentTemplate` avec les nouveaux champs
- [ ] Configurer chaque template avec ses fetch sources spécifiques
- [ ] Définir les eval_rules par catégorie (sales, support, marketing, etc.)
- [ ] Mapper les `suggestedIntegrations` vers des connecteurs Pipedream réels

### P3 — Polish

| Item | État actuel | Action |
|------|-------------|--------|
| **Billing avancé** | Polar basique | Credit tracking, alertes usage |
| **Marketplace** | Non prévu V1 | — |
| **Analytics** | Basique | Dashboards coût/performance |
| **Enterprise (SSO/SAML)** | Non prévu V1 | — |

---

## 4. MIGRATIONS NÉCESSAIRES

### 4.1 npm → pnpm

```bash
# 1. Supprimer node_modules et package-lock.json
rm -rf node_modules package-lock.json

# 2. Installer pnpm
npm install -g pnpm

# 3. Initialiser workspace
pnpm init

# 4. Créer pnpm-workspace.yaml
echo "packages:\n  - 'apps/*'\n  - 'packages/*'" > pnpm-workspace.yaml

# 5. Installer
pnpm install
```

### 4.2 Biome → ESLint + Prettier

```bash
# 1. Supprimer Biome
pnpm remove @biomejs/biome
rm biome.json

# 2. Installer ESLint + Prettier
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-config-prettier prettier

# 3. Créer configs
# .eslintrc.js, .prettierrc
```

### 4.3 Structure flat → monorepo

```bash
# 1. Créer structure
mkdir -p apps/web packages/@nodebase/{types,db,config,crypto,ai,core,connectors,queue}

# 2. Déplacer src/ vers apps/web/
mv src apps/web/

# 3. Configurer Turborepo
# turbo.json avec pipeline build/lint/test
```

### 4.4 Migration Prisma schema

Le schema actuel est déjà riche (51 éléments). Ajouts nécessaires :

```prisma
// Ajouter pour le Scan Engine
model ScanResult {
  id          String   @id @default(nanoid())
  workspaceId String
  category    ScanCategory
  signals     Json     // SignalResult[]
  scannedAt   DateTime @default(now())
}

enum ScanCategory {
  SALES
  SUPPORT
  MARKETING
  HR
  FINANCE
  PROJECTS
}

// Ajouter pour l'Eval Layer
model AgentRun {
  id              String   @id @default(nanoid())
  agentId         String
  userId          String
  triggeredAt     DateTime
  triggeredBy     String   // "cron" | "webhook" | "manual"
  dataSources     Json
  outputType      String
  outputContent   String
  llmModel        String
  llmTokensUsed   Int
  l1Assertions    Json
  l1Passed        Boolean
  l2Score         Int
  l2Breakdown     Json
  l3Triggered     Boolean
  l3Blocked       Boolean?
  l3Reason        String?
  userAction      String?
  draftDiff       String?
  finalAction     String?
  finalAt         DateTime?
}

// Ajouter pour AI Event Logging
model AiEvent {
  id          String   @id @default(nanoid())
  agentId     String
  userId      String
  workspaceId String
  model       String   // "haiku" | "sonnet" | "opus"
  tokensIn    Int
  tokensOut   Int
  cost        Float
  latency     Int      // ms
  stepsUsed   Int
  evalResult  String   // "pass" | "block" | "warn"
  action      String
  timestamp   DateTime @default(now())
}
```

### 4.5 Auth : Better Auth → Supabase Auth

**Question ouverte :** Le repo utilise Better Auth avec Polar. La migration vers Supabase Auth est recommandée par le V6 mais :
- Better Auth fonctionne
- L'intégration Polar est déjà faite
- Migration = risque et effort

**Recommandation :** Garder Better Auth pour V1, migrer en V2 si nécessaire.

---

## 5. CONVENTIONS

### 5.1 Naming

| Type | Convention | Exemple |
|------|------------|---------|
| **Packages** | `@nodebase/` | `@nodebase/core`, `@nodebase/ai` |
| **Fichiers** | kebab-case | `scan-engine.ts`, `agent-worker.ts` |
| **Classes** | PascalCase | `ScanResource`, `AgentEngine` |
| **Fonctions** | camelCase | `runScan()`, `executeAgent()` |
| **Constants** | SCREAMING_SNAKE | `MAX_STEPS_PER_RUN`, `DEFAULT_LLM_TIER` |

### 5.2 Code style

- **Zéro `any`** — TypeScript strict mode
- **Zod partout** — API input, config, LLM output parsing
- **Exports nommés** — Pas de `export default`
- **nanoid pour IDs publics** — `scan_kx7Gh2p` pas UUIDs
- **Commits** — Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`)

### 5.3 Patterns obligatoires

```typescript
// Resource Pattern — TOUJOURS
class ScanResource {
  static async findById(id: string, auth: Authenticator): Promise<ScanResource | null> {
    const scan = await prisma.scan.findUnique({ where: { id } });
    if (!scan) return null;
    if (!auth.canAccess(scan.workspaceId)) throw new PermissionError();
    return new ScanResource(scan, auth);
  }
}

// Error Hierarchy — JAMAIS throw new Error("...")
class ScanError extends NodebaseError {
  constructor(public signalId: string, public connectorId: string, message: string) {
    super(`Scan failed on signal ${signalId} via ${connectorId}: ${message}`);
  }
}

// Config typée — PAS de process.env direct
class LLMConfig {
  @Env('ANTHROPIC_API_KEY')
  apiKey: string;  // fail au boot si absent

  @Env('LLM_MAX_STEPS_PER_RUN')
  maxStepsPerRun: number = 5;
}
```

---

## 6. COMMANDES

### Actuelles (npm)

```bash
npm run dev          # Next.js dev avec Turbopack
npm run build        # Build production
npm run start        # Start production
npm run lint         # Biome check
npm run format       # Biome format

npm run db:push      # Push Prisma schema
npm run db:generate  # Generate Prisma client
npm run db:seed      # Seed templates

npm run inngest:dev  # Dev Inngest server
npm run ngrok:dev    # Expose local via ngrok
npm run dev:all      # Tous les services via mprocs
```

### Cibles (pnpm + Turbo)

```bash
pnpm dev             # All packages + apps dev
pnpm build           # Build all (cached)
pnpm lint            # ESLint all packages
pnpm test            # Jest all packages
pnpm typecheck       # TypeScript check

pnpm --filter @nodebase/core build   # Build un package
pnpm --filter web dev                # Dev app web

turbo run build --filter=@nodebase/ai  # Turbo avec filter
```

---

## 7. PLAN LANGCHAIN — Contrôle & Auto-Optimisation

> **Dernière mise à jour :** Février 2026
> **Document complet :** `.claude/plans/floating-leaping-backus.md`

**Objectif :** Transformer Nodebase en plateforme auto-optimisante inspirée de LangChain/LangSmith.

### 7.1 Les 5 Patterns LangChain Intégrés

1. **LangSmith** — Tracing complet + évaluation multi-tour des conversations
2. **Promptim** — Optimisation automatique des prompts via feedback loop
3. **Agent Builder** — Création d'agents en langage naturel
4. **LangGraph** — Runtime avec middleware hooks composables
5. **Feedback Loop** — Live data → test datasets → auto-optimization

### 7.2 Architecture en 4 Layers

| Layer | Composants | Status |
|-------|-----------|--------|
| **1. Execution** | Agent Runtime (ReAct pattern) + Middleware Hooks | 🔴 À implémenter |
| **2. Observability** | Tracing + Multi-turn Evals + Insights Engine | 🔴 À implémenter |
| **3. Optimization** | Feedback Collector + Auto-Optimizer + A/B Tests | 🔴 À implémenter |
| **4. Meta-Agent** | Agent Builder (NL) + Self-Modifying Agents | 🔴 À implémenter |

### 7.3 Nouveaux Packages

```
packages/@nodebase/core/
├── agent-engine/          # Runtime avec hooks extensibles
├── observability/         # Tracing & métriques (LangSmith-style)
├── evaluation/            # Multi-turn evals + goal detection
├── insights/              # Clustering + pattern detection
├── optimization/          # Feedback → A/B tests (Promptim-style)
└── meta-agent/            # Self-building/modifying agents
```

### 7.4 Nouveaux Modèles Prisma

- `AgentTrace` — Traces complètes d'exécution (tokens, coût, latence)
- `ConversationEvaluation` — Évaluations multi-tour (goal completion, satisfaction)
- `AgentInsight` — Insights automatiques (patterns, anomalies, opportunités)
- `AgentFeedback` — Feedback structuré (thumbs, edits, corrections)
- `AgentABTest` — Tests A/B de prompts
- `ModificationProposal` — Propositions d'auto-amélioration

### 7.5 Roadmap (9 semaines)

| Phase | Durée | Contenu |
|-------|-------|---------|
| **Phase 1** | S1-2 | Fondations — Runtime + Hooks + Tracing |
| **Phase 2** | S3-4 | Multi-turn Evals + Insights Engine |
| **Phase 3** | S5-6 | Auto-Optimization (Promptim) |
| **Phase 4** | S7-8 | Agents Builders Autonomes |
| **Phase 5** | S9 | Dashboards + Testing |

### 7.6 ROI Attendu

- **Réduction coût** : 30-50% via model tier optimization
- **Amélioration qualité** : +40% satisfaction via auto-optimization
- **Réduction churn** : Agents auto-optimisants = plus de valeur

**Voir plan complet :** [`.claude/plans/floating-leaping-backus.md`](.claude/plans/floating-leaping-backus.md)

---

## 8. RÉFÉRENCES

- **Vision produit complète :** `.claude/idea_scoping_v6.md`
- **Deep dive Dust & n8n :** `.claude/dust_n8n_deep_dive_v2.md`
- **Inventaire open-source :** `.claude/open_source_inventory.md`
- **Templates agents :** `prisma/seed-templates.ts` (93 templates)
- **Plan LangChain (contrôle + auto-optimisation) :** `.claude/plans/floating-leaping-backus.md`
