// Copie le moteur (src/engine) à côté de l'Edge Function, avant chaque déploiement :
//   node tools/sync-engine.mjs && npx supabase@2.121.0 functions deploy act --project-ref biwenlmxtabconpkblke
// Un test vérifie que la copie est à jour.
import { mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';

const from = new URL('../src/engine/', import.meta.url);
const to = new URL('../supabase/functions/_shared/engine/', import.meta.url);
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
const files = readdirSync(from).filter((f) => f.endsWith('.js'));
for (const f of files) copyFileSync(new URL(f, from), new URL(f, to));
console.log(`Moteur copié pour le serveur : ${files.length} fichiers.`);
