# Analyse Technique Deep Dive — Dust & n8n
## Stack, Patterns, Architecture, Leçons Actionnables

---

# PARTIE 1 : DUST — Dissection complète

---

## 1.1 Stack technique exacte

**Langages :** TypeScript 90.3% | Rust 8.5% | JavaScript 0.8% | Shell 0.2% | CSS 0.1% | PLpgSQL 0.1%

**Base de données :** PostgreSQL (via Sequelize ORM) — pas Prisma, pas TypeORM. Dust utilise Sequelize avec TypeScript decorators pour les modèles. Les migrations sont dans `connectors/migrations/` avec des fichiers `.ts` et `.sql` séparés.

**Cache / Real-time :** Redis — utilisé pour :
- PubSub pour le streaming d'événements en temps réel (conversations, agent responses)
- Advisory locks PostgreSQL pour prévenir les race conditions sur les messages concurrents
- Session management

**Orchestration :** Temporal Cloud (managed, pas self-hosted)
- 10M+ activités/jour en production
- Chaque connecteur a son propre namespace Temporal
- Workers Temporal séparés par type de connecteur
- Signaux Temporal pour la communication inter-workflow (ex: `googleDriveFullSync` peut envoyer un signal à `incrementalSync`)

**Auth :** Auth0 — avec :
- Session-based auth pour le frontend (cookies)
- API keys pour l'accès programmatique
- System keys pour la communication inter-services
- Classe `Authenticator` centralisée (`front/lib/auth.ts`) qui unifie les 3 méthodes
- Support SSO enterprise (SAML)
- Domain auto-join (les users avec @entreprise.com rejoignent auto le workspace)
- Invitation system avec JWT tokens

**Frontend :** Next.js (Pages Router, pas App Router) — confirmé par la structure `front/pages/api/`. Le front utilise SWR pour le data fetching (pas React Query).

**Design System :** `sparkle/` — package interne avec composants React réutilisables. Partagé entre le frontend principal et l'extension Chrome.

**Search :** Elasticsearch — confirmé par `elasticsearch.Dockerfile` à la racine. Utilisé pour l'indexation et la recherche full-text des documents ingérés.

**SDK :** `@dust-tt/client` sur npm — utilise :
- Pattern `Result<T, E>` pour le error handling (Ok/Err, pas try/catch)
- Zod pour la validation runtime des types
- Streaming via SSE pour les réponses d'agents

**Linting :** ESLint avec un **plugin custom** `eslint-plugin-dust/` — ils ont écrit leurs propres règles ESLint spécifiques à leur codebase.

**Dev Tools :** `.junie/` (JetBrains AI assistant config), `.vscode/` (VS Code workspace settings), `.husky/` (git hooks pre-commit).

**Infra :** Docker multi-container (`docker-compose.yml`), Elasticsearch Dockerfile séparé, `prodbox/` pour l'environnement de production/debug.

**→ LEÇON :** Dust a un ESLint plugin CUSTOM. C'est un signal de maturité engineering — ils enforçent des patterns spécifiques à leur domaine au niveau du linter. Pour nous : écrire des règles ESLint custom pour forcer l'usage du `BaseAgentConnector` interface, empêcher les `any` types dans les modèles agents, etc.

---

## 1.2 Architecture des données — Modèles Sequelize

**Resource Pattern :** Dust utilise un pattern `*Resource` pour encapsuler les modèles Sequelize :
- `SpaceResource` (`front/lib/resources/space_resource.ts`)
- `GroupResource` (`front/lib/resources/group_resource.ts`)
- `DataSourceResource` (`front/lib/resources/data_source_resource.ts`)
- `DataSourceViewResource` (`front/lib/resources/data_source_view_resource.ts`)
- `ConnectorResource` (dans le service connectors)

Ce pattern ajoute une couche d'abstraction au-dessus de Sequelize : permissions checking, serialization, business logic. Les Resources ne sont PAS des modèles bruts — ils encapsulent l'accès aux données avec le contexte de l'utilisateur.

**Hiérarchie Workspace → Space → Group :**
- **Workspace** : unité organisationnelle top-level (= une entreprise)
- **Space** : conteneur de données dans un workspace (3 types par défaut : system, conversations, global)
- **Group** : ensemble d'utilisateurs avec des permissions. Le "global group" inclut automatiquement tous les membres du workspace.
- **DataSource** : source de données connectée (Google Drive folder, Slack channel, etc.)
- **DataSourceView** : vue filtrée d'une DataSource, attachée à un Space via un Group

**Modèles Agent :**
- `AgentConfiguration` : config complète d'un agent (instructions, model settings, actions)
- `AgentAction` : action disponible pour un agent (search, browse, run_dust_app, run_agent)
- `GlobalAgentSettings` : paramètres des agents globaux pré-configurés
- `GroupAgent` : liaison agent ↔ group pour les permissions (`front/lib/models/assistant/group_agent.ts`)

**Modèles Conversation :**
- `Conversation` : métadonnées (visibility, titre)
- `UserMessage` / `AgentMessage` / `ContentFragment` : types de messages
- `AgentAction` models séparés par type : `dust_app_run.ts`, etc.

**Modèles Connector (par service) :**
- `connectors/src/lib/models/google_drive.ts` : GoogleDriveFiles, GoogleDriveFolders, GoogleDriveWebhooks
- `connectors/src/lib/models/slack.ts` : SlackChannels, SlackMessages, SlackConfigurations
- `connectors/src/lib/models/github.ts` : GithubInstallations, GithubRepos, GithubIssues, GithubDiscussions, GithubCodeFiles

**→ LEÇON :** Le pattern Resource est puissant. Au lieu d'exposer les modèles Prisma bruts dans les routes API, envelopper chaque modèle dans une classe Resource qui :
1. Vérifie les permissions avant tout accès
2. Sérialise proprement pour l'API
3. Encapsule la business logic
4. Cache les requêtes fréquentes

Pour nous : `ScanResultResource`, `AgentTemplateResource`, `ConnectorResource`, `WorkspaceResource`.

---

## 1.3 Système d'agents — Architecture détaillée

**Agent Configuration Model :**
```
AgentConfiguration {
  sId: string (short ID, public-facing)
  name: string
  description: string
  instructions: string (prompt en langage naturel)
  model: {
    providerId: string ("openai", "anthropic", "google_ai_studio")
    modelId: string ("gpt-4-turbo", "claude-3-opus", etc.)
    temperature: number (0-1)
  }
  maxStepsPerRun: number (défaut: 3)
  visualizationEnabled: boolean
  actions: AgentAction[]  // search, browse, dust_app_run, tables_query, run_agent
  scope: "workspace" | "published" | "private"
}
```

**Agent Actions disponibles :**
1. **RetrievalAction** : recherche sémantique dans les DataSources connectées
2. **DustAppRunAction** : exécute un "Dust App" (workflow custom avec code)
3. **TablesQueryAction** : query SQL sur des tables structurées (Google Sheets, CSV, etc.)
4. **BrowseAction** : navigation web (fetch + parse de pages)
5. **RunAgentAction** : appel à un autre agent comme tool (max depth: 4)
6. **ProcessAction** : traitement de données (extraction, transformation)
7. **WebsearchAction** : recherche web

**Execution Flow :**
1. User poste un message avec `@agent` mention
2. `postUserMessage()` crée le message et identifie les agents mentionnés
3. Pour chaque agent : `runAgent()` → crée un `AgentMessage`
4. L'agent génère une réponse via le LLM
5. Si le LLM décide d'utiliser un tool → exécution de l'action correspondante
6. Résultat de l'action injecté dans le contexte → nouvelle itération LLM
7. Boucle jusqu'à réponse finale OU `maxStepsPerRun` atteint
8. Tous les événements sont streamés via Redis PubSub → SSE vers le frontend

**Model Configuration :** (`SUPPORTED_MODEL_CONFIGS`)
- OpenAI : GPT-4 Turbo, GPT-4o, o1-preview, o1-mini
- Anthropic : Claude 3 Opus, Claude 3.5 Sonnet, Claude 3 Haiku
- Google : Gemini 1.5 Pro, Gemini 1.5 Flash
- Avec pour chaque : context size, temperature range, capabilities (vision, reasoning, etc.)
- Séparation `USED_MODEL_CONFIGS` (models exposés aux users) vs `REASONING_MODEL_CONFIGS` (models avec thinking blocks)

**Global Agents :** Agents pré-configurés disponibles dans tous les workspaces :
- `@dust` : agent généraliste utilisant toutes les DataSources du workspace
- `@gpt4`, `@claude`, `@gemini` : wrappers directs autour des LLMs
- Gérés via `GlobalAgentSettings` dans la DB, pas hardcodés

**→ LEÇONS CLÉS :**

1. **`maxStepsPerRun` est critique** — c'est le guard-rail principal contre l'explosion de coûts. Dust met 3. Nous devrions mettre 5 pour nos cas multi-source mais avec un monitoring strict du nombre moyen de steps par exécution.

2. **Les actions sont des modules séparés** — chaque type d'action a son propre fichier, ses propres modèles DB, son propre flow d'exécution. C'est extensible : ajouter une nouvelle action = ajouter un module, pas modifier le core.

3. **L'agent NE choisit PAS entre 16 tools** — la philosophie Dust est de donner des instructions précises et des tools spécifiques à chaque agent. Un agent de customer support a des actions search (documentation) + browse (web) + tables_query (CRM). Il n'a PAS accès à run_dust_app ou process. Cette restriction par design est clé pour la fiabilité.

4. **Le streaming est via Redis PubSub, pas WebSocket** — plus simple à scaler. Le frontend écoute un endpoint SSE, le backend publie les événements sur un channel Redis dédié à la conversation. Pas besoin de gérer des connexions WebSocket persistantes.

---

## 1.4 Système de permissions — Spaces & Groups

**Architecture :**
```
Workspace
  ├── Space: "System" (internal, pas visible)
  ├── Space: "Conversations" (conversations privées)
  ├── Space: "Global" (accessible à tous)
  ├── Space: "Engineering" (custom)
  │     ├── Group: "Engineering Team"
  │     │     ├── User: Alice
  │     │     └── User: Bob
  │     ├── DataSource: GitHub Connector
  │     └── Agent: @code-reviewer
  └── Space: "Sales" (custom)
        ├── Group: "Sales Team"
        ├── DataSource: HubSpot Connector
        └── Agent: @deal-assistant
```

**Permission Model :**
- `requestedPermissions()` dans `SpaceResource` définit les patterns de permissions par type de space
- Les permissions sont vérifiées via l'`Authenticator` à chaque requête API
- Un agent dans le Space "Sales" ne peut PAS accéder aux DataSources du Space "Engineering"
- Le "Global" group est spécial : tous les membres du workspace y sont automatiquement

**→ LEÇON :** Ce modèle Space/Group est exactement ce dont on a besoin pour l'isolation par persona. Space "Ventes" = Thomas. Space "Support" = Julien. Space "RH" = Sophie. Les agents et connecteurs sont scopés par Space. Un agent Sales ne voit pas les données Support.

---

## 1.5 Slack Integration — Pattern d'intégration canal

**Architecture bot :**
- `botAnswerMessage()` (736 lignes) : point d'entrée pour tous les messages
- Détection de syntaxe `~agentname` pour invoquer un agent spécifique
- Fallback vers les Global Agents si pas de mention spécifique
- Thread history récupéré et attaché comme contexte
- Streaming de la réponse directement dans le thread Slack

**Rate limiting :**
- Mécanisme de backoff pour respecter les rate limits de l'API Slack
- Messages mis à jour en batch (pas token par token) pour éviter les 429

**Citations :**
- `connectors/src/connectors/slack/chat/citations.ts` : système de citations avec liens vers les sources
- `connectors/src/connectors/slack/chat/blocks.ts` : formatting des réponses en Slack Blocks

**→ LEÇON :** L'intégration Slack de Dust est un pattern complet pour "l'agent dans le canal". Pour nous, c'est la roadmap de l'intégration Slack/Teams future. Points clés : le backoff mechanism, le batch update des messages, et le système de citations.

---

## 1.6 Core Rust — Performance critique

Le `core/` en Rust gère :
- **Document chunking** : découpage intelligent des documents en chunks pour embeddings
- **Embeddings computation** : vectorisation des chunks
- **Search engine** : recherche sémantique dans les vecteurs
- **Data source management** : CRUD sur les documents indexés

**Pourquoi Rust ?** À 10M+ activités Temporal/jour, le chunking et l'embedding de milliers de documents simultanés en TypeScript serait trop lent et consommerait trop de mémoire. Le Rust leur donne ~10x les performances pour le data processing intensif.

**→ LEÇON :** On n'a PAS besoin de Rust Day 1. Notre volume sera 1000x inférieur à Dust. Mais architecturer le scan engine comme un service séparé (même en TypeScript) pour pouvoir le réécrire en Rust/Go plus tard si le volume l'exige.

---

# PARTIE 2 : N8N — Dissection complète

---

## 2.1 Stack technique exacte

**Langages :** TypeScript 100% (frontend + backend + packages)

**Runtime :** Node.js 22.16+ (LTS), pnpm 9.x, Turbo pour les builds

**Base de données :** PostgreSQL (recommandé pour production) + SQLite (dev) + MySQL/MariaDB (supportés) — via TypeORM (pas Sequelize, pas Prisma). Les entités sont dans `packages/@n8n/db/`.

**Queue :** Bull (Redis-backed) pour le mode queue. Config détaillée :
- Job priority (1 = highest)
- Concurrency configurable par worker (défaut: 10)
- Stall detection avec Bull
- Grace period de 30s pour shutdown propre (`N8N_GRACEFUL_SHUTDOWN_TIMEOUT`)

**Frontend :** Vue 3 + Vite + Pinia (state management). Design system custom dans `packages/@n8n/design-system/` avec composants Vue réutilisables.

**API :** Express.js avec pattern Controller → Service → Repository. Decorators custom :
- `@RestController('/path')` pour les controllers
- `@Get()`, `@Post()`, `@Put()`, `@Delete()` pour les routes
- `@ProjectScope('workflow:read')` pour les permissions
- `@Body()`, `@Param()`, `@Query()` pour l'extraction de paramètres

**Dependency Injection :** Package `@n8n/di` custom avec `Container` singleton et décorateur `@Service()`. Tous les services sont des singletons injectés automatiquement.

**Configuration :** Package `@n8n/config` avec décorateurs :
- `@Env('VARIABLE_NAME')` pour mapper les env vars aux propriétés typées
- `@Nested()` pour organiser les configs en sous-classes
- Validation automatique via Zod
- Support `*_FILE` (ex: `DATABASE_PASSWORD_FILE=/run/secrets/db_password`)
- Précédence : Runtime DB settings > Env vars > *_FILE > Config files > Defaults

**Encryption :** `N8N_ENCRYPTION_KEY` (AES) pour tous les credentials stockés. Généré automatiquement dans `~/.n8n/encryption.key` si pas défini. DOIT être partagé entre tous les processus en mode queue.

**Auth :** JWT-based avec cookies. Support LDAP, SAML (enterprise). Système d'invitation par email.

**Task Runners :** Processus sidecar séparés pour l'exécution sandboxée de code :
- `JsTaskRunnerProcess` : exécution JavaScript isolée
- `PyTaskRunnerProcess` : exécution Python isolée
- Docker images séparées pour les task runners (`docker/images/runners/`)
- Communication via protocole interne

**CI/CD :** GitHub Actions avec Blacksmith runners (2-4 vCPU) :
- Parallel test execution (5 containers Cypress par défaut)
- Validation DB multi-backend (PostgreSQL, MySQL, MariaDB) avec tmpfs pour performance
- Visual regression via Chromatic pour le design system
- Concurrency groups qui annulent les runs obsolètes
- JUnit XML + Cobertura coverage reporters
- Multi-architecture Docker builds (AMD64 + ARM64)

**→ LEÇON :** Le système de configuration de n8n est remarquablement propre. Le pattern `@Env('VARIABLE_NAME')` avec validation Zod et support `*_FILE` est exactement ce qu'on devrait implémenter. Ça élimine toute la plomberie env var → config typée.

---

## 2.2 Workflow Execution Engine — Détails internes

**Classe principale :** `WorkflowExecute` dans `packages/core/src/execution-engine/workflow-execute.ts`

**Node Execution Loop :**
1. Le moteur identifie les nodes "root" (triggers, nodes sans input)
2. Pour chaque node prêt : crée un `ExecutionContext` (input data, credentials, paramètres)
3. Appelle `node.execute()` (programmatic) ou résout la config déclarative
4. Output data stocké dans `runExecutionData.resultData.runData[nodeName]`
5. Identifie les nodes downstream → les marque comme prêts
6. Répète jusqu'à ce que tous les nodes soient exécutés ou erreur

**Disabled Nodes :** Les nodes désactivés passent les données du premier input directement au output — ils sont transparents dans le flow. C'est un pattern malin pour le debugging.

**Lifecycle Hooks :** `ExecutionLifecycleHooks` permet d'injecter du comportement à chaque étape :
- `workflowExecuteBefore` : avant le début
- `nodeExecuteBefore` / `nodeExecuteAfter` : autour de chaque node
- `workflowExecuteAfter` : après la fin (succès ou erreur)
- `sendResponse` : envoi de la réponse HTTP (pour les webhook workflows)
- Hook `hookFunctionsPush()` : pousse les updates d'exécution vers le frontend en temps réel

**Error Handling :**
- Erreurs par node : capturées et stockées dans `runData` avec le node source
- Erreurs workflow-level : capturées par le runner
- Close functions : chaque node peut enregistrer des fonctions de cleanup qui s'exécutent TOUJOURS, même en cas d'erreur
- En mode queue : Bull peut marquer des exécutions réussies comme "stalled" → `processError()` gère ce cas

**Active Executions :** `ActiveExecutions` classe qui track toutes les exécutions en cours dans le processus. Méthodes : register, track, stop, finalize. Permet le graceful shutdown (attendre que les exécutions en cours se terminent).

**Execution Modes :**

| Mode | Comment ça marche | Quand l'utiliser |
|------|-------------------|------------------|
| **Regular** | Exécution in-process, tout dans le main server | Dev, single-instance, < 50 workflows actifs |
| **Queue** | Main enqueue dans Bull/Redis, Workers consomment | Production, scaling horizontal, > 50 workflows |
| **Multi-main** | Plusieurs instances main avec leader election via Redis TTL | HA enterprise, zero-downtime deploys |

**Queue Architecture détaillée :**
```
Main Process (API + UI + Triggers)
  │
  ├── Enqueue job dans Bull queue (Redis)
  │     priority: 1 (highest) à N
  │     data: { executionId, workflowData }
  │
  └── Bull Queue (Redis)
        │
        ├── Worker 1 (concurrency: 10)
        │     └── ScalingService → JobProcessor → WorkflowExecute
        ├── Worker 2 (concurrency: 10)
        └── Worker N
              └── Communication via job.progress() → Redis pub/sub
```

**Worker Communication :**
- Workers communiquent avec le main via `job.progress()` de Bull
- Messages publiés sur Redis pub/sub
- Types de messages : execution started, execution completed, execution error
- Le main relaye ces messages au frontend via WebSocket

**→ LEÇONS :**

1. **Le pattern Bull queue est exactement BullMQ** — n8n utilise Bull (prédécesseur de BullMQ). Nous utiliserons BullMQ (version moderne, mêmes concepts). La migration est triviale.

2. **Le lifecycle hooks pattern est brillant** — plutôt que de hardcoder le monitoring/logging/notifications dans le moteur d'exécution, n8n les injecte via des hooks. Pour nous : injecter l'AI event logging, le cost tracking, et les notifications utilisateur via des hooks.

3. **Le graceful shutdown est non-négociable** — `N8N_GRACEFUL_SHUTDOWN_TIMEOUT=30` assure que les exécutions en cours se terminent proprement avant le redéploiement. Sans ça, des scans ou des actions d'agents seraient coupés mid-execution.

4. **Le multi-main avec leader election** — n8n utilise un TTL Redis key pour le leader election. Simple et efficace. On peut l'implémenter pour les scheduled scans (un seul processus déclenche les scans, les autres sont en standby).

---

## 2.3 Node System — Comment construire des intégrations

**Interface `INodeType` :**
```typescript
interface INodeType {
  description: INodeTypeDescription;  // metadata, paramètres, credentials
  execute?(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
  // OU
  methods?: { ... }  // pour le style déclaratif
}
```

**Style Déclaratif (recommandé pour les APIs REST) :**
```typescript
// Pas de code execute() — juste une config JSON
{
  description: {
    displayName: 'HubSpot',
    name: 'hubspot',
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: [
          { name: 'Create Contact', value: 'createContact' },
          { name: 'Get Deal', value: 'getDeal' },
        ]
      }
    ],
    requestDefaults: {
      baseURL: 'https://api.hubspot.com',
      headers: { 'Content-Type': 'application/json' }
    }
  }
}
```

Le framework gère automatiquement : requêtes HTTP, pagination, rate limiting, retry, parsing de la réponse.

**Style Programmatic (pour la logique complexe) :**
```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const operation = this.getNodeParameter('operation', 0);
  
  for (let i = 0; i < items.length; i++) {
    if (operation === 'createContact') {
      const response = await this.helpers.httpRequest({
        method: 'POST',
        url: 'https://api.hubspot.com/contacts/v1/contact',
        body: { ... }
      });
      returnData.push({ json: response });
    }
  }
  return [returnData];
}
```

**Node Data Flow :**
- Tous les data entre nodes conforment à `INodeExecutionData` : `{ json: {}, binary?: {} }`
- Multiple connection types : Main (data flow), AiTool, AiAgent, AiMemory, AiOutputParser, AiDocument, AiEmbedding, AiVectorStore, AiRetriever, AiTextSplitter
- Les connexions AI utilisent des types spécifiques pour le type-checking au design-time

**Expression System :**
- Syntax `{{ }}` avec JavaScript complet à l'intérieur
- Variables spéciales : `$input`, `$json`, `$execution`, `$workflow`, `$node`
- `WorkflowDataProxy` créé fresh pour chaque exécution de node
- Extensions custom pour strings, dates, numbers

**Credential System détaillé :**
- Chaque type de credential est défini comme une classe avec `ICredentialType`
- Encryption : `Credentials` class dans `n8n-core` — AES avec `N8N_ENCRYPTION_KEY`
- Redaction : avant envoi au frontend, `redact()` remplace les passwords par des sentinelles
- OAuth2 : flow complet avec refresh automatique, `oauthTokenData` jamais exposé au frontend
- Test intégré : endpoint `/credentials/:id/test` qui vérifie la validité
- Anti-tampering : vérification côté serveur que le user n'a pas modifié des nodes avec des credentials auxquelles il n'a pas accès

**Community Nodes :**
- Tag npm `n8n-community-node-package`
- Starter template officiel : `n8n-nodes-starter`
- Installation via `npm install` dans l'instance n8n
- Hot reload : le `dev:ai` script ne watch que les packages AI

**→ LEÇONS :**

1. **Le style déclaratif élimine 80% du boilerplate** — pour un connecteur HubSpot, Pipedrive, Stripe standard, on n'a pas besoin de code. Juste un JSON qui décrit les endpoints. Le framework gère la plomberie.

2. **Les connection types AI sont une abstraction puissante** — séparer les connexions par type (AiTool, AiMemory, AiVectorStore) permet au type system de vérifier que les bons composants sont connectés ensemble. Pour nous : typer les connexions entre scan engine, agent engine, et connectors.

3. **Le credential test intégré** — quand un user connecte HubSpot, on fait un appel API de test immédiat et on montre le résultat. Pas d'attente anxieuse "est-ce que ma clé API est bonne ?".

---

## 2.4 AI / LangChain Integration — Détails

**Package :** `packages/@n8n/nodes-langchain` (séparé du nodes-base)

**Nodes Agent :**
- `Agent` node : agent conversationnel avec tools
- `ConversationalAgent` : agent avec mémoire de conversation
- Support streaming des reasoning steps de l'agent

**Nodes LLM :**
- OpenAI, Anthropic, Google AI, Mistral, Ollama, Azure OpenAI, Groq, Cohere
- `ModelSelector` node : routing dynamique basé sur la complexité de la query

**Nodes Tools :**
- `toolWorkflow` : workflow entier comme tool d'agent (BRILLANT)
- `toolHttpRequest` : wrapper HTTP pour les APIs
- `toolCode` : exécution JavaScript/Python custom
- `McpClientTool` : connexion à des MCP servers
- `ToolExecutor` : exécution directe de tools sans agent (pour le testing)

**Nodes Memory :**
- Buffer Memory, Window Buffer, Summary Memory
- Backends : Postgres, Redis, Zep, Motorhead

**Nodes Vector Store :**
- Pinecone, Qdrant, Weaviate, Supabase, Chroma, Milvus, PGVector

**Nodes RAG :**
- Document loaders, text splitters, embeddings, retrievers
- Pipeline complète : Document → Split → Embed → Store → Retrieve → Augment → Generate

**Guardrails :**
- `Guardrails.node.js` : content filtering et safety checks
- Validations des outputs LLM AVANT qu'ils arrivent downstream
- Customizable rules

**AI Events :**
- `logAiEvent()` helper method sur `IExecuteFunctions`
- Events trackés : `ai-messages-retrieved-from-memory`, `ai-tool-called`, `ai-output-parsed`, `ai-response-generated`
- Intégration telemetry (Rudderstack/PostHog) pour monitoring usage et coûts

**Chat Hub :**
- Interface multi-LLM dans le UI
- Génère dynamiquement des workflows n8n pour chaque query
- Crée les nodes agent, tool, et memory à la volée
- Credential selector modal pour choisir quel LLM utiliser

**AI Workflow Builder (enterprise) :**
- Génère des workflows à partir de descriptions en langage naturel
- Package séparé : `packages/@n8n/ai-workflow-builder.ee/`

**→ LEÇONS :**

1. **`toolWorkflow` est notre pattern d'agent composition** — un agent "Deal Revival" peut appeler un mini-workflow "fetch HubSpot deal → check emails → check calendar → draft follow-up" comme un seul tool. Le workflow est testable indépendamment, réutilisable par plusieurs agents.

2. **`ModelSelector` pour le cost optimization** — router "résume ce ticket" vers Haiku et "rédige une proposition commerciale" vers Sonnet. n8n le fait au niveau node, nous le ferons au niveau agent template.

3. **`logAiEvent()` est non-négociable** — chaque appel LLM doit être tracké. Sans ça, impossible de savoir combien coûte chaque agent, quel template consomme le plus, où optimiser. n8n l'a intégré nativement — on doit faire pareil.

4. **Le Guardrails node valide notre eval L1** — n8n a un mécanisme de validation inline des outputs. Notre eval L1 (assertions : email contient objet, nom du contact est correct, pas de données sensibles) est exactement ce pattern, en plus sophistiqué.

---

## 2.5 Architecture patterns de n8n à adopter

**1. Dependency Injection avec @Service() :**
```typescript
@Service()
class ScanService {
  constructor(
    private readonly connectorService: ConnectorService,
    private readonly agentService: AgentService,
    private readonly queueService: QueueService,
  ) {}
}
```
Tous les services sont des singletons auto-injectés. Testable (mock les dépendances).

**2. Controller decorators :**
```typescript
@RestController('/api/scans')
class ScanController {
  @Post('/')
  @ProjectScope('scan:execute')
  async createScan(@Body() body: CreateScanDto): Promise<ScanResult> { ... }
}
```

**3. Configuration typée :**
```typescript
class ScanConfig {
  @Env('SCAN_INTERVAL_MINUTES')
  interval: number = 60;

  @Env('SCAN_MAX_SIGNALS')  
  maxSignals: number = 23;
}
```

**4. Error Type Hierarchy :**
n8n a des types d'erreurs spécifiques : `NodeOperationError`, `NodeConnectionError`, `WorkflowActivationError`. Pas de `throw new Error("something went wrong")`. Chaque erreur porte le contexte du node, de l'exécution, et du type de problème.

**→ LEÇON :** Implémenter des error types spécifiques dès le Day 1 :
- `ScanError` (avec signal_id, connector_id, details)
- `AgentExecutionError` (avec agent_id, step_number, action_type)
- `ConnectorError` (avec connector_type, api_endpoint, status_code)
- `CredentialError` (avec credential_id, error_type: expired|invalid|revoked)

---

# PARTIE 3 : SYNTHÈSE TECHNIQUE — Décisions d'architecture

---

## 3.1 Tableau de décision stack

| Composant | Dust utilise | n8n utilise | Notre choix | Justification |
|-----------|-------------|-------------|-------------|---------------|
| **Runtime** | Node.js + Rust | Node.js 22 | **Node.js 22** | Pas de volume justifiant Rust |
| **Framework frontend** | Next.js (Pages) | Vue 3 + Vite | **Next.js (App Router)** | SSR, API routes, notre expertise |
| **State mgmt frontend** | SWR | Pinia | **TanStack Query** | Cache, mutations, invalidation |
| **ORM** | Sequelize | TypeORM | **Prisma** | Type-safety supérieure, migrations auto |
| **DB** | PostgreSQL | PostgreSQL/SQLite/MySQL | **PostgreSQL** (Supabase) | JSON columns, full-text search, managed |
| **Queue** | Temporal Cloud | Bull (Redis) | **BullMQ** (Redis) | Modern Bull, job priorités, retries |
| **Cache / PubSub** | Redis | Redis | **Redis** (Upstash ou Supabase) | SSE streaming, scan status, rate limiting |
| **Auth** | Auth0 | JWT custom | **Supabase Auth** ou **Auth0** | OAuth social, magic link, pas de code custom |
| **Search** | Elasticsearch | N/A | **PostgreSQL full-text** Day 1 | pg_trgm + tsvector suffisent pour notre volume |
| **Config** | .env manual | @Env() decorators + Zod | **@Env() + Zod** (copier le pattern n8n) | Type-safe, validation, support *_FILE |
| **Encryption credentials** | Service-level | AES N8N_ENCRYPTION_KEY | **AES-256** | Non-négociable pour les clés API clients |
| **API style** | REST (Next.js API routes) | REST (Express + decorators) | **tRPC** ou **REST API routes** | End-to-end type safety |
| **Monorepo** | Workspaces Yarn | pnpm + Turbo | **pnpm + Turbo** | Build parallèles, caching, shared types |
| **CI/CD** | GitHub Actions | GitHub Actions + Blacksmith | **GitHub Actions** | Standard, gratuit pour open-source |
| **Docker** | Multi-container compose | Multi-arch (AMD64+ARM64) | **Single Dockerfile** Day 1 | Complexité minimal, Railway/Render/Fly |
| **Monitoring** | Datadog | Prometheus metrics | **Sentry + custom events** Day 1 | Erreurs + AI cost tracking |
| **LLM** | Multi-provider (OpenAI, Anthropic, Google) | Multi-provider via LangChain | **Anthropic SDK direct** Day 1 | Claude only, pas de LangChain overhead |
| **Design system** | Sparkle (custom) | @n8n/design-system (Vue) | **shadcn/ui + Tailwind** | Rapide, customizable, React |

## 3.2 Patterns à implémenter Day 1

| Pattern | Source | Pourquoi critique |
|---------|--------|-------------------|
| **Resource Pattern** (models → resources avec permissions) | Dust | Sécurité by design, pas en afterthought |
| **BaseConnectorManager interface** | Dust | Chaque nouveau connecteur est prévisible |
| **Lifecycle Hooks** (scan.before, scan.after, agent.before, agent.after) | n8n | Monitoring/logging injectable sans modifier le core |
| **Credential encryption + redaction** | n8n | Les PME nous confient leurs clés API |
| **Error Type Hierarchy** | n8n | Debug 10x plus rapide qu'avec des Error("...") génériques |
| **Config @Env() + Zod** | n8n | Zéro bug de config en production |
| **AI Event Logging** (model, tokens, cost, latency) | n8n | Impossible d'optimiser ce qu'on ne mesure pas |
| **SSE via Redis PubSub** (pas WebSocket) | Dust | Simple à scaler, pas de connexion persistante à gérer |
| **maxStepsPerRun** (limite d'itérations agent) | Dust | Guard-rail coût, configurable par template |
| **Graceful Shutdown** | n8n | Pas de scans/actions coupés mid-execution |

## 3.3 Patterns à implémenter Month 2-3

| Pattern | Source | Pourquoi pas Day 1 |
|---------|--------|--------------------|
| **Toolset dynamique** (agents auto-discover tools) | Dust | Nécessite 3+ connecteurs d'abord |
| **Sub-agent composition** (max depth 4) | Dust | Les agents simples doivent marcher d'abord |
| **toolWorkflow** (mini-workflows comme tools) | n8n | Complexité d'orchestration élevée |
| **Declarative connector format** (JSON, pas code) | n8n | Les 6 premiers connecteurs seront custom |
| **Queue mode** avec workers séparés | n8n | Single-instance suffit pour < 100 users |
| **RBAC par Space/Group** | Dust | Single-tenant suffit Day 1 |
| **Community agent marketplace** | n8n | Pas de communauté Day 1 |

## 3.4 Anti-patterns identifiés — À ne PAS faire

| Anti-pattern | Qui le fait | Pourquoi c'est un problème |
|-------------|-------------|---------------------------|
| **Sequelize en 2025** | Dust | Type-safety inférieure à Prisma, API moins ergonomique. Dust le fait car ils ont commencé avant Prisma. On prend Prisma. |
| **Pages Router Next.js** | Dust | Deprecated en faveur de l'App Router. On prend App Router directement. |
| **LangChain comme abstraction** | n8n | Overhead significatif, debugging opaque, abstractions qui leakent. On utilise l'Anthropic SDK directement — moins de couches = moins de bugs. |
| **Éditeur visuel de workflow** | n8n | Notre cible = PME non-tech. Un éditeur visuel = courbe d'apprentissage. Templates plug-and-play = zéro courbe d'apprentissage. |
| **Fair-code / self-hosted** | n8n | SaaS only pour nous. Pas de support client self-hosted, pas de debt Docker/K8s. |
| **Multi-DB support** (PostgreSQL + MySQL + SQLite) | n8n | Complexité massive pour zéro bénéfice. PostgreSQL only. |
| **Vue.js** | n8n | React/Next.js a un écosystème plus large, notre expertise est là. |

---

## 3.5 Architecture cible détaillée

```
nareo-platform/ (pnpm monorepo + Turbo)
│
├── apps/
│   ├── web/                          # Next.js 14+ App Router
│   │   ├── app/                      # Routes (dashboard, scan, agents, settings)
│   │   ├── components/               # UI components (shadcn/ui + custom)
│   │   └── lib/                      # Client-side utils, hooks, API client
│   │
│   └── api/                          # Separate API server (si needed)
│         └── (ou intégré dans Next.js API routes)
│
├── packages/
│   ├── @nareo/types/                 # Interfaces partagées
│   │   ├── agent.ts                  # AgentTemplate, AgentExecution, AgentAction
│   │   ├── scan.ts                   # ScanResult, Signal, SignalCategory
│   │   ├── connector.ts             # ConnectorConfig, ConnectorStatus
│   │   ├── credential.ts            # CredentialType, EncryptedCredential
│   │   └── errors.ts                # ScanError, AgentError, ConnectorError
│   │
│   ├── @nareo/db/                    # Prisma schema + generated client
│   │   ├── prisma/
│   │   │   └── schema.prisma         # Workspace, User, Agent, Scan, Connector, Credential
│   │   └── src/
│   │       └── resources/            # Resource pattern (ScanResource, AgentResource, etc.)
│   │
│   ├── @nareo/core/                  # Moteur d'exécution
│   │   ├── scan-engine/              # Scan execution (signals detection)
│   │   ├── agent-engine/             # Agent execution (LLM calls, actions)
│   │   ├── eval/                     # L1 assertions, L2 scoring, L3 human review
│   │   └── hooks/                    # Lifecycle hooks (before/after scan, agent, action)
│   │
│   ├── @nareo/connectors/           # Connecteurs
│   │   ├── base.ts                   # BaseAgentConnector interface
│   │   ├── hubspot/                  # HubSpot: deals, contacts, activities
│   │   ├── pipedrive/                # Pipedrive: deals, contacts, activities
│   │   ├── zendesk/                  # Zendesk: tickets, SLAs, satisfaction
│   │   ├── stripe/                   # Stripe: invoices, subscriptions, payments
│   │   ├── gmail/                    # Gmail: emails, threads
│   │   └── calendar/                 # Google Calendar: events, availability
│   │
│   ├── @nareo/queue/                 # BullMQ workers
│   │   ├── scan-worker.ts            # Scheduled scans, on-demand scans
│   │   ├── agent-worker.ts           # Agent execution (async)
│   │   └── sync-worker.ts            # Connector data sync (incremental)
│   │
│   ├── @nareo/config/                # Configuration typée
│   │   ├── env.ts                    # @Env() decorator + Zod validation
│   │   └── index.ts                  # GlobalConfig (database, queue, llm, scan)
│   │
│   ├── @nareo/crypto/               # Credential encryption
│   │   ├── encrypt.ts                # AES-256 encrypt/decrypt
│   │   └── redact.ts                 # Redaction pour le frontend
│   │
│   └── @nareo/ai/                    # LLM integration
│       ├── client.ts                 # Anthropic SDK wrapper
│       ├── events.ts                 # AI event logging (model, tokens, cost)
│       ├── style-learner.ts          # Style adaptation par user
│       └── tiering.ts                # Model selection (Haiku/Sonnet/Opus)
│
├── templates/                        # Agent templates (JSON + prompt)
│   ├── sales/
│   │   ├── deal-revival.json
│   │   ├── lead-qualification.json
│   │   └── follow-up-drafter.json
│   ├── support/
│   ├── marketing/
│   ├── hr/
│   ├── finance/
│   └── operations/
│
├── turbo.json                        # Build pipeline config
├── pnpm-workspace.yaml               # Workspace config
├── .github/workflows/                # CI/CD
└── docker/                           # Dockerfiles
```

---

## 3.6 Métriques engineering à tracker (inspirées des deux repos)

| Métrique | Source d'inspiration | Target |
|----------|---------------------|--------|
| **Build time** (full rebuild) | n8n Turbo caching | < 30s avec cache, < 2min cold |
| **Type coverage** | n8n strict TypeScript | 100% (zéro `any`) |
| **Test coverage** | n8n 80%+ | 70% Day 1, 85% Month 3 |
| **P95 scan latency** | Dust 10M activities/day | < 3s pour un scan 6-signal |
| **P95 agent execution** | Dust maxStepsPerRun:3 | < 8s pour un draft simple |
| **LLM cost per action** | n8n AI events | Tracker chaque appel, target < €0.05/draft |
| **Error rate** | Dust Datadog | < 0.5% scan failures, < 1% agent failures |
| **Connector health** | Dust connector lifecycle | 99.5% uptime per connector |
| **Deployment time** | n8n Docker CI | < 5min push → production |
| **Graceful shutdown** | n8n 30s timeout | 100% des scans in-flight complétés |
