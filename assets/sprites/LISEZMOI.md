# Planches de sprites (essai local)

Déposez ici des planches PNG nommées d'après le type :

- `feu.png`, ou plusieurs variantes `feu1.png`, `feu2.png`, `feu3.png`… (jusqu'à 9, sans trou) ;
- idem pour `eau`, `poison`, `plante`, `glace`, `electrik`, `normal`, `roche`, `insecte`, `psy`,
  `combat`, `spectre`.

Chaque créature reçoit une variante de son type au hasard et la garde tout son séjour. Elle est
animée avec les 2 premières lignes de 4 images (0,5 s par image). Sans fichier, le jeu garde
ses dessins SVG. Rechargez la page après avoir ajouté un fichier.

Réglages dans `src/client/sprites.js` :

- `SPRITE_TYPES` : pour tout un type (ex. `poison: { rows: 1 }` = une seule ligne de 4 images) ;
- `SPRITE_FILES` : pour une planche précise (ex. `'feu2': { sheetCols: 5 }`) ;
- options : `cols`, `rows`, `sheetCols` (images par ligne sur la planche) ou `frameW` / `frameH`
  (taille d'une image en pixels), `frameMs` (durée d'une image), `pixel: true` pour du pixel art.

À ne pas publier avec des images dont vous n'avez pas les droits.
