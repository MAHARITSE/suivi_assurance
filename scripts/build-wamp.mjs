import { build } from 'vite';
import { rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wampDirectory = path.join(projectRoot, 'wamp-deploy');

// Nettoyer uniquement les anciens bundles assets sans supprimer api.php, config.php, schema.sql, Installation.html, etc.
await rm(path.join(wampDirectory, 'assets'), { recursive: true, force: true });
await mkdir(wampDirectory, { recursive: true });

// Compiler le frontend React directement dans wamp-deploy
await build({
  configFile: path.join(projectRoot, 'vite.config.ts'),
  root: projectRoot,
  build: {
    outDir: wampDirectory,
    emptyOutDir: false,
  },
});

console.log(`\n✓ Dossier WAMP consolidé et prêt : ${path.relative(projectRoot, wampDirectory)}`);
console.log('✓ Tous les fichiers (Frontend React compilé, API api.php, config.php, schema.sql MySQL, et guides d\'installation) sont regroupés dans wamp-deploy/.');
console.log('Copiez simplement tout le contenu de wamp-deploy/ dans le répertoire www de WAMP Server.');


