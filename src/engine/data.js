// =============================================================================
// Données de jeu : types, auras, pièces, objets, équilibrage.
//
// L'équilibrage reprend celui de CroqueMotel (règles documentées dans la
// réécriture Eternaltwin) : satisfaction de base 3, goût présent +2 / absent −3,
// aversion présente −3 / absente +2, caisse vide au départ, arrivées toutes les
// 8 h sans personnel, séjours d'une nuit au début, nouveaux types débloqués par
// niveau d'hôtel, taxes 500 / 1000 / 1500…
//
// Simplification demandée : un type = une aura (Feu = Chaleur, Eau = Humidité,
// Poison = Odeurs, Glace = Froid, Normal = Bruit). Pas de tableau d'efficacité.
// Chaque type reprend la règle spéciale d'une famille d'origine (docs/ROADMAP.md §1).
// Les noms des Pokémon sont PROVISOIRES.
// =============================================================================

/** Symbole de la monnaie du jeu (provisoire). */
export const CURRENCY = '🪙';
/**
 * Monnaie premium (provisoire) : comme les jetons de la réécriture, elle se
 * GAGNE en jouant (missions, clients comblés, Stars, taxe) et n'achète jamais
 * de 🪙. Elle paie les articles de la Boutique, les employés au-delà du 4e,
 * « Attirer un client » et la remise à zéro des talents.
 */
export const GEMS = '💎';
export const GEMS_NAME = 'Gemmes';

/**
 * Auras (effets) : émises par les clients vers leurs 4 voisins, ou par les
 * équipements dans leur propre chambre. "voisinage" est émis par tout voisin
 * visible (sauf Spectre).
 */
export const AURAS = {
  chaleur:   { id: 'chaleur',   name: 'Chaleur',   icon: '🔥', color: '#ff7a3d' },
  humidite:  { id: 'humidite',  name: 'Humidité',  icon: '💧', color: '#4f8cff' },
  odeur:     { id: 'odeur',     name: 'Odeurs',    icon: '☠️', color: '#a14fc4' },
  froid:     { id: 'froid',     name: 'Froid',     icon: '❄️', color: '#7fd6e6' },
  bruit:     { id: 'bruit',     name: 'Bruit',     icon: '🔊', color: '#c9b98a' },
  voisinage: { id: 'voisinage', name: 'Compagnie', icon: '👥', color: '#64b5f6' },
};
export const AURA_IDS = Object.keys(AURAS);

/** Goûts tirables selon le niveau d'hôtel (le voisinage n'est jamais tiré). */
export function tastePool(level) {
  return level > 1 ? ['humidite', 'chaleur', 'odeur', 'froid', 'bruit'] : ['humidite', 'chaleur', 'odeur'];
}

/**
 * Types de Pokémon.
 * - auras  : auras émises vers les voisins
 * - unlock : niveau d'hôtel à partir duquel le type peut arriver
 * - weight : fréquence relative
 */
export const TYPES = {
  eau:      { id: 'eau',      name: 'Eau',      color: '#5b9cff', dark: '#2f63c4', icon: '💧', auras: ['humidite'], unlock: 1, weight: 10,
              trait: { name: 'Banal',          desc: 'Aucune particularité.' } },
  poison:   { id: 'poison',   name: 'Poison',   color: '#b46ad6', dark: '#7a3399', icon: '☠️', auras: ['odeur'],    unlock: 1, weight: 10,
              trait: { name: 'Tête en l\'air', desc: 'Oublie beaucoup plus souvent un objet en partant (+30 %).' } },
  feu:      { id: 'feu',      name: 'Feu',      color: '#ff8a3d', dark: '#c4521a', icon: '🔥', auras: ['chaleur'],  unlock: 1, weight: 10,
              trait: { name: 'Pyromane',       desc: 'Détruit souvent sa chambre et casse tous les équipements en partant (sauf extincteur).' } },
  roche:    { id: 'roche',    name: 'Roche',    color: '#a99a86', dark: '#6b5d4c', icon: '🪨', auras: ['froid'],    unlock: 3, weight: 10,
              trait: { name: 'Costaud',        desc: 'Compte double au laboratoire (2 études au lieu d\'une).' } },
  normal:   { id: 'normal',   name: 'Normal',   color: '#c8b98f', dark: '#8f7f57', icon: '⭕', auras: ['bruit'],    unlock: 3, weight: 10,
              trait: { name: 'Jovial',         desc: 'Donne +1 de satisfaction à chacun de ses voisins.' } },
  glace:    { id: 'glace',    name: 'Glace',    color: '#9fe3ec', dark: '#4fa6b8', icon: '❄️', auras: ['froid'],    unlock: 4, weight: 10,
              trait: { name: 'Frileux',        desc: 'Les petites attentions du personnel durent 3 h de plus.' } },
  insecte:  { id: 'insecte',  name: 'Insecte',  color: '#a5c43a', dark: '#647a16', icon: '🐞', auras: ['bruit'],    unlock: 4, weight: 10,
              trait: { name: 'Radin',          desc: 'Ne paie que la moitié… sauf s\'il est comblé (10) : il paie alors ×1,7.' } },
  psy:      { id: 'psy',      name: 'Psy',      color: '#ff7fbf', dark: '#c23f86', icon: '🔮', auras: ['chaleur'],  unlock: 4, weight: 10,
              trait: { name: 'Hypnotiseur',    desc: 'Installé une 1re fois à 8 ou plus, il fait venir un autre client Psy.' } },
  combat:   { id: 'combat',   name: 'Combat',   color: '#e0594a', dark: '#9c2a1f', icon: '🥊', auras: ['odeur'],    unlock: 5, weight: 10,
              trait: { name: 'Hystérique',     desc: 'À 4 ou moins, il hurle : −3 pour TOUS les autres clients de l\'hôtel.' } },
  plante:   { id: 'plante',   name: 'Plante',   color: '#73cc5a', dark: '#3d8a2c', icon: '🌿', auras: ['humidite', 'odeur'], unlock: 5, weight: 10,
              trait: { name: 'Monstro-plante', desc: 'Dégage deux choses à la fois autour de lui : Humidité et Odeurs.' } },
  spectre:  { id: 'spectre',  name: 'Spectre',  color: '#8f7cc7', dark: '#55448c', icon: '👻', auras: [],           unlock: 6, weight: 10,
              trait: { name: 'Invisible',      desc: 'Ne dégage rien et ne compte pas comme un voisin.' } },
  electrik: { id: 'electrik', name: 'Électrik', color: '#ffd23f', dark: '#c49a0a', icon: '⚡', auras: ['bruit'],    unlock: 7, weight: 10,
              trait: { name: 'Survolté',       desc: 'À 0 ou à 10, il devient instable et explose 3 h plus tard (chambre détruite) si rien ne change.' } },
};
export const TYPE_IDS = Object.keys(TYPES);

/** Type "porteur" principal de chaque aura (pour les conseils). */
export const AURA_TYPE = { chaleur: 'feu', humidite: 'eau', odeur: 'poison', froid: 'glace', bruit: 'normal' };

/** Les deux premiers clients sont composés à la main (comme dans CroqueMotel). */
export const STARTERS = [
  { type: 'poison', species: 'abo', emits: ['odeur'], likes: ['chaleur', 'voisinage'], dislikes: [] },
  { type: 'feu', species: 'salameche', emits: ['chaleur'], likes: ['odeur', 'voisinage'], dislikes: [] },
];

// -----------------------------------------------------------------------------
// Espèces, ce qu'elles dégagent, natures
//
// Comme dans CroqueMotel, trois choses distinctes par client :
//  - le COMPORTEMENT vient du type (premier type de l'espèce) : Feu = Pyromane… ;
//  - ce qu'il DÉGAGE est tiré à son arrivée parmi ce qui va avec ses types ;
//  - ses GOÛTS viennent de sa nature (Timide : aime la Chaleur, déteste le Bruit).
// -----------------------------------------------------------------------------

/**
 * Ce que chaque type peut faire dégager (le premier est le plus fréquent).
 * Acier, Sol et Fée n'existent qu'en second type : ils n'apportent pas de
 * comportement, seulement ce qu'ils dégagent.
 */
export const TYPE_EMITS = {
  feu: ['chaleur', 'odeur', 'bruit'],
  eau: ['humidite', 'froid', 'bruit'],
  poison: ['odeur', 'humidite'],
  electrik: ['bruit', 'chaleur'],
  glace: ['froid', 'humidite'],
  roche: ['froid', 'bruit'],
  normal: ['bruit', 'odeur', 'chaleur'],
  insecte: ['bruit', 'odeur'],
  psy: ['chaleur', 'froid'],
  combat: ['odeur', 'chaleur', 'bruit'],
  plante: ['humidite', 'odeur', 'chaleur'],
  spectre: [],
  acier: ['froid', 'bruit'],
  sol: ['odeur', 'bruit'],
  fee: ['chaleur', 'odeur'],
};

/** Types qui n'existent qu'en second type (affichage). */
export const EXTRA_TYPES = {
  acier: { id: 'acier', name: 'Acier', icon: '⚙️', color: '#9aa7b8' },
  sol: { id: 'sol', name: 'Sol', icon: '⛰️', color: '#c9a35a' },
  fee: { id: 'fee', name: 'Fée', icon: '✨', color: '#f4a6d7' },
};

/** Niveau d'hôtel à partir duquel une espèce à double type dégage deux choses. */
export const DUAL_TYPE_LEVEL = 5;

/** Espèces : nom, types, planche de sprites (assets/sprites/<sprite>.png). */
export const SPECIES = {
  carapuce: { id: 'carapuce', name: 'Carapuce', types: ['eau'], sprite: 'eau' },
  psykokwak: { id: 'psykokwak', name: 'Psykokwak', types: ['eau'], sprite: 'eau1' },
  ptitard: { id: 'ptitard', name: 'Ptitard', types: ['eau'], sprite: 'eau2' },
  kokiyas: { id: 'kokiyas', name: 'Kokiyas', types: ['eau'], sprite: 'eau3' },
  magicarpe: { id: 'magicarpe', name: 'Magicarpe', types: ['eau'], sprite: 'eau4' },
  otaria: { id: 'otaria', name: 'Otaria', types: ['eau'], sprite: 'glace' },
  salameche: { id: 'salameche', name: 'Salamèche', types: ['feu'], sprite: 'feu' },
  ponyta: { id: 'ponyta', name: 'Ponyta', types: ['feu'], sprite: 'feu1' },
  goupix: { id: 'goupix', name: 'Goupix', types: ['feu'], sprite: 'feu2' },
  magmar: { id: 'magmar', name: 'Magmar', types: ['feu'], sprite: 'feu3' },
  abo: { id: 'abo', name: 'Abo', types: ['poison'], sprite: 'poison1' },
  tadmorv: { id: 'tadmorv', name: 'Tadmorv', types: ['poison'], sprite: 'poison2' },
  rattata: { id: 'rattata', name: 'Rattata', types: ['normal'], sprite: 'normal' },
  metamorph: { id: 'metamorph', name: 'Métamorph', types: ['normal'], sprite: 'normal1' },
  evoli: { id: 'evoli', name: 'Évoli', types: ['normal'], sprite: 'normal2' },
  pikachu: { id: 'pikachu', name: 'Pikachu', types: ['electrik'], sprite: 'electrik' },
  voltorbe: { id: 'voltorbe', name: 'Voltorbe', types: ['electrik'], sprite: 'electrik2' },
  elektek: { id: 'elektek', name: 'Élektek', types: ['electrik'], sprite: 'electrik3' },
  magneti: { id: 'magneti', name: 'Magnéti', types: ['electrik', 'acier'], sprite: 'electrik1' },
  ferosinge: { id: 'ferosinge', name: 'Férosinge', types: ['combat'], sprite: 'combat' },
  machoc: { id: 'machoc', name: 'Machoc', types: ['combat'], sprite: 'combat1' },
  soporifik: { id: 'soporifik', name: 'Soporifik', types: ['psy'], sprite: 'psy2' },
  mmime: { id: 'mmime', name: 'M. Mime', types: ['psy', 'fee'], sprite: 'psy1' },
  chenipan: { id: 'chenipan', name: 'Chenipan', types: ['insecte'], sprite: 'insecte' },
  aspicot: { id: 'aspicot', name: 'Aspicot', types: ['insecte', 'poison'], sprite: 'insecte1' },
  mimitoss: { id: 'mimitoss', name: 'Mimitoss', types: ['insecte', 'poison'], sprite: 'poison' },
  lippoutou: { id: 'lippoutou', name: 'Lippoutou', types: ['glace', 'psy'], sprite: 'glace1' },
  racaillou: { id: 'racaillou', name: 'Racaillou', types: ['roche', 'sol'], sprite: 'roche' },
  mystherbe: { id: 'mystherbe', name: 'Mystherbe', types: ['plante', 'poison'], sprite: 'plante' },
  fantominus: { id: 'fantominus', name: 'Fantominus', types: ['spectre', 'poison'], sprite: 'spectre' },
};
export const SPECIES_IDS = Object.keys(SPECIES);

/**
 * Natures : comme dans Pokémon, chacune favorise une statistique et en pénalise
 * une autre. Ici : Attaque = Bruit, Défense = Froid, Vitesse = Chaleur,
 * Attaque Spéciale = Odeurs, Défense Spéciale = Humidité. Les 5 natures neutres
 * aiment simplement la compagnie.
 */
export const NATURES = {
  solo: { name: 'Solo', like: 'bruit', dislike: 'froid' },
  rigide: { name: 'Rigide', like: 'bruit', dislike: 'odeur' },
  mauvais: { name: 'Mauvais', like: 'bruit', dislike: 'humidite' },
  brave: { name: 'Brave', like: 'bruit', dislike: 'chaleur' },
  assure: { name: 'Assuré', like: 'froid', dislike: 'bruit' },
  malin: { name: 'Malin', like: 'froid', dislike: 'odeur' },
  lache: { name: 'Lâche', like: 'froid', dislike: 'humidite' },
  relax: { name: 'Relax', like: 'froid', dislike: 'chaleur' },
  timide: { name: 'Timide', like: 'chaleur', dislike: 'bruit' },
  presse: { name: 'Pressé', like: 'chaleur', dislike: 'froid' },
  jovial: { name: 'Jovial', like: 'chaleur', dislike: 'odeur' },
  naif: { name: 'Naïf', like: 'chaleur', dislike: 'humidite' },
  modeste: { name: 'Modeste', like: 'odeur', dislike: 'bruit' },
  doux: { name: 'Doux', like: 'odeur', dislike: 'froid' },
  foufou: { name: 'Foufou', like: 'odeur', dislike: 'humidite' },
  discret: { name: 'Discret', like: 'odeur', dislike: 'chaleur' },
  calme: { name: 'Calme', like: 'humidite', dislike: 'bruit' },
  gentil: { name: 'Gentil', like: 'humidite', dislike: 'froid' },
  prudent: { name: 'Prudent', like: 'humidite', dislike: 'odeur' },
  malpoli: { name: 'Malpoli', like: 'humidite', dislike: 'chaleur' },
  hardi: { name: 'Hardi', like: 'voisinage', dislike: null },
  docile: { name: 'Docile', like: 'voisinage', dislike: null },
  serieux: { name: 'Sérieux', like: 'voisinage', dislike: null },
  pudique: { name: 'Pudique', like: 'voisinage', dislike: null },
  bizarre: { name: 'Bizarre', like: 'voisinage', dislike: null },
};
export const NATURE_IDS = Object.keys(NATURES);

/** Phrase de la fiche pour ce qu'un Pokémon dégage. */
export const EMIT_PHRASES = {
  chaleur: 'dégage énormément de chaleur',
  humidite: 'dégage beaucoup d’humidité',
  odeur: 'dégage une odeur tenace',
  froid: 'répand un froid glacial',
  bruit: 'fait beaucoup de bruit',
};

/** Nom affichable d'un type (y compris Acier, Sol, Fée). */
export const typeName = (id) => (TYPES[id] || EXTRA_TYPES[id] || { name: id }).name;

// -----------------------------------------------------------------------------
// Services en chambre et pièces constructibles
// -----------------------------------------------------------------------------

/** Demandes de service (chacune nécessite une machine dédiée), débloquées aux niveaux 2, 4, 5 et 6. */
export const SERVICES = {
  linge:   { id: 'linge',   name: 'Linge propre',  icon: '👕', room: 'laverie' },
  cirage:  { id: 'cirage',  name: 'Pattes cirées', icon: '👞', room: 'cireuse' },
  encas:   { id: 'encas',   name: 'En-cas',        icon: '🍰', room: 'cuisine' },
  boisson: { id: 'boisson', name: 'Boisson',       icon: '🥤', room: 'bar' },
};
export const SERVICE_IDS = Object.keys(SERVICES);

/**
 * Pièces constructibles sur un emplacement libre.
 * - cost   : prix fixe, ou fonction (state) => prix
 * - level  : niveau d'hôtel requis ; max : exemplaires maximum
 */
export const BUILDABLES = {
  bedroom:   { id: 'bedroom',   kind: 'bedroom', name: 'Chambre',         cost: 100, minutes: 5,  level: 1,
               desc: 'Héberge un client.' },
  laverie:   { id: 'laverie',   kind: 'service', name: 'Laverie',          cost: 300, minutes: 30, level: 2, max: 2, service: 'linge',
               desc: 'Permet de répondre aux demandes de linge propre.' },
  cireuse:   { id: 'cireuse',   kind: 'service', name: 'Cireuse à pattes', cost: 300, minutes: 30, level: 4, max: 2, service: 'cirage',
               desc: 'Permet de répondre aux demandes de cirage.' },
  cuisine:   { id: 'cuisine',   kind: 'service', name: 'Frigo à en-cas',   cost: 300, minutes: 30, level: 5, max: 2, service: 'encas',
               desc: 'Permet de répondre aux demandes d\'en-cas.' },
  bar:       { id: 'bar',       kind: 'service', name: 'Bar à jus',        cost: 300, minutes: 30, level: 6, max: 2, service: 'boisson',
               desc: 'Permet de répondre aux demandes de boisson.' },
  sauna:     { id: 'sauna',     kind: 'leisure', name: 'Sauna',           cost: 'leisure', minutes: 30, level: 3, max: 3, aura: 'chaleur',
               desc: 'Les clients qui aiment la Chaleur viennent s\'y détendre (5 🪙 par visite).' },
  piscine:   { id: 'piscine',   kind: 'leisure', name: 'Piscine',         cost: 'leisure', minutes: 30, level: 3, max: 3, aura: 'humidite',
               desc: 'Les clients qui aiment l\'Humidité viennent s\'y détendre (5 🪙 par visite).' },
  decharge:  { id: 'decharge',  kind: 'leisure', name: 'Décharge VIP',    cost: 'leisure', minutes: 30, level: 3, max: 3, aura: 'odeur',
               desc: 'Les clients qui aiment les Odeurs viennent s\'y détendre (5 🪙 par visite).' },
  patinoire: { id: 'patinoire', kind: 'leisure', name: 'Patinoire',       cost: 'leisure', minutes: 30, level: 3, max: 3, aura: 'froid',
               desc: 'Les clients qui aiment le Froid viennent s\'y détendre (5 🪙 par visite).' },
  labo:      { id: 'labo',      kind: 'lab',     name: 'Laboratoire',     cost: 250, minutes: 30, level: 2, max: 2,
               desc: 'Envoyez-y un client pour étudier les Pokémon : 5 études = une fiole à ramasser (1 point de recherche).' },
  karaoke:   { id: 'karaoke',   kind: 'leisure', name: 'Karaoké',         cost: 'leisure', minutes: 30, level: 3, max: 3, aura: 'bruit',
               desc: 'Les clients qui aiment le Bruit viennent s\'y détendre (5 🪙 par visite).' },
};

// -----------------------------------------------------------------------------
// Objets (boutique, objets oubliés)
// - equip  : équipement installé dans une chambre (2 maximum, différents),
//            même occupée ; il ne se déplace pas, on peut seulement le détruire
// - gift   : cadeau offert à un client installé (refusé s'il a déjà eu un bonus)
// - repair : réparation instantanée d'une chambre vide
// - price  : prix en GEMMES (comme dans la réécriture, la Boutique se paie en
//            monnaie premium) ; shop : rayon ('base' | 'special'), absent = pas en boutique
// Au départ d'un client, un seul tirage (50 %) casse TOUS les équipements.
// -----------------------------------------------------------------------------
export const ITEMS = {
  radiateur:   { id: 'radiateur',   kind: 'equip', name: 'Radiateur turbo',      price: 4, shop: 'base', auras: ['chaleur'],
                 desc: 'Génère de la Chaleur dans la chambre.' },
  brumisateur: { id: 'brumisateur', kind: 'equip', name: 'Brumisateur géant',    price: 4, shop: 'base', auras: ['humidite'],
                 desc: 'Génère de l\'Humidité dans la chambre.' },
  compost:     { id: 'compost',     kind: 'equip', name: 'Bac à compost',        price: 4, shop: 'base', auras: ['odeur'],
                 desc: 'Génère des Odeurs dans la chambre.' },
  clim:        { id: 'clim',        kind: 'equip', name: 'Clim polaire',         price: 4, shop: 'base', auras: ['froid'],
                 desc: 'Génère du Froid dans la chambre.' },
  enceinte:    { id: 'enceinte',    kind: 'equip', name: 'Enceinte XXL',         price: 4, shop: 'base', auras: ['bruit'],
                 desc: 'Génère du Bruit dans la chambre.' },
  nounours:    { id: 'nounours',    kind: 'equip', name: 'Nounours câlin',       price: 4, shop: 'base', auras: ['voisinage'],
                 desc: 'Tient compagnie au client, comme s\'il avait un voisin.' },
  hammam:      { id: 'hammam',      kind: 'equip', name: 'Kit hammam',           price: 6, auras: ['chaleur', 'humidite'],
                 desc: 'Génère de la Chaleur ET de l\'Humidité.' },
  fondue:      { id: 'fondue',      kind: 'equip', name: 'Fondue oubliée',       price: 6, auras: ['chaleur', 'odeur'],
                 desc: 'Génère de la Chaleur ET des Odeurs.' },
  malle:       { id: 'malle',       kind: 'equip', name: 'Malle à double fond',  price: 5, shop: 'special', auras: [], dropBonus: 0.3,
                 desc: 'Le client a 30 % de chances en plus d\'oublier un objet en partant.' },
  kit:         { id: 'kit',         kind: 'repair', name: 'Kit réparation express', price: 5, shop: 'special',
                 desc: 'Répare instantanément tous les dégâts d\'une chambre vide.' },
  panier:      { id: 'panier',      kind: 'gift',  name: 'Panier de bienvenue',  price: 2, shop: 'special', gift: 1,
                 desc: '+1 de satisfaction, si le client n\'a encore reçu aucun bonus.' },
  coffret:     { id: 'coffret',     kind: 'gift',  name: 'Coffret prestige',     price: 5, shop: 'special', gift: 2,
                 desc: '+2 de satisfaction, si le client n\'a encore reçu aucun bonus.' },
  baldaquin:   { id: 'baldaquin',   kind: 'equip', name: 'Lit à baldaquin doré', price: 5, shop: 'special', auras: [], payMult: 1.25, consumed: true,
                 desc: 'Gains +25 %. Retiré au départ du client.' },
  cocon:       { id: 'cocon',       kind: 'equip', name: 'Cocon insonorisé',     price: 5, shop: 'special', auras: [], isolate: true, consumed: true,
                 desc: 'Isole totalement la chambre (rien n\'entre, rien ne sort). Retiré au départ.' },
  matelas:     { id: 'matelas',     kind: 'equip', name: 'Matelas nuage',        price: 5, shop: 'special', auras: [], nightBonus: 1,
                 desc: '+1 de satisfaction à chaque nuit passée dans la chambre (cumulable).' },
  feux:        { id: 'feux',        kind: 'equip', name: 'Feux d\'artifice',     price: 5, shop: 'special', auras: [], fireworks: true,
                 desc: 'La 1re nuit : +6 pour l\'occupant… puis la chambre prend 3 dégâts et tout l\'équipement saute.' },
  extincteur:  { id: 'extincteur',  kind: 'equip', name: 'Extincteur',           price: 4, shop: 'special', auras: [], fireproof: true,
                 desc: 'Empêche un client Feu de détruire la chambre.' },
  // Décoration : s'utilise sur une pièce, change tout son étage (valeur toujours différente de l'actuelle).
  randpaint:     { id: 'randpaint',     kind: 'deco', deco: 'paint',     name: 'Pot de peinture surprise', price: 2, shop: 'deco',
                   desc: 'Repeint un étage d\'une des 24 teintes, au hasard.' },
  randpaintwarm: { id: 'randpaintwarm', kind: 'deco', deco: 'paintWarm', name: 'Peinture vive',            price: 3, shop: 'deco',
                   desc: 'Repeint un étage d\'une teinte vive, au hasard.' },
  randpaintcool: { id: 'randpaintcool', kind: 'deco', deco: 'paintCool', name: 'Peinture douce',           price: 3, shop: 'deco',
                   desc: 'Repeint un étage d\'une teinte douce, au hasard.' },
  randtexture:   { id: 'randtexture',   kind: 'deco', deco: 'wallpaper', name: 'Papier peint surprise',    price: 3, shop: 'deco',
                   desc: 'Change le motif du papier peint d\'un étage.' },
  randbottom:    { id: 'randbottom',    kind: 'deco', deco: 'bottom',    name: 'Bas de mur surprise',      price: 4, shop: 'deco',
                   desc: 'Change le bas de mur et la frise d\'un étage.' },
  randdeco:      { id: 'randdeco',      kind: 'decobox',                 name: 'Carton de déco surprise',  price: 5, shop: 'deco',
                   desc: 'Contient un meuble ou un objet de déco à poser où vous voulez.' },
};

/** Kits de la Boutique : un exemplaire de chaque article du rayon (prix en gemmes). */
export const PACKS = {
  base: { id: 'base', name: 'Kit d\'aménagements de base', price: 20 },
  deco: { id: 'deco', name: 'Kit de décoration',           price: 15 },
};
export const ITEM_IDS = Object.keys(ITEMS);

// -----------------------------------------------------------------------------
// Équilibrage (repris de CroqueMotel)
// -----------------------------------------------------------------------------
export const CONFIG = {
  timeZone: 'Europe/Paris',
  wakeUpHour: 6,              // aucun client n'arrive entre minuit et 6h
  checkoutHour: 10,           // départs à 10h le jour du départ
  requestLastHour: 23,

  startMoney: 0,              // la caisse est vide à l'ouverture
  startPrestige: 1,
  startCols: 3,               // rez-de-chaussée : 2 emplacements + l'accueil à droite
  startFloors: 2,             // 2 étages de 3 chambres
  startBedrooms: 6,
  startStaff: 0,
  startItems: {},

  firstClients: 1,            // un seul client devant la porte à l'ouverture
  queueMax: 5,
  arrivalHoursByStaff: [8, 5, 4, 3, 2, 1, 0.75], // délai entre deux arrivées selon le personnel à l'accueil
  arrivalRetryMin: 10,

  // Satisfaction
  baseSat: 3,
  likeOk: 2,                  // goût présent (par source) / aversion absente
  likeNok: -3,                // goût absent / aversion présente (par source)
  joy: 1,                     // voisin Jovial
  movePenalty: -2,            // une seule fois par client (−1 avec « Faculté d'adaptation »)
  hysteriaThreshold: 4,       // un client Combat à 4 ou moins hurle…
  hysteriaMalus: -3,          // … et fait perdre 3 à tous les autres
  bombFuseHours: 3,           // Électrik à 0 ou 10 : explosion 3 h plus tard
  insectPay: 0.5,             // l'Insecte paie moitié…
  insectPayMax: 1.7,          // … sauf comblé (10)

  // Gains : 50 × facteur(satisfaction) × niveau de chambre
  clientMoney: 50,
  payFactors: [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.45, 0.55, 0.7, 0.8, 1],
  roomLevelMult: [1, 1, 1.2, 1.6],
  moneyPickup: 25,            // billets oubliés au sol
  // Salles de loisir : visite de 2 h à 2 h 59, 5 🪙, puis 5 h de repos (minutes sauf restHours)
  leisure: { gain: 5, visitMin: 120, visitSpread: 59, restHours: 5, idleMin: 20, idleSpread: 50, retryMin: 10, retrySpread: 30 },

  // Séjours (poids des durées 1 / 2 / 3 nuits selon le niveau)
  stayWeights: (level) => [100, level >= 4 ? 50 : level === 3 ? 20 : 0, level >= 4 ? 20 : 0],

  // Construction
  roomUpgradeCost: [0, 0, 250, 600],
  roomUpgradeFame: [0, 0, 1, 2],
  roomMaxLevel: 3,
  roomUpgradeMinutes: 10,
  leisureBaseCost: 200,       // + 100 par salle d'ambiance déjà construite
  leisureStepCost: 100,
  lobbyCapacity: [0, 2, 3, 4, 5, 6],     // par niveau d'accueil (1 à 5)
  lobbyUpgradeCost: [0, 0, 250, 500, 1500, 3000],
  maxCols: 7,
  maxFloors: 22,
  extendFameFromRooms: 9,     // au-delà de 9 pièces, chaque extension rapporte 1 ⭐

  // Personnel
  staffCosts: [150, 250, 500, 1000], // puis 15 × (n − 1) gemmes
  staffRepairMinutes: 2.5,    // par point de dégât
  repairCostPerDamage: 6,
  repairCostMult: [1, 1, 1.5, 2],
  careHours: 4,
  careCost: 10,
  careChance: 0.4,
  glaceCareExtraHours: 3,
  maxDamage: 5,

  // Départs
  dirtChance: 0.5,            // la chambre s'abîme (+1) ; divisé par 2 au niveau 1
  breakChance: 0.5,           // un seul tirage casse tous les équipements
  dropChance: 0.2,
  poisonDropBonus: 0.3,
  beginnerItemFloor: 4,       // au niveau 1, objet garanti tant qu'on en a 4 ou moins

  // Stars (VIP)
  vipChance: 0.01,
  vipBase: 1,                 // 3 − 2 : elles "aiment" les chambres de luxe
  vipFame: { max: 30, good: 7, low: 1 },

  // Services
  // Une demande à la fois, visible dans les 6 h avant son échéance ; manquée = rien.
  serviceUnlock: { linge: 2, cirage: 4, encas: 5, boisson: 6 },
  requestVisibleHours: 6,
  requestRange: { arrival: [1, 12], done: [12, 24], missed: [7, 15] }, // heures en plus des 6 h
  serviceBusyMin: 30,
  serviceGain: 1,

  // Progression
  taxByLevel: { 2: 500, 3: 1000, 4: 1500, 5: 2000, 6: 3000, 7: 4200, 8: 5600, 9: 8000 },
  levelUpFamePerLevel: 20,
  levelUpFameCap: 200,
  subsidyThreshold: 100,      // l'aide du Consortium remet la caisse à 300…
  subsidyTarget: 300,
  subsidyMaxLevel: 3,         // … jusqu'au niveau 3

  // Laboratoire
  lab: { needed: 5, gain: 1, specialGain: 2, cooldownHours: 2, fearMaxSpare: 0.66, goldFame: 1 },
  // Événements aléatoires : toutes les 9 à 21 h
  events: { minHours: 9, spreadHours: 12, accidentDamage: 3, theftMin: 15, theftMax: 64, floorHug: 2, floorDamage: 3 },

  // Retour après une longue absence (5 jours) : hôtel remis d'aplomb
  welcomeBack: { days: 5, money: 250 },
  // Aucune action entre 23 h 59 et 0 h 01
  lockMinutes: 1,

  // Monnaie premium : ce qu'elle rapporte et ce qu'elle coûte
  gems: { tutorialEnd: 10, quest: 5, delighted: 1, starGood: 2, starMax: 5, taxPerLevel: 10, attract: 5, resetTalents: 20, staffStep: 15 },

  satisfiedThreshold: 8,
  logMax: 300,
  maxCatchUpEvents: 20000,
};

export const STAFF_NAMES = ['Gaston', 'Josiane', 'Marcel', 'Huguette', 'Raymond', 'Ginette', 'Lucien', 'Odette', 'Firmin', 'Paulette'];
export const HOTEL_NAMES = {
  pre: ['Taudis', 'Refuge', 'Motel', 'Repaire', 'Pension', 'Auberge', 'Gîte'],
  suf: ['du coin perdu', 'des courants d\'air', 'de la dernière chance', 'du marais', 'des insomniaques', 'du bout du monde', 'des grincements'],
};
