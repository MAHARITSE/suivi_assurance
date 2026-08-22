# 📚 Tutoriel Complet — Suivi Assurance SALFA (WAMP)

> **Objectif :** Installer, déployer et utiliser l'application **Suivi Assurance SALFA** sur **WAMP Server** (Windows, Apache, MySQL, PHP) en 10 minutes.
> Pour l'Hôpital Loterana SALFA Toliara — Gestion tiers-payant : sociétés, assurés, prestations, règlements.

---

## 🎯 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Installation WAMP](#installation-wamp)
4. [Compiler l'application](#compiler)
5. [Déployer dans www](#deployer)
6. [Base de données](#base-de-donnees)
7. [Vérification](#verification)
8. [Guide d'utilisation](#guide-utilisation)
9. [Imports PDF & Excel](#imports)
10. [Dépannage](#depannage)
11. [FAQ](#faq)
12. [Tutoriel intégré dans l'app](#tutoriel-integre)

---

## 1. Vue d'ensemble <a id="vue-densemble"></a>

L'application est une **SPA React** (Vite + Tailwind) avec :

- **Frontend :** React 19, lucide-react, recharts, jsPDF
- **Backend WAMP :** `wamp/api.php` (PHP 7.1+ → 8.5, PDO MySQL)
- **Base :** `suivi_assurance_salfa` — 7 tables
- **Build :** `npm run build:wamp` génère `wamp/` prêt à copier dans `C:\wamp64\www\`

**Flux :**
```
Code React → npm run build:wamp → wamp/index.html + assets/
                                     + api.php + config.php + schema.sql
                                      ↓
                          C:\wamp64\www\suivi_assurance\
                                      ↓
                          http://localhost/suivi_assurance/
```

---

## 2. Prérequis <a id="prérequis"></a>

| Composant | Minimum | Recommandé | Note |
|-----------|---------|------------|------|
| **WampServer** | 3.x | 3.2.6+ / 3.3.x | wampserver.aviatechno.net |
| **PHP** | 7.1 | 7.4, 8.0, 8.1, 8.2 | Inclus WAMP, changer via icône |
| **MySQL/MariaDB** | 5.7 / 10.3 | 8.0 / 10.4+ | Inclus WAMP |
| **Apache** | 2.4 | 2.4.x | Inclus WAMP |
| **Node.js** | 18 | 20 LTS | Uniquement pour `build:wamp` |
| **Extension** | `pdo_mysql` | activée | WAMP → PHP → Extensions |

**Sans Node.js ?** Si on vous a déjà fourni le dossier `wamp/` buildé (avec `index.html` + `assets/`), sautez directement à [Déployer](#deployer).

Vérif rapide :
- Icône WAMP **verte** = Apache + MySQL OK
- `http://localhost/phpmyadmin` accessible (root / vide)
- `node -v` ≥ 18 et `php -v` ≥ 7.1

---

## 3. Installation WAMP <a id="installation-wamp"></a>

### 3.1 Télécharger & installer

1. Allez sur **https://wampserver.aviatechno.net/** → Télécharger **WampServer 64 bits**.
2. Installez dans `C:\wamp64` (par défaut). Laissez l'installateur installer **VC++ Redistributables** s'il le propose.

### 3.2 Lancer WAMP

- Double-clic sur WampServer. Icône zone notification : **rouge → orange → vert**.
- **Vert = OK**. Si **orange** : port 80 occupé (Skype, IIS).
  - Clic droit icône → **Outils → Tester port 80**
  - Fermez Skype → Options → Avancé → Connexion → décocher **Utiliser ports 80/443**
  - Ou changez Apache : icône → Apache → httpd.conf → `Listen 8080` → Redémarrer

### 3.3 Choisir PHP 7.4+ (CRITIQUE)

- Clic gauche icône WAMP → **PHP → Version** → choisissez **7.4.x, 8.0, 8.1 ou 8.2**
- Si vous restez en **PHP 5.x**, `api.php` plantera : `syntax error, strict_types`
- Redémarrez : icône → **Redémarrer tous les services**

### 3.4 Activer `pdo_mysql`

- Icône WAMP → **PHP → Extensions** → cochez **php_pdo_mysql** et **php_mysqli**
- Icône → **Redémarrer tous les services**

### 3.5 Vérifier phpMyAdmin

- Ouvrez `http://localhost/phpmyadmin`
- Login : **root**, mot de passe **vide** (par défaut WAMP). Vous devez voir l'interface.

> Problème `MSVCR110.dll manquant` ? Installez **Visual C++ Redistributable 2012-2022 x64** depuis Microsoft.

---

## 4. Compiler l'application <a id="compiler"></a>

Ouvrez un terminal **dans le dossier du projet** (clic droit → Ouvrir dans Terminal) :

```bash
# 1. Aller dans le projet (adaptez le chemin)
cd C:\chemin\vers\suivi_assurance

# 2. Installer dépendances (1ère fois uniquement, ~30 sec, 295 paquets)
npm install

# 3. Générer dossier wamp/ prêt à déployer
npm run build:wamp
```

**Sortie attendue :**

```
vite v6.4.3 building for production...
✓ 2452 modules transformed.
wamp/index.html  1.77 kB
wamp/assets/index-*.css  66 kB
wamp/assets/index-*.js   1.9 MB
✓ built in 8s
Dossier WAMP prêt : wamp
Copiez son contenu dans le dossier www de WAMP puis ouvrez votre URL localhost.
```

**Ce que fait `build:wamp` (`scripts/build-wamp.mjs`) :**

- Supprime `wamp/assets/` et `wamp/index.html` (conserve `api.php`, `config.php`, `.htaccess`, `README.md`)
- Lance `vite build` avec `outDir: wamp`, `emptyOutDir: false`, `base: './'`
- Copie `database/schema_wamp.sql` → `wamp/schema_wamp.sql`

**Résultat :**

```
wamp/
├── index.html              (généré)
├── assets/
│   ├── index-*.css
│   ├── index-*.js
│   ├── purify.es-*.js
│   └── ...
├── api.php                 (conservé)
├── config.php              (conservé)
├── .htaccess               (conservé)
├── schema_wamp.sql         (copié)
└── README.md
```

---

## 5. Déployer dans www <a id="deployer"></a>

1. **Créer dossier cible :** `C:\wamp64\www\suivi_assurance\` (ou `C:\wamp\www\...` selon install)
2. **Copier :** Sélectionnez **tout le contenu** de `.../suivi_assurance/wamp/` et collez dans `C:\wamp64\www\suivi_assurance\`
   - ⚠️ Ne copiez pas le dossier `wamp` lui-même, mais **son contenu**
3. **Ouvrir :** `http://localhost/suivi_assurance/`

> ❌ **Ne jamais** ouvrir `index.html` en double-cliquant (file://). Toujours via **localhost**, sinon routing et API cassés.

**Mise à jour future :** Refaites `npm run build:wamp` puis recopiez uniquement `index.html` + `assets/`. Gardez `api.php`/`config.php` si personnalisés.

---

## 6. Base de données <a id="base-de-donnees"></a>

### 6.1 Importer le schéma

1. Ouvrez `http://localhost/phpmyadmin`
2. Onglet **Importer** → Choisir fichier → `C:\wamp64\www\suivi_assurance\schema_wamp.sql` (ou depuis projet `wamp/schema_wamp.sql`)
3. **Exécuter** : crée base `suivi_assurance_salfa` + 7 tables

**Tables :**

| Table | Description |
|-------|-------------|
| `societes` | Assurances : MCI CARE, NY HAVANA, BSA, ASCOMA... |
| `personnes` | Adhérents, ayants droit, matricules |
| `familles` | Actes médicaux : CONS, PHAR, LABO, RADIO, plafonds |
| `prestations` | Factures SALFA (en-tête) |
| `lignes_prestation` | Détail actes par facture |
| `paiements` | Bordereaux règlements |
| `lignes_paiement` | Détail actes payés/rejetés |

### 6.2 Configuration `config.php`

Par défaut WAMP local :

```php
define('SUIVI_DB_HOST', '127.0.0.1');
define('SUIVI_DB_PORT', '3306'); // parfois 3308 sur WAMP récent
define('SUIVI_DB_NAME', 'suivi_assurance_salfa');
define('SUIVI_DB_USER', 'root');
define('SUIVI_DB_PASSWORD', ''); // vide par défaut
```

Modifiez directement le fichier ou via env `SUIVI_DB_HOST`, `SUIVI_DB_PORT`, `SUIVI_DB_NAME`, `SUIVI_DB_USER`, `SUIVI_DB_PASSWORD`.

---

## 7. Vérification <a id="verification"></a>

Après déploiement + import SQL, testez :

### 7.1 Health check

```
http://localhost/suivi_assurance/api.php?action=health
```

Doit retourner :

```json
{ "database": "connected", "success": true }
```

### 7.2 Diagnostic complet

```
http://localhost/suivi_assurance/api.php?action=diagnostic
```

Vérifie :

- Version PHP (≥7.1)
- Extension `pdo_mysql`
- Connexion MySQL
- Présence base `suivi_assurance_salfa`
- Présence 7 tables + nombre lignes
- Permissions

Si `ok: false`, la réponse JSON indique la correction.

---

## 8. Guide d'utilisation <a id="guide-utilisation"></a>

### Navigation

- **Vue d'ensemble** : Dashboard CA, impayés, rejets, top sociétés, filtres, raccourcis
- **Prestations** : Factures SALFA, création manuelle, import PDF, détail lignes
- **Règlements** : Bordereaux, import Excel décomptes, rapprochement auto
- **Rejets** : Actes rejetés/partiellement payés, motifs
- **Historique** : Timeline paiements
- **Sociétés** : Gestion assurances (code, contact, taux couverture défaut)
- **Assurés** : Matricule, société, qualité (Principal/Conjoint/Enfant)
- **Actes** : Référentiel familles médicales, plafonds, aliases
- **Rapports** : PDF recouvrement, factures groupées, export comptable
- **Entête** : Personnalisation en-tête PDF (logo, adresse, couleurs)
- **Tutoriel** : Ce guide intégré, interactif, avec checklist progression

### Flux recommandé

```
1. Paramétrer Sociétés & Actes
→ 2. Importer Assurés (Excel)
→ 3. Importer Prestations (PDF SALFA)
→ 4. Importer Règlements (Excel décomptes MCI/Ascoma/BSA)
→ 5. Suivre Rejets & Générer Rapports
```

### Sauvegarde

- Bouton **"Sauvegarder (.SQL WAMP)"** en haut à droite (Header) → génère dump complet via `sqlExporter.ts`
- Ou phpMyAdmin → base `suivi_assurance_salfa` → Exporter

---

## 9. Imports PDF & Excel <a id="imports"></a>

### 9.1 Factures SALFA (PDF)

- **Où :** Prestations → Importer PDF SALFA (modal `SalfaImportModal`)
- **Comment :** Glisser 1 ou N PDF
- **Extraction auto :** n° facture, date, matricule, nom, société, actes (code/libellé/montant), total, ticket modérateur
- **Mapping :** Si acte inconnu (ex: nouveau code), modale `ActMappingModal` → choisir famille (PHAR, CONS...)
- **Création auto :** Assurés/sociétés inconnus créés si option activée

### 9.2 Décomptes / Règlements (Excel)

- **Où :** Règlements → Importer Décompte (`DecompteImportModal`)
- **Formats :** .xlsx, .xls, .csv (via `xlsx` lib)
- **Colonnes attendues :** matricule, nom, n° facture, date soins, montants, code acte, immatriculation
- **Rapprochement :** Trouve prestation d'origine via n° facture + matricule, calcule payé/rejeté/reste
- **Sous-sociétés :** Si format `BFV EMPLOYES (BFV RETRAITES)` → extraction auto sous-société dans parenthèses
- **Modèles :** `src/utils/excelTemplates.ts` → bouton Modèle pour télécharger modèle conforme

---

## 10. Dépannage <a id="depannage"></a>

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| **Page blanche / Forbidden** | `build:wamp` jamais fait, `index.html` absent | `npm run build:wamp` → recopier `wamp/` |
| **Erreur PHP `strict_types` / `syntax error`** | PHP <7.1 | WAMP → PHP → Version → 7.4+ → Redémarrer |
| **`api.php` → `success:false` MySQL** | MySQL arrêté, base non importée, mauvais port | Icône verte, importer `schema_wamp.sql`, vérifier port 3306 vs 3308 dans `config.php` |
| **`Access denied for user 'root'`** | Mot de passe root ≠ vide | Modifier `SUIVI_DB_PASSWORD` dans `config.php` |
| **Données ne s'enregistrent pas en base** | Normal 1er lancement, sync à la saisie | Créer/modifier prestation → vérifier phpMyAdmin |
| **`pdo_mysql` manquant dans diagnostic** | Extension désactivée | WAMP → PHP → Extensions → cocher `pdo_mysql` + `mysqli` |
| **WAMP icône orange, port 80 occupé** | Skype, IIS, autre Apache | Fermer Skype port 80/443 ou changer `Listen 8080` dans httpd.conf |
| **MSVCR110.dll manquant** | VC++ Redistributable absent | Installer VC++ 2012-2022 x64 depuis Microsoft |
| **Fichier trop gros import Excel** | >10k lignes | Découper en plusieurs fichiers ou augmenter `upload_max_filesize` dans php.ini |

**Logs utiles :**

- Apache error : `C:\wamp64\logs\apache_error.log` (icône → Apache → Logs)
- PHP error : `C:\wamp64\logs\php_error.log`
- Diagnostic : `http://localhost/suivi_assurance/api.php?action=diagnostic`

---

## 11. FAQ <a id="faq"></a>

**Q: Page blanche après copie dans www ?**
R: Oubliez `npm run build:wamp` ? Vérifiez que `C:\wamp64\www\suivi_assurance\` contient bien `index.html` + `assets/`. Refaites build + copie.

**Q: `api.php?action=health` → disconnected ?**
R: 1) Icône verte ? 2) Base importée ? 3) Port 3306 vs 3308 ? 4) `pdo_mysql` activée ? Testez diagnostic.

**Q: Dois-je ouvrir index.html en double-cliquant ?**
R: Non ! Toujours via `http://localhost/suivi_assurance/`. file:// casse routing et API.

**Q: Où sont données sans WAMP ?**
R: En `npm run dev` (tsx server.ts), données en localStorage (`suivi_assurance_mcicare_*`). Avec WAMP, sync MySQL via `wampApi.ts` + fallback localStorage.

**Q: Comment sauvegarder ?**
R: Bouton Header "Sauvegarder (.SQL WAMP)" ou phpMyAdmin → Exporter.

**Q: Changer mot de passe root MySQL ?**
R: Oui, modifiez `config.php` ou env `SUIVI_DB_PASSWORD`.

**Q: Application lente, bundle 1.9 MB ?**
R: Normal (2452 modules). Vite code-split possible : `manualChunks` dans `vite.config.ts` ou dynamic import. Pour l'instant, gzip 551 kB.

---

## 12. Tutoriel intégré dans l'app <a id="tutoriel-integre"></a>

Depuis la version avec tuto, l'application contient un **Centre d'aide** accessible via :

- Navigation → **Tutoriel** (icône livre)

Fonctionnalités :

- 10 sections (Intro, Prérequis, WAMP, Build, Deploy, DB, Usage, Imports, Debug, FAQ)
- Checklist interactive avec progression % (sauvegardée en localStorage `suivi_assurance_tuto_checklist`)
- Boutons Copier pour commandes
- Liens directs vers `api.php?action=diagnostic`
- Mode hors-ligne : accessible même sans WAMP (intégré au build)

Pour mettre à jour le tuto sur WAMP : refaites `npm run build:wamp`.

---

## 📦 Scripts npm

```json
{
  "dev": "tsx server.ts",
  "build": "vite build && esbuild server.ts --bundle ...",
  "build:wamp": "node scripts/build-wamp.mjs",
  "start": "node dist/server.cjs",
  "lint": "tsc --noEmit"
}
```

---

## 🔐 Sécurité WAMP

- `.htaccess` bloque `config.php`, `README.md`, `schema_wamp.sql` (`Require all denied`)
- `config.php` utilise PDO avec `ERRMODE_EXCEPTION`, `EMULATE_PREPARES false`
- Ne jamais exposer WAMP sur internet sans sécuriser MySQL (mot de passe root) et Apache

---

## 📞 Support

- Diagnostic : `http://localhost/suivi_assurance/api.php?action=diagnostic`
- Logs : `C:\wamp64\logs\`
- Code : `wamp/api.php`, `wamp/config.php`, `src/utils/wampApi.ts`

**Bon déploiement !** 🚀

— *Hôpital SALFA Toliara, Service Facturation & Recouvrement*
