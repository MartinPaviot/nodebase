# Setup Claude Code — Nodebase

## Ce qu'il faut faire

### 1. Créer un dossier `.claude/` à la racine du repo

```
nodebase/
├── .claude/
│   ├── CLAUDE.md              ← Instructions principales pour Claude Code
│   ├── idea_scoping_v6.md     ← Le doc stratégie/produit/technique complet
│   ├── tech_deep_dive.md      ← L'analyse Dust & n8n (optionnel, gros fichier)
│   └── open_source_inventory.md ← Le catalogue de libs (optionnel)
├── src/
├── prisma/
├── package.json
└── ...
```

### 2. Le fichier clé : `.claude/CLAUDE.md`

C'est le fichier que Claude Code lit en premier à chaque session. Il doit contenir :

```markdown
# CLAUDE.md — Nodebase

## Projet
Nodebase est une plateforme d'agents AI pour PME non-tech. 
Voir `idea_scoping_v6.md` dans ce dossier pour le contexte complet.

## Stack technique (V6)
- **Runtime :** Node.js 22 + TypeScript 5 strict (zéro `any`)
- **Framework :** Next.js 14+ App Router
- **ORM + DB :** Prisma 6 + PostgreSQL (Supabase)
- **Auth :** Supabase Auth (ou ce qui est déjà en place)
- **API :** tRPC + TanStack Query
- **UI :** shadcn/ui + Tailwind CSS v4 + Radix
- **Queue :** BullMQ + Redis (Upstash)
- **LLM :** @anthropic-ai/sdk (Claude direct, PAS LangChain, PAS Vercel AI SDK)
- **Monorepo :** pnpm + Turborepo
- **Monitoring :** Sentry
- **Linting :** ESLint + Prettier (PAS Biome)
- **Workflow editor :** React Flow (@xyflow/react)
- **State :** Zustand (client) + TanStack Query (serveur)
- **Validation :** Zod partout
- **IDs :** nanoid (courts, URL-safe)
- **Dates :** luxon

## Architecture monorepo
```
nodebase/
├── apps/web/              ← Next.js app (dashboard, API routes)
├── packages/
│   ├── @nodebase/types    ← Interfaces partagées
│   ├── @nodebase/db       ← Prisma + Resource pattern
│   ├── @nodebase/config   ← @Env() + Zod validation
│   ├── @nodebase/crypto   ← AES-256 encryption + redaction
│   ├── @nodebase/ai       ← Anthropic SDK + events + tiering
│   ├── @nodebase/core     ← Scan engine + Agent engine + Eval + Hooks
│   ├── @nodebase/connectors ← BaseConnector + HubSpot/Gmail/etc.
│   └── @nodebase/queue    ← BullMQ workers
├── templates/             ← ~93 agent templates (JSON + prompts)
├── turbo.json
└── pnpm-workspace.yaml
```

## Patterns obligatoires (source : Dust & n8n)
1. **Resource Pattern** — Jamais exposer un modèle Prisma brut. Toujours via une classe Resource avec permissions.
2. **Lifecycle Hooks** — agent.before / agent.after pour le logging, cost tracking, notifications.
3. **Credential Encryption** — AES-256 pour TOUS les credentials. Redaction côté frontend.
4. **Error Type Hierarchy** — ScanError, AgentExecutionError, ConnectorError, CredentialError.
5. **Config @Env() + Zod** — L'app refuse de démarrer si la config est invalide.
6. **AI Event Logging** — Chaque appel LLM loggé (model, tokens, cost, latency, agent_id).
7. **SSE via Redis PubSub** — Streaming des réponses agents, PAS WebSocket.
8. **maxStepsPerRun** — Guard-rail coût sur chaque template d'agent (défaut: 5).
9. **Graceful Shutdown** — 30s timeout, aucune exécution coupée mid-run.

## Conventions
- Namespace packages : `@nodebase/`
- Commits : Conventional Commits (feat:, fix:, chore:, refactor:)
- Pas de `any` TypeScript
- Zod pour toute validation (API input, config, LLM output)
- nanoid pour les IDs publics
- Fichiers en kebab-case
- Exports nommés (pas de default exports)
```

### 3. Copier le idea_scoping_v6.md dans .claude/

C'est le fichier qu'on vient de finaliser. Claude Code pourra le consulter 
pour comprendre le produit, le scan, les templates, l'eval layer, etc.

### 4. Lancer Claude Code

```bash
cd nodebase
claude   # ou ouvrir VS Code avec l'extension Claude
```

Claude Code lira automatiquement `.claude/CLAUDE.md` au démarrage.
