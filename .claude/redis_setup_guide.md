# Guide de configuration Redis avec Upstash

## Pourquoi Upstash Redis?

- **Gratuit** jusqu'à 10,000 commandes/jour
- **Serverless** - pas de serveur à gérer
- **Compatible** avec BullMQ et ioredis
- **Faible latence** avec réplication globale
- **Recommandé** dans l'architecture V6 (voir CLAUDE.md)

## Étapes de configuration

### 1. Créer votre base Redis Upstash

1. Allez sur: https://console.upstash.com
2. Connectez-vous avec GitHub (ou créez un compte)
3. Cliquez sur **"Create Database"**
4. Configuration:
   - **Name**: `nodebase-dev`
   - **Type**: **Global Database** (10K commandes/jour gratuit)
   - **Region**: `us-east-1` (proche de votre Neon DB)
   - **Eviction**: No eviction
   - **TLS**: Enabled (par défaut)
5. Cliquez sur **"Create"**

### 2. Copier l'URL de connexion

Une fois la base créée:

1. Dans le dashboard Upstash, cliquez sur votre database `nodebase-dev`
2. Cherchez la section **"REST API"** ou **"Connect"**
3. Copiez l'URL qui ressemble à:
   ```
   rediss://default:AbC1234...@usw2-example.upstash.io:6379
   ```
   ⚠️ Assurez-vous de copier l'URL complète avec le mot de passe!

### 3. Mettre à jour votre .env

Ouvrez votre fichier `.env` à la racine du projet et remplacez:

```env
# AVANT (local)
REDIS_URL="redis://localhost:6379"

# APRÈS (Upstash)
REDIS_URL="rediss://default:VotreMdpIci@xxx.upstash.io:6379"
```

### 4. Tester la connexion

Une fois l'URL configurée dans `.env`, testez la connexion:

```bash
pnpm --filter @nodebase/queue test:redis
```

Vous devriez voir:

```
🔌 Testing Redis connection...

📋 Config loaded:
   URL: rediss://default:****@xxx.upstash.io:6379
   Max retries: 3

⏳ Connecting to Redis...
✅ Connected to Redis!

⏳ Testing PING...
✅ PING successful: PONG

⏳ Testing SET/GET...
✅ SET/GET successful: Hello from Nodebase!

⏳ Getting Redis info...
✅ Redis version: 7.2.x

🎉 All Redis tests passed!
```

### 5. Utiliser Redis dans votre code

Redis est maintenant disponible via le package `@nodebase/queue`:

```typescript
import { createQueue } from "@nodebase/queue";

// Créer une queue
const emailQueue = createQueue({ name: "emails" });

// Ajouter un job
await emailQueue.add("send-welcome", {
  to: "user@example.com",
  template: "welcome"
});
```

## Architecture Redis dans Nodebase

Redis est utilisé pour:

1. **BullMQ** - Queue de jobs asynchrones (remplace Inngest)
   - Workflows
   - Agents
   - Intégrations
   - Emails

2. **SSE via Redis PubSub** - Streaming des réponses agents
   - Chat en temps réel
   - Notifications
   - Mises à jour live

## Limites du plan gratuit Upstash

- **10,000 commandes/jour** (suffisant pour dev)
- **256 MB** de stockage
- **1 database** max

Pour production, le plan payant démarre à $0.20/100K commandes.

## Troubleshooting

### Erreur de connexion

Si vous avez une erreur de connexion:

1. Vérifiez que l'URL dans `.env` est correcte et complète
2. Vérifiez que TLS est activé (URL commence par `rediss://` avec double S)
3. Vérifiez que votre IP n'est pas bloquée par Upstash (normalement non)

### Erreur "READONLY"

Si vous voyez une erreur `READONLY`, c'est que la base est en mode réplication.
Assurez-vous d'avoir créé une base **Global** et non **Regional**.

## Next steps

Une fois Redis configuré, vous pouvez:

1. ✅ Lancer l'app avec `turbo dev --filter=@nodebase/web`
2. Créer des workers BullMQ pour vos agents
3. Implémenter le SSE pour le streaming des réponses

---

**Besoin d'aide?** Consultez la doc Upstash: https://docs.upstash.com/redis
