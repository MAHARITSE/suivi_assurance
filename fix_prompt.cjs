const fs = require('fs');
const path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "RÈGLES CRUCIALES D'EXTRACTION :\\n1. Extraction complète : Extrais TOUTES les lignes du document sans en oublier une seule (qu'il y ait 10, 25 ou 45 lignes).",
  "RÈGLES CRUCIALES D'EXTRACTION :\\n1. EXTRÊMEMENT IMPORTANT - EXTRACTION MULTI-PAGES : Ce document contient de MULTIPLES PAGES. Tu DOIS lire et extraire TOUTES les lignes de TOUTES LES PAGES sans aucune exception. Ne t'arrête surtout pas à la première page. Continue jusqu'à la toute dernière ligne de la dernière page. Il est tout à fait normal d'avoir 150 lignes ou plus."
);

fs.writeFileSync(path, code, 'utf8');
