# IDEA SCOPING V6 — Architecture Solide

**AI Agent Platform for SMEs** | Février 2026 | V6 : Consolidation technique (Dust & n8n deep-dive)

---

## SUMMARY

En 2018, Guillaume Moubeche a lancé Lemlist dans un marché dominé par Outreach ($100M+ ARR), Salesloft, Mailshake, Woodpecker. Il a lancé un outil de prospection complet — un CRM avec gestion de campagnes de cold email — mais avec UNE technique que personne n'avait (les images personnalisées). Produit complet Day 1 + une différenciation killer. Il a grandi vers la revenue acceleration platform sur 7 ans, guidé par le feedback utilisateur. Résultat : $40M ARR, 50K clients, bootstrapped, 40% EBITDA.

**On fait pareil.**

On lance une plateforme d'agents AI pour PME non-tech Day 1. On réplique le modèle qui marche (Lindy : agents autonomes connectés aux outils business via Pipedream) avec 2 features que personne n'a : **un scan qui montre ce qui tombe entre les mailles** (deals dormants, tickets proches SLA, candidatures non traitées, factures overdue, tâches sans assigné, campagnes en chute) et **un style learner** (les drafts deviennent les tiens). ~93 templates couvrant sales, marketing, support, HR, ops, research/product. Le vrai wedge se découvre en M1-M3 via les données d'usage.

**3 piliers :**

1. **Le produit :** Plateforme d'agents AI plug-and-play pour PME non-tech. Scan € + ~93 templates couvrant sales, marketing, support, HR, ops, productivité. Chaque agent se connecte à ses outils via Pipedream et fait le job. Style Learner. Workflows customisables via React Flow.

2. **Le dogfooding total :** On gère notre propre boîte entièrement avec nos agents. Prospection, follow-up, support, recrutement, meetings, content, facturation. Chaque agent qu'on utilise devient un template. Chaque résultat devient du contenu. La preuve est inarguable.

3. **La communauté sur le craft :** Pas une communauté produit. Une communauté sur le métier : "comment automatiser ta boîte avec l'AI." Templates d'agents partagés gratuitement, résultats réels, build in public. Les gens viennent pour apprendre le craft. Notre outil est dans chaque exemple.

---

## 1. Problem

Identique au V4. Trois layers imbriquées. Sources vérifiées.

### Layer 1 — Time hemorrhage on non-strategic tasks (known, partially addressed)

**Transversal :** **28% of French SME directors** spend minimum 2 days/week on admin (CPME survey, July 2024, n=1,612).

**Sales :** Sales reps sell only **30%** of their time (Salesforce State of Sales, 6th Edition, 2024, 5,500+ respondents). HubSpot 2024: sales reps sell only **2 hours per day**. **68%** of reps say note-taking and data input are their most time-consuming tasks (Salesroom 2024).

**Marketing :** Marketers spend **16h/semaine** sur des tâches administratives et de reporting au lieu de la stratégie et la création (CoSchedule 2024). **60%** du temps marketing est consacré à des tâches opérationnelles (Gartner CMO Spend Survey 2024).

**Support :** Les agents support passent **~30%** de leur temps à chercher des informations au lieu de résoudre des tickets (Zendesk CX Trends 2024). Le coût moyen d'un ticket humain est de **€15-25** alors qu'un bot bien configuré coûte **<€1** (Intercom 2024).

**HR :** Les équipes RH passent **40%** de leur temps sur des tâches administratives (SHRM 2024). Le coût moyen d'un recrutement en France est de **€5,000-8,000** — dont une large partie en process manuels (screening, scheduling, follow-ups).

**Ops :** Les chefs de projet passent **54%** de leur temps sur du "work about work" au lieu du travail stratégique (Asana Work Index 2024).

Partiellement adressé par Zapier/Make/n8n. Mais ces outils automatisent des tâches connues — ils ne détectent pas ce qui échappe.

### Layer 2 — Data quality crisis (known, ignored)

CRM data decays at ~2.1%/month. **76%** of CRM data is inaccurate (Validity State of CRM Data Management 2025, n=602). **44%** of businesses lose >10% revenue from bad CRM data (Validity 2022, n=1,200+). Employees spend **13h/week** searching for CRM info (Validity 2025). Nobody fixes it because nobody sees it.

### Layer 3 — Agent unreliability (unnamed, unaddressed)

**METR RCT** (Jul 2025, n=16 devs, 246 tasks): AI devs **19% slower** but believed 20% faster. **IBM CEO Study** (May 2025, n=2,000 CEOs): only **25%** of AI initiatives deliver ROI. **DORA 2024** (n=39,000+): 25% AI adoption correlates with **-7.2% delivery stability**. **Klarna** (May 2025): replaced 700 agents → rehired. Lower quality, detected too late. **S&P Global** (2025): **42%** of enterprises scrapped AI initiatives. **France Num** (Sept 2025, n=3,043): 42% PME use AI, **only 5%** real automation.

**Le problème core : les gens ne savent pas ce qui tombe entre les mailles.** Pas "je perds du temps sur des tâches répétitives" (Zapier répond partiellement). Mais : des deals qui glissent silencieusement dans le CRM, des tickets support qui approchent du SLA sans que personne ne le voie, des candidatures non traitées depuis 5 jours, des factures impayées qui s'accumulent, des tâches overdue que personne n'a reassignées. Chaque métier a ses trous. On le découvre quand le client se plaint, le candidat accepte ailleurs, la facture passe en contentieux, ou le deal est perdu. Trop tard.

### 1.1 Who's experiencing this?

| Persona | Rôle | Pain #1 | Pain #2 |
|---------|------|---------|---------|
| **Thomas** | Sales Director, PME 40 pers. | "Des deals dorment dans le CRM et je ne le vois pas" | "Mon CRM est une passoire mais personne ne le maintient" |
| **Sophie** | Head of Ops, PME 80 pers. | "Je ne sais pas ce qui tombe entre les mailles" | "Je n'ai pas confiance en l'AI pour agir à ma place" |
| **Claire** | Responsable Marketing, PME 60 pers. | "Je passe plus de temps à reporter qu'à créer" | "Je recycle du contenu manuellement sur 5 plateformes" |
| **Antoine** | DRH, PME 100 pers. | "Le screening de CV me prend 3 jours par recrutement" | "L'onboarding est un fichier Excel que personne ne suit" |
| **Julien** | Head of Support, PME 50 pers. | "Les tickets s'empilent et je ne vois pas lesquels sont critiques" | "On répond toujours aux mêmes questions" |
| **CEO PME** | Dirigeant, 10-200 pers. | "On perd des clients sans savoir pourquoi" | "Je n'ai pas de visibilité sur les opérations" |

### 1.2 Frequency & Intensity

Un employé moyen de PME a 20-50 engagements ouverts à tout moment et **ne le sait pas**. Le coût n'est pas le temps perdu — c'est le revenu perdu sur les deals qui glissent, les tickets qui escaladent, les candidats qui acceptent ailleurs, les factures qui passent en contentieux, les tâches qui bloquent des projets entiers. Invisible → non-actionnable → pertes composées.

---

## 2. Solution

### 2.0 Le parallèle Lemlist — comment construire face aux incumbents

**Lemlist (2018) :** Outreach faisait $100M+ ARR. Salesloft était massivement financé. Guillaume avait $1,000 et un MVP moche.

Il a lancé un outil de prospection complet — un CRM dans lequel on pouvait gérer ses campagnes de cold email — mais avec UN angle que personne n'avait : les images personnalisées dans les cold emails. Pas un prototype avec une feature. Un produit complet avec UNE technique killer.

La technique marchait parce qu'elle avait 5 propriétés :
1. **Visible en 5 secondes** — le prospect voit son nom sur un whiteboard
2. **Résultat immédiat** — taux de réponse qui double dès le premier envoi
3. **Partageable** — les gens screenshotaient les emails reçus
4. **Résout un vrai problème quotidien** — "mes cold emails sont ignorés"
5. **Simple à comprendre** — tu vois, tu comprends

Et surtout : **lié directement au CA.** Plus de réponses → plus de meetings → plus de deals. Le sales rep pouvait dire à son boss : "6 meetings de plus ce mois." Inarguable.

Timeline produit Lemlist :

| Phase | Produit | Ce qui était "mieux" |
|-------|---------|---------------------|
| **V1 (2018)** | CRM + cold email + images personnalisées | Produit complet avec UNE technique killer |
| **V2 (2019)** | Refonte onboarding (activation 10% → 45%) | Pas de nouvelle feature — juste utilisable |
| **V3 (2020)** | Multichannel (email + LinkedIn + calls) | Extension demandée par les users |
| **V4 (2021-22)** | Sales engagement platform complète | Feature parity avec Outreach/Salesloft |
| **V5 (2023-25)** | Lempire (acquisitions Taplio, TweetHunter, Claap) | Revenue acceleration platform, $40M ARR |

**7 ans pour aller de "CRM avec images personnalisées" à "revenue acceleration platform."** Chaque étape guidée par le feedback utilisateur.

**Notre approche :** Comme Lemlist, on lance un produit complet Day 1 — une plateforme d'agents AI pour les non-tech (pas un prototype). ~93 templates couvrant sales, marketing, support, ops, HR, research/product. Avec 2 features que personne n'a (scan €, style learner). Le vrai wedge émergera en M1-M3 via l'usage, comme Lemlist a découvert que le multi-channel était plus fort que les images.

### 2.1 Competitive Landscape — Le gap qu'on exploite

**Concurrent #1 : le statu quo.** La majorité des PME n'utilisent PAS encore d'agents AI. Le Sales Director fait ses follow-ups à la main, la RH screening les CV manuellement, le support copie-colle les mêmes réponses. On ne vend pas "mieux que Lindy" — on vend "tes tâches répétitives se font toutes seules."

**Concurrents directs — Plateformes d'agents AI :**

| | **Dust** | **Lindy** | **Nous (V1)** |
|---|---|---|---|
| **Positionnement** | Agent platform enterprise | AI Employees no-code | Plateforme agents AI pour PME non-tech |
| **Cible** | Enterprise 3000+ | SMB/Startups, équipes business, ops teams | PME 10-500, non-technique |
| **Onboarding** | "Qu'est-ce que tu veux construire ?" | "Choisis parmi 1,000 templates" | **"Connecte tes outils, on te montre ce qui fuit"** |
| **Templates** | Custom par l'admin IT | 1,000+ templates | **~93 templates plug-and-play** |
| **Apprentissage** | Mémoire conversationnelle | Aucun | **Style Learner (few-shot diffs)** |
| **Frame résultats** | "X agents déployés" | "X tâches automatisées" | **"X alertes traitées / €X d'impact business"** |
| **Infra** | Custom | Pipedream | **Pipedream (même infra que Lindy, 2,800+ APIs)** |

**Concurrents indirects — Outils d'automatisation :**

| | **Zapier** | **Make** | **n8n** |
|---|---|---|---|
| **Positionnement** | Automatisation par workflows | Automatisation visuelle avancée | Automatisation open-source |
| **Cible** | PME, tous niveaux | PME tech-savvy | Devs, self-hosted |
| **Modèle** | Trigger → Action (si X alors Y) | Scenarios visuels multi-étapes | Workflows programmables |
| **Limite** | Zero intelligence : ne DÉTECTE rien, n'écrit rien, n'analyse rien. L'user doit savoir exactement ce qu'il veut automatiser. | Idem — puissant mais réactif, pas proactif | Idem + nécessite compétences techniques |
| **Ce qu'on fait différemment** | Nos agents sont PROACTIFS : ils détectent les deals dormants, les tickets proches SLA, les candidatures non traitées, les factures overdue. Zapier ne sait pas que tu as un ticket premium non assigné. | Nos agents GÉNÈRENT du contenu (drafts, briefs, rapports). Make déplace de la data entre outils, il ne crée rien. | Nos agents sont plug-and-play pour non-tech. n8n est un outil de dev. |

**Pourquoi Dust/Lindy ne font pas ça (même raison qu'Outreach ne faisait pas les images personnalisées) :**

Les incumbents ne construisent pas la feature parce qu'ils ne sont pas au même endroit :

1. **Dust construit pour le CTO/admin IT** — observability, sécurité, agent chaining. Leur buyer veut de la gouvernance, pas un daily briefing opérationnel.
2. **Lindy construit pour des équipes business SMB qui savent déjà ce qu'elles veulent automatiser** — l'user choisit un template, le configure, le déploie. Leur buyer est tech-aware : il sait ce qu'est un workflow, il sait quel process automatiser. Lindy ne lui dit pas ce qu'il rate.
3. **Zapier/Make/n8n construisent de la plomberie** — ils connectent A à B. Ils ne comprennent pas le contexte business et ne génèrent rien.
4. **Personne ne construit pour Sophie, Claire, Antoine, Julien** — les responsables de PME qui ne savent pas ce qu'ils ratent, qui ne savent pas ce qu'est un "trigger" ou un "workflow", et qui n'iront jamais configurer un agent from scratch. Thomas ne sait pas que 3 deals dorment. Julien ne sait pas qu'un ticket premium est non assigné depuis 2h. Antoine ne sait pas que 8 CV attendent depuis 5 jours. Sophie ne sait pas que €12K de factures sont overdue.

C'est une **contrainte de positionnement**, pas technique.

**Ce qu'on apprend de chaque concurrent :**

Ces concurrents sont des machines de guerre. Chacun a résolu un problème mieux que nous ne le ferons Day 1. L'intelligence c'est de voler les bonnes idées et de les intégrer dans notre produit.

| Concurrent | Ce qu'ils font mieux que tout le monde | Ce qu'on intègre chez nous |
|------------|---------------------------------------|---------------------------|
| **Lindy** | **Natural language agent creation.** L'user décrit ce qu'il veut en français, l'agent se construit. Pas de drag-and-drop obligatoire — juste "je veux un agent qui relance mes leads après 3 jours." Templates de très haute qualité (1,000+) qui marchent out of the box. Agent Swarms (clonage parallèle pour exécuter 500 tâches en simultané). Autopilot (Computer Use — l'agent navigue sur le web quand il n'y a pas d'API). | **V1 :** Templates plug-and-play qui marchent immédiatement (même standard de qualité). Natural language customization dans React Flow ("ajoute une condition : seulement si le deal > €10K" / "escalade le ticket si le client est Premium" / "ne screene que les CV avec 3+ ans d'expérience"). **V2 :** Agent Swarms pour l'outbound massif. Computer Use pour les outils sans API. |
| **Dust** | **Permissions granulaires** — les docs engineering ne fuitent pas vers sales. SSO/SCIM, audit logs, data residency. **Knowledge grounding** — les agents sont ancrés dans les données de l'entreprise (Notion, Slack, GitHub, Confluence), pas juste les APIs. $7.3M ARR avec 66 personnes (>$110K ARR/employé). 70% adoption hebdo chez des entreprises de 3,000+ personnes. **"Builder community"** interne — les tinkerers de l'entreprise créent des agents pour leur équipe. | **V1 :** Knowledge base connectée (l'agent sait ce que l'entreprise sait, pas juste ce qu'il y a dans le CRM). **V1.1 :** Permissions par rôle (le commercial ne voit pas les données RH). **V2 :** "Builder" interne — les power users de la PME créent des agents pour leur équipe et les partagent. |
| **Zapier** | **8,000+ intégrations** — la couverture la plus large du marché. **Documentation exemplaire** — chaque intégration a des guides, exemples, templates. **Reliability** — 81 milliards de tâches exécutées, ça tourne. Utilisé par 69% du Fortune 1000. **Copilot AI** (ZapConnect 2025) — décrire une automation en langage naturel et elle se construit. **Template library** — des milliers de templates pré-faits classés par use case, avec un moteur de recherche. $400M de revenue projeté en 2025, bootstrapped. | **V1 :** Template library searchable avec filtres par métier, outil connecté, et cas d'usage (copier la logique de classification de Zapier). Documentation par template : chaque agent a sa page "comment ça marche, ce qu'il connecte, exemples de résultats." **Toujours :** Fiabilité comme obsession — monitoring, alerting, retry. Si l'agent plante, l'user perd confiance définitivement. |
| **Make** | **Éditeur visuel best-in-class** — le canvas Make est le plus intuitif du marché pour visualiser des workflows complexes. On voit le flow de données, les branches, les conditions. **Text aggregation** — excellente capacité à combiner des données de sources multiples en un output structuré. **MCP Server** — les scénarios sont modularisables comme des outils réutilisables par d'autres agents (scalabilité enterprise). **Make Grid** — carte auto-générée de tout le paysage d'automation de l'entreprise (quels agents, connectés à quoi, quel flux de données). | **V1 :** S'inspirer du canvas Make pour notre éditeur React Flow — les nodes doivent montrer le flux de données en temps réel, pas juste des boîtes statiques. **V1.1 :** Vue "Grid" — un dashboard qui montre tous les agents actifs, leurs connexions, et les flux de données entre eux. **V2 :** Templates modulaires réutilisables (un agent qui enrichit un lead peut être réutilisé dans 10 workflows différents). |
| **n8n** | **Open-source + self-hosted** — data sovereignty totale. **Code Node** — possibilité de drop en JavaScript/Python à n'importe quel point du workflow (plafond de complexité illimité). **AI-native** — 70+ nodes LangChain, support RAG natif, vector databases. **Git version control** sur les workflows — rollback, branching, collaboration. **Debugging avancé** — pinned/mock data, global error triggers, logs détaillés. Community très active qui créé des nodes custom. | **V1 :** Logs d'exécution détaillés et debugging visible pour chaque agent (l'user voit exactement ce qui s'est passé quand un agent échoue). **V1.1 :** Possibilité d'ajouter du code custom dans un node React Flow (pour les power users qui veulent aller plus loin que les templates). **V2 :** Export/import de workflows + versioning. |

### 2.2 Ce que Lindy n'a pas — Nos 2 features différenciantes

**Ce ne sont pas des "wedges" définitifs.** Ce sont 2 features que Lindy n'a pas et qui nous différencient au launch. Le vrai wedge émerge en M1-M3 via l'usage — peut-être que c'est une de ces 2, peut-être que c'est autre chose.

**Feature 1 : Le Scan — "Connecte tes outils, on te montre ce qui tombe entre les mailles"**

Lindy te demande de choisir un template et de le configurer. Nous, on scanne tes outils et on te montre immédiatement ce qui nécessite ton attention — adapté aux outils que TU utilises :

> **Sales** — 3 deals (€47K) sans activité depuis 7+ jours. Drafts relance prêts.
> **Support** — 5 tickets proches du SLA, dont 1 client premium non assigné.
> **Marketing** — Campagne "Webinar Fév" : open rate en chute. 3 MQLs non transmis.
> **HR** — 6 candidatures non traitées depuis >48h.
> **Finance** — €12K de factures overdue. 2 paiements Stripe échoués.
> **Projets** — 8 tâches overdue, 3 sans assigné avec deadline demain.
>
> **[Traiter les priorités] [Activer les agents pour le reste]**

L'user n'a pas besoin de savoir ce qu'est un agent. Il voit ce qui tombe entre les mailles et clique pour résoudre. Le scan s'élargit automatiquement quand il connecte un nouvel outil.

**Feature 2 : Le Style Learner — "C'est MON style"**

Lindy produit des drafts génériques. Chez nous, chaque correction de l'user est capturée. En 2 semaines, les drafts ressemblent à ce que l'user aurait écrit lui-même. Ça fonctionne sur tous les outputs : emails, messages Slack, résumés, rapports, réponses support.

**Vérification des 5 propriétés Lemlist :**
1. ✅ **Visible en 5 secondes** — "3 deals dormants, 5 tickets proches SLA, 6 CV non traités, €12K factures overdue" + actions prêtes
2. ✅ **Résultat immédiat** — tu envoies le draft, le ticket est traité, le deal avance, le candidat est relancé, la facture est suivie, la tâche est assignée
3. ✅ **Partageable** — "regarde ce que l'outil a trouvé dans notre boîte"
4. ✅ **Résout un vrai problème quotidien** — chaque métier a ses tâches qui tombent entre les mailles
5. ✅ **Simple à comprendre** — pas besoin de savoir ce qu'est un "agent"

Et surtout : **lié au CA.** Le draft réactive un deal qui dormait. Le ticket critique est traité avant le breach SLA. Le candidat qualifié ne tombe pas entre les mailles. La facture overdue est relancée. La tâche bloquante est reassignée. Mesurable en euros sur chaque métier.

### 2.3 Le Scan — Transversal, stress-testé, pas de bullshit

Le scan n'est pas juste l'onboarding. C'est le produit. Il tourne TOUS LES JOURS, sur TOUS les métiers connectés.

**Principe fondamental : un seul faux positif embarrassant tue la confiance pour toujours.** Mieux vaut 4 alertes justes que 8 alertes dont 3 sont fausses. Chaque signal ci-dessous a été vérifié contre les APIs réelles pour confirmer que la donnée existe et est fiable.

**Le scan s'adapte aux outils connectés.** Si la PME connecte son CRM → signaux sales. Si elle connecte Zendesk → signaux support. Si elle connecte les deux → vue croisée. Pas de scan générique unique, mais un scan qui se construit à partir de ce que l'entreprise utilise réellement.

---

**SALES — CRM (HubSpot, Pipedrive, Salesforce) + Email (Gmail/Outlook) + Calendar**

| Signal | Source technique | Fiabilité |
|--------|-----------------|-----------|
| Deals sans activité >X jours | CRM : `notes_last_updated` (HubSpot) / `last_activity_id` (Pipedrive). Un appel API. | **95%+** |
| Leads entrants non traités >24h | Email : threads entrants sans réponse. CRM : email non présent dans les contacts. | **90%+** |
| Emails envoyés sans réponse >48h | Email : `threads.get` → dernier message = le nôtre → delta timestamp. Cross-check CRM. | **85%** |
| Temps de réponse en hausse (tendance 4-6 sem) | Email : timestamps des messages dans les threads. Moyenne glissante. | **80%** |
| Fréquence d'échange en baisse (tendance 4-6 sem) | Email : comptage de messages par période par contact. Moyenne glissante. | **80%** |
| Meeting annulé sans replanification | Calendar API : event cancelled/declined + pas de nouvel event avec le même contact. | **90%** |

**SUPPORT — Zendesk, Freshdesk, Intercom, Crisp**

| Signal | Source technique | Fiabilité |
|--------|-----------------|-----------|
| Tickets ouverts sans réponse >Xh | Ticket `status` + `created_at` + absence de commentaire agent. Donnée structurelle. | **95%+** |
| SLA en passe d'être dépassé | Zendesk : API `ticket_metric_events` type `breach`. Freshdesk : `due_by` field. | **95%+** |
| Tickets non assignés | `assignee_id` = null sur ticket ouvert. Signal binaire. | **95%+** |
| Temps de résolution moyen en hausse | Calcul sur `solved_at - created_at` glissant 4 semaines. | **85%** |
| Tickets réouverts (indicateur insatisfaction) | Ticket passé de `solved` à `open`. Comptage sur période. | **90%** |

**MARKETING — HubSpot Marketing, Mailchimp, Google Ads, Meta Ads**

| Signal | Source technique | Fiabilité |
|--------|-----------------|-----------|
| Campagnes email avec taux d'ouverture en chute | Mailchimp/HubSpot : `open_rate` par campagne vs. moyenne historique. | **85%** |
| Leads MQL non transmis à sales >48h | HubSpot : `lifecyclestage` = MQL + pas de deal associé + delta > 48h. | **90%** |
| Budget ads dépensé sans conversion | Google Ads/Meta Ads : `cost` > seuil + `conversions` = 0 sur X jours. | **90%** |
| Landing pages avec taux de bounce anormal | Google Analytics : `bounce_rate` par page vs. moyenne. | **80%** |

**HR & RECRUTEMENT — Workable, Welcome to the Jungle, BambooHR, Lever**

| Signal | Source technique | Fiabilité |
|--------|-----------------|-----------|
| Candidatures non traitées >48h | Application `status` = new + `created_at` > 48h. Donnée structurelle. | **95%+** |
| Offres envoyées sans réponse >X jours | Offer `status` = sent + delta. | **90%** |
| Postes ouverts depuis >X jours sans shortlist | Job `created_at` + 0 candidats en phase interview. | **85%** |

**OPS & FINANCE — Pennylane, QuickBooks, Stripe, Xero**

| Signal | Source technique | Fiabilité |
|--------|-----------------|-----------|
| Factures impayées >X jours | Invoice `status` = unpaid/overdue + `due_date`. Donnée structurelle. | **95%+** |
| Abonnements en churning | Stripe : `subscription.status` = `past_due` ou `canceled`. | **95%+** |
| Paiements récurrents échoués | Stripe : `charge.failed` events. | **95%+** |

**PRODUCTIVITÉ & PROJETS — Asana, Monday, Notion, Trello**

| Signal | Source technique | Fiabilité |
|--------|-----------------|-----------|
| Tâches overdue | Task `due_date` < today + `completed` = false. Signal binaire. | **95%+** |
| Projets sans mise à jour >X jours | Project `modified_at` ou dernière tâche complétée. | **90%** |
| Tâches sans assigné avec deadline proche | Task `assignee` = null + `due_date` < 3 jours. | **95%+** |

---

**Pattern commun : tous ces signaux sont du metadata structurel.** Dates, statuts, compteurs, deltas. Pas de lecture de contenu, pas d'interprétation LLM pour la détection. Le LLM intervient UNIQUEMENT pour générer des drafts/actions contextuels.

**Signaux RETIRÉS du V1 après stress-test :**

| Signal retiré | Raison |
|---------------|--------|
| ~~Promesses non tenues (email)~~ | Nécessite lecture du body (trust barrier). Deadlines souvent vagues. Vérification impossible. **~60-70% de fiabilité = inacceptable.** |
| ~~Longueur des emails~~ | `sizeEstimate` Gmail ≠ longueur du texte écrit (inclut headers, quoted text, signature, PJ). |
| ~~Handoffs bloqués~~ | Forward = nouveau thread (invisible). Trop de faux positifs. |
| ~~Score de confiance sur drafts~~ | Aucune ground truth. Chiffre inventé. |

---

**Scan initial (onboarding, 2 min) — adapté aux outils connectés :**

Exemple PME avec CRM (HubSpot) + Support (Zendesk) + Facturation (Stripe) + Projets (Asana) + Marketing (Mailchimp) + HR (Workable) :

> **Sales — 3 deals (€47K) sans activité depuis 7+ jours**
> - Acme Corp (€23K) — dernière activité il y a 12 jours. **[Draft relance prêt]**
> - Beta SA (€15K) — email envoyé il y a 11 jours, pas de réponse. **[Draft prêt]**
> - Gamma (€9K) — aucune activité depuis 8 jours. **[Draft prêt]**
>
> **Support — 5 tickets proches du SLA**
> - Ticket #1204 (client premium) — SLA first reply dans 2h, pas encore assigné. **[Assigner + Draft réponse]**
> - 4 tickets ouverts >24h sans réponse agent. **[Voir les tickets]**
>
> **Marketing — 2 alertes**
> - Campagne "Webinar Février" : open rate 12% (vs. 28% moyenne). **[Voir la campagne]**
> - 3 MQLs non transmis à sales depuis >48h. **[Transmettre + Draft intro]**
>
> **HR — 6 candidatures non traitées**
> - Poste "Dev Frontend Senior" : 6 CV reçus >48h sans screening. **[Voir les candidats]**
>
> **Finance — 3 factures impayées (€12K)**
> - Facture #2024-089 (€5K) — overdue 14 jours. **[Draft relance paiement]**
> - 2 paiements Stripe échoués ce mois. **[Voir les détails]**
>
> **Projets — 8 tâches overdue cette semaine**
> - 3 tâches sans assigné avec deadline demain. **[Voir dans Asana]**
>
> **[Traiter les priorités] [Voir le dashboard complet]**

**Daily briefing (chaque matin, 8h) — par persona :**

Pour Thomas (Sales) :
> 🔴 2 deals à relancer. 1 lead non traité depuis 6h. Drafts prêts.
> 🟡 2 meetings aujourd'hui. Briefs préparés.

Pour Julien (Support) :
> 🔴 1 ticket premium proche SLA. 3 tickets non assignés.
> 📊 Temps de résolution moyen cette semaine : 4.2h (vs. 3.1h semaine dernière).

Pour Claire (Marketing) :
> 🔴 2 MQLs non transmis à sales depuis 3 jours. Campagne "Webinar Fév" : open rate en chute de 15%.
> 🟡 €350 dépensés sur Google Ads sans conversion depuis 8 jours.

Pour Antoine (HR) :
> 🔴 6 candidatures non traitées depuis >48h sur "Dev Frontend Senior."
> 🟡 1 offre envoyée sans réponse depuis 4 jours. Poste "Chef de Projet" ouvert depuis 45 jours sans shortlist.

Pour Sophie (CEO) :
> 🔴 €12K de factures overdue. 3 deals dormants. 5 tickets proches SLA. 6 CV non traités.
> 📊 Vue consolidée : 23 alertes traitées / 28 cette semaine.

**100% de la détection est metadata-only.** Le LLM intervient UNIQUEMENT pour la génération de drafts et actions contextuels.

### 2.4 Les ~93 Templates — Le catalogue complet

Comme Lemlist V1 était un outil de prospection COMPLET (pas un prototype avec une seule feature), on lance avec un catalogue complet. Lindy a 1,000+ templates. On vise ~93 au launch — suffisant pour couvrir tous les métiers d'une PME. Avec Claude Code, chaque template = quelques heures de dev (trigger + fetch données via Pipedream + prompt + eval rules + workflow React Flow).

**Principe dogfooding :** Les agents prioritaires sont ceux que Martin et Ombeline utilisent pour gérer leur propre boîte. Ils sont battle-tested avant d'être proposés aux users.

**💰 SALES (22 templates) :**

| Template | Description |
|----------|-------------|
| Lead Qualifier | Qualification de leads (critères BANT) |
| Sales Follow-up | Séquences de suivi commercial |
| Sales Meeting Recorder | Enregistrement et résumé de réunions commerciales |
| Lead Generator | Génération de leads |
| Lead Outreacher | Outreach personnalisé |
| Outbound Phone Call Agent | Appels sortants automatisés |
| Enrich New Leads | Enrichissement de leads (LinkedIn, web, firmographics) |
| LinkedIn Personalized Message Drafter | Messages LinkedIn personnalisés |
| AI Sales Development Representative | SDR automatisé complet |
| Contact Finder Info | Recherche de contacts et coordonnées |
| New Lead Qualifier | Qualification de nouveaux leads entrants |
| Case Study Drafter | Rédaction d'études de cas à partir des deals gagnés |
| Email Finder | Recherche d'emails professionnels |
| Sales Call Prep | Préparation d'appels commerciaux avec contexte relation |
| Sales Coach | Coaching commercial post-call (talk ratio, objections, next steps) |
| HubSpot Contact Assistant | Assistant contacts HubSpot (enrichissement, nettoyage) |
| Email Negotiator | Négociation par email avec suggestions stratégiques |
| In-depth Lead Researcher | Recherche approfondie de leads (company, persona, pain points) |
| Proposal Drafter | Rédaction de propositions commerciales |
| Inbound Sales Agent | Agent commercial entrant (qualification + routing) |
| ICP Insights Miner | Analyse de profil client idéal à partir des deals gagnés |
| Sales Insights | Dashboard insights commerciaux (patterns, trends, recommandations) |

**📢 MARKETING (20 templates) :**

| Template | Description |
|----------|-------------|
| Brand Monitor | Surveillance de marque (mentions, sentiment, concurrents) |
| Newsletter Writer | Rédaction de newsletters à partir du contenu récent |
| AI CMO Creative Agent | Création de contenus marketing multi-format |
| AI CMO Research Agent | Recherche marketing (trends, audience, competitors) |
| AI CMO Analysis Agent | Analyse marketing (ROI campagnes, attribution, recommandations) |
| SEO Blog Writer | Articles de blog optimisés SEO |
| Content Repurposing Agent | Recyclage de contenu multi-plateformes (blog → LinkedIn → Twitter → newsletter) |
| SEO Audit Agent | Audit SEO complet avec recommandations |
| SEO Assistant | Assistant SEO continu (keywords, backlinks, ranking) |
| Turn Podcasts into Blog Posts | Conversion podcast → article de blog |
| Partnership Collaboration Scout | Recherche de partenariats pertinents |
| Marketing Focus Group | Groupe de focus virtuel (simulation audience) |
| Copywriting Assistant | Assistant copywriting avec ton de marque |
| Influencer Outreach | Outreach influenceurs personnalisé |
| Press Release Drafter | Rédaction de communiqués de presse |
| Support Inbox Content Creator | Création de contenu FAQ/help center depuis les tickets support |
| Newsletters Into Twitter Content | Conversion newsletter → threads Twitter |
| Content Writer | Rédacteur de contenu long format |
| Social Media Manager | Gestionnaire réseaux sociaux (planning, création, scheduling) |

**🎧 SUPPORT (21 templates) :**

| Template | Description |
|----------|-------------|
| Customer Support Email Responder | Réponses email automatisées avec contexte client |
| SMS Support Bot | Support par SMS |
| WhatsApp Support Agent | Support WhatsApp |
| Email Triager | Tri intelligent d'emails (urgence, catégorie, routing) |
| Email Responder | Réponses automatiques personnalisées |
| Phone Support Agent | Support téléphonique IA |
| Website Customer Support | Chatbot site web avec knowledge base |
| Support Slackbot | Bot Slack interne pour questions équipe |
| AI Receptionist | Réceptionniste IA (accueil, routing, FAQ) |
| Knowledge Retrieval | Récupération intelligente de connaissances internes |
| Daily Support Email Report | Rapport quotidien support (volume, SLA, satisfaction) |
| Daily Slack Digest | Résumé quotidien des conversations Slack importantes |
| Urgent Ticket Alert Agent | Alertes temps réel sur tickets critiques |
| Support Ticket Dispatcher | Dispatch intelligent de tickets (compétences, charge, urgence) |
| Feedback Survey Agent | Collecte de feedback post-interaction |
| Customer Sentiment Tracker | Suivi du sentiment client dans le temps |
| Support FAQ Generator | Génération automatique de FAQ à partir des tickets récurrents |
| Support Bot with Human Handoff | Bot avec escalade humaine intelligente |
| Query Your Files | Interrogation de documents internes en langage naturel |
| Telegram Bot | Bot Telegram support |
| AI Customer Calls Rep | Représentant appels clients IA |

**🔬 RESEARCH / PRODUCT (14 templates) :**

| Template | Description |
|----------|-------------|
| Voice of the Customer | Analyse voix du client (patterns, sentiment, besoins) |
| Competition Tracker | Veille concurrentielle automatisée |
| Web Researcher | Recherche web avancée sur un sujet |
| Web Monitoring | Surveillance de sites web (changements, prix, contenu) |
| Daily Product Updates | MAJ produit quotidiennes (GitHub commits, PRs, issues) |
| User Research Notetaker | Notes structurées de recherche utilisateur |
| Design Critique Summarizer | Résumé de critiques design |
| Disseminate Meeting Insights | Partage automatique d'insights réunions aux bonnes personnes |
| User Feedback Tracker | Suivi et catégorisation du feedback utilisateur |
| Product Documentation Creator | Création de documentation produit |
| Bug Triage & Prioritization | Tri et priorisation automatique de bugs |
| Daily Product Feedback Email Report | Rapport quotidien feedback produit |
| Product Documentation Q&A Agent | Q&A sur la documentation produit |
| User Feedback Collector | Collecteur de feedback multi-canal |

**👥 HR & RECRUITING (15 templates) :**

| Template | Description |
|----------|-------------|
| Recruiting Agent | Agent de recrutement complet (sourcing → screening → scheduling) |
| Resume Screening Agent | Filtrage automatisé de CV (critères configurables) |
| Company Knowledge Base | Base de connaissances entreprise interrogeable |
| Employee Onboarding Assistant | Assistant onboarding (checklist, docs, follow-ups) |
| Hiring Team Sync Summary | Résumé synchronisation équipe recrutement |
| Candidate Evaluation Agent | Évaluation structurée de candidats |
| Candidate Screener | Screening rapide de candidats |
| AI Interview Answer Generator | Générateur de grilles d'évaluation entretien |
| Resume Data Extractor & Organizer | Extraction structurée de données CV |
| Interview Questions Generator | Générateur de questions d'entretien adaptées au poste |
| Candidate Background Researcher | Recherche background candidat (LinkedIn, publications, projets) |
| Job Description Optimizer | Optimisation d'offres d'emploi (inclusivité, attractivité, SEO) |
| Offer Letter Generator | Générateur de lettres d'offre personnalisées |
| Offer Negotiation Assistant | Assistant négociation offres |
| HR Policy Bot | Bot politique RH (congés, avantages, process) |

**⚙️ OPERATIONS (7 templates) :**

| Template | Description |
|----------|-------------|
| AI Todos Manager | Gestionnaire de tâches IA (priorisation, rappels, redistribution) |
| Vendor Invoice & Payment Tracker | Suivi factures fournisseurs et paiements |
| Project Status Updater | MAJ automatique statut projet |
| Daily Ops Digest | Résumé opérations quotidien |
| Meeting Agenda & Follow-up | Agenda pré-meeting + suivi post-meeting |
| Overdue Task Nudger | Rappels intelligents tâches en retard |
| Inventory Low-Stock Alert | Alertes stock bas |

**📅 PRODUCTIVITY (3 templates) :**

| Template | Description |
|----------|-------------|
| Meeting Scheduler | Planification intelligente de réunions (disponibilités, fuseaux) |
| Email Assistant | Rédaction et gestion d'emails (triage, drafts, templates) |
| Task Manager | Organisation des tâches et projets |

**🛠️ CUSTOM (1 template) :**

| Template | Description |
|----------|-------------|
| Custom Agent | Agent personnalisable — l'user définit trigger, sources, prompt, actions via React Flow |

**📊 Résumé par catégorie :**

| Catégorie | Templates | Personas cibles |
|-----------|-----------|----------------|
| Sales | 22 | Thomas (Sales Director) |
| Support | 21 | Julien (Head of Support) |
| Marketing | 20 | Claire (Responsable Marketing) |
| HR & Recruiting | 15 | Antoine (DRH) |
| Research / Product | 14 | Product Manager, CEO |
| Operations | 7 | Sophie (Head of Ops) |
| Productivity | 3 | Tous |
| Custom | 1 | Power users |
| **TOTAL** | **~93** | |

**Ce qui fait la différence vs Lindy (1,000 templates) :**

1. **Le scan comme hook** — "3 deals dormants, 5 tickets proches SLA, 6 CV non traités, €12K factures overdue" avant même d'activer un agent. Lindy n'a pas ça.
2. **Chaque agent a le Style Learner** — s'améliore avec les corrections de l'utilisateur.
3. **Chaque agent est dogfoodé** — testé sur une vraie boîte avec des vrais résultats documentés.
4. **Plug-and-play pour non-tech** — pas de workflow à configurer from scratch. Connecte tes outils, choisis un template, customise si tu veux via React Flow.
5. **Couverture multi-métier** — sales, marketing, support, HR, ops, product. Pas juste sales.

**Extension V1.1+ :** Guidée par le feedback users. Quand Thomas demande un template qu'on n'a pas, c'est le signal pour le construire.

### 2.5 Eval Layer — Confiance visible

**Pourquoi c'est un différenciateur :** Lindy génère un draft, tu ne sais pas pourquoi il dit ce qu'il dit. Tu ne sais pas si l'agent est sûr de lui ou s'il invente. Tu dois tout relire à chaque fois. Chez nous, chaque output d'agent passe par 3 couches d'évaluation et le user VOIT le résultat. C'est la différence entre "un assistant dont tu ne sais jamais s'il a bien fait" et "un assistant qui te dit quand il doute."

#### L1 — Assertions (checks déterministes)

Des règles codées en dur, exécutées après chaque output. Zéro LLM, <10ms, 100% fiables.

**Assertions par type d'agent :**

| Catégorie | Assertion | Fail → |
|-----------|-----------|--------|
| **Tout output texte** | Contient le nom du destinataire/contact | ❌ Output bloqué, régénéré |
| **Tout output texte** | Ne contient PAS de placeholder type [NOM], [ENTREPRISE], {variable} | ❌ Output bloqué |
| **Tout output texte** | Longueur dans la range attendue (configurable par agent) | ⚠️ Warning visible |
| **Tout output texte** | Pas de contenu en anglais si user en français (et vice versa) | ⚠️ Warning |
| **Tout output texte** | Pas de données d'un autre contact/deal/ticket dans l'output (cross-contamination) | ❌ Output bloqué, alert critique |
| **Sales : Follow-Up / Deal Revival** | Référence un échange réel (date ou sujet extrait des données fetchées) | ❌ Draft bloqué si aucune référence |
| **Sales : CRM Update** | Le champ à modifier existe dans le CRM connecté | ❌ Action bloquée |
| **Sales : Outbound** | L'email du destinataire est valide (regex + MX check) | ❌ Action bloquée |
| **Support : Ticket Response** | Référence le numéro du ticket et le sujet original | ❌ Draft bloqué |
| **Support : Ticket Response** | Ne propose pas une action que l'agent n'a pas le droit de faire (ex: remboursement) | ⚠️ Warning |
| **HR : Candidate Reply** | Référence le poste et le nom du candidat | ❌ Draft bloqué |
| **HR : Candidate Reply** | Pas de mention de salaire sauf si explicitement dans la config | ⚠️ Warning |
| **Marketing : Content** | Respecte le word count cible du format (tweet ≠ blog post) | ⚠️ Warning |
| **Finance : Invoice Follow-Up** | Montant et date d'échéance correspondent à la facture dans Stripe/QuickBooks | ❌ Draft bloqué si montant incorrect |
| **Finance : Invoice Follow-Up** | Inclut le lien de paiement si disponible | ⚠️ Warning |
| **Ops : Meeting Prep** | Liste au moins 1 participant et 1 point d'agenda | ❌ Bloqué si vide |

**Implémentation :** Chaque template d'agent déclare ses assertions dans sa config. Le moteur d'exécution les run automatiquement. Un assert fail = le draft ne passe pas à L2.

```typescript
eval_assertions: [
  { check: "contains_recipient_name", severity: "block" },
  { check: "no_placeholders", severity: "block" },
  { check: "references_real_exchange", severity: "block" },
  { check: "word_count_range", min: 50, max: 500, severity: "warn" },
  { check: "correct_language", severity: "warn" },
  { check: "no_cross_contamination", severity: "block" }
]
```

#### L2 — Score de confiance (rule-based, 0-100)

Un score composite calculé SANS LLM, basé sur des métriques objectives.

**Composantes du score :**

| Signal | Poids | Comment c'est calculé | Exemple |
|--------|-------|----------------------|---------|
| **Historique de validation** | 35% | % des N derniers outputs similaires envoyés sans modification | 8/10 derniers outputs envoyés tels quels → 80/100 |
| **Complétude des données** | 25% | % des sources de données que l'agent a réussi à fetcher | Source 1 ✅ + Source 2 ✅ + Source 3 ❌ (token expiré) → 67/100 |
| **Fraîcheur des données** | 20% | Âge des données les plus récentes utilisées | Dernière donnée: il y a 2h → 95/100. Dernière donnée: il y a 30j → 30/100 |
| **Assertions L1 passées** | 20% | Ratio assertions passed vs warnings | 5/5 passed, 0 warnings → 100/100. 4/5 passed, 1 warning → 80/100 |

**Score composite :** `confidence = (historique × 0.35) + (complétude × 0.25) + (fraîcheur × 0.20) + (assertions × 0.20)`

**Ce que l'user voit (adapté selon l'agent) :**

Sales Follow-Up :
```
Score: 91/100  ████████████████████░░
├── Historique: 94% (vos 8 derniers outputs similaires envoyés sans modif)
├── Données: 100% (Gmail ✅ HubSpot ✅ Calendar ✅)
├── Fraîcheur: 88% (dernières données: il y a 4h)
└── Checks: 80% (5/5 passés, 1 warning: longueur)
```

Resume Screening :
```
Score: 88/100  █████████████████░░░░
├── Historique: 85% (vos 6 derniers screenings approuvés sans modif)
├── Données: 100% (Workable ✅ Job Description ✅)
├── Fraîcheur: 95% (dernières données: il y a 1h)
└── Checks: 80% (4/4 passés, 1 warning: candidat senior)
```

Invoice Follow-Up :
```
Score: 94/100  ██████████████████░░░
├── Historique: 92% (vos 10 dernières relances envoyées sans modif)
├── Données: 100% (Stripe ✅ HubSpot ✅)
├── Fraîcheur: 98% (dernières données: il y a 30min)
└── Checks: 100% (5/5 passés, montant vérifié, lien paiement inclus)
```

**Thresholds d'action :**

| Score | Couleur | Comportement |
|-------|---------|-------------|
| 85-100 | 🟢 Vert | "Prêt à envoyer." Si mode auto activé → envoi automatique. |
| 60-84 | 🟡 Jaune | "Vérifiez avant d'envoyer." Toujours en attente d'approbation. |
| 40-59 | 🟠 Orange | "Confiance faible — données incomplètes ou obsolètes." Draft affiché mais flaggé. |
| 0-39 | 🔴 Rouge | "Draft non fiable." Affiché avec warning mais action désactivée. L'user doit réécrire. |

#### L3 — LLM-as-Judge (review avant actions irréversibles)

Un second appel LLM (Claude Haiku — rapide et pas cher) qui review l'output avant qu'il soit présenté à l'user. Ce n'est PAS le même LLM qui a généré le draft.

**Quand L3 se déclenche :**
- Toute action irréversible (envoyer un email, répondre à un ticket, modifier le CRM, poster sur Slack, envoyer une offre candidat)
- Score L2 < 70 (le système doute, second avis)
- Premier output pour un nouveau contact/ticket/candidat (pas d'historique)
- L'agent détecte un sujet sensible (réclamation, résiliation, conflit, candidature senior)

**Ce que L3 vérifie :**

| Check | Prompt simplifié | Fail → |
|-------|-----------------|--------|
| **Cohérence de ton** | "Cet output est-il cohérent avec les 5 derniers outputs de ce user pour ce type d'agent ?" | ⚠️ Warning : "Le ton est plus formel que d'habitude" |
| **Hallucination check** | "Chaque fait mentionné est-il présent dans les données sources ci-dessous ?" | ❌ Block : "Le draft mentionne un meeting le 15 mars qui n'existe pas dans les données" |
| **Appropriateness** | "Cet output est-il approprié étant donné le contexte ?" | ❌ Block : exemples — "Le contact a 3 tickets critiques ouverts, une relance commerciale serait mal perçue" / "Le candidat a refusé l'offre, ne pas relancer sur le même poste" |
| **Complétude** | "L'output répond-il à l'objectif de l'agent ?" | ⚠️ Warning : "Le draft est trop vague, ne mentionne pas l'objet de la relance" |

**Coût L3 :** Claude Haiku à $0.80/1M tokens. Un eval L3 = ~500 tokens input + ~100 tokens output = ~$0.0005. Sur 1,000 evals/jour = $0.50/jour. Négligeable.

**Ce que l'user voit quand L3 intervient :**

```
⚠️ L3 Review — 1 point d'attention (Sales Follow-Up) :
"Le draft mentionne 'comme convenu lors de notre call' mais aucun call
n'apparaît dans votre calendrier avec ce contact sur les 30 derniers jours.
Vérifiez avant d'envoyer."
[Envoyer quand même] [Modifier le draft]
```

```
⚠️ L3 Review — 1 point d'attention (Support Ticket Reply) :
"Le draft propose un remboursement, mais votre policy limite les remboursements
aux commandes < 30 jours. Ce ticket concerne une commande de 45 jours."
[Envoyer quand même] [Modifier le draft]
```

```
⚠️ L3 Review — 1 point d'attention (Resume Screening) :
"Le screening rejette un candidat pour 'expérience insuffisante' mais son CV
mentionne 4 ans chez Datadog en tant que Senior Frontend. Vérifiez les critères."
[Confirmer le rejet] [Revoir le candidat]
```

```
⚠️ L3 Review — 1 point d'attention (Invoice Follow-Up) :
"La facture #2024-089 a un avoir en cours de traitement (€1,200). Le montant
de relance devrait être €3,800 et non €5,000. Draft ajusté."
[Envoyer le draft ajusté] [Modifier]
```

#### Autonomie progressive — de draft-only à auto-pilot

L'eval layer ne sert pas qu'à vérifier — elle sert à **construire la confiance progressivement** jusqu'à l'autonomie.

| Phase | Condition | Comportement | L'user fait |
|-------|-----------|-------------|-------------|
| **Phase 1 : Draft-only** | Par défaut, semaines 1-2 | Tout est un draft en attente d'approbation. Rien ne part sans clic. | Review chaque draft, approuve/modifie/rejette |
| **Phase 2 : Batch approve** | 5+ validations sans modif pour un type d'agent | "Approuver tout" se débloque. L'user peut valider 10 drafts en 1 clic. | Review rapide, approve en batch |
| **Phase 3 : Auto-send conditionnel** | 20+ validations <10% modif + score L2 > 85 | L'agent propose : "Activer l'envoi automatique pour cet agent quand le score > 85 ?" | L'user choisit quels agents passent en auto |
| **Phase 4 : Full auto** | 50+ validations, modif rate < 5%, zéro L3 block en 30j | L'agent agit seul pour les actions réversibles (draft → send). Les actions irréversibles restent en approval. | L'user check le daily briefing, intervient sur les exceptions |

**Rollback automatique :** Si après passage en Phase 3-4, le taux de modification remonte > 30% ou un L3 block survient, l'agent revient automatiquement en Phase 2. Le user est notifié : "L'agent Follow-Up est revenu en mode approbation suite à 3 modifications consécutives."

**Le data model de l'eval :**

Chaque exécution d'agent produit un `AgentRun` stocké en DB :

```typescript
model AgentRun {
  id              String    // unique run ID
  agentTemplateId String    // quel agent template
  userId          String    // quel user
  triggeredAt     DateTime  // quand l'agent s'est déclenché
  triggeredBy     String    // "cron" | "webhook" | "manual"

  // Données fetchées
  dataSources     Json      // { gmail: { status: "ok", count: 12 }, hubspot: { status: "ok", count: 3 } }

  // Output
  outputType      String    // "draft_email" | "draft_ticket_reply" | "crm_update" | "slack_message" | "alert" | "report" | "task_action" | "candidate_screening" | "invoice_followup" | "marketing_alert"
  outputContent   String    // le draft, l'action, ou le rapport
  llmModel        String    // "gemini-flash" | "haiku-3.5" | "sonnet-4"
  llmTokensUsed   Int       // pour tracking coûts

  // Eval L1
  l1Assertions    Json      // [{ check: "contains_name", passed: true }, ...]
  l1Passed        Boolean   // toutes les assertions block passées ?

  // Eval L2
  l2Score         Int       // 0-100
  l2Breakdown     Json      // { history: 94, completeness: 100, freshness: 88, assertions: 80 }

  // Eval L3 (nullable — pas toujours déclenché)
  l3Triggered     Boolean
  l3Model         String?   // "gemini-flash"
  l3Checks        Json?     // [{ check: "hallucination", passed: true }, ...]
  l3Blocked       Boolean?
  l3Reason        String?   // "Draft mentionne un meeting inexistant"

  // User action
  userAction      String?   // "approved" | "modified" | "rejected" | "pending"
  userModifiedAt  DateTime?
  draftDiff       String?   // diff entre output original et version envoyée (pour Style Learner)

  // Résultat final
  finalAction     String?   // "sent" | "blocked" | "cancelled"
  finalAt         DateTime?
}

### 2.6 Style Learner — Les outputs deviennent "les tiens"

1. Agent génère un output (draft email, réponse ticket, message Slack, rapport)
2. L'user modifie (raccourcit, change le ton, reformule, ajoute du contexte)
3. Diff capturé
4. 10 derniers diffs injectés en few-shot
5. Prochain output est plus "toi"

Résultat : taux de modification ~70% (semaine 1) → ~20% (mois 3).

C'est le compound advantage. M1 : agents équivalents à la concurrence. M3 : meilleurs parce qu'ils ont appris. M6 : significativement meilleurs. Un concurrent qui arrive en M6 part de zéro.

### 2.7 Intégrations — Pipedream Connect + Agents autonomes

**Le principe :** On ne construit PAS une couche d'abstraction entre les outils et les agents. Chaque agent sait ce dont il a besoin et va chercher ses données directement via Pipedream Connect. C'est exactement ce que fait Lindy. Simple, rapide, éprouvé.

**Couche infra : Pipedream Connect**

Pipedream gère toute la plomberie : OAuth, tokens, refresh, rate limits, retries, et fournit des actions pré-built pour 2,800+ APIs. C'est ce qu'utilise Lindy pour ses "4,000+ intégrations."

**Coût :** $150/mois + $2/user/mois. À €160/mois minimum côté client = ~1.2% du revenue. À 1,000 users = $2,150/mois — absorbé dans la marge.

**Comment chaque agent fonctionne :**

```
User connecte ses outils (HubSpot, Gmail, Zendesk, Asana, Stripe, BambooHR...)
        ↓
[Pipedream Connect] — OAuth, tokens, refresh, rate limits, CRUD
        ↓
[Agent] — fetch les données dont IL a besoin, génère un output, eval L1/L2/L3
        ↓
Output → Approval Queue → User envoie/approuve ou modifie → Style Learner capture
```

Pas de couche intermédiaire. Pas d'abstraction. L'agent est autonome.

**Exemple concret — Deal Revival Agent (Sales) :**

1. Fetch CRM (via Pipedream) : deals sans activité > 30 jours → trouve Acme Corp, €23K, stale depuis 34j
2. Fetch Email (via Pipedream) : derniers emails avec le contact → Pierre a dit de revenir le 20 jan
3. Fetch Calendar (via Pipedream) : prochain meeting ? → aucun planifié
4. Draft : "Bonjour Pierre, je souhaitais revenir vers vous suite à notre échange du 15 janvier sur le pricing en 3 phases..."
5. Eval L1 : ✅ nom correct, ✅ référence échange réel. L2 : ✅ ton cohérent. Score : 87
6. → Approval Queue

**Exemple concret — Urgent Ticket Alert Agent (Support) :**

1. Fetch Zendesk (via Pipedream) : tickets ouverts + `sla_policy` → trouve Ticket #1204, client Premium, SLA first reply dans 2h, non assigné
2. Fetch CRM (via Pipedream) : le contact est client €31K/an, 3 tickets ouverts en parallèle
3. Alert : "🔴 Ticket #1204 (client Premium, €31K/an) — SLA first reply dans 2h, non assigné. 3 tickets ouverts en parallèle."
4. Draft réponse : basé sur la FAQ interne + historique tickets du client
5. Eval L1 : ✅ numéro ticket, ✅ pas de promesse hors scope. L2 : score 92
6. → Notification Slack + Draft dans Approval Queue

**Exemple concret — Resume Screening Agent (HR) :**

1. Fetch ATS (via Pipedream) : nouvelles candidatures sur "Senior Dev Frontend" → 14 CV reçus dans les dernières 24h
2. Fetch job description : critères obligatoires (React, 3+ ans, FR ou EN)
3. Screening : chaque CV évalué contre les critères. 6 matchent, 5 partiels, 3 hors scope
4. Output : tableau de screening avec score + justification par candidat
5. Eval L1 : ✅ tous les critères évalués, ✅ pas de biais détecté (pas de filtre sur âge/genre/origine). L2 : score 88
6. → Approval Queue (le DRH review avant de passer en entretien)

**Exemple concret — Campaign Health Monitor (Marketing) :**

1. Fetch Mailchimp (via Pipedream) : dernières campagnes email + rapports → open rate campagne "Webinar Fév" = 12%
2. Fetch historique : moyenne des 10 dernières campagnes = 28%
3. Alert : "🟡 Campagne 'Webinar Fév' : open rate 12% (vs. 28% moyenne). Chute de 57%."
4. Draft : suggestions d'amélioration (sujet, timing, segment)
5. Eval L1 : ✅ pourcentages vérifiés, ✅ campagne identifiée. L2 : score 85
6. → Notification Slack + Dashboard Marketing

**Exemple concret — Invoice Follow-Up Agent (Finance) :**

1. Fetch Stripe (via Pipedream) : invoices `status = open` + `due_date` dépassé → 3 factures overdue, total €12K
2. Fetch CRM (via Pipedream) : identifier le contact associé à chaque facture
3. Draft relance paiement personnalisé par facture avec montant, date d'échéance, lien de paiement
4. Eval L1 : ✅ montant correct, ✅ nom du contact, ✅ lien de paiement inclus. L2 : score 92
5. → Approval Queue (le comptable valide avant envoi)

Chaque agent peut croiser plusieurs sources SI c'est pertinent pour son job. Pas parce qu'une architecture l'impose, mais parce que l'agent en a besoin. Le Deal Revival Agent croise CRM + Email + Calendar naturellement. L'Urgent Ticket Alert croise Zendesk + CRM. Le Resume Screening Agent croise l'ATS + job description. Le Campaign Health Monitor ne lit que Mailchimp — pas besoin de plus. L'Invoice Follow-Up croise Stripe + CRM pour personnaliser la relance.

**Pourquoi pas les alternatives :**
- Unified APIs (Merge, $650/mois) : plus petit dénominateur commun, pas de custom fields
- Nango (open source) : 500 APIs vs 2,800, self-hosting coûte du temps de dev
- Build from scratch : Lindy a dépensé $1M pour 250 intégrations en 2 ans

**Risque Workday :** Pipedream racheté par Workday. Si direction change dans 18+ mois, on aura validé le PMF et on pourra internaliser les 5-6 connecteurs critiques + Nango.

**Catégories d'outils supportés par métier :**

| Catégorie métier | Outils via Pipedream | Agents concernés |
|-----------------|---------------------|-----------------|
| **Productivité (socle)** | Gmail, Outlook, Google Calendar, Outlook Calendar, Slack, Teams, Discord, Google Drive, Notion, SharePoint | Tous les agents — email, calendar et messaging sont le socle |
| **Sales** | HubSpot, Salesforce, Pipedrive, Zoho, Close, Copper, LinkedIn Sales Nav, Apollo, Clearbit, DocuSign, PandaDoc | Deal Revival, Follow-Up, Lead Scorer, Pipeline Reporter, Deep Enrichment, Cold Email Sequencer |
| **Marketing** | Mailchimp, ActiveCampaign, Brevo, HubSpot Marketing, Klaviyo, Google Ads, Meta Ads | Campaign Health Monitor, Content Repurposing, Newsletter Writer, SEO Blog Writer, Brand Monitor |
| **Ops** | Asana, Monday, Trello, ClickUp, Zendesk, Intercom, Freshdesk, Typeform, Google Forms | AI Todos Manager, Overdue Task Nudger, Project Status Updater, Client Health Monitor, Support FAQ Generator, Action Item Tracker |
| **HR** | BambooHR, Personio, Gusto, Greenhouse, Lever | Onboarding Checklist, Candidate Follow-Up, Document Collector |
| **Finance** | Stripe, QuickBooks, Xero, Pennylane | Invoice Follow-Up, Vendor Invoice Tracker, Subscription Churn Alert |

**Ce qu'on ne construit PAS :**
- Pas de "Context Builder" comme abstraction séparée — chaque agent fetch ce dont il a besoin
- Pas de "Crossing Engine" — le croisement est dans la logique de chaque agent, pas dans une couche
- Pas d'intégrations e-commerce (Shopify) au launch — on se focus sur les outils transversaux des PME

**L'avantage de cette approche :**
- **Simplicité :** chaque agent est autonome, facile à débugger, facile à améliorer
- **Vitesse de dev :** avec Claude Code, chaque agent template = quelques heures de dev, pas des jours
- **Scalabilité :** ajouter un agent = écrire sa logique de fetch + son prompt, pas rewirer une architecture
- **93 templates en 3 semaines** = faisable parce que chaque template suit le même pattern (trigger + fetch données + prompt + eval + action)

**Comparaison avec Lindy :**

| | Lindy | Nous |
|---|---|---|
| **Intégrations** | 4,000+ via Pipedream | 2,800+ via Pipedream (même infra) |
| **Agents** | 1,000+ templates | ~93 templates au launch, extensible |
| **Approche** | Agent autonome, trigger → action | Identique + scan € et style learner |
| **Onboarding** | Configure ton workflow | Plug-and-play : connecte tes outils, les agents travaillent |
| **Ce qu'on a en plus** | — | Scan transversal (détection proactive sur sales, support, marketing, HR, finance, projets), Style Learner (les drafts deviennent les tiens) |
| **Ce qu'on a en moins** | — | Moins de templates (100 vs 1,000), moins de maturité, pas de track record |

**Le wedge se trouvera en usage.** Au launch, on est un Lindy avec scan € et style learner. En M1-M3, les données d'usage nous diront quel segment, quel agent, quelle feature fait la différence. Le vrai wedge émerge, on ne le décrète pas.


### 2.8 Data Collection Layer

On ne construit pas de moteur prédictif. On collecte.

| Donnée | Source | Usage immédiat | Usage futur |
|--------|--------|----------------|-------------|
| **Action Log** | Chaque action agent + résultat | Score L2, métriques | Amélioration prompts |
| **Draft Diffs** | Draft original vs version envoyée | Style Learner | Fine-tuning par compte |
| **Interaction Patterns** | Metadata (qui↔qui, fréquence, temps réponse, tickets, tâches) | Scan tendances, alertes | Détection patterns par vertical |
| **Agent Performance** | Taux d'approbation, modification, rejet par agent | Dashboard, priorités dev | Recommandation agents |

Principe : métadonnées, diffs, patterns. JAMAIS le contenu brut des emails ou tickets.

---

## 3. Dogfooding — Le pilier stratégique

Ce n'est pas une tactique marketing. C'est la stratégie produit.

### 3.1 Pourquoi c'est central

Guillaume prospectait pour Lemlist AVEC Lemlist. Quand un prospect recevait un cold email avec son nom sur un whiteboard et bookait un call, Guillaume pouvait dire : "Tu viens de vivre le produit."

Nous : on gère notre boîte entièrement avec nos propres agents.

| Opération | Agent utilisé | Preuve produit |
|-----------|--------------|----------------|
| **Sales** — Prospection outbound | Cold Email Sequencer + Lead Research + LinkedIn Outreach | "Ce cold email a été écrit par notre agent" |
| **Sales** — Follow-up prospects | Deal Revival + Follow-Up Agent | "Notre agent a détecté que tu n'avais pas répondu en 9 jours" |
| **Sales** — Réponse leads entrants | Speed-to-Lead | "Notre agent t'a répondu en 3 minutes" |
| **Support** — Réponses utilisateurs | Customer Support Email Responder + FAQ Builder | "La réponse support que tu as reçue a été drafté par notre agent" |
| **Support** — Triage tickets | Email Triager + Urgent Ticket Alert | "Les tickets critiques sont escaladés en <5 min" |
| **Marketing** — Contenu | Content Repurposing + Newsletter Writer + SEO Blog Writer | "Cet article de blog et cette newsletter ont été générés par nos agents" |
| **Marketing** — Veille | Brand Monitor + Competition Tracker | "On sait quand quelqu'un parle de nous ou de nos concurrents en temps réel" |
| **HR** — Recrutement | Resume Screening + Candidate Follow-Up | "Le screening de nos candidats est fait en 2 min au lieu de 3 jours" |
| **Ops** — Meetings & projets | Meeting Prep + Action Item Tracker + Project Status Updater | "Le brief de ce call a été préparé par notre agent" |
| **Ops** — CRM propre | CRM Data Guardian + Deep Enrichment | "Notre HubSpot est nettoyé automatiquement chaque jour" |
| **Ops** — Reporting | Pipeline Reporter + Daily Ops Digest | "Nos reports hebdo sont générés automatiquement" |

### 3.2 Le cercle vertueux

```
Martin utilise les agents pour gérer la boîte
  → Trouve des bugs/frictions → Améliore le produit
  → Documente les résultats → Contenu authentique
  → La communauté voit les résultats → Veut le même outil
  → Deviennent users → Leur feedback améliore le produit
  → Martin documente les améliorations → Plus de contenu
  → etc.
```

C'est le "Growth Circle of Love" de Guillaume, appliqué à notre produit.

### 3.3 Chaque agent est dogfoodé avant d'être lancé

Pas de templates théoriques. Chaque agent dans le catalogue est un agent que Martin ou Ombeline utilise, avec de vrais résultats documentés.

"Le Deal Revival Agent a été testé sur notre propre pipeline pendant 3 semaines. Résultat : 12 deals réactivés, €34K de pipeline remis en mouvement, taux de modification des drafts passé de 68% à 22%."

"Le Customer Support Email Responder tourne sur nos propres tickets depuis 2 semaines. Résultat : temps de première réponse passé de 4h à 45 min. 60% des réponses envoyées sans modification."

"Le Content Repurposing Agent transforme chaque article de blog en 5 formats (LinkedIn post, tweet thread, newsletter snippet, résumé Slack, short video script). On publie 5x plus avec le même effort."

Personne d'autre ne peut dire ça. Les templates de Lindy sont des configurations génériques. Les nôtres sont battle-tested sur une vraie boîte, avec des screenshots réels et des métriques publiques.

---

## 4. La communauté — Le craft, pas le produit

### 4.1 Le modèle Lemlist

Guillaume n'a pas créé "The Lemlist Users Group." Il a créé **"The Sales Automation Family"** — une communauté sur le MÉTIER de la prospection. Les gens venaient pour apprendre à mieux prospecter. Lemlist était le tool montré dans chaque exemple.

Contenu type dans la communauté Lemlist :
- Templates de campagnes réelles avec taux de réponse
- "Lemlister of the Week" : un user showcasé avec sa campagne, ses résultats
- Discussions sur les meilleures techniques de cold email
- Guillaume qui partage ses propres campagnes

### 4.2 Notre communauté

**Nom de travail : "AI Ops Community"** (ou meilleur) — une communauté sur le craft de l'automatisation business avec l'AI.

Pas "comment utiliser notre produit." Mais "comment utiliser l'AI pour gérer ta boîte."

**Contenu type :**

- "Comment j'ai relancé 15 deals dormants en 20 minutes — voici les drafts (avant/après)"
- "Mon agent support a résolu 40% des tickets sans intervention humaine — setup complet"
- "Before/after : le draft ChatGPT vs le draft avec contexte complet (email, ticket, candidature)"
- "Le scan de mon entreprise a trouvé 3 deals dormants, 5 tickets proches SLA, 6 CV en attente, et €12K de factures overdue."
- "Semaine 4 avec le Style Learner : mes drafts sont modifiés à 25% contre 70% la première semaine"
- "Comment mon agent RH a screené 200 CV en 30 minutes — critères, résultats, surprises"
- "Mon agent marketing recycle chaque article en 5 formats — voici le workflow complet"
- "Comment le scan a détecté €15K de factures overdue que personne ne suivait — 3 relances envoyées en 10 min"

**"Agent of the Week" :** Chaque semaine, un user showcasé avec ses agents, ses résultats réels, son setup. L'user partage avec son réseau (visibilité gratuite). Les autres veulent être le prochain.

### 4.3 Build in public

Martin et Ombeline documentent TOUT. Revenue, erreurs, décisions produit, résultats des agents sur leur propre boîte. Transparence totale.

"Day 3 : j'ai lancé le scan sur nos outils. Résultat : 3 deals dormants (€47K), 5 tickets support proches du SLA, 2 MQLs non transmis, 4 CV non traités depuis 3 jours, 2 factures overdue, 8 tâches sans assigné. Embarrassant mais révélateur. Les actions sont prêtes."

"Week 2 : le Style Learner commence à écrire comme moi. Le draft de relance pour Client X mentionnait le pricing en 3 phases qu'on avait discuté — je n'aurais pas pensé à le mentionner moi-même. Côté support : les réponses commencent à avoir notre ton. Côté HR : le screening de CV flag les bons critères sans qu'on les re-précise à chaque fois."

"Month 1 : 47 actions traitées via les agents. Sales : 12 deals relancés, €34K réactivé. Support : temps de première réponse passé de 4h à 45 min. Marketing : 8 articles recyclés en 40 posts LinkedIn. HR : 45 CV screenés en 30 min au lieu de 3 jours. Finance : €8K de factures overdue relancées automatiquement. Avant les agents : on faisait tout ça à la main."

Chaque post est simultanément : contenu authentique + preuve produit + template réplicable.

---

## 5. Implementation

### 5.1 MVP Sprint Plan (3 semaines)

**Semaine 1 : Core Engine + Pipedream + Scan transversal + Agents Sales (first vertical)**

Martin :
- Days 1-2 : Monorepo setup (pnpm + Turbo + packages). Agent execution engine (BullMQ + Redis) + Eval layer (L1/L2/L3) + Pipedream Connect setup + LLM routing (Haiku/Sonnet/Opus via @anthropic-ai/sdk). Credential encryption (AES-256). Config typée (@Env + Zod). Lifecycle hooks + AI event logging. Soumission Google OAuth. Le moteur est générique — chaque agent est une config (trigger + données à fetcher via Pipedream + prompt + llm_tier + maxStepsPerRun + eval rules). Avec Claude Code, chaque nouveau template = quelques heures.
- Day 3 : Business Scan — OAuth pour les outils connectés. Détection transversale : deals dormants (CRM), tickets proches SLA (support), MQLs non transmis (marketing), candidatures non traitées (HR), factures overdue (finance), tâches overdue (projets). Output framé par métier. Style Learner core.
- Day 4 : Deal Revival Agent + Follow-Up Agent + CRM Data Guardian. Connecteurs HubSpot/Pipedrive/Salesforce via Pipedream.
- Day 5 : Deep Enrichment + Lead Scorer + Speed-to-Lead.
- Days 6-7 : Pipeline Reporter + Deal Alert. Outbound Engine + Cold Email Sequencer + Lead Research.

Ombeline :
- Jour 1 : Domaines + DNS + mailboxes + privacy policy + Google verification video
- Jour 2-14 : Warmup + listes prospects + séquences cold email (dogfooding dès que les agents outbound sont prêts)

**Semaine 2 : Agents Support + Ops + HR + Marketing + Templates en masse**

- Day 8 : Support agents core — Customer Support Email Responder + Email Triager + Urgent Ticket Alert + Support Ticket Dispatcher. Connecteurs Zendesk/Freshdesk/Intercom via Pipedream.
- Day 9 : Client Health Monitor + Meeting Prep/Recap + Action Item Tracker
- Day 10 : Marketing agents — Content Repurposing + Newsletter Writer + SEO Blog Writer + Brand Monitor
- Day 11 : LinkedIn Outreach + Outbound Reporter + Cold Email polish
- Day 12 : HR agents (Resume Screening, Candidate Follow-Up, Employee Onboarding Assistant)
- Day 13 : Daily Briefing par persona (agrégation par métier : sales, support, ops, marketing). Ops agents : Overdue Task Nudger + Vendor Invoice Tracker.
- Day 14 : Martin et Ombeline dogfoodent le produit sur leur propre boîte. Bug bash. UX fixes.

**Semaine 3 : Workflow Editor + Templates supplémentaires + Polish + Launch**

- Day 15 : React Flow workflow editor — affichage des templates en nodes visuels, customisation par l'user (modifier triggers, conditions, actions). Chaque template = un workflow pré-configuré éditable.
- Day 16 : ~60-70 templates supplémentaires via Claude Code (les ~20-30 core sont faits en semaine 1-2, reste ~60-70 sur les 93). Chaque template = trigger + fetch Pipedream + prompt + llm_tier + eval rules.
- Day 17 : Onboarding wizard (connecter outils → scan transversal → résultats par métier → activation agents). Approval Queue. Agent Dashboard.
- Day 18 : Catalogue UI (browse par catégorie : sales, marketing, ops, HR, productivité). Credit tracking + Stripe. Error handling.
- Day 19 : Communauté setup. Premiers posts build in public.
- Days 20-21 : Testing, edge cases, deployment, soft launch aux 20-50 premiers users.

**Pourquoi ~93 templates en 3 semaines est faisable :** Le moteur d'exécution est générique. Chaque agent est une configuration : trigger + données à fetcher + prompt + eval rules. Pipedream gère toute la plomberie (2,800+ APIs). Avec Claude Code, un template complet se crée en 2-4 heures. Les 20-30 templates les plus critiques (semaines 1-2) sont les plus complexes et les plus dogfoodés. Les templates restants (semaine 3) suivent le même pattern et sont générés rapidement via Claude Code.

### 5.2 Ce qu'on NE construit PAS en V1

| Feature | Pourquoi pas maintenant | Quand |
|---------|------------------------|-------|
| Chat Builder (agents custom from scratch) | Trop ambitieux. ~93 templates customisables via React Flow couvrent la majorité des besoins. | V2 quand on comprend les besoins custom via le feedback |
| Impact Engine / Pulse Report | Pas assez de data Day 1 pour des métriques crédibles | V1.1 (M2-M3) |
| Marketplace templates | Pas assez d'users pour un écosystème | V3+ |
| Enterprise tier (SSO/SAML) | Pas la cible Day 1 | V4+ |

### 5.3 Risques techniques critiques

| Risque | Sévérité | Mitigation | Source insight |
|--------|----------|------------|---------------|
| OAuth "Unverified App" warnings (Gmail, Zendesk, etc.) | 🔴 | Soumettre vérification semaine 1 pour chaque provider. Fallback : 100 users test. Prioriser les outils les plus demandés. | — |
| Qualité des drafts | 🔴 | Tout en draft-only. Eval L1/L2/L3 obligatoire. Style Learner. Dogfooding intensif. `maxStepsPerRun: 5` pour limiter les coûts. | Dust : maxStepsPerRun = 3 |
| Credential security (on stocke des tokens OAuth, API keys) | 🔴 | AES-256 encryption de TOUS les credentials. Redaction côté frontend (jamais de secret en clair dans le browser). Rotation de l'encryption key documentée. | n8n : `N8N_ENCRYPTION_KEY` + `redact()` |
| 93 templates en 3 semaines = qualité inégale | 🟡 | Chaque agent = même pattern (trigger + fetch Pipedream + prompt + eval). Claude Code accélère massivement. Prioriser les 20-30 agents dogfoodés. Les autres fonctionnent mais sont affinés post-launch via feedback. | — |
| Privacy données (emails, tickets, CV, factures) | 🟡 | Metadata-first. Zero storage contenu brut. Messaging clair par type de données. Compliance RGPD dès Day 1. | — |
| Agent execution coupée mid-run (deploy, crash) | 🟡 | Graceful shutdown avec `SHUTDOWN_TIMEOUT=30s`. BullMQ stall detection + retry automatique. Aucun deploy ne kill une exécution en cours. | n8n : graceful shutdown 30s |
| Explosion de coûts LLM | 🟡 | `maxStepsPerRun` par template. AI event logging de CHAQUE appel (model, tokens, cost, latency). Dashboard coût par agent, par user, par mois. Alertes si coût moyen >€0.10/action. | n8n : `logAiEvent()` |
| Pipedream down / API rate limited | 🟡 | Retry avec backoff exponentiel via BullMQ. Cache des dernières données. Notification user si reconnexion nécessaire. | n8n : Bull stall detection |
| Config bugs en production (mauvaise env var) | 🟡 | Configuration validée par Zod au boot. App refuse de démarrer si config invalide. Support `*_FILE` pour secrets Docker. | n8n : `@Env()` + Zod |
| Trop similaire à Lindy, pas de différenciation | 🟡 | Le scan transversal et le style learner différencient au launch. Le vrai wedge se précise en M1-M3 via usage. Si aucun wedge n'émerge, pivoter le positionnement. | — |
| Scan faux positifs (deals "dormants" qui sont sains) | 🟡 | Snooze/dismiss par signal. Thresholds configurables par entreprise. Wording "à vérifier" pas "en danger." | Stress-test V5 |
| Debug impossible sur les erreurs agents | 🟡 | Error type hierarchy dès Day 1 : `ScanError`, `AgentExecutionError`, `ConnectorError`, `CredentialError`. Chaque erreur porte le contexte complet. | n8n : NodeOperationError |

### 5.4 User Journey: Day 0 → Month 2

**Minute 0 :** "Scannez vos outils gratuitement" → OAuth sur les outils connectés (CRM, email, support, projets...).

**Minute 2 :** Le scan lit les outils connectés. Feed live par métier :

Thomas (Sales) voit : "3 deals sans activité depuis 7+ jours. 1 lead non traité. Drafts prêts." Il clique sur Deal Acme Corp, voit le draft qui mentionne le pricing en 3 phases discuté le 15 janvier. Il modifie légèrement, envoie. Style Learner capture.

Julien (Support) voit : "5 tickets proches du SLA. 1 ticket premium non assigné. 3 tickets ouverts >24h." Il assigne le ticket premium, envoie le draft de réponse.

**Minute 5 :** Thomas active Deal Revival + Follow-Up + Speed-to-Lead. Julien active Urgent Ticket Alert + Support FAQ Generator + Customer Sentiment Tracker.

**Day 1 :** Chaque persona reçoit son daily briefing adapté. Thomas : 2 deals à relancer, 1 lead entrant. Julien : 1 ticket premium proche SLA, temps de résolution moyen en hausse. En 15 min, les urgences sont traitées. Ils browsent le catalogue pour activer d'autres agents.

**Day 3 :** Thomas invite Sophie (Head of Ops, +€15/seat). Sophie connecte Asana + Stripe. Le scan trouve : 8 tâches overdue, 3 sans assigné, €12K de factures impayées. Elle active Overdue Task Nudger + Vendor Invoice Tracker + Meeting Prep.

**Week 1 :** L'équipe a traité 30 outputs d'agents. 20 envoyés sans modification, 10 modifiés. Le Style Learner apprend les patterns de chacun — Thomas écrit court et direct, Julien est plus empathique dans ses réponses support, Sophie est très structurée.

**Week 2 :** Le Deal Acme Corp a répondu. Meeting replanifié. Côté support, le temps de première réponse est passé de 4h à 45 min grâce aux drafts automatiques. CRM Data Guardian a trouvé 23 doublons dans HubSpot.

**Week 3 :** Taux de modification global : 40% (vs 70% semaine 1). Thomas a 8 agents actifs, Julien 6, Sophie 5. Crédits en approche → Starter.

**Month 1 :** Sales : €23K de pipeline réactivé. Support : SLA breach rate ÷2. Ops : 0 tâches overdue non traitées. Finance : €8K de factures relancées. 3 personas actifs, chacun avec des agents adaptés à son métier.

**Month 2 :** Claire (Marketing) rejoint (+€15/seat). Active Content Repurposing + Newsletter Writer + SEO Blog Writer. Antoine (HR) rejoint (+€15/seat). Active Resume Screening + Candidate Follow-Up + Employee Onboarding Assistant. L'équipe demande un agent de reporting consolidé cross-métier → signal pour le construire.

### 5.5 Stack Technique — Fondé sur le reverse-engineering de Dust & n8n

> **Méthodologie :** Chaque choix technique ci-dessous est justifié par l'analyse des repos GitHub de Dust.tt ($7.3M ARR, 84 contributeurs, 17,842 commits) et n8n (162K stars, 400+ intégrations). On a identifié ce que les deux convergent (PostgreSQL, Redis, TypeScript), ce qu'ils font différemment, et les anti-patterns à éviter.

**Framework & Runtime**

| Composant | Choix | Justification (Dust/n8n insight) |
|-----------|-------|----------------------------------|
| **Node.js 22 LTS** | Runtime | Les deux utilisent Node.js. Dust ajoute Rust pour le chunking haute perf — pas nécessaire à notre volume (1000x inférieur). |
| **TypeScript 5.x strict** | Langage | Les deux l'utilisent avec strict mode. n8n : zéro `any` dans les packages core. On fait pareil. |
| **Next.js 14+ (App Router)** | Framework | Dust utilise Next.js (Pages Router, deprecated). On prend App Router directement. SSR, API routes, un seul déploiement. |
| **React 19** | UI | Standard. Dust utilise React + leur design system Sparkle. |
| **Prisma 6 + PostgreSQL** | ORM + DB | Dust utilise Sequelize (ancien), n8n utilise TypeORM (lourd). Prisma est supérieur en type-safety et DX. Les deux convergent sur PostgreSQL. |
| **Supabase Auth** | Authentification | Dust utilise Auth0 (enterprise, cher). n8n utilise JWT custom. Supabase Auth = OAuth social + magic link + session management, intégré à notre Supabase PostgreSQL. |
| **tRPC + TanStack Query** | API layer | Dust utilise SWR (simple mais limité). TanStack Query = cache, mutations, optimistic updates, invalidation. tRPC = type-safety end-to-end. |
| **Tailwind CSS v4 + shadcn/ui** | Styling | Dust a Sparkle (custom), n8n a un design system Vue custom. shadcn/ui + Radix = composants React accessibles, customizables, zéro maintenance. |
| **Sentry** | Monitoring | n8n utilise `@sentry/node` + `@sentry/profiling-node`. Error tracking + performance + AI cost tracking. |
| **ESLint + Prettier** | Dev tooling | Les DEUX utilisent ESLint (Dust a même un plugin ESLint custom). L'écosystème ESLint est plus riche que Biome. |
| **pnpm + Turborepo** | Monorepo | n8n utilise pnpm + Turbo. Builds parallèles, caching agressif (<30s avec cache). Yarn workspaces (Dust) est plus ancien. |

**Moteur d'exécution des agents — Inspiré de Bull (n8n) + Temporal (Dust)**

| Composant | Choix | Justification (Dust/n8n insight) |
|-----------|-------|----------------------------------|
| **BullMQ + Redis** | Queue & orchestration | n8n utilise Bull (prédécesseur de BullMQ) pour TOUTES ses exécutions : priority queues, concurrency control, retries, stall detection, graceful shutdown. Dust utilise Temporal (10M+ jobs/day) — overkill pour nous. BullMQ = Bull moderne, TypeScript natif, même concepts. On contrôle notre infra d'exécution. |
| **ioredis** | Client Redis | Le client Redis de n8n. Feature-rich : clustering, sentinel, pipelines. Redis sert pour BullMQ + PubSub (streaming SSE) + cache. |
| **Pipedream Connect** | Intégrations OAuth | OAuth + tokens + CRUD sur 2,800+ APIs. L'agent appelle Pipedream pour lire Gmail, écrire dans HubSpot. On ne gère AUCUN OAuth soi-même. ~$2/user/mois. |
| **@anthropic-ai/sdk** | LLM direct | n8n utilise LangChain (overhead significatif, debugging opaque). Dust utilise des SDK directs. On suit Dust : Anthropic SDK directement, pas d'abstraction. Moins de couches = moins de bugs. |
| **React Flow (@xyflow/react)** | Workflow editor | L'user part d'un template et customise : ajouter/retirer des étapes, modifier les conditions, changer les actions. Identique au modèle Lindy. |

**Pourquoi BullMQ au lieu d'Inngest :**

| Critère | Inngest | BullMQ + Redis |
|---------|---------|----------------|
| **Setup** | 1 ligne SDK, managed | Redis à provisionner (Upstash = 1 clic) |
| **Coût** | $0 pour <25K runs, puis $25+/mois | Redis : $0-10/mois (Upstash free tier) |
| **Contrôle** | Boîte noire, vendor lock-in | Full control, open-source |
| **Debugging** | Dashboard Inngest | BullMQ Dashboard + nos propres logs |
| **Graceful shutdown** | Non garanti | Natif (n8n le fait en production) |
| **Stall detection** | N/A | Natif (n8n l'utilise pour les exécutions zombies) |
| **Priority queues** | Non | Oui (scans urgents > scans planifiés) |
| **Redis déjà nécessaire** | Non | Oui (SSE streaming + cache + rate limiting) |

**Verdict :** On a DÉJÀ besoin de Redis pour le streaming SSE (pattern Dust), le cache, et le rate limiting. BullMQ est un ajout marginal sur un Redis existant. Pas de vendor lock-in, contrôle total, et les patterns sont prouvés par n8n à 162K stars.

**Pourquoi Anthropic SDK direct au lieu de Vercel AI SDK :**

| Critère | Vercel AI SDK | @anthropic-ai/sdk |
|---------|---------------|-------------------|
| **Abstraction** | Multi-provider (OpenAI, Anthropic, Google, etc.) | Claude uniquement |
| **Streaming** | ✅ Excellent | ✅ Natif |
| **Tool use** | ✅ Via adapter | ✅ Natif, type-safe |
| **Debugging** | 1 couche d'abstraction en plus | Direct — les erreurs sont celles de l'API |
| **Model switching** | 1 ligne de code | Notre wrapper `@nodebase/ai/tiering.ts` (10 lignes) |

**Verdict :** On utilise Claude exclusivement Day 1. L'abstraction Vercel AI SDK ne vaut pas le coût en debugging. Si on ajoute GPT-4o ou Gemini en Month 2-3, un thin wrapper de 50 lignes suffit. Dust fait exactement ça — SDK directs, pas de LangChain.

**Routing LLM par complexité**

| Tier | Modèle | Coût input/1M tokens | Cas d'usage | % du volume |
|------|--------|---------------------|-------------|-------------|
| **Fast** | Claude Haiku 3.5 | $0.80 | Triage, extraction données structurées, résumés, notifications, alertes | ~60% |
| **Smart** | Claude Sonnet 4 | $3.00 | Follow-ups, réponses tickets, meeting recaps, screening CV, templates | ~30% |
| **Deep** | Claude Opus 4.5 | $15.00 | Drafts stratégiques, analyse sentiment complexe, style learner training | ~10% |

**Le routing est simple :** chaque template d'agent spécifie son tier dans sa config. Pas de routing dynamique Day 1 — c'est un champ `llm_tier: "fast" | "smart" | "deep"` dans la config. Copié du pattern Dust `SUPPORTED_MODEL_CONFIGS`.

**Impact coûts :** Coût moyen pondéré ≈ $1.50/1M tokens. Sur 1,000 users actifs avec ~500K tokens/user/mois = ~$750/mois de LLM. Marge saine.

```typescript
// Agent template — même pattern pour TOUS les 93 agents
const followUpAgent: AgentTemplate = {
  id: "follow-up-simple",
  name: "Follow-Up Agent",
  trigger: { type: "cron", schedule: "0 9 * * *" },
  fetch: [
    { source: "gmail", query: "is:sent after:3d no:reply" },
    { source: "hubspot", query: "deals.where(stage != 'closed')" }
  ],
  llm_tier: "smart",                    // → Claude Sonnet
  maxStepsPerRun: 5,                    // guard-rail coût (Dust met 3)
  prompt: "Tu es un assistant commercial. Voici les emails sans réponse...",
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
  actions: [
    { type: "draft_email", require_approval: true },
    { type: "update_crm", field: "last_followup_date" }
  ]
}
```

**Flow d'exécution complet (BullMQ + Redis PubSub) :**

```
[BullMQ] trigger (cron job / webhook / event)
    ↓
[Agent Config] → quelles données fetcher ? quel prompt ? quel LLM tier ? maxStepsPerRun ?
    ↓
[Pipedream Connect] → fetch les sources (CRM, email, support, ATS, projets, calendar...)
    ↓
[@anthropic-ai/sdk] → route vers le bon modèle (Haiku/Sonnet/Opus)
                    → prompt = template + données fetchées
                    → streaming via Redis PubSub → SSE vers le frontend
    ↓
[Lifecycle Hooks] → agent.before / agent.after (logging, cost tracking, notifications)
    ↓
[Eval Layer] → L1 assertions (deterministic, <10ms) → si fail block → régénère
           → L2 confidence score (rule-based, <50ms) → score 0-100
           → L3 LLM-as-Judge (Haiku, ~200ms, ~$0.00006) → si triggered
    ↓
[AI Event Log] → model, tokens_in, tokens_out, cost, latency, agent_id, user_id
    ↓
[Prisma + Resource Pattern] → output stocké en DB avec metadata + permissions
    ↓
[Redis PubSub → SSE] → user voit l'output en streaming dans le dashboard
    ↓
[User] → approuve / modifie / rejette
    ↓
[BullMQ] → si approuvé : Pipedream exécute l'action (email send, ticket reply, CRM update...)
[Style Learner] → si modifié : capture les diffs pour améliorer les prochains outputs
[AI Event Log] → action_taken, result, feedback stockés
```

**Ce qu'on ne gère PAS nous-mêmes :**

| Responsabilité | Qui gère | Pourquoi |
|---------------|---------|---------|
| OAuth / tokens | Pipedream | 2,800 APIs, refresh tokens, scopes. |
| Job scheduling / retries / stall detection | BullMQ + Redis | Open-source, battle-tested par n8n. |
| Error tracking + performance | Sentry | `@sentry/node` + `@sentry/profiling-node`. |
| Hosting frontend | Vercel | Next.js natif, CDN, serverless. |
| Database managed | Supabase | PostgreSQL managed. Backups automatiques. Auth intégré. |
| Redis managed | Upstash | Serverless Redis. Free tier → $10/mois. |

**State management :**

| Besoin | Outil | Justification |
|--------|-------|--------------|
| State serveur (agents, drafts, configs) | tRPC + TanStack Query | Cache, optimistic updates, invalidation. 90% du state est serveur. |
| State client (React Flow editor) | Zustand | State management léger pour les nodes/edges du workflow editor. Plus simple que Jotai. |
| Params URL | Nuqs | Filtres catalogue, pagination. Type-safe. |

**Formulaires & Validation :**
React Hook Form + Zod. Zod est utilisé par les DEUX plateformes (Dust et n8n) pour la validation runtime.

---

### 5.6 Architecture — Patterns prouvés par Dust & n8n

> **Principe :** On ne réinvente rien. Chaque pattern ci-dessous est extrait du code de Dust ou n8n, adapté à notre contexte.

**Pattern 1 — Resource Pattern (source : Dust)**

Dust n'expose JAMAIS un modèle Sequelize brut dans une API route. Chaque modèle est enveloppé dans une classe `*Resource` qui vérifie les permissions, sérialise proprement, et encapsule la business logic.

```typescript
// Au lieu de : const scan = await prisma.scan.findUnique({ where: { id } })
// On fait :
class ScanResource {
  static async findById(scanId: string, auth: Authenticator): Promise<ScanResource | null> {
    const scan = await prisma.scan.findUnique({ where: { id: scanId } });
    if (!scan) return null;
    if (!auth.canAccess(scan.workspaceId)) throw new PermissionError();
    return new ScanResource(scan, auth);
  }

  toJSON() {
    return {
      id: this.scan.id,
      signals: this.scan.signals,
      createdAt: this.scan.createdAt,
      // credentials JAMAIS exposés
    };
  }
}
```

Resources à implémenter Day 1 : `ScanResource`, `AgentTemplateResource`, `ConnectorResource`, `WorkspaceResource`, `CredentialResource`.

**Pattern 2 — Lifecycle Hooks (source : n8n)**

n8n injecte du comportement à chaque étape d'exécution via des hooks, sans modifier le moteur core. On fait pareil :

```typescript
const hooks: AgentLifecycleHooks = {
  agentExecuteBefore: async (ctx) => {
    ctx.startTime = Date.now();
    await sentry.startTransaction({ name: `agent:${ctx.agentId}` });
  },
  agentExecuteAfter: async (ctx) => {
    const latency = Date.now() - ctx.startTime;
    await logAiEvent({
      agentId: ctx.agentId,
      model: ctx.model,
      tokensIn: ctx.tokensIn,
      tokensOut: ctx.tokensOut,
      cost: calculateCost(ctx.model, ctx.tokensIn, ctx.tokensOut),
      latency,
    });
  },
  onError: async (ctx, error) => {
    sentry.captureException(error, { extra: { agentId: ctx.agentId } });
  }
};
```

**Pattern 3 — Credential Encryption + Redaction (source : n8n)**

n8n chiffre TOUS les credentials avec AES et ne les expose JAMAIS au frontend :

```typescript
// Stockage : AES-256 encryption
const encrypted = encrypt(JSON.stringify(credentials), ENCRYPTION_KEY);
await prisma.credential.create({ data: { encryptedData: encrypted } });

// API response : redaction
function redactCredentials(cred: Credential): SafeCredential {
  return {
    id: cred.id,
    name: cred.name,
    type: cred.type,
    // Le frontend voit "••••••••" pas le vrai token
    data: Object.fromEntries(
      Object.keys(cred.data).map(k => [k, '••••••••'])
    ),
  };
}
```

**Pattern 4 — Error Type Hierarchy (source : n8n)**

n8n a des types d'erreurs spécifiques avec contexte complet. Pas de `throw new Error("something went wrong")` :

```typescript
class ScanError extends NodebaseError {
  constructor(public signalId: string, public connectorId: string, message: string) {
    super(`Scan failed on signal ${signalId} via ${connectorId}: ${message}`);
  }
}

class AgentExecutionError extends NodebaseError {
  constructor(public agentId: string, public stepNumber: number, message: string) {
    super(`Agent ${agentId} failed at step ${stepNumber}: ${message}`);
  }
}

class ConnectorError extends NodebaseError {
  constructor(public connectorType: string, public endpoint: string, public statusCode: number) {
    super(`${connectorType} API error ${statusCode} on ${endpoint}`);
  }
}

class CredentialError extends NodebaseError {
  constructor(public credentialId: string, public errorType: 'expired' | 'invalid' | 'revoked') {
    super(`Credential ${credentialId} is ${errorType}`);
  }
}
```

**Pattern 5 — Configuration typée @Env() + Zod (source : n8n)**

n8n mappe les env vars aux propriétés typées avec validation automatique :

```typescript
class ScanConfig {
  @Env('SCAN_INTERVAL_MINUTES')
  interval: number = 60;

  @Env('SCAN_MAX_SIGNALS')
  maxSignals: number = 23;

  @Env('SCAN_METADATA_ONLY')
  metadataOnly: boolean = true;
}

class LLMConfig {
  @Env('ANTHROPIC_API_KEY')
  apiKey: string;  // fail au boot si absent

  @Env('LLM_MAX_STEPS_PER_RUN')
  maxStepsPerRun: number = 5;

  @Env('LLM_COST_ALERT_THRESHOLD')
  costAlertThreshold: number = 0.10;  // €/action
}
```

L'app refuse de démarrer si la config est invalide. Zéro bug de config en production.

**Pattern 6 — AI Event Logging (source : n8n)**

n8n track CHAQUE appel LLM via `logAiEvent()`. Non-négociable pour nous :

```typescript
interface AiEvent {
  id: string;               // nanoid
  agentId: string;
  userId: string;
  workspaceId: string;
  model: 'haiku' | 'sonnet' | 'opus';
  tokensIn: number;
  tokensOut: number;
  cost: number;             // en €
  latency: number;          // en ms
  stepsUsed: number;
  maxStepsAllowed: number;
  evalResult: 'pass' | 'block' | 'warn';
  action: 'draft' | 'send' | 'update' | 'notify';
  timestamp: Date;
}
```

Dashboard admin : coût par agent, par user, par mois. Alertes si un template explose son budget.

**Pattern 7 — SSE via Redis PubSub (source : Dust)**

Dust stream les réponses agents via Redis PubSub → SSE. Pas de WebSocket. Plus simple à scaler :

```typescript
// Backend : publish sur Redis
const channel = `agent:${executionId}`;
await redis.publish(channel, JSON.stringify({ type: 'token', data: token }));
await redis.publish(channel, JSON.stringify({ type: 'done', data: result }));

// API route SSE : subscribe
app.get('/api/executions/:id/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  const sub = redis.duplicate();
  await sub.subscribe(`agent:${req.params.id}`);
  sub.on('message', (_, data) => res.write(`data: ${data}\n\n`));
});
```

**Pattern 8 — Graceful Shutdown (source : n8n)**

n8n attend que les exécutions en cours se terminent avant shutdown :

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutdown signal received. Waiting for active executions...');
  await queue.close(30_000); // 30s grace period
  await prisma.$disconnect();
  process.exit(0);
});
```

---

### 5.7 Architecture cible — Monorepo

```
nodebase/ (pnpm + Turborepo)
│
├── apps/
│   └── web/                          # Next.js 14+ App Router
│       ├── app/                      # Routes (dashboard, scan, agents, settings, catalogue)
│       ├── components/               # shadcn/ui + custom components
│       └── lib/                      # Hooks, API client tRPC, utils
│
├── packages/
│   ├── @nodebase/types/                 # Interfaces partagées front ↔ back
│   │   ├── agent.ts                  # AgentTemplate, AgentExecution, AgentAction
│   │   ├── scan.ts                   # ScanResult, Signal, SignalCategory
│   │   ├── connector.ts              # ConnectorConfig, ConnectorStatus
│   │   ├── credential.ts             # CredentialType, EncryptedCredential
│   │   └── errors.ts                 # ScanError, AgentError, ConnectorError, CredentialError
│   │
│   ├── @nodebase/db/                    # Prisma schema + generated client + Resource pattern
│   │   ├── prisma/schema.prisma      # Workspace, User, Agent, Scan, Connector, Credential, AiEvent
│   │   └── src/resources/            # ScanResource, AgentResource, ConnectorResource, etc.
│   │
│   ├── @nodebase/core/                  # Moteurs d'exécution
│   │   ├── scan-engine/              # Détection signaux (metadata-only, 23 signaux, 6 catégories)
│   │   ├── agent-engine/             # Exécution agents (LLM calls, actions, maxStepsPerRun)
│   │   ├── eval/                     # L1 assertions, L2 scoring, L3 LLM-as-Judge
│   │   └── hooks/                    # Lifecycle hooks (before/after scan, agent, action)
│   │
│   ├── @nodebase/connectors/            # Connecteurs (Pipedream + notre intelligence layer)
│   │   ├── base.ts                   # BaseConnector interface
│   │   ├── hubspot/                  # HubSpot: deals, contacts, activities
│   │   ├── pipedrive/                # Pipedrive: deals, contacts, activities
│   │   ├── zendesk/                  # Zendesk: tickets, SLAs, satisfaction
│   │   ├── stripe/                   # Stripe: invoices, subscriptions, payments
│   │   ├── gmail/                    # Gmail: emails, threads
│   │   └── calendar/                 # Google Calendar: events, availability
│   │
│   ├── @nodebase/queue/                 # BullMQ workers
│   │   ├── scan-worker.ts            # Scheduled scans, on-demand scans
│   │   ├── agent-worker.ts           # Agent execution (async, streaming)
│   │   └── sync-worker.ts            # Connector data sync (incremental)
│   │
│   ├── @nodebase/config/                # Configuration typée (@Env() + Zod)
│   │   ├── env.ts                    # @Env() decorator + Zod validation
│   │   └── index.ts                  # GlobalConfig (database, queue, llm, scan, connectors)
│   │
│   ├── @nodebase/crypto/                # Credential encryption (AES-256)
│   │   ├── encrypt.ts                # AES-256 encrypt/decrypt
│   │   └── redact.ts                 # Redaction pour le frontend
│   │
│   └── @nodebase/ai/                    # LLM integration
│       ├── client.ts                 # Anthropic SDK wrapper (thin)
│       ├── events.ts                 # AI event logging (model, tokens, cost, latency)
│       ├── style-learner.ts          # Style adaptation par user
│       └── tiering.ts                # Model selection (Haiku/Sonnet/Opus)
│
├── templates/                        # ~93 agent templates (JSON + prompt)
│   ├── sales/                        # deal-revival, follow-up, lead-scorer, etc.
│   ├── support/                      # ticket-responder, sla-alert, faq-generator, etc.
│   ├── marketing/                    # content-repurposing, newsletter-writer, etc.
│   ├── hr/                           # resume-screening, candidate-follow-up, etc.
│   ├── finance/                      # invoice-follow-up, expense-tracker, etc.
│   └── operations/                   # task-nudger, meeting-prep, daily-briefing, etc.
│
├── turbo.json                        # Build pipeline config
├── pnpm-workspace.yaml               # Workspace config
├── .github/workflows/                # CI/CD (lint, test, build, deploy)
├── docker/                           # Dockerfiles (si nécessaire)
└── .env.example                      # Template de config
```

---

### 5.8 Dépendances open-source — Shopping list

> **Chaque dépendance ci-dessous est utilisée en production par Dust et/ou n8n.** Pas de choix théoriques.

**Day 1 — Core (non-négociable)**

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^19",
    "@anthropic-ai/sdk": "latest",
    "@prisma/client": "^6",
    "bullmq": "latest",
    "ioredis": "latest",
    "zod": "latest",
    "zod-to-json-schema": "latest",
    "jsonrepair": "latest",
    "axios": "latest",
    "lodash": "latest",
    "luxon": "latest",
    "nanoid": "latest",
    "nodemailer": "latest",
    "jsonwebtoken": "latest",
    "helmet": "latest",
    "dotenv": "latest",
    "change-case": "latest",
    "@sentry/node": "latest",
    "@sentry/profiling-node": "latest",
    "@tanstack/react-query": "latest",
    "@trpc/server": "latest",
    "@trpc/client": "latest",
    "@xyflow/react": "latest",
    "zustand": "latest",
    "react-hook-form": "latest",
    "nuqs": "latest"
  },
  "devDependencies": {
    "typescript": "^5",
    "prisma": "^6",
    "eslint": "latest",
    "typescript-eslint": "latest",
    "eslint-config-prettier": "latest",
    "prettier": "latest",
    "jest": "latest",
    "@playwright/test": "latest",
    "turbo": "latest",
    "husky": "latest"
  }
}
```

**Libs spécifiques à valeur élevée :**

| Lib | Vient de | Pourquoi indispensable |
|-----|----------|----------------------|
| **jsonrepair** | n8n | Les LLMs génèrent souvent du JSON cassé. Répare automatiquement. |
| **nanoid** | n8n + Dust | IDs courts URL-safe (`scan_kx7Gh2p`). Meilleur UX que les UUIDs. |
| **luxon** | n8n | Dates/times avec timezones. Successeur de Moment.js. |
| **change-case** | n8n | Normalise `deal_stage` (HubSpot) ↔ `dealStage` (Pipedrive). |
| **ioredis** | n8n | Client Redis feature-rich. BullMQ + PubSub + cache sur un seul client. |
| **zod** | les deux | Validation TypeScript-first. Utilisé partout : API input, config, LLM output parsing. |

**Month 2-3 — Scale**

```
bullmq-dashboard (monitoring des jobs)
@testcontainers/postgresql (tests DB réalistes)
@testcontainers/redis (tests queue)
@slack/web-api (intégration Slack)
googleapis (connecteurs Google)
@rudderstack/rudder-sdk-node (analytics)
storybook (documentation composants)
highlight.js (si preview code dans l'UI)
boring-avatars (avatars générés)
react-markdown (rendu markdown)
```

---

### 5.9 Patterns Day 1 vs Month 2-3 vs Month 4+

**Day 1 — implémenter immédiatement :**

| Pattern | Source | Impact |
|---------|--------|--------|
| Resource Pattern (models → resources avec permissions) | Dust | Sécurité by design |
| BaseConnector interface | Dust | Chaque nouveau connecteur est prévisible |
| Lifecycle Hooks (agent.before, agent.after) | n8n | Monitoring/logging injectable |
| Credential encryption AES-256 + redaction | n8n | Les PME nous confient leurs clés API |
| Error Type Hierarchy | n8n | Debug 10x plus rapide |
| Config @Env() + Zod validation | n8n | Zéro bug de config en production |
| AI Event Logging (model, tokens, cost, latency) | n8n | Optimisation coûts impossible sans ça |
| SSE via Redis PubSub | Dust | Streaming simple, scalable |
| maxStepsPerRun (limite d'itérations agent) | Dust | Guard-rail coût, configurable par template |
| Graceful Shutdown (30s timeout) | n8n | Aucune exécution coupée mid-run |

**Month 2-3 — quand on a du volume :**

| Pattern | Source | Trigger |
|---------|--------|---------|
| Queue mode avec workers séparés | n8n | >100 users actifs |
| Sub-agent composition (max depth 4) | Dust | Agents simples marchent d'abord |
| Declarative connector format (JSON, pas code) | n8n | >6 connecteurs |
| RBAC par Space/Group | Dust | Multi-team dans un workspace |
| Leader election via Redis TTL | n8n | Multi-instance pour HA |

**Month 4+ — enterprise :**

| Pattern | Source | Trigger |
|---------|--------|---------|
| Community agent marketplace | n8n | Communauté active |
| LDAP/SAML SSO | n8n | Clients enterprise |
| Prometheus metrics | n8n | Monitoring avancé |
| Toolset dynamique (agents auto-discover tools) | Dust | 10+ connecteurs par workspace |

---

### 5.10 Métriques engineering — Targets

| Métrique | Source d'inspiration | Target Day 1 | Target M3 |
|----------|---------------------|-------------|-----------|
| **Build time** (full rebuild) | n8n Turbo caching | < 2min cold | < 30s avec cache |
| **Type coverage** | n8n strict TypeScript | 100% (zéro `any`) | 100% |
| **Test coverage** | n8n 80%+ | 50% | 75% |
| **P95 scan latency** (6 signaux) | Dust 10M activities/day | < 5s | < 3s |
| **P95 agent execution** (draft simple) | Dust maxStepsPerRun:3 | < 10s | < 8s |
| **LLM cost per action** | n8n AI events | < €0.08 | < €0.05 |
| **Error rate** (scan) | Sentry | < 2% | < 0.5% |
| **Error rate** (agent) | Sentry | < 5% | < 1% |
| **Connector health** | Dust connector lifecycle | 95% | 99.5% |
| **Deployment time** (push → prod) | n8n Docker CI | < 10min | < 5min |
| **Graceful shutdown** | n8n 30s timeout | 100% in-flight complétés | 100% |
| **Credential encryption** | n8n | 100% Day 1 | 100% |

---

## 6. Go-To-Market

### 6.1 ICP

B2B services or tech SMEs, 10-500 employés. Outils cloud (CRM, support, projets). Buyer initial : Sales Director ou Head of Ops — le persona avec le plus de pain visible et qui partagera l'outil avec ses pairs. Expansion : Support, Marketing, HR via le seat model.

### 6.2 GTM : Pirate Mode + Communauté + Build in Public

**3 canaux, pas 1 :**

**Canal 1 — Cold email (notre propre outbound engine)**
- 10-15 domaines, 25-30 mailboxes, ~€270-350/mois
- On utilise nos propres agents pour prospecter (dogfooding)
- 4-step séquences par persona × langue (FR + EN)
- M1-M3 : 5-7.5K emails/sem → 50 users
- M4-M6 : scaled → 200 users

**Canal 2 — Communauté + contenu (le craft de l'AI business automation)**
- Communauté dès Day 1 (Slack ou Discord)
- Contenu hebdo : templates d'agents, résultats réels, before/after
- "Agent of the Week" : un user showcasé
- Build in public : Martin + Ombeline sur LinkedIn (FR + EN)
- Objectif Y2 : le contenu drive 70% de l'inbound (comme Lemlist Y2)

**Canal 3 — Réseau + referral**
- Les premiers users viennent du réseau perso + SF network
- Referral natif : "invitez un collègue, 500 crédits gratuits"
- Chaque user satisfait dans une PME = porte d'entrée vers toute l'entreprise

**Pas de Product Hunt Day 1. Pas d'AppSumo.** Le produit doit être excellent avant l'exposition massive. Product Hunt = M3-M4 quand on a des case studies et des résultats réels.

### 6.3 Pricing

| | Free | Starter | Pro | Business |
|--|------|---------|-----|----------|
| **Prix/mois** | €0 | €160 | €350 | €750 |
| **Crédits** | 200 | 3,000 | 8,000 | 20,000 |
| **Sièges inclus** | 1 | 1 | 1 | 1 |
| **Siège add.** | — | +€15 | +€15 | +€15 |
| **Agents** | Illimités | Illimités | Illimités | Illimités |
| **Overage** | Hard stop | €0.07/cr | €0.06/cr | €0.05/cr |

Transparence totale : dashboard temps réel, crédits par agent, projection fin de mois.

**Le scan est GRATUIT.** Même en Free. C'est le hook. "3 deals dormants, 5 tickets proches SLA, 6 CV non traités, €12K factures overdue" → l'user VEUT les agents pour corriger → conversion.

**Coût infra intégrations (Pipedream Connect) : ~$2/user/mois.** Soit ~1.2% du revenue au Starter. Absorbé dans la marge, invisible pour le client.

### 6.4 International

EN + FR Day 1. Tous marchés anglophones + francophones en parallèle.

---

## 7. Market Size & Path to €100M ARR

Identique V4. Blended ACV Y1 : €2,800. TAM Day 1 (sans USA) : ~135,000 SMEs = €648M.

| Year | New accounts | Active | ARR | Growth |
|------|-------------|--------|-----|--------|
| Y2 | 200 | 200 | €0.6M | — |
| Y3 | 800 | 966 | €2.9M | +422% |
| Y4 | 2,200 | 3,002 | €9.7M | +233% |
| Y5 | 5,000 | 7,492 | €25.9M | +166% |
| Y6 | 9,000 | 15,218 | €56.8M | +119% |
| Y7 | 14,000 | 26,631 | **€108.4M** | +91% |

**Parallèle Lemlist :** $252K ARR Y1 → $720K Y2 → $2M Y2.5 → $6M Y3 → $10M Y3.5 → $20M Y5 → $28M Y6 → $40M Y7. Bootstrapped, 40% EBITDA, 50K clients.

---

## 8. Opportunity — Why Now?

1. **Capability-reliability gap proven** — METR, Klarna, IBM, DORA (2024-2025)
2. **SME AI adoption accelerating but shallow** — 42% use AI, 5% automation (France Num 2025)
3. **LLM costs make contextual agents viable** — contexte complet injectible pour <€0.01/draft
4. **EU AI Act** — transparency requirements favor visible eval
5. **Gap between players** — Dust = enterprise CTO. Lindy = SMB tech-aware qui sait ce qu'il veut automatiser. PME non-technique qui ne sait pas ce qu'elle rate = personne.

---

## 9. Competition

| Player | Forces | Ce qu'ils ne font PAS |
|--------|--------|-----------------------|
| **Statu quo (ChatGPT + manuellement)** | Gratuit, flexible, pas de setup | ❌ Pas de scan continu. ❌ Pas de connexion aux outils. ❌ Aucune automatisation. ❌ Le user doit tout faire lui-même. |
| **Lindy** | 4,000+ intégrations, 1,000+ templates, PMF prouvé | ❌ Pas de scan € ("montre-moi ce que je perds"). ❌ Pas de style learner. ❌ L'user doit savoir ce qu'il veut automatiser. |
| **Dust** | Agent chaining, observability, SOC 2, Sequoia | ❌ Pas PME (enterprise only). ❌ Pas plug-and-play (nécessite admin IT). ❌ Pas de scan business. |
| **HubSpot AI** | Données CRM natives, base installée massive | ❌ Limité à HubSpot. ❌ Pas d'agents autonomes cross-tools. ❌ Pas de scan multi-sources. |
| **Zapier** (indirect) | 7,000+ intégrations, brand massive, simple | ❌ Trigger→Action sans intelligence. Ne détecte rien, n'écrit rien, n'analyse rien. L'user doit tout configurer. |
| **Make** (indirect) | Scénarios visuels puissants, pricing agressif | ❌ Même limite que Zapier : automatisation réactive, pas proactive. Ne génère aucun contenu. |
| **n8n** (indirect) | Open-source, self-hosted, pas de lock-in | ❌ Nécessite compétences techniques. Cible devs, pas PME non-tech. |

**Le pari :** Le marché des PME qui n'ont PAS encore d'agents est bien plus grand que le marché des PME qui switchent de Lindy. On ne se bat pas contre Lindy — on va chercher les gens qui ne connaissent pas Lindy. On ne se bat pas contre Zapier/Make — ils automatisent de la plomberie, nous automatisons des métiers. Le scan € les hook, les agents font le job, et le wedge se précise en usage.

**Ce qu'on vole à chaque concurrent (détail en section 2.1) :** Natural language agent creation + template quality (Lindy). Knowledge grounding + permissions granulaires (Dust). Template library searchable + documentation + fiabilité obsessionnelle (Zapier). Canvas visuel best-in-class + vue Grid (Make). Logs détaillés + debugging visible + code custom pour power users (n8n).

---

## 10. Hypotheses

| # | Hypothesis | Risk | Test |
|---|-----------|------|------|
| H1 | Le scan framé en € convertit >30% free → agent activation | CRITICAL | M1-M3 |
| H2 | Les drafts contextuels sont significativement meilleurs que ChatGPT/concurrents | CRITICAL | Before/after A/B sur les premiers users |
| H3 | Le Style Learner réduit modification rate 70% → <30% en 4 semaines | HIGH | Tracking par agent/user |
| H4 | Eval visible augmente la confiance vs agents aveugles | HIGH | NPS / feedback qualitatif |
| H5 | ~93 templates couvrent la majorité des besoins (pas besoin de builder Day 1) | HIGH | Feature requests hors catalogue, churn M3-M6 |
| H6 | Le dogfooding produit du contenu qui convertit | HIGH | Inbound attribution |
| H7 | La communauté sur le craft attire des prospects (pas juste des curieux) | MEDIUM | Conversion community → signup |
| H8 | 2,800 APIs via Pipedream suffisent au launch | HIGH | "Intégration manquante" comme raison de churn |
| H9 | Dust ne descend pas PME en 18 mois | MEDIUM | Veille compétitive |
| H10 | Le vrai wedge émerge en M1-M3 via les données d'usage (pas besoin de le fixer avant le launch) | HIGH | Tracking rétention par agent/persona/feature |

### Kill Criteria

- <20% complètent le Business Scan → Scan pas compelling
- Les drafts ne sont PAS perçus comme meilleurs que ChatGPT → Thesis wrong
- >50% des users demandent des agents hors catalogue → Accélérer chat builder
- WTP <€120/mois → Economics broken
- Style Learner ne réduit pas le taux de modification en M3 → Feedback loop wrong
- Le dogfooding ne produit pas de contenu engageant → Stratégie communauté à revoir
- Aucun wedge n'émerge en M3 (pas d'agent/feature/persona avec rétention supérieure) → Repositionner

---

## 11. La trajectoire produit (à la Lemlist)

| Phase | Timeline | Produit | Ce qui déclenche le passage |
|-------|----------|---------|---------------------------|
| **V1** | M0-M3 | Plateforme agents AI pour PME non-tech. Scan € + ~93 templates (sales, marketing, support, HR, ops, research/product) + style learner + outbound infra. Tout via Pipedream. | Launch + 50 users |
| **V1.1** | M3-M5 | Impact Engine (attribution € aux agents). +templates guidés par feedback. Le wedge se précise. | Feedback, churn analysis, données d'usage |
| **V2** | M5-M9 | Chat builder simple. Visual agent editor. Marketplace embryonnaire. API. Doubler sur le wedge identifié en V1.1. | Users avancés veulent du custom |
| **V3** | M9-M15 | Full platform. Marketplace. MCP pour extensions. | Scaler au-delà des early adopters |
| **V4+** | M15+ | Enterprise tier, SSO, acquisitions complémentaires | Revenue permet l'expansion |

**Le principe : chaque étape est déclenchée par un signal marché, pas par un plan.**

---

## 12. V5 → V6 : Ce qui a changé

> **V6 = V5 inchangé sur le produit, le GTM, le pricing, les hypothèses. Seule la partie technique est consolidée à partir du reverse-engineering des repos GitHub de Dust et n8n.**

| | V5 | V6 |
|---|---|---|
| **Orchestration agents** | Inngest (managed, vendor lock-in) | **BullMQ + Redis** (open-source, prouvé par n8n à 162K stars). Redis est déjà nécessaire pour SSE + cache. |
| **LLM SDK** | Vercel AI SDK (abstraction multi-provider) | **@anthropic-ai/sdk direct** (Claude-only Day 1, pas d'overhead d'abstraction). Pattern Dust. |
| **Auth** | Better Auth | **Supabase Auth** (intégré à notre Supabase PostgreSQL, OAuth social, magic link). |
| **Linting** | Biome | **ESLint + Prettier** (les DEUX repos utilisent ESLint, écosystème plus riche). |
| **Monorepo** | Repo unique | **pnpm + Turborepo** (pattern n8n, builds parallèles, caching <30s). |
| **State management** | Jotai | **Zustand** (plus simple pour React Flow). |
| **LLM tiers** | Gemini Flash / Haiku / Sonnet-GPT4o | **Haiku / Sonnet / Opus** (Claude-only, cohérent avec SDK direct). |
| **Streaming** | Non spécifié | **SSE via Redis PubSub** (pattern Dust, pas de WebSocket). |
| **Credential security** | Non spécifié | **AES-256 encryption + redaction** (pattern n8n, non-négociable). |
| **Error handling** | Generic `Error` | **Error type hierarchy** (ScanError, AgentError, ConnectorError, CredentialError). |
| **Config management** | dotenv basique | **@Env() decorator + Zod validation** (pattern n8n, app refuse de démarrer si config invalide). |
| **Cost tracking** | Non spécifié | **AI Event Logging** de chaque appel LLM (model, tokens, cost, latency, agent_id). |
| **Shutdown** | Non spécifié | **Graceful shutdown 30s** (aucune exécution coupée mid-run). |
| **Architecture patterns** | Non documentés | **8 patterns prouvés** (Resource, Hooks, Encryption, Errors, Config, Events, SSE, Shutdown). |
| **Monorepo structure** | Non spécifiée | **Architecture détaillée** (9 packages : types, db, core, connectors, queue, config, crypto, ai). |
| **Dépendances** | Non listées | **Shopping list complète** avec justification par source (Dust/n8n). |
| **Métriques engineering** | Non définies | **12 targets** (build time, type coverage, test coverage, latency, cost, error rate...). |

**Ce qui n'a PAS changé vs V5 :**
- Le produit : scan € + ~93 templates + style learner + eval L1/L2/L3
- Le dogfooding total comme pilier stratégique
- La communauté sur le craft
- Le GTM pirate mode + communauté + build in public
- Le pricing (Free/Starter/Pro/Business)
- Les hypothèses et kill criteria
- La trajectoire produit Lemlist
- Le market size et path to €100M ARR
- L'user journey Day 0 → Month 2

---

*Document V6 — Consolidé le 9 février 2026*
*Changement majeur vs V5 : consolidation technique basée sur le reverse-engineering des repos GitHub de Dust.tt (84 contributeurs, 17,842 commits, $7.3M ARR) et n8n (162K stars, 400+ intégrations). Stack revu de fond en comble : BullMQ au lieu d'Inngest, Anthropic SDK direct au lieu de Vercel AI SDK, pnpm+Turbo monorepo, 8 patterns architecturaux prouvés (Resource, Lifecycle Hooks, Credential Encryption, Error Hierarchy, Typed Config, AI Event Logging, SSE/Redis PubSub, Graceful Shutdown). Chaque choix est justifié par son usage en production dans l'un des deux repos. Le produit, le GTM, et la stratégie n'ont pas changé.*
