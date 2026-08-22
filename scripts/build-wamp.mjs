import { build } from 'vite';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wampDirectory = path.join(projectRoot, 'wamp');

// Ne supprimer que les fichiers générés : l'API PHP, la configuration et la
// documentation présents dans wamp/ sont conservés à chaque génération.
await mkdir(wampDirectory, { recursive: true });
await rm(path.join(wampDirectory, 'assets'), { recursive: true, force: true });
await rm(path.join(wampDirectory, 'index.html'), { force: true });

await build({
  configFile: path.join(projectRoot, 'vite.config.ts'),
  root: projectRoot,
  build: {
    outDir: wampDirectory,
    emptyOutDir: false,
  },
});

await copyFile(
  path.join(projectRoot, 'database', 'schema_wamp.sql'),
  path.join(wampDirectory, 'schema_wamp.sql')
);

console.log(`Dossier WAMP prêt : ${path.relative(projectRoot, wampDirectory)}`);
console.log('Copiez son contenu dans le dossier www de WAMP puis ouvrez votre URL localhost.');
