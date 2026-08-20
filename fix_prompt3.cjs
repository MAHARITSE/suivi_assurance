const fs = require('fs');
const path = 'server.ts';
let code = fs.readFileSync(path, 'utf8');

const oldRules = `RÈGLES CRUCIALES D'EXTRACTION :
1. Extraction complète : Extrais TOUTES les lignes du document sans en oublier une seule (qu'il y ait 10, 25 ou 45 lignes).`;

const newRules = `RÈGLES CRUCIALES D'EXTRACTION :
1. EXTRACTION MULTI-PAGES OBLIGATOIRE : Ce document contient souvent plusieurs pages. Extrais ABSOLUMENT TOUTES les lignes de TOUTES LES PAGES jusqu'à la fin. Il est normal d'avoir plus de 100 lignes. N'abrège jamais le tableau !`;

code = code.replace(oldRules, newRules);

fs.writeFileSync(path, code, 'utf8');
