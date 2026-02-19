# Plan: Onglet Agent — Chat pleine page avec sidebar conversations

## Context

Le bouton **Test** ouvre un panneau 420px qui simule l'agent en exécutant le flow node par node. L'onglet **Agent** (actuellement un placeholder "No tasks yet") doit devenir la **vraie interface de l'agent** : un chat pleine page avec le même mode d'exécution flow + une sidebar pour gérer les conversations.

L'utilisateur n'a pas besoin de mini flow viz — les tool messages inline par node (icône, nom, status, summary, inspect) + la progress bar du `ChatInterface` suffisent.

---

## Anatomie du Test Chat (ce qu'on réplique)

### Ce que fait `flow-editor.tsx` (le wrapper)

1. **État** : `showChat`, `chatConversationId`, `flowExecutionState`, `retryFromFailedFn`
2. **Ouverture** : `handleToggleChat()` crée une conversation si nécessaire, ouvre le panneau
3. **Header custom** ([lines 888-963](apps/web/src/features/agents/components/flow-editor.tsx#L888-L963)) :
   - Icône du node en cours + label ("Message Received" par défaut)
   - Bouton "Retry from failed" (si erreurs) ou "Retry" (restart conversation)
4. **Body** : `<ChatInterface>` avec flow execution mode

### Ce que fait `ChatInterface` (le moteur)

Quand `flowNodes` + `flowEdges` sont fournis → `hasFlow = true` → `executeFlowMode()` :

- POST `/api/agents/flow/execute` avec `flowData` (nodes + edges)
- Streaming SSE : `node-start`, `node-complete`, `node-error`, `text-delta`, `flow-complete`...
- Affiche chaque node comme un `ToolCallMessage` (icône, nom, spinner/check/error, summary, inspect)
- **Progress bar** ([lines 1666-1689](apps/web/src/features/agents/components/chat-interface.tsx#L1666-L1689)) : `Running: {label}... (3/7)` + bouton Stop
- **Greeting** + **conversation starters** depuis le node messageReceived
- **Retry from failed** avec cache des outputs upstream
- **Feedback** : thumbs up/down, edit response
- **Safe Mode** : confirmation dialog pour actions irréversibles
- **Pulse Log** : activity log accessible depuis l'input area
- **Message recovery** : récupère les messages depuis la DB au remount

### Props critiques du `ChatInterface` pour le flow mode

```tsx
<ChatInterface
  key={conversationId}
  conversationId={conversationId}
  agentId={agentId}
  agentName={agentName}
  agentAvatar={agentAvatar}
  flowNodes={flowNodesList}          // → hasFlow = true → executeFlowMode
  flowEdges={flowEdgesList}          // → envoyé à /api/agents/flow/execute
  onExecutionStateChange={setState}  // → tracking (optionnel, pour le canvas)
  onRetryFromFailed={(fn) => set()}  // → expose la fonction retry au parent
  mode="chat"
  getFlowData={getFlowData}          // → données live canvas (prioritaires)
  initialGreeting={greeting}
  conversationStarters={starters}
/>
```

**Point clé** : Sans `getFlowData` (ou s'il retourne `undefined`), `executeFlowMode` utilise automatiquement les props `flowNodes`/`flowEdges` ([line 657](apps/web/src/features/agents/components/chat-interface.tsx#L657)). C'est ce qu'on veut pour l'Agent tab — utiliser les données **sauvegardées**, pas le canvas live.

---

## Implémentation

### Step 1 — Renommer le tab header

**Fichier:** [flow-editor-header.tsx](apps/web/src/features/agents/components/flow-editor-header.tsx)

| Avant | Après |
|---|---|
| Icon : `ListChecks` | Icon : `ChatCircle` |
| Label : `"Agents"` | Label : `"Agent"` |

Importer `ChatCircle` de `@phosphor-icons/react`, retirer `ListChecks` si inutilisé.

### Step 2 — Ajouter l'état agent chat dans `flow-editor.tsx`

**Fichier:** [flow-editor.tsx](apps/web/src/features/agents/components/flow-editor.tsx)

Près de la ligne 78 :
```tsx
// Agent chat tab state — independent from the test panel
const [agentChatConversationId, setAgentChatConversationId] = useState<string | null>(null);
const [agentChatRetryFn, setAgentChatRetryFn] = useState<(() => void) | null>(null);
```

### Step 3 — Créer `AgentChatTab` (nouveau fichier)

**Nouveau fichier:** [agent-chat-tab.tsx](apps/web/src/features/agents/components/agent-chat-tab.tsx)

#### Props

```tsx
interface AgentChatTabProps {
  agentId: string;
  agentName: string;
  agentAvatar?: string | null;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
  flowNodes?: FlowNode[];
  flowEdges?: FlowEdge[];
  initialGreeting?: string;
  conversationStarters?: ConversationStarter[];
}
```

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌──────────────────────────────────────┐ │
│ │  SIDEBAR     │ │  CHAT AREA                           │ │
│ │  (260px)     │ │                                      │ │
│ │              │ │  ┌────────────────────────────────┐   │ │
│ │  [Search]    │ │  │ Header: node icon + label      │   │ │
│ │  [+ New]     │ │  │ + Retry/Restart buttons        │   │ │
│ │              │ │  ├────────────────────────────────┤   │ │
│ │  Today       │ │  │                                │   │ │
│ │   ● Conv 1 ← │ │  │  ChatInterface (flow mode)    │   │ │
│ │   ● Conv 2   │ │  │  - Tool messages par node     │   │ │
│ │  Yesterday   │ │  │  - Progress bar               │   │ │
│ │   ● Conv 3   │ │  │  - Streaming text             │   │ │
│ │              │ │  │  - Greeting + starters         │   │ │
│ │              │ │  │  - Feedback buttons            │   │ │
│ │              │ │  │  - Safe mode confirmations     │   │ │
│ │              │ │  │                                │   │ │
│ │              │ │  ├────────────────────────────────┤   │ │
│ │              │ │  │ [Input area + Pulse + Send]    │   │ │
│ │              │ │  └────────────────────────────────┘   │ │
│ └─────────────┘ └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### Sidebar conversations (gauche, 260px)

- **Header** : Barre de recherche + bouton `+` (new conversation)
- **Liste** : Conversations groupées par date (Today, Yesterday, Date)
  - Chaque item : icône `ChatCircle` + titre (ou "New conversation") + indicateur actif
  - Click → `onConversationChange(id)`
- **Empty state** : "No conversations yet"
- **Données** : `useConversations(agentId)` de [use-agents.ts](apps/web/src/features/agents/hooks/use-agents.ts)
- **Création** : `useCreateConversation()` de [use-agents.ts](apps/web/src/features/agents/hooks/use-agents.ts)
- **Responsive** : `hidden lg:flex` sur la sidebar, visible seulement sur grands écrans

#### Chat header (au-dessus du ChatInterface)

Réplique exacte du header du Test panel ([flow-editor.tsx:888-963](apps/web/src/features/agents/components/flow-editor.tsx#L888-L963)) :
- Gauche : Icône agent (via `getAgentConfig`) + nom de l'agent
- Droite : Bouton "Retry" qui crée une nouvelle conversation (même pattern que le Test)

On n'a PAS besoin de `onExecutionStateChange` puisqu'il n'y a pas de canvas à animer, mais on garde `onRetryFromFailed` pour le bouton Retry from failed du header.

#### Chat body

```tsx
<ChatInterface
  key={conversationId}
  conversationId={conversationId}
  agentId={agentId}
  agentName={agentName}
  agentAvatar={agentAvatar}
  flowNodes={flowNodes}
  flowEdges={flowEdges}
  mode="chat"
  // PAS de getFlowData → utilise les données sauvegardées (fallback dans executeFlowMode)
  // PAS de onExecutionStateChange → pas de canvas à animer
  onRetryFromFailed={(fn) => setRetryFn(() => fn)}
  initialGreeting={initialGreeting}
  conversationStarters={conversationStarters}
/>
```

#### Empty state (pas de conversation sélectionnée)

Icône agent (gradient, via `getAgentConfig`) + "Chat with {agentName}" + "Start a conversation to interact with your agent." + bouton "New conversation"

#### Auto-create à l'ouverture

`useEffect` : si `conversationId` est null au premier render, créer automatiquement une conversation.

### Step 4 — Brancher dans `flow-editor.tsx`

**Fichier:** [flow-editor.tsx](apps/web/src/features/agents/components/flow-editor.tsx)

Remplacer le placeholder (lines 1123-1138) par :
```tsx
{activeTab === "tasks" && (
  <AgentChatTab
    agentId={agent.id}
    agentName={agent.name}
    agentAvatar={agent.avatar}
    conversationId={agentChatConversationId}
    onConversationChange={setAgentChatConversationId}
    flowNodes={flowNodesList}
    flowEdges={flowEdgesList}
    initialGreeting={messageReceivedData.greeting}
    conversationStarters={messageReceivedData.starters}
  />
)}
```

Ajuster la classe overflow du container pour l'onglet tasks : `overflow-hidden` (ChatInterface gère son propre scroll).

Ajouter l'import de `AgentChatTab`.

---

## Fichiers modifiés

| Fichier | Type | Description |
|---|---|---|
| [flow-editor-header.tsx](apps/web/src/features/agents/components/flow-editor-header.tsx) | Modifier | Label "Agents" → "Agent", icône `ListChecks` → `ChatCircle` |
| [flow-editor.tsx](apps/web/src/features/agents/components/flow-editor.tsx) | Modifier | État `agentChatConversationId` + `agentChatRetryFn`, remplacer placeholder, import, overflow |
| [agent-chat-tab.tsx](apps/web/src/features/agents/components/agent-chat-tab.tsx) | **Nouveau** | Composant pleine page : sidebar convos + header + ChatInterface flow mode |

## Réutilisation (DRY)

| Existant | Fichier | Réutilisé pour |
|---|---|---|
| `ChatInterface` | [chat-interface.tsx](apps/web/src/features/agents/components/chat-interface.tsx) | Moteur du chat — aucune modif |
| `useConversations()` | [use-agents.ts](apps/web/src/features/agents/hooks/use-agents.ts) | Liste des conversations sidebar |
| `useCreateConversation()` | [use-agents.ts](apps/web/src/features/agents/hooks/use-agents.ts) | Création de conversations |
| `getAgentConfig()` | [flow-editor-header.tsx](apps/web/src/features/agents/components/flow-editor-header.tsx) | Icône + gradient agent |
| `FlowNode`, `FlowEdge` types | [chat-interface.tsx](apps/web/src/features/agents/components/chat-interface.tsx) | Types des props flow |
| `ConversationStarter` type | [chat-interface.tsx](apps/web/src/features/agents/components/chat-interface.tsx) | Type des starters |

## Inchangé

- `ChatInterface` — aucune modification
- `/api/agents/flow/execute` — aucune modification
- Test panel — complètement indépendant

## Vérification

1. Ouvrir un agent → onglet **Agent** → conversation auto-créée
2. Envoyer un message → exécution flow node par node (ToolCallMessages inline + progress bar)
3. Vérifier streaming, node-start/complete/error, retry from failed
4. Vérifier greeting + conversation starters
5. Créer 2ème conversation → sidebar met à jour → switch fonctionne
6. Onglet **Flow editor** → **Test** → fonctionne indépendamment
7. Retour onglet **Agent** → conversation préservée
8. Responsive : sidebar masquée < lg, chat prend toute la largeur
