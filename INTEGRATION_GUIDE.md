# Daily Briefing Integration Guide

## Composant créé

✅ [`DailyBriefingWidget.tsx`](apps/web/src/features/agents/components/daily-briefing-widget.tsx)

## Intégration dans `/home`

### Option 1: Ajout en haut de page (Recommandé)

Modifier [`home-content.tsx`](apps/web/src/features/agents/components/home-content.tsx):

```tsx
import { DailyBriefingWidget } from "./daily-briefing-widget";

export function HomeContent() {
  // ... existing code ...

  return (
    <div className="flex-1 overflow-auto">
      {/* ... existing gradient background ... */}

      <div className="max-w-4xl mx-auto px-6 -mt-32 relative z-[1]">

        {/* ADD BRIEFING HERE - Before title */}
        <div className="mb-8">
          <DailyBriefingWidget />
        </div>

        {/* Existing title */}
        <h1 className="text-4xl font-bold tracking-tight text-center mb-8">
          What can I help you build?
        </h1>

        {/* ... rest of existing content ... */}
      </div>
    </div>
  );
}
```

### Option 2: Ajout après input principal

```tsx
{/* Existing input */}
<div className="relative mb-6">
  {/* ... textarea ... */}
</div>

{/* ADD BRIEFING HERE - After input */}
<div className="mb-6">
  <DailyBriefingWidget />
</div>

{/* Suggestions */}
<div className="flex flex-wrap justify-center gap-2 mb-12">
  {/* ... */}
</div>
```

## Features du Widget

### État par défaut
- ✅ Récupère automatiquement le briefing du jour
- ✅ Badge "New" si non lu
- ✅ Compteur "X unread" avec stats
- ✅ Expandable/collapsible

### Contenu affiché
- 📝 Texte du briefing généré par Claude
- 📊 Résumé par agent (runs, success rate, coût)
- ⚠️ Pending approvals highlight
- ✅ Action "Mark as Read"
- 🔗 Lien vers /approvals si nécessaire

### États visuels
- **Non lu**: Bordure bleue, background bleu clair
- **Lu**: Bordure normale, checkmark vert
- **Aucun briefing**: Message placeholder avec bordure dashed

## Backend Setup (Worker)

### Activer le worker pour un user

Dans votre code backend (ex: après signup):

```typescript
import { scheduleDailyBriefing } from "@/queue/briefing-worker";

// Schedule daily briefing at 8 AM
await scheduleDailyBriefing(userId, 8);

// Custom time (9 AM)
await scheduleDailyBriefing(userId, 9);
```

### Désactiver

```typescript
import { unscheduleDailyBriefing } from "@/queue/briefing-worker";

await unscheduleDailyBriefing(userId);
```

## API Usage (tRPC)

### Côté Client

```typescript
import { trpc } from "@/trpc/client";

// Get today's briefing
const { data } = trpc.briefing.getTodaysBriefing.useQuery();

// Get specific date
const { data } = trpc.briefing.getBriefingByDate.useQuery({
  date: new Date("2026-02-12"),
});

// Get recent (last 7 days)
const { data } = trpc.briefing.getRecentBriefings.useQuery({
  limit: 7,
});

// Mark as read
const markRead = trpc.briefing.markAsRead.useMutation();
await markRead.mutateAsync({ briefingId: "..." });

// Get stats
const { data: stats } = trpc.briefing.getBriefingStats.useQuery();
// { total: 30, read: 25, unread: 5 }
```

## Styling

Le widget utilise les composants shadcn/ui existants:
- `Card`, `CardHeader`, `CardContent`
- `Badge` pour les notifications
- `Button` pour les actions
- Icônes Phosphor

Thème:
- ✅ Dark mode supporté
- ✅ Responsive design
- ✅ Animations subtiles (border, background)

## Prochaines améliorations

### Email Notifications
- [ ] Envoi automatique via Gmail si intégration connectée
- [ ] Template email HTML du briefing
- [ ] Unsubscribe link

### Analytics
- [ ] Track read rate
- [ ] Track time to read
- [ ] A/B test briefing formats

### Personnalisation
- [ ] Choix de l'heure d'envoi
- [ ] Fréquence (daily, weekly)
- [ ] Filtres par agent
- [ ] Format personnalisé (concise, detailed)
