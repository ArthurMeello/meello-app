# Gamification Meello — Document de référence

Système de progression par XP et niveaux pensé pour une communauté d'entrepreneurs (≈14 membres).
Objectif : faire revenir les membres régulièrement et faire vivre la communauté, sans flicage ni compétition.

Principes directeurs :
- On récompense la **valeur** (revenir, venir, interagir) plus que le **volume**.
- On **récompense, on ne surveille pas** (pas de validation de présence, pas de contrôle).
- Progression **personnelle**, sans classement public entre membres.
- Tout repose sur de la donnée d'usage déjà existante (connexions, événements, posts, likes, last_active).

---

## 1. Barème XP de base

### Gains uniques (une seule fois par membre)
- Profil complété à 100% : **+150 XP**
- Première fiche produit / service : **+50 XP**

### Connexions entre membres
Créditées à l'**acceptation** de la connexion, **des deux côtés** (initiateur et accepteur). Dégressif :
- 1re connexion : **+30 XP**
- Connexions 2 à 10 : **+10 XP** chacune
- Au-delà de 10 connexions : **0 XP**

Garde-fou : seule une connexion acceptée crédite (pas une simple demande envoyée).

### Feed / engagement (XP pour celui qui AGIT, pas l'auteur du contenu)
"Posts" = feed + communauté (les deux catégories regroupées).
- Commenter un post : **+8 XP**, plafond **3 / jour**
- Liker un post : **+2 XP**, plafond **5 / jour**
- Répondre à un sondage (voter) : **+2 XP**, plafond **3 / jour**

Le QG n'attribue **aucun XP** (choix délibéré, pour éviter le spam de messages et garder le QG comme espace libre).

### Événements (on récompense, on ne surveille pas)
- Participer à un événement : **+15 XP** (constaté simplement, sans code ni validation de présence)
- Organiser un événement : **+100 XP**

### Revenir (régularité)
- Connexion du jour : **+5 XP**, 1 fois / jour
- Série de semaines ouvrées actives : **+50 XP** par semaine
  - Une semaine est "active" si le membre s'est connecté **≥ 4 jours sur les 5 jours ouvrés**.
  - On compte en **semaines consécutives**, pas en jours : le week-end ne casse jamais la série, louper 1 jour dans la semaine non plus.

---

## 2. Badge flamme (série de semaines)

Représentation visuelle de la série de semaines actives définie ci-dessus (≥4 jours sur 5 ouvrés = semaine validée).
Pas une mécanique séparée : c'est l'affichage de la série existante. Principe : on encourage, on ne punit pas.

La flamme affiche le **nombre de semaines consécutives validées** et change de palier visuel :

| Palier flamme | Semaines consécutives |
|---------------|----------------------|
| Étincelle | 1 à 3 |
| Flamme | 4 à 9 |
| Brasier | 10 à 24 |
| Feu sacré | 25+ |

> Les paliers de la **flamme** (séries de semaines) sont distincts des paliers de **niveau** (XP). Ne pas confondre.

### Règle de rupture (douce, "semaine de grâce")
- Semaine en cours non validée → la flamme **vacille** mais survit (semaine de grâce pour la rattraper).
- **2 semaines manquées** d'affilée → la série repart de zéro, en douceur.
- Jamais de reset brutal après un seul manquement.

### Affichage
- **Carte profil desktop** : en haut à droite (zone à côté du nom / date d'inscription).
- **Cartes de l'annuaire** : en haut à droite de chaque carte (version plus compacte).
- Badge : icône flamme + nombre de semaines (ex : 🔥 8), couleur selon le palier.
- Au survol / clic : détail ("8 semaines consécutives, reviens cette semaine pour la garder").
- Visible de tous dans l'annuaire → émulation douce (on voit qui est assidu), sans classement.

---

## 3. Niveaux & paliers

- Échelle **1 à 100**. Le **niveau 100 est le Graal** ; au-delà, c'est du bonus.
- Les XP cumulés font monter le niveau. Progression rapide au début, puis ralentit.

### Courbe d'XP (figée)
- Coût du niveau N (pour passer de N-1 à N) = **40 + 2,66 × (N − 2)**, pour N ≥ 2.
  - Niveau 2 = 40 XP, niveau 3 = ~43, niveau 10 = ~61, niveau 50 = ~168, niveau 100 = ~301.
- **Cumul au niveau 100 ≈ 16 900 XP.**
- Calée pour qu'un **membre très actif** (~150-200 XP/sem) atteigne le niveau 100 en **~1,8 an**.

### Paliers nommés (6 paliers sur l'échelle 1-100)
| Palier | Niveaux | XP cumulés (début) |
|--------|---------|--------------------|
| Nouvelle pousse | 1 à 9 | 0 |
| Membre installé | 10 à 24 | ~450 |
| Moteur | 25 à 49 | ~1 700 |
| Pilier | 50 à 74 | ~5 100 |
| Figure | 75 à 99 | ~10 100 |
| Légende Meello | 100+ | ~16 900 |

### Temps d'acquisition estimés
| Palier | Membre moyen (~280 XP/mois) | Membre très actif |
|--------|------------------------------|-------------------|
| Membre installé (niv. 10) | ~1,5 mois | ~3 semaines |
| Moteur (niv. 25) | ~6 mois | ~2 mois |
| Pilier (niv. 50) | ~1,5 an | ~6 mois |
| Figure (niv. 75) | ~3 ans | ~13 mois |
| Légende (niv. 100) | ~5 ans | ~1,8 an |

> La majorité des membres vivront entre les niveaux 1 et 40. Les niveaux 50+ sont rares et prestigieux.

- Affichage sur le profil : niveau courant, palier (statut), barre de progression vers le niveau suivant.

### Médaillon de niveau (sur l'avatar)
- Pastille ronde incrustée **en bas à droite de la photo de profil**, façon badge de statut sur avatar.
- Contient le **numéro de niveau**.
- **Couleur** de la pastille selon le palier atteint (Nouvelle pousse, Membre installé, Moteur, Pilier, Figure, Légende).
- Le médaillon **suit l'avatar partout** où il apparaît (profil, annuaire, posts, commentaires…).
- V2 possible : ajouter un mini-symbole/icône distinctif par palier (au-delà de la couleur).

> **À DÉFINIR** : la courbe de progression précise (XP requis par niveau + à quels niveaux tombent les paliers nommés). C'est la dernière pièce avant implémentation.

---

## 3. Défis de la semaine

But : créer une raison neuve chaque semaine de revenir et d'interagir. Cassent la routine du barème de base.

Règles :
- **3 défis par membre** chaque semaine (lundi → dimanche).
- **Choisis automatiquement** selon le profil de chaque membre (personnalisés).
- **Indépendants** : chaque défi réussi donne son boost. Faire 1 ou 3 dépend du membre, pas de tout-ou-rien.
- Si un membre n'a pas assez de défis pertinents (ex : profil complet ET déjà très connecté), on **complète avec des défis d'interaction** (commenter / poster / réagir), faisables par tous. Garantit toujours 3 défis.

### Banque de défis
| Défi | Action | Boost | Éligibilité |
|------|--------|-------|-------------|
| Brise la glace | 2 nouvelles connexions | +60 XP | Tous |
| Fais connaissance | Visiter 3 profils, se connecter à au moins 1 | +50 XP | Tous |
| Donne ton avis | Commenter 3 posts (feed ou communauté) | +50 XP | Tous |
| Partage ton actu | Publier un post cette semaine | +40 XP | Tous |
| Complète ton profil | Enrichir son profil | +30 XP | **Seulement si profil < 100%** |

Logique d'adaptation automatique (exemples) :
- Profil < 100% → proposer "Complète ton profil".
- Connexions < 10 (encore éligible aux XP de connexion) → pousser "Brise la glace" / "Fais connaissance".
- Membre discret (ne poste/commente jamais) → "Donne ton avis" / "Partage ton actu".
- Membre déjà complet + très connecté → compléter avec des défis d'interaction.

---

## 4. Implémentation technique (à faire)

Pistes (stack Supabase + Next.js, à détailler en spec dédiée) :
- Table `member_xp` (ou colonnes sur `profiles`) : total XP, niveau, palier courant.
- Table `xp_events` : historique des gains (membre, type d'action, XP, date) — sert aussi à appliquer les plafonds journaliers et la dégressivité des connexions.
- Fonction d'attribution d'XP, branchée aux endroits déjà câblés (proche de `/api/notify`).
- Table `weekly_challenges` + assignation auto par membre (cron hebdo).
- Affichage : barre de progression + palier sur le profil ; encart "défis de la semaine".
- Calcul de la série via `last_active` / une table d'activité journalière.

> Statut : barème, défis et règles **figés**. Restent : courbe de niveaux, puis spec technique détaillée.
