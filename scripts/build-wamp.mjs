import { build } from 'vite';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wampDirectory = path.join(projectRoot, 'wamp-deploy');
const wampSrcDirectory = path.join(projectRoot, 'wamp_src');

// Re-créer complètement le dossier wamp-deploy à zéro
await rm(wampDirectory, { recursive: true, force: true });
await mkdir(wampDirectory, { recursive: true });

// Compiler le frontend React avec Vite en mode « wamp »
// (IS_WAMP_BUILD = true dans le code : version STRICTEMENT MYSQL,
//  aucune donnée chargée en dehors de la base MySQL de WAMP)
await build({
  configFile: path.join(projectRoot, 'vite.config.ts'),
  root: projectRoot,
  mode: 'wamp',
  build: {
    outDir: wampDirectory,
    emptyOutDir: false,
  },
});

// Copier l'ensemble de l'API PHP, configurations, scripts SQL et guides d'installation
try {
  await cp(wampSrcDirectory, wampDirectory, { recursive: true });
} catch (err) {
  console.error('Erreur lors de la copie des fichiers WAMP :', err);
}

console.log(`\n✓ Dossier WAMP généré avec succès : ${path.relative(projectRoot, wampDirectory)}`);
console.log('✓ API PHP (api.php, config.php), schéma MySQL (schema.sql) et guides d\'installation (INSTALLATION.md) inclus.');
console.log('Copiez tout le contenu de wamp-deploy dans le répertoire www de WAMP Server.');

