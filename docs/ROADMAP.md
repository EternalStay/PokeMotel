# PokéMotel — Inventaire complet de CroqueMotel et feuille de route

Référence : la réécriture Eternaltwin de CroqueMotel
(<https://gitlab.com/eternaltwin/croquemotel/croquemotel>), en particulier
`docs/GAMEPLAY.md` (les règles du source d'origine, recoupées), `server/contracts/*`,
`server/modules/*`, `client/components/*` et `client/pages/*`.

Principe : **reproduire tout le système** (moteur, règles, fonctionnalités, UX),
mais avec **nos monstres à types** (1 type = 1 aura) et **nos propres visuels**.
On reprend les idées et les règles.

Légende : ✅ fait · ⚠️ fait mais différent de l'original (écart assumé ou à aligner) · ❌ à faire

---

## 1. Correspondance familles d'origine → nos types

L'original a 12 familles (règles spéciales) et des effets tirés au hasard. Chez nous,
le **type** donne à la fois l'aura émise et la règle spéciale. Effets : Chaleur, Humidité,
Odeurs, puis **Froid** (à la place de la Nourriture d'origine) et Bruit dès le niveau 2.

| Famille d'origine (niveau) | Règle | Notre type | Aura | État |
|---|---|---|---|---|
| Sorcière banale (1) | aucune | Eau | Humidité | ✅ |
| Capitaliste (1) | +30 % d'objet oublié | Poison | Odeurs | ✅ |
| Pyromane (1) | détruit chambre + équipement | Feu | Chaleur | ✅ |
| Abomination (3) | vaut 2 à l'Institut | Roche | Froid | ✅ |
| Zombie jovial (3) | +1 à ses 4 voisins | Normal | Bruit | ✅ |
| Poisson sourd (4) | attentions +3 h | Glace | Froid | ✅ |
| Blob fauché (4) | paie ×0,5, mais ×1,7 à 10 | Insecte | Bruit | ✅ |
| Hypno-chat (4) | placé à ≥ 8 → un autre du même type arrive | Psy | Chaleur | ✅ |
| Hystérique (5) | ≤ 4 : hurle, −3 à tous les autres | Combat | Odeurs | ✅ |
| Monstro-plantes (5) | émet 2 effets | Plante | Humidité + Odeurs | ✅ |
| Fantôme (6) | n'émet rien, pas même le voisinage | Spectre | — | ✅ |
| Bombe émotive (7) | à 0 ou 10 : instable, explose 3 h après | Électrik | Bruit | ✅ |
| Colis suspect (ami) | ne paie pas, récompense si bien traité | **Œuf surprise** | — | ✅ moteur ; envoi entre joueurs au lot K |

Décidé le 2026-11-08 : auras ci-dessus, niveaux de déblocage d'origine.

---

## 2. Inventaire des règles (moteur)

### 2.1 Temps
- ✅ Vraie horloge (fuseau Paris), ouverture 6 h, départs 10 h, paie à minuit, file vidée à minuit.
- ✅ Taxe la nuit du dimanche au lundi.
- ✅ Rattrapage du temps écoulé à chaque visite (moteur « à la demande »).
- ✅ Aucune action entre 23 h 59 et 0 h 01.
- ✅ Retour après 5 jours d'absence : chambres réparées, dette effacée, +250, file remplie à 5, fenêtre « Bon retour ».

### 2.2 Argent
- ✅ Départ à 0, table de gains 50 × facteur × niveau de chambre (×1 / ×1,2 / ×1,6), lit de diamants +25 %.
- ✅ Un client paie deux fois : à minuit et à son départ à 10 h ; un client à 0 ne paie pas au départ.
- ✅ Insecte (Blob fauché) ×0,5, sauf ×1,7 à 10.
- ✅ Maîtrises de gains (+50 %/niveau) : Glace, Électrik, Plante (= Poissons, Bombes, Plantes).
- ✅ Réparations et petites attentions payables même caisse vide (solde négatif en rouge).
- ✅ Objet trouvé au sol : 25.
- ✅ Salle de loisir : visite de 2 h à 2 h 59, 5 par visite, puis 5 h de repos.

### 2.3 Prestige et étoiles
- ✅ 1 à l'ouverture ; +1 client à 10 ; VIP 30 / 7 / 1 ; taxe 20 × niveau (≤ 200) ; +1 par emplacement au-delà de 9 ; chambre améliorée +1 / +2 ; mission répétable +5.
- ✅ Fiole d'or : +1.
- ✅ Legs : +150 et une étoile (seule source d'étoiles).

### 2.4 Clients
- ✅ Délai d'arrivée 8 / 5 / 4 / 3 / 2 / 1 h / 45 min selon le personnel ; pas d'arrivée la nuit ; 1 % de VIP.
- ✅ 2 goûts tirés dans le vivier (0 à 2 « aime »), voisinage jamais tiré sauf pour les 2 premiers clients.
- ✅ Séjours : 1 nuit, puis 2 (dès le niveau 3), puis 3 (dès le niveau 4).
- ✅ Un seul client à l'ouverture (les quêtes en amènent d'autres).
- ✅ Campagnes de pub livrées à 6 h ; « Attirer un client » immédiat (5 💎).
- ✅ Les Œufs surprise restent en file au minuit qui suit leur arrivée.

### 2.5 Satisfaction
- ✅ Base 3 (VIP 1) ; goût présent +2 / absent −3 ; dégoût présent −3 / absent +2 ; joie +1 par voisin jovial ; luxe VIP +2 / −3 ; −1 par point de dégât ; bonus/malus ; bornée 0–10.
- ✅ Déménagement −2, une seule fois (−1 avec « Faculté d'adaptation »).
- ✅ État de la chambre doublé pour un VIP.
- ✅ Hystérie : −3 par Hystérique (Combat) qui hurle, pour tous les autres clients.
- ✅ Cadeau refusé dès que le client a reçu le moindre bonus.
- ✅ Matelas : +1 chaque nuit, cumulatif.

### 2.6 Pièces et construction
- ✅ Largeur max 7, hauteur max 22, chambre 100, améliorations 250 / 600, accueil 250 / 500 / 1500 / 3000 (capacité 2 à 6).
- ✅ Rez-de-chaussée à 3 emplacements dont l'accueil à droite, pas de chambre au RDC.
- ✅ Agrandissement case par case comme l'original : porte-à-faux permis (dessiné sur des consoles avec jambes de force), RDC qui s'agrandit par la droite. Écart restant : une case à gauche de la colonne 0 décale tout l'hôtel.
- ✅ Durées : amélioration 10 min ; Institut, machines et salles 30 min.
- ✅ On ne bâtit ni sur un chantier, ni sur une pièce sale, ni sur une pièce occupée.
- ✅ Prix d'agrandissement : gratuit jusqu'à 9 pièces, puis 50 / 250 / 500, puis `floor(n² × 3 / 100) × 100`.
- ✅ Remplacer une pièce par une autre directement (confirmation : niveau et équipements perdus).

### 2.7 Chambres et départs
- ✅ Dégâts 0 à 5 ; 50 % de salir au départ (moitié au niveau 1) ; Feu (Pyromane) = destruction ; client à 0 = tout détruit.
- ✅ Un seul tirage à 50 % casse tous les équipements ; Lit de diamants et Caisson retirés au départ.
- ✅ Objet oublié 20 % (+30 Poison, +30 Armoire), toujours au niveau 1 tant qu'on a ≤ 4 objets.
- ✅ Équipement installable chambre occupée ; un équipement posé se détruit, il ne se déplace pas.
- ✅ Feux d'artifice : +6 la première nuit, puis 3 de dégât et tout l'équipement saute.

### 2.8 Salles
- ✅ Salles de loisir (3 de chaque, 200 + 100 × déjà bâties, niveau 3) : le client s'y rend seul selon ses goûts.
- ✅ Machines de service : 4 (linge niv. 2, cireuse niv. 4, frigo niv. 5, bar niv. 6).
- ✅ Une demande par séjour, visible dans ses 6 dernières heures, parmi les machines que l'hôtel pourrait bâtir ; manquée → reprogrammée 7 à 15 h plus tard.
- ✅ Répondre : machine libre, occupée 30 min, +1.
- ✅ Institut du Bonheur (2 max, niveau 2) : à 5 points, une fiole posée au sol ; tous les autres clients, en file et logés, perdent 1 ; Roche (Abomination) vaut 2.

### 2.9 Personnel
- ✅ Prix 150 / 250 / 500 / 1000 ; accueil ; réparation 1 point / 2 min 30 à 6 (×1,5 / ×2) ; attention 4 h, 40 %, 10.
- ⚠️ Au-delà de 4 employés : payés en 💎 (dans l'onglet Personnel, pas dans un rayon « administratif »).
- ✅ L'employé qui s'occupait d'un client le suit quand on le déménage ; il est renvoyé quand son client part.

### 2.10 Taxe et niveaux
- ✅ Montants ≤ 100 (prorata), 500, 1000, 1500, 2000, 3000, 4200, 5600, 8000, puis `(niveau − 1) × 1500` ; « Dans ton fisc » −20 % ; coup de pouce à 300 jusqu'au niveau 3.
- ✅ Due seulement si l'hôtel a été actif dans la semaine (un client placé ou déplacé).
- ✅ Fenêtres de récap : Minuit (bilan par client), Semaine (taxe), Niveau supérieur (pièces débloquées), Bon retour.

### 2.11 Événements aléatoires (toutes les 9 à 21 h)
- ✅ Table de poids et niveaux (tracas, bonheur, rien, accident, vol, câlin d'étage, VIP caché, étage ravagé, sblurb).
- ✅ Accident : 3 dégâts ; vol : 15 à 64 + l'équipement de la chambre ; câlin d'étage +2 ; étage ravagé 3.

### 2.12 Monnaie premium — Gemmes 💎 (nom provisoire)
- ✅ Gagnée en jouant (fin de tutoriel 10, quête 5, client comblé 1, VIP 2 / 5, taxe 10 × niveau), jamais achetée.
- ✅ Usages : employés au-delà du 4ᵉ, Supermarché, « Attirer un client » (5), remise à zéro des talents (20). Les 💎 n'achètent jamais de 🪙.

### 2.13 Labo
- ✅ 4 rangées (+4 points par rangée), plafond 25 (+5 par étoile), spécialités et effets alignés sur les familles.
- ✅ Remise à zéro : 20 💎 ; « Bon goût » donne un carton de déco surprise.

### 2.14 Quêtes
- ✅ 19 quêtes en série (dont les 2 de décoration) puis 5 répétables (+5 ⭐), tirées au sort, jamais deux fois la même de suite.
- ✅ La fenêtre « contrat rempli » ne s'ouvre que si la quête rapporte quelque chose.
- ✅ « Recommencer » proposé seulement jusqu'à la quête de la première nuit.
- ✅ « Recommencer en personnalisé » : accueil seul, +600 (6 chambres), gemmes gardées.
- ✅ Pointeur « Nouvelle mission » animé.

### 2.15 Legs (étoiles)
- ✅ Conditions : niveau 4 + étoiles, 3000 en caisse (non débités), 12 / 20 / 30 / 50 / 75 / 100 / 150 pièces bâties.
- ✅ On garde l'argent (+600), 1 employé, l'inventaire sauf le mobilier ; niveau 2, accueil seul, +1 étoile, +150 ⭐, plafond +5, arbre remis à zéro ; tutoriel sauté, récompenses versées d'un coup.

### 2.16 Supermarché et objets
- ✅ Rayons Aménagements de base, Décorations, Aménagements spéciaux ; kits (un exemplaire de chaque objet du rayon).
- ✅ Catalogue : Radiateur, Brumisateur, Bac à compost, Enceinte, Nounours, objets doubles, Matelas, Lit de diamants, Armoire, Caisson, Kit réparation, Cadeau / Super pack, Clim polaire, Extincteur (maison), Feux d'artifice, pots de peinture (vive / douce / surprise), papier peint, bas de mur, carton de déco.
- ✅ Pas de Buffet : décidé le 2026-11-08, les auras suivent uniquement les types (la Nourriture d'origine est remplacée par le Froid de Glace).

### 2.17 Décoration
- ✅ Par étage : peinture (24 teintes), papier peint, bas de mur ; chaque objet tire une valeur différente de l'actuelle.
- ✅ Mobilier libre (7 familles, 20 variantes) posé n'importe où sur un étage (rez-de-chaussée et réception compris), au sol ou au mur, à cheval entre deux pièces ; il reste en place si une pièce est démolie et glisse avec son étage (aligné le 2026-11-08).
- ✅ Mode « Changer le mobilier » avec la réserve en bandeau.

### 2.18 Publicité et Bureau
- ✅ Vitrine quotidienne de 4 à 6 sponsors (déterministe par hôtel et par jour), clients ou VIP livrés à 6 h.
- ✅ Bureau : renommer, statistiques, legs, campagnes, « Recommencer ».
- ✅ Couleur du néon (13 teintes), nom du gérant ; sections du Bureau progressives (campagnes dès le niveau 2, réglages dès la mission « renommer », legs après la 1ʳᵉ nuit).

### 2.19 Succès
- ✅ 11 compteurs et 39 paliers (seuils et points d'origine, titres et badges maison), points totaux, titre affiché avec le nom du gérant. Le compteur « visites » attend le lot K.

### 2.20 Social
- ✅ Amis (code ami, demandes, lien d'invitation), classement par prestige (amis / tous), visite en spectateur, envoi d'Œufs surprise (1 par jour), mur de l'hôtel (messages entre amis, « j'aime ») (lot K).

---

## 3. Inventaire de l'UX (à transposer proprement)

| Élément d'origine | Rôle | Chez nous |
|---|---|---|
| Cadre de jeu + colonne de droite (infos, missions, journal) | disposition principale | ✅ grand écran ; ✅ mobile épuré (2026-11-08) : un seul bandeau (nom, heure, argent, gemmes, prestige), file d'attente dans la rue uniquement, mission dans la barre d'actions, onglets en icônes |
| Panneau d'infos au survol (client, pièce) ; au doigt, le tap rejoue le survol | lisibilité | ✅ survol ; ✅ toucher = menu compact (infos + actions) |
| Glisser la vue (seuil 4 px), pas de zoom d'origine | navigation | ✅ glisser + zoom (bonus) |
| Menu contextuel au clic sur une pièce | actions | ✅ menu flottant collé à la pièce, « Détails » = fenêtre complète |
| Barre d'actions sur la scène : Agrandir, Changer le mobilier, inventaire par rayons | accès rapide | ✅ (verticale sur mobile, horizontale sur grand écran) |
| Bulle d'aide près du curseur pour les éléments d'interface | apprentissage | ✅ survol ou appui long |
| Pointeur « Nouvelle mission » animé | guidage | ✅ (+ « Me montrer » dans la mission) |
| Panneau de missions repliable | progression | ✅ |
| Bulles de pensée, chiffres qui s'envolent, lumière des fenêtres selon l'humeur | vie / feedback | ✅ |
| Horloges (prochain client, heure à la réception) | temps | ✅ |
| Fenêtres de récap (minuit, semaine, niveau, retour) | narration | ✅ |
| Pop-up « contrat rempli » | récompense | ✅ |
| Confirmations (remplacer une pièce, détruire un équipement, legs) | sécurité | ✅ |

---

## 4. Tâches (par lots)

### Lot A — Conformité des règles (moteur) ✅
- [x] A1 Double paiement (minuit + départ à 10 h), client à 0 ne paie pas au départ.
- [x] A2 Déménagement −2 une seule fois (−1 avec le talent) ; le larbin suit le client.
- [x] A3 Dégâts doublés pour un VIP ; cadeau refusé dès le moindre bonus ; Matelas cumulatif par nuit.
- [x] A4 Solde négatif autorisé pour réparations et attentions (affichage en rouge).
- [x] A5 Objet au sol = 25 ; Fiole d'or = +1 ⭐ ; fioles et objets posés au sol à ramasser.
- [x] A6 Salles de loisir : visites de 2 h–2 h 59, 5 par visite, 5 h de repos (+ client visible dans la salle).
- [x] A7 Services : 4 machines, une demande par séjour dans les 6 dernières heures, re-programmation 7–15 h.
- [x] A8 Institut : les clients en file perdent aussi 1 ; Roche vaut 2.
- [x] A9 Taxe due seulement si l'hôtel a été actif dans la semaine.
- [x] A10 Verrou 23 h 59–0 h 01 ; retour après 5 jours.
- [x] A11 Événements aux valeurs d'origine.
- [x] A12 Un seul client à l'ouverture.
- [x] A13 Talents : valeurs exactes, remise à zéro payante (20 💎).
- [x] A14 Répétables tirées au sort ; pop-up seulement si récompense ; « Recommencer » jusqu'à la 1ʳᵉ nuit.

### Lot B — Types / familles complets ✅
- [x] B1 Auras des nouveaux types (Roche, Insecte, Psy, Combat) et niveaux de déblocage.
- [x] B2 Insecte = Blob fauché ; Psy = Hypno.
- [x] B3 Combat = Hystérique (bulle « HURLE ! »).
- [x] B4 Électrik = Bombe émotive (compte à rebours 3 h, explosion).
- [x] B5 Roche = Abomination (2 à l'Institut).
- [x] B6 Dessins SVG des 4 nouveaux types, aide et maîtrises.

### Lot C — Pièces et construction ✅
- [x] C1 RDC à 3 emplacements (accueil à droite), pas de chambre au RDC.
- [x] C2 Agrandissement case par case, porte-à-faux permis comme l'original (écart : à gauche, tout l'hôtel glisse d'une colonne).
- [x] C3 Durées d'origine ; remplacement direct d'une pièce avec confirmation.
- [x] C4 Feux d'artifice ; catalogue complet des Aménagements spéciaux.

### Lot D — Fenêtres de récap ✅
- [x] D1 Minuit · [x] D2 Semaine · [x] D3 Niveau supérieur · [x] D4 Bon retour.

### Lot E — Décoration ✅
- [x] E1 Peinture / papier peint / bas de mur par étage.
- [x] E2 Mobilier libre (7 familles, 20 variantes) posé sur l'étage comme l'original, réserve, mode « Changer le mobilier ».
- [x] E3 Objets de déco au Supermarché et en récompense ; 2 quêtes de déco ; « Bon goût ».

### Lot F — Supermarché, monnaie premium, publicité ✅
- [x] F1 Gemmes gagnées en jouant. · [x] F2 Rayons et kits. · [x] F3 Vitrine publicitaire. · [x] F4 « Attirer un client ».

### Lot G — Legs et étoiles ✅
- [x] G1 Conditions dans le Bureau. · [x] G2 Legs complet. · [x] G3 Étoiles visibles (bandeau, enseigne).

### Lot M — Compléments et solidité du moteur ✅
- [x] M1 Tests d'invariants : partie simulée au hasard sur des semaines (aucune référence orpheline, satisfaction 0–10, argent entier, sauvegarde JSON stable), déterminisme (même graine + mêmes actions = même état), rattrapage en une fois = rattrapage pas à pas.
- [x] M2 Œuf surprise côté moteur : client offert (ne paie pas, reste en file à minuit, 3 en attente max, récompense s'il part à ≥ 6), prêt pour l'envoi entre amis (lot K).
- [x] M3 Bureau progressif : campagnes dès le niveau 2, réglages après la quête « renommer », legs après la 1ʳᵉ nuit ; couleur du néon (13 teintes).
- [x] M4 « Recommencer en personnalisé » : accueil seul, quêtes de la série validées, +600.

### Lot H — Succès ✅
- [x] H1 11 compteurs et 39 paliers (icônes / titres préfixe-suffixe, textes maison), points totaux, titre choisi affiché à côté du nom, onglet « Succès ».

### Lot I — UX (inspirée du dépôt, visuels maison) ✅
- [x] I1 Menu contextuel flottant au toucher d'une pièce (actions directes), fenêtre détaillée en option.
- [x] I2 Barre d'actions sur la scène : Agrandir, Changer le mobilier, inventaire par rayons (on arme un objet puis on touche une chambre).
- [x] I3 Bulles d'aide (survol / premier toucher) sur les éléments d'interface.
- [x] I4 Pointeur animé « Nouvelle mission » ; mobile : tap = infos dans un panneau compact.
- [x] I5 Mode mobile paysage soigné ; pas de « tirer pour rafraîchir » sur la scène.
- [x] I6 Interface épurée, fidèle à l'original : plus de cartes de file en bas (les clients attendent dans la rue), un seul bandeau en haut, mission dans la barre d'actions, onglets en icônes ; installer un client = toucher le client puis la chambre (sa note est affichée d'avance).

### Lot J — Serveur (Supabase)
- [x] J1 Comptes (e-mail + Google), table `hotels` (état jsonb), RLS.
- [x] J2 Moteur exécuté côté serveur (Edge Function) : `advance` + actions validées, horloge serveur.
- [x] J3 `SupabaseStore` côté client (même interface que `LocalStore`), mode hors-ligne en lecture.

### Lot K — Social
- [x] K1 Amis (recherche, demandes), classement par prestige.
- [x] K2 Visite en spectateur + panneau du propriétaire.
- [x] K3 Envoi d'Œufs surprise (3 max en attente, 1 par jour), récompenses.
- [x] K4 Mur de l'hôtel (commentaires, j'aime, partage).

### Lot L — Finitions
- [ ] L1 Noms définitifs des Pokémon et du jeu (« PokéMotel » est un titre de travail).
- [ ] L2 Équilibrage final.
- [ ] L3 Langues (optionnel), accessibilité, performance (grands hôtels, option « basse qualité »).

**Avancement (2026-11-08, V0.9.1)** : lots A à I et M terminés (60 tests, dont une partie « fuzz » qui joue des semaines au hasard ; `FUZZ_SEEDS=80 npm test` pour une passe lourde). Toutes les actions passent par `dispatch` (point d'entrée unique, prêt pour le serveur). Essai en cours : planches de sprites animées par type, plusieurs variantes possibles (`assets/sprites/<type>1.png`…, une au hasard par Pokémon).

**Ordre** : J (Supabase) → J (Supabase) → K (social) → L (finitions).
Le moteur passe avant tout le reste : c'est la base sur laquelle on ajustera ensuite le système de types.
