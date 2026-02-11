# Inventaire Open Source — Dust & n8n
## Tout ce qu'ils utilisent que tu peux réutiliser

---

# 🏗️ INFRASTRUCTURE & BUILD

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **pnpm** | n8n | Package manager rapide avec workspaces natifs, deduplication agressive | ⭐⭐⭐ CRITIQUE — base du monorepo | https://pnpm.io |
| **Turborepo** | n8n | Build system monorepo : caching, parallel builds, task dependencies | ⭐⭐⭐ CRITIQUE — builds < 30s avec cache | https://turbo.build |
| **Docker** | les deux | Containerisation, multi-stage builds | ⭐⭐⭐ CRITIQUE — déploiement | https://docker.com |
| **GitHub Actions** | les deux | CI/CD, tests automatisés, Docker build+push | ⭐⭐⭐ CRITIQUE — pipeline | https://github.com/features/actions |
| **Husky** | Dust | Git hooks (pre-commit, pre-push) — lint avant chaque commit | ⭐⭐ utile — qualité code | https://github.com/typicode/husky |
| **Blacksmith** | n8n | Runners GitHub Actions plus rapides (2-4 vCPU) | ⭐ nice-to-have — optimisation CI | https://blacksmith.sh |

---

# 🗄️ BASE DE DONNÉES & ORM

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **PostgreSQL** | les deux | DB relationnelle principale — JSON columns, full-text search, advisory locks | ⭐⭐⭐ CRITIQUE — notre DB | https://postgresql.org |
| **Sequelize** | Dust | ORM Node.js avec migrations, modèles TypeScript | ❌ on prend Prisma (meilleur type-safety) | https://sequelize.org |
| **TypeORM** | n8n | ORM avec decorators TypeScript, migrations | ❌ on prend Prisma (même raison) | https://typeorm.io |
| **Prisma** | — | ORM moderne, schema-first, type-safe, migrations auto | ⭐⭐⭐ NOTRE CHOIX — meilleur DX | https://prisma.io |
| **pg** | n8n | Driver PostgreSQL natif pour Node.js | ⭐⭐ utile — si requêtes raw nécessaires | https://github.com/brianc/node-postgres |

---

# 🔴 REDIS & QUEUES

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **ioredis** | n8n | Client Redis Node.js performant — clustering, sentinel, pipelines | ⭐⭐⭐ CRITIQUE — notre client Redis | https://github.com/redis/ioredis |
| **Bull** | n8n | Job queue Redis — priority, retries, concurrency, rate limiting | ❌ on prend BullMQ (version moderne) | https://github.com/OptimalBits/bull |
| **BullMQ** | — | Successeur de Bull — meilleure API, TypeScript natif, flows, groups | ⭐⭐⭐ CRITIQUE — scans async, agent execution | https://bullmq.io |
| **cache-manager** | n8n | Abstraction de cache multi-backend (memory, Redis, etc.) | ⭐⭐ utile — cache API responses, scan results | https://github.com/node-cache-manager/node-cache-manager |

---

# 🌐 FRAMEWORK WEB & API

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **Next.js** | Dust | Framework React fullstack — SSR, API routes, App Router | ⭐⭐⭐ CRITIQUE — notre frontend+API | https://nextjs.org |
| **Express** | n8n | Framework HTTP minimaliste — routing, middleware | ⭐ possible — si API séparé du Next.js | https://expressjs.com |
| **helmet** | n8n | Headers de sécurité HTTP (CSP, HSTS, X-Frame-Options) | ⭐⭐⭐ CRITIQUE — sécurité baseline | https://helmetjs.github.io |
| **compression** | n8n | Gzip/Brotli des réponses HTTP | ⭐⭐ utile — performance | https://github.com/expressjs/compression |
| **express-rate-limit** | n8n | Rate limiting par IP/endpoint | ⭐⭐⭐ CRITIQUE — protection API | https://github.com/express-rate-limit/express-rate-limit |
| **http-proxy-middleware** | n8n | Proxy HTTP configurable | ⭐ si microservices | https://github.com/chimurai/http-proxy-middleware |
| **cookie-parser** | n8n | Parse des cookies HTTP | ⭐⭐ utile — sessions | https://github.com/expressjs/cookie-parser |
| **formidable** | n8n | Parse de formulaires multipart/file uploads | ⭐⭐ utile — upload de fichiers clients | https://github.com/node-formidable/formidable |
| **cors** | n8n | Gestion des CORS headers | ⭐⭐ utile | https://github.com/expressjs/cors |

---

# 🔐 AUTHENTIFICATION & SÉCURITÉ

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **Auth0** | Dust | Auth-as-a-Service — OAuth, SSO SAML, MFA, domain auto-join | ⭐⭐ option — si on quitte Supabase Auth | https://auth0.com |
| **jsonwebtoken** | n8n | Création/vérification de JWT tokens | ⭐⭐⭐ CRITIQUE — tokens API, invitations | https://github.com/auth0/node-jsonwebtoken |
| **bcryptjs** | n8n | Hashage de mots de passe | ⭐⭐ utile — si auth custom | https://github.com/dcodeIO/bcrypt.js |
| **openid-client** | n8n | Client OpenID Connect / OAuth 2.0 complet | ⭐⭐ utile — connexion Google/Microsoft | https://github.com/panva/node-openid-client |
| **oauth-1.0a** | n8n | Signature OAuth 1.0a (pour les APIs legacy comme Twitter) | ⭐ si intégration X/Twitter | https://github.com/ddo/oauth-1.0a |
| **otpauth** | n8n | Génération/vérification de codes OTP (2FA) | ⭐⭐ utile — sécurité avancée | https://github.com/hectorm/otpauth |
| **csrf** | n8n | Protection CSRF tokens | ⭐⭐ utile — sécurité formulaires | https://github.com/pillarjs/csrf |
| **ldapts** | n8n | Client LDAP TypeScript (Active Directory) | ⭐ si clients enterprise AD | https://github.com/ldapts/ldapts |
| **infisical-node** | n8n | Secrets management (alternative à Vault) | ⭐⭐ utile — gestion secrets production | https://infisical.com |

---

# 🤖 IA & LLM

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **@anthropic-ai/sdk** | — | SDK officiel Anthropic — Claude API, streaming, tools | ⭐⭐⭐ CRITIQUE — notre LLM principal | https://github.com/anthropics/anthropic-sdk-typescript |
| **@langchain/core** | n8n | Framework LLM — agents, chains, memory, tools | ❌ trop d'overhead — SDK direct préféré | https://github.com/langchain-ai/langchainjs |
| **@langchain/anthropic** | n8n | Binding LangChain pour Claude | ❌ même raison | https://github.com/langchain-ai/langchainjs |
| **@langchain/openai** | n8n | Binding LangChain pour GPT | ❌ pas multi-LLM Day 1 | https://github.com/langchain-ai/langchainjs |
| **@langchain/community** | n8n | Intégrations communautaires LangChain (Ollama, Mistral, etc.) | ❌ pas Day 1 | https://github.com/langchain-ai/langchainjs |
| **tiktoken** | n8n | Tokenizer OpenAI — comptage de tokens | ⭐⭐ utile — estimer les coûts avant appel | https://github.com/openai/tiktoken |
| **zod** | les deux | Validation de schemas TypeScript runtime | ⭐⭐⭐ CRITIQUE — validation inputs/outputs, config, API | https://zod.dev |
| **zod-to-json-schema** | n8n | Convertit Zod schemas en JSON Schema | ⭐⭐ utile — documentation API auto | https://github.com/StefanTerdell/zod-to-json-schema |
| **jsonrepair** | n8n | Répare du JSON malformé (utile pour les outputs LLM) | ⭐⭐⭐ CRITIQUE — les LLMs génèrent souvent du JSON cassé | https://github.com/josdejong/jsonrepair |

---

# 📧 EMAIL & NOTIFICATIONS

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **nodemailer** | n8n | Envoi d'emails SMTP — pièces jointes, HTML, templates | ⭐⭐⭐ CRITIQUE — notifications, invitations, drafts | https://nodemailer.com |
| **handlebars** | n8n | Template engine — emails HTML, rapports | ⭐⭐ utile — templates d'emails | https://handlebarsjs.com |
| **express-handlebars** | n8n | Integration Handlebars avec Express | ⭐ si API séparé | https://github.com/express-handlebars/express-handlebars |

---

# 📊 MONITORING & OBSERVABILITÉ

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **@sentry/node** | n8n | Error tracking, performance monitoring, profiling | ⭐⭐⭐ CRITIQUE — erreurs en production | https://sentry.io |
| **@sentry/profiling-node** | n8n | Profiling Node.js en production | ⭐⭐ utile — identifier les bottlenecks | https://docs.sentry.io/platforms/node/profiling |
| **@rudderstack/rudder-sdk-node** | n8n | Analytics/telemetry backend (alternative Segment) | ⭐⭐ utile — tracking usage produit | https://rudderstack.com |
| **express-prom-bundle** | n8n | Metrics Prometheus pour Express (latence, erreurs, throughput) | ⭐⭐ utile — si Grafana dashboards | https://github.com/jochen-schweizer/express-prom-bundle |
| **isbot** | n8n | Détection de bots/crawlers dans les requêtes HTTP | ⭐⭐ utile — filtrer le trafic bot des analytics | https://github.com/nicedoc/isbot |

---

# 🔧 UTILITAIRES CORE

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **lodash** | les deux | Utilities JavaScript — deep clone, merge, debounce, throttle | ⭐⭐⭐ CRITIQUE — incontournable | https://lodash.com |
| **luxon** | n8n | Dates/times modernes (successeur de Moment.js) | ⭐⭐⭐ CRITIQUE — timezones, formatting | https://moment.github.io/luxon |
| **nanoid** | n8n | Générateur d'IDs uniques, court, URL-safe | ⭐⭐⭐ CRITIQUE — IDs publics (scan_abc123) | https://github.com/ai/nanoid |
| **axios** | les deux | Client HTTP — interceptors, retry, timeout | ⭐⭐⭐ CRITIQUE — appels APIs externes | https://axios-http.com |
| **dotenv** | n8n | Chargement de variables d'environnement depuis .env | ⭐⭐⭐ CRITIQUE — config locale | https://github.com/motdotla/dotenv |
| **flat** | n8n | Flatten/unflatten d'objets imbriqués | ⭐⭐ utile — normalisation de données API | https://github.com/hughsk/flat |
| **flatted** | n8n | JSON.stringify pour structures circulaires | ⭐⭐ utile — serialisation d'exécutions complexes | https://github.com/WebReflection/flatted |
| **change-case** | n8n | Conversion camelCase ↔ snake_case ↔ PascalCase | ⭐⭐ utile — normalisation entre APIs | https://github.com/blakeembrey/change-case |
| **fast-glob** | n8n | Glob patterns ultra-rapides pour fichiers | ⭐⭐ utile — scan de templates, migrations | https://github.com/mrmlnc/fast-glob |
| **p-cancelable** | n8n | Promises annulables | ⭐⭐ utile — annulation de scans en cours | https://github.com/sindresorhus/p-cancelable |
| **p-lazy** | n8n | Promises lazy-evaluated | ⭐ nice-to-have | https://github.com/sindresorhus/p-lazy |
| **picocolors** | n8n | Couleurs terminal (alternative ultra-light à chalk) | ⭐ nice-to-have — CLI output | https://github.com/alexeyraspopov/picocolors |
| **rimraf** | n8n | rm -rf cross-platform | ⭐ scripts de build | https://github.com/isaacs/rimraf |
| **simple-git** | n8n | Git operations programmatiques depuis Node.js | ⭐ si versioning de templates | https://github.com/steveukx/git-js |
| **json-diff** | n8n | Diff entre deux objets JSON | ⭐⭐ utile — audit log des changements de config | https://github.com/andreyvit/json-diff |
| **iconv-lite** | n8n | Conversion d'encodages (UTF-8, Latin-1, etc.) | ⭐ si documents non-UTF8 | https://github.com/ashtuchkin/iconv-lite |
| **js-base64** | n8n | Encoding/decoding Base64 | ⭐ utilitaire | https://github.com/nicedoc/isbot |
| **form-data** | n8n | Construction de multipart/form-data pour les uploads API | ⭐⭐ utile — upload vers APIs tierces | https://github.com/form-data/form-data |
| **aws4** | n8n | Signature AWS v4 (pour S3, SES, etc.) | ⭐⭐ utile — si stockage S3 | https://github.com/mhart/aws4 |
| **highlight.js** | n8n | Syntax highlighting côté serveur | ⭐ si preview de code dans l'UI | https://highlightjs.org |

---

# ✅ VALIDATION & SCHEMAS

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **zod** | les deux | Validation TypeScript-first, inférence de types | ⭐⭐⭐ CRITIQUE — validation partout | https://zod.dev |
| **jsonschema** | n8n | Validation JSON Schema (draft-07) | ⭐ si APIs qui demandent JSON Schema | https://github.com/tdegrunt/jsonschema |
| **class-validator** | n8n | Validation via decorators TypeScript | ⭐ alternative à Zod si style OOP | https://github.com/typestack/class-validator |
| **class-transformer** | n8n | Transformation de classes TypeScript (serialize/deserialize) | ⭐ compagnon de class-validator | https://github.com/typestack/class-transformer |

---

# 🎨 FRONTEND & UI (ce que Dust utilise côté React)

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **React** | Dust | UI library | ⭐⭐⭐ CRITIQUE — via Next.js | https://react.dev |
| **SWR** | Dust | Data fetching avec stale-while-revalidate caching | ❌ on prend TanStack Query (plus puissant) | https://swr.vercel.app |
| **TanStack Query** | — | Data fetching — cache, mutations, optimistic updates, infinite scroll | ⭐⭐⭐ NOTRE CHOIX — meilleur que SWR | https://tanstack.com/query |
| **Tailwind CSS** | — | Utility-first CSS framework | ⭐⭐⭐ CRITIQUE — styling | https://tailwindcss.com |
| **shadcn/ui** | — | Composants React accessibles, customizables (basés sur Radix) | ⭐⭐⭐ CRITIQUE — notre design system | https://ui.shadcn.com |
| **Radix UI** | — | Primitives UI accessibles headless (base de shadcn) | ⭐⭐⭐ via shadcn/ui | https://radix-ui.com |
| **Framer Motion** | — | Animations React | ⭐⭐ utile — transitions, micro-interactions | https://framer.com/motion |
| **Recharts** | — | Charts React (basé sur D3) — graphiques scan, coûts | ⭐⭐⭐ CRITIQUE — dashboard analytics | https://recharts.org |
| **Lucide** | — | Icônes SVG (fork de Feather Icons, 1500+ icônes) | ⭐⭐⭐ CRITIQUE — icônes UI | https://lucide.dev |

---

# 🔌 FRONTEND VUE (utilisé par n8n — pas directement pertinent mais les libs sous-jacentes le sont)

| Lib | Utilisé par | Ce que ça fait | Alternative React pour nous |
|-----|-------------|----------------|---------------------------|
| **Vue 3** | n8n | Framework frontend | → React (Next.js) |
| **Pinia** | n8n | State management | → Zustand ou TanStack Query |
| **Vite** | n8n | Build tool frontend | → inclus dans Next.js |
| **vue-chartjs** | n8n | Charts | → Recharts |
| **vue-boring-avatars** | n8n | Avatars générés par algorithme | → boring-avatars (React) ⭐⭐ |
| **vue-markdown-render** | n8n | Rendu Markdown | → react-markdown ⭐⭐ |
| **element-plus** | n8n | Component library Vue | → shadcn/ui |
| **@codemirror/** | n8n | Code editor dans le browser | → @codemirror/ (framework-agnostic) ⭐⭐ |
| **ag-grid-vue3** | n8n | Datatable avancée | → ag-grid-react ⭐⭐ si tableaux complexes |

---

# 🧪 TESTING

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **Jest** | les deux | Test runner, assertions, mocks, coverage | ⭐⭐⭐ CRITIQUE — tests unitaires + intégration | https://jestjs.io |
| **Vitest** | n8n | Test runner Vite-native (plus rapide que Jest) | ⭐⭐ alternative — si Vite dans le stack | https://vitest.dev |
| **Playwright** | n8n | E2E browser testing — multi-browser, auto-wait | ⭐⭐⭐ CRITIQUE — tests E2E | https://playwright.dev |
| **@testing-library/jest-dom** | n8n | Matchers DOM pour Jest (toBeVisible, toHaveTextContent) | ⭐⭐ utile — tests composants | https://testing-library.com |
| **jest-mock-extended** | n8n | Mocks TypeScript type-safe pour Jest | ⭐⭐ utile — mock des services | https://github.com/marchaos/jest-mock-extended |
| **@testcontainers/postgresql** | n8n | PostgreSQL éphémère dans Docker pour les tests | ⭐⭐⭐ CRITIQUE — tests DB réalistes | https://testcontainers.com |
| **@testcontainers/redis** | n8n | Redis éphémère dans Docker pour les tests | ⭐⭐ utile — tests queue | https://testcontainers.com |
| **Chromatic** | n8n | Visual regression testing pour Storybook | ⭐⭐ utile — si design system | https://chromatic.com |
| **Storybook** | n8n | Documentation interactive des composants UI | ⭐⭐ utile — documentation composants | https://storybook.js.org |
| **@currents/playwright** | n8n | Parallelisation cloud des tests Playwright | ⭐ optimisation CI avancée | https://currents.dev |

---

# 📝 CODE QUALITY

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **ESLint** | les deux | Linting JavaScript/TypeScript | ⭐⭐⭐ CRITIQUE | https://eslint.org |
| **typescript-eslint** | les deux | Rules ESLint pour TypeScript | ⭐⭐⭐ CRITIQUE | https://typescript-eslint.io |
| **eslint-plugin-import-x** | n8n | Vérification des imports (order, unused, circular) | ⭐⭐ utile — imports propres | https://github.com/un-ts/eslint-plugin-import-x |
| **eslint-plugin-unused-imports** | n8n | Suppression auto des imports inutilisés | ⭐⭐ utile — code propre | https://github.com/sweepline/eslint-plugin-unused-imports |
| **eslint-config-prettier** | n8n | Désactive les règles ESLint qui conflictent avec Prettier | ⭐⭐⭐ CRITIQUE | https://github.com/prettier/eslint-config-prettier |
| **Prettier** | les deux | Formatage automatique du code | ⭐⭐⭐ CRITIQUE | https://prettier.io |
| **tsc-alias** | n8n | Résolution des path aliases TypeScript post-compilation | ⭐⭐ utile — monorepo imports | https://github.com/justkey007/tsc-alias |
| **svgo** | n8n | Optimisation des fichiers SVG | ⭐ nice-to-have | https://github.com/nicedoc/isbot |

---

# 🔑 ENCRYPTION & CRYPTO

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **Node.js crypto** (natif) | les deux | AES-256 encryption, hashing, HMAC | ⭐⭐⭐ CRITIQUE — encryption des credentials | https://nodejs.org/api/crypto.html |
| **bcryptjs** | n8n | Hash de passwords (bcrypt en pure JS) | ⭐⭐ utile — si auth custom | https://github.com/dcodeIO/bcrypt.js |

---

# 🔍 SEARCH & INDEXATION

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **Elasticsearch** | Dust | Moteur de recherche full-text, indexation de documents | ❌ Day 1 — PostgreSQL full-text suffit | https://elastic.co |
| **pg_trgm** (extension PG) | — | Trigram matching pour recherche fuzzy en PostgreSQL | ⭐⭐⭐ CRITIQUE — search dans les scans/agents | https://www.postgresql.org/docs/current/pgtrgm.html |
| **tsvector** (natif PG) | — | Full-text search natif PostgreSQL | ⭐⭐⭐ CRITIQUE — recherche dans les documents | https://www.postgresql.org/docs/current/textsearch.html |

---

# ⚡ REALTIME & STREAMING

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **Redis PubSub** (via ioredis) | Dust | Streaming d'événements en temps réel | ⭐⭐⭐ CRITIQUE — streaming de scans et réponses agents | https://redis.io/docs/manual/pubsub |
| **ws** | n8n | WebSocket server/client natif Node.js | ⭐⭐ utile — si besoin WebSocket en plus de SSE | https://github.com/websockets/ws |
| **Server-Sent Events** (natif) | Dust | Streaming unidirectionnel server → client | ⭐⭐⭐ CRITIQUE — streaming des réponses LLM | https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events |

---

# 🔄 ORCHESTRATION & WORKFLOW

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **Temporal** | Dust | Orchestration de workflows durables, retries automatiques | ❌ Day 1 — BullMQ suffit. À reconsidérer si > 1M jobs/jour | https://temporal.io |
| **BullMQ** | — | Job queue Redis — schedules, retries, priorités, rate limits | ⭐⭐⭐ CRITIQUE — scans planifiés, exécutions agents | https://bullmq.io |

---

# 📦 OUTILS SPÉCIFIQUES MÉTIER

| Lib | Utilisé par | Ce que ça fait | Pertinence Nareo | Lien |
|-----|-------------|----------------|-------------------|------|
| **Pipedream Connect** | — | 2400+ connecteurs OAuth managed, token refresh automatique | ⭐⭐⭐ CRITIQUE — connecteurs Day 1 | https://pipedream.com/connect |
| **@slack/web-api** | Dust | Client Slack officiel — bots, messages, interactions | ⭐⭐ utile — intégration Slack future | https://github.com/slackapi/node-slack-sdk |
| **@microsoft/microsoft-graph-client** | Dust | Client Microsoft Graph — SharePoint, OneDrive, Outlook, Teams | ⭐⭐ utile — connecteur Microsoft | https://github.com/microsoftgraph/msgraph-sdk-javascript |
| **googleapis** | Dust | Client Google APIs — Drive, Calendar, Gmail | ⭐⭐ utile — connecteurs Google | https://github.com/googleapis/google-api-nodejs-client |
| **@octokit/rest** | Dust | Client GitHub REST API | ⭐ si connecteur GitHub | https://github.com/octokit/rest.js |
| **notion-client** | Dust | Client Notion API | ⭐ si connecteur Notion | https://github.com/makenotion/notion-sdk-js |

---

# 🎯 RÉSUMÉ — TON SHOPPING LIST Day 1

## Stack Core (non-négociable)

```
# Infrastructure
pnpm + turborepo + docker + github-actions + husky

# Database & Cache
postgresql (via supabase) + prisma + ioredis + bullmq

# Framework
next.js (app router) + react + typescript

# UI
tailwindcss + shadcn/ui + radix-ui + lucide + recharts + framer-motion

# Auth
supabase-auth OU auth0 + jsonwebtoken

# LLM
@anthropic-ai/sdk

# Validation
zod + zod-to-json-schema + jsonrepair

# HTTP
axios + helmet + express-rate-limit

# Utils
lodash + luxon + nanoid + dotenv + change-case + nodemailer

# Monitoring
@sentry/node + @sentry/profiling-node

# Testing
jest + playwright + @testcontainers/postgresql

# Code quality
eslint + typescript-eslint + prettier + eslint-config-prettier
```

## Month 2-3 (selon besoin)

```
# Analytics
@rudderstack/rudder-sdk-node OU posthog-node

# Advanced search
elasticsearch (si volume > 100K documents)

# Integrations natives
@slack/web-api + googleapis + @microsoft/microsoft-graph-client

# Advanced UI
@codemirror/* (si code editor) + ag-grid-react (si tableaux complexes)
+ boring-avatars + react-markdown

# Testing avancé
chromatic + storybook + vitest

# Secrets
infisical-node

# Realtime
ws (si WebSocket nécessaire en plus de SSE)
```

## Ce qu'ils utilisent qu'on NE prend PAS

| Lib | Pourquoi non |
|-----|-------------|
| Sequelize | Prisma est meilleur en type-safety |
| TypeORM | Même raison |
| Bull (legacy) | BullMQ est le successeur moderne |
| LangChain | Trop d'overhead, SDK Anthropic direct suffit |
| SWR | TanStack Query est plus puissant |
| Vue 3 / Pinia / Vite | Notre stack est React/Next.js |
| Temporal Cloud | BullMQ suffit pour notre volume Day 1 |
| Elasticsearch | PostgreSQL full-text suffit Day 1 |
| Rust core | Pas le volume de Dust, TypeScript everywhere |
| Convict | Zod + custom @Env() decorators font mieux |
| vm2 | Pas de code execution user Day 1 |
| element-plus | shadcn/ui |
