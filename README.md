# PokéMotel (titre provisoire) — V0.9.2

Jeu de gestion d'hôtel pour créatures, inspiré du concept de CroqueMotel, avec des **affinités de types**.
PWA mobile, HTML/CSS/JS vanilla, sans dépendance ni étape de build. Toutes les illustrations sont
dessinées en SVG dans `src/client/art.js` (aucune image externe). Polices : Fredoka + Lilita One (Google Fonts).

## Lancer

```bash
npm run dev      # http://localhost:5173  (mode test : http://localhost:5173/?dev)
npm test         # tests du moteur (60, dont des parties jouées au hasard)
FUZZ_SEEDS=80 npm test   # passe lourde : 80 parties de 4 semaines
```

Le mode `?dev` ajoute un bouton **⏩ DEV** : +10 min, +1h, minuit, 10h, 8h, +1000 🪙.

## Règles (calquées sur CroqueMotel)

- **Vraie horloge** (`Europe/Paris`) : arrivées entre 6h et minuit, paie à minuit, départs à 10h,
  taxe la nuit du dimanche au lundi (payée = +1 niveau, +20 ⭐ × niveau, +10 💎 × niveau), due seulement
  si l'hôtel a accueilli quelqu'un dans la semaine. Aucune action entre 23 h 59 et 0 h 01.
- **Un type = une aura + la règle d'une famille d'origine** :

  | Type | Aura | Niveau | Particularité |
  |---|---|---|---|
  | Eau | Humidité | 1 | aucune |
  | Poison | Odeurs | 1 | oublie souvent un objet (+30 %) |
  | Feu | Chaleur | 1 | Pyromane : détruit sa chambre et ses équipements |
  | Roche | Froid | 3 | compte double au laboratoire |
  | Normal | Bruit | 3 | Jovial : +1 à ses 4 voisins |
  | Glace | Froid | 4 | petites attentions +3 h |
  | Insecte | Bruit | 4 | paie moitié, ×1,7 s'il est comblé |
  | Psy | Chaleur | 4 | placé à 8+ : fait venir un autre Psy |
  | Combat | Odeurs | 5 | à 4 ou moins, il hurle : −3 à tous les autres |
  | Plante | Humidité + Odeurs | 5 | émet deux auras |
  | Spectre | — | 6 | n'émet rien, pas même le voisinage |
  | Électrik | Bruit | 7 | à 0 ou 10, explose 3 h plus tard si rien ne change |

  Tout voisin visible apporte du Voisinage. On ne ressent jamais sa propre aura.
- **Satisfaction** : base 3 (Star : 1). Chaque client a 2 goûts répartis entre « aime » et « déteste » :
  aimé présent +2 par source / absent −3 ; détesté présent −3 par source / absent +2. Voisin Jovial +1,
  chambre abîmée −1 par point (doublé pour une Star), Star : chambre de luxe +2 / sinon −3, déménagement −2
  une seule fois, hystérie −3 par Combat qui hurle.
- **Gains** : 50 × facteur (0 → 1) × niveau de chambre (×1 / ×1,2 / ×1,6), payés **deux fois** (à minuit et au
  départ). Prestige : 1 à 10/10, Star 30/7/1.
- **Démarrage** : caisse vide, 6 chambres, aucun employé, réserve vide, **un** client devant la porte (Poison qui
  aime la Chaleur) ; la 1re mission amène son voisin idéal (Feu qui aime les Odeurs). Le Consortium remet la
  caisse à 300 quand elle passe sous 100, jusqu'au niveau 3. Après 5 jours d'absence, l'hôtel est remis d'aplomb.
- **Difficulté croissante** : un client toutes les 8 h sans personnel (5 / 4 / 3 / 2 / 1 / 0,75 h avec),
  goûts parmi 3 auras au niveau 1 puis 5, séjours d'1 nuit puis jusqu'à 3, types débloqués par niveau (tableau),
  Laboratoire et Laverie au 2, salles de loisir au 3, Cireuse au 4, Frigo au 5, Bar au 6.
  Taxes : ≤100, 500, 1000, 1500, 2000, 3000…
- **Services** : une demande à la fois, visible dans les 6 h avant son échéance (+1 si servie, rien si manquée).
- **Salles de loisir** : un client qui aime leur aura y va seul (2 h à 3 h, 5 🪙 par visite, puis 5 h de repos).
- **Départs** : 50 % de salir la chambre (25 % au niveau 1), un seul tirage à 50 % casse tous les équipements,
  un Pyromane détruit tout, un client à 0 part furieux sans payer. Objet oublié 20 % (garanti au début).
- **Bâtiment** : rez-de-chaussée en cases (2 emplacements pour des salles, l'accueil à droite, jamais de
  chambre), étages de largeurs libres. On agrandit **case par case** (Bureau › Ajouter un emplacement, puis une
  case en pointillés) : à côté d'une pièce du même étage, ou au-dessus du dernier étage, toujours sur une pièce
  existante ; 7 colonnes et 22 étages au plus. Au rez-de-chaussée, une case ajoutée à droite se place au début
  et l'accueil reste au bout. Amélioration d'une chambre : 10 min de travaux ; une pièce peut être remplacée
  directement (niveau et équipements perdus).
- **Décoration** : chaque étage a sa peinture (24 teintes), son papier peint (7 motifs), son bas de mur et
  sa frise ; pots de peinture, papiers peints et bas de mur surprise changent tout l'étage (toujours pour une
  valeur différente) et un nouvel étage hérite de celui du dessous. Les cartons de déco donnent du mobilier
  (plantes bizarres, tableaux, luminaires, meubles, canapés…) à poser n'importe où sur un étage, au sol ou au
  mur, avec « Changer le mobilier » : un meuble peut être à cheval entre deux pièces (réception comprise), il
  reste en place si une pièce est démolie et glisse avec son étage ; il se range à tout moment.
- **Publicité** (Bureau) : chaque jour, 4 à 6 sponsors (toujours les mêmes pour la journée) proposent un lot
  de 2 à 5 clients ou de 1 à 4 Stars, payé en 🪙 et livré au réveil, à 6h. La 1re offre du jour est un lot de Stars.
- **Legs** (Bureau) : au niveau 4 + étoiles, avec 3000 🪙 en caisse (non débités) et 12 / 20 / 30 / 50 / 75 /
  100 / 150 pièces bâties, on lègue son hôtel : on garde l'argent (+600), 1 employé et la réserve (sans le
  mobilier), on repart au niveau 2 avec l'accueil seul, +1 étoile ✦, +150 ⭐, un arbre de talents remis à zéro et
  plus grand de 5 points ; le tutoriel est validé d'un coup (récompenses versées) et les répétables reprennent.
- **Récapitulatifs** : bilan de minuit (ce que chaque client a payé), taxe impayée ou Consortium absent,
  niveau supérieur (types et pièces débloqués), bon retour après 5 jours.
- **Coûts** : chambre 100, amélioration 250 / 600, personnel 150 / 250 / 500 / 1000 🪙 puis en 💎, services 300,
  loisir 200 + 100 par salle, extensions gratuites jusqu'à 9 pièces puis 50 / 250 / 500… Réparations et petites
  attentions se paient même caisse vide (solde négatif possible).
- **Gemmes 💎** (monnaie premium, nom provisoire), gagnées en jouant : 10 à la fin du tutoriel, 5 par mission
  ensuite, 1 par client comblé (Star : 2 à 5), 10 × niveau à la taxe. Elles paient la Boutique, les employés
  au-delà du 4e, « Attirer un client » (5) et la remise à zéro des talents (20). Elles n'achètent jamais de 🪙.

## Missions, laboratoire, événements (V0.4)

- **19 missions de tutoriel** (installer un client, équiper, recruter, renommer, agrandir, passer une nuit,
  utiliser la recherche, satisfaire / combler des clients…) avec leurs récompenses (argent, objets, clients,
  points de recherche), puis **5 missions répétables** à +5 ⭐. Bandeau sous l'horloge, détail au toucher.
- **Laboratoire** (niveau 2, 250 🪙) : un client étudié part sans payer ; à 5 études, une fiole apparaît
  (1 point de recherche à ramasser) ; tous les autres clients, logés ou en file, perdent 1 point. Recharge de 2 h.
- **Arbre de talents** (onglet Labo) : 19 talents en 4 rangées (débloquées tous les 4 points), 25 points max ;
  au-delà, chaque fiole rapporte 1 ⭐. Réinitialisation : 20 💎.
- **Événements** toutes les 9 à 21 h : petits tracas, bonnes surprises, câlin d'étage (+2), Star démasquée ;
  à partir du niveau 2 accidents en chambre (3 dégâts) et vols (15 à 64 🪙 + l'équipement) ; à partir du
  niveau 4 étage ravagé (3 dégâts) et sblurb (goûts changés).
- Missions répétables tirées au sort (jamais deux fois la même) ; « Recommencer » seulement avant la 1re nuit.
- Les anciennes sauvegardes (v3 à v7) sont migrées automatiquement.

## Succès, Œufs surprise, Bureau (V0.9)

- **Succès** : 11 compteurs (clients hébergés, bien traités, Stars, services, objets ramassés, labo, pièces
  construites, campagnes, étoiles, Œufs d'amis, visites) et 39 paliers (seuils et points de CroqueMotel ;
  titres et badges maison). Le titre choisi s'affiche avec le nom du gérant (Bureau › Succès).
- **Œufs surprise** (le « colis suspect » d'origine) : un client envoyé par un ami ; il loge une nuit, ne paie
  jamais, survit au minuit de son arrivée, 3 au plus par hôtel. L'envoi entre joueurs viendra avec Supabase
  (`receiveParcel` est prêt ; barre DEV : « +🥚 Œuf »).
- **Bureau progressif** : « Recommencer » (normal ou personnalisé : accueil seul + 600 🪙) jusqu'à la 1re nuit,
  campagnes dès le niveau 2, réglages (nom, gérant, couleur du néon parmi 13) dès la mission « renommer »,
  legs ensuite.
- **Solidité** : toutes les actions passent par `dispatch(state, name, args, now)` (rattrapage du temps,
  verrou de minuit, refus des actions datées du passé ; une action refusée ne modifie jamais l'état). Un test
  joue des semaines de parties au hasard et vérifie les invariants, le déterminisme et le rattrapage.
- **Interface (lot I)** : toucher une pièce ouvre un menu compact collé à elle (infos du client, actions
  directes : servir, chouchouter, offrir, déménager, étudier, réparer, améliorer, construire…) ; barre
  d'actions sur la scène (Agrandir, Mobilier, réserve par rayons : on arme un objet puis on touche la
  pièce) ; bulles d'aide au survol ou à l'appui long ; flèche « Nouvelle mission » ; mode paysage.
- **Sprites (essai)** : une planche `assets/sprites/<type>.png` (ou des variantes `<type>1.png`, `<type>2.png`…,
  une au hasard par créature) remplace le dessin SVG de ce type par une
  animation de 8 images (voir `assets/sprites/LISEZMOI.md`).

## Scène et interface (V0.4.2)

- **Caméra** : glisser pour se déplacer, molette / pincement / boutons + − pour zoomer, bouton « tout voir ».
  Un glisser de plus de 4 px n'est pas un clic.
- **Grand écran** (≥ 900 px) : scène au centre, colonne à droite comme dans CroqueMotel : infos de ce qui est
  survolé (client : profil, goûts, détail de la satisfaction ; pièce : ambiance, équipements), mission en cours
  (objectifs regroupés avec compteurs, récompenses) et journal en direct. Sur mobile : bandeau de mission compact.
- **Habillage** : arbres, buissons, banc, cheminées fumantes, garde-corps, néon sur poteaux, appliques et
  jardinières sur la façade, horloges à LED (prochain client sur l'auvent, heure à la réception), lampadaires,
  voiture qui passe, oiseaux, skyline large ; éclairage de nuit (façade assombrie, chambres occupées qui rayonnent).

## Lisibilité (ce qui va / ne va pas)

- **Visage + note** sur chaque chambre occupée (vert / orange / rouge).
- **Pastilles d'influence** en bas de chaque chambre : flèche vers le voisin responsable, icône de l'aura
  (ou du facteur : camaraderie, solitude, confort, service…) et valeur (+1, −2…).
- **Placement en deux temps** : chaque chambre libre affiche la future note, ★ Top = meilleur choix ;
  toucher une chambre ouvre le détail (lignes + effet sur les voisins, chambres impactées surlignées),
  puis « Installer ici ».
- **Chiffres qui s'envolent** quand une humeur change, **bulles de pensée** qui expliquent la cause
  (« Cette chaleur me fait fondre ! »), **bulles de service** qui indiquent si la salle nécessaire est
  disponible (✓), occupée (horloge) ou à construire (cadenas).
- **Fiche client** : mini-carte des 4 voisins, détail ligne par ligne, conseils. **Fiche chambre libre** :
  auras reçues et types à éviter.

## Structure

```
index.html, style.css, manifest.webmanifest, sw.js, icons/
src/engine/   moteur pur (aucune dépendance au navigateur → réutilisable côté Supabase)
  data.js          types, auras, affinités, pièces, objets, équilibrage (CONFIG), noms provisoires
  rng.js           aléatoire déterministe (état stocké dans la sauvegarde)
  time.js          heure locale de l'hôtel (minuit, 10h, heure d'été)
  model.js         création de partie, pièces, clients, personnel, coûts
  satisfaction.js  calcul détaillé + aperçu de placement
  sim.js           advance(state, now) : rejoue les événements depuis la dernière visite, taxe
  actions.js       actions du joueur (placer, servir, affecter, acheter, construire, agrandir...)
  api.js           dispatch : point d'entrée unique des actions (client aujourd'hui, serveur demain)
  deco.js          décoration d'étage et mobilier
  meta.js          publicité, legs, recommencer, néon, Œufs surprise
  achievements.js  succès (compteurs, paliers, titres)
src/client/
  main.js          scène, interactions, fenêtres (rendu incrémental)
  art.js           illustrations SVG (créatures, pièces, décor)
  icons.js         icônes d'interface, auras, humeurs, directions
  insight.js       aides visuelles (pastilles, bulles de pensée, mini-carte, conseils)
  storage.js       LocalStore (futur SupabaseStore, même interface)
  furniture.js     dessins du mobilier
  sprites.js       planches de sprites animées (essai)
tests/        tests du moteur (node:test)
tools/        serveur de dev, génération des icônes
```

## Prochaines étapes

1. **Supabase** (lot J) : comptes, sauvegarde et moteur côté serveur via `dispatch`.
2. **Supabase** : comptes (e-mail + Google), sauvegarde côté serveur, moteur exécuté côté serveur.
3. **Social** : visite d'hôtels, envoi de clients, classement de prestige.
