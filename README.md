# Suivi Assurance SALFA

Application de gestion et suivi des assurances santé pour **Hôpital SALFA Toliara** : sociétés, adhérents, prestations médicales, bordereaux de règlement, importation automatisée PDF/Excel, et rapprochement comptable.

## 🚀 Démarrage rapide

### Mode développement (sans WAMP)

```bash
npm install
npm run dev
# Ouvre http://localhost:5173 (ou port indiqué)
```

Données en localStorage navigateur.

### Mode WAMP (production offline)

```bash
npm install
npm run build:wamp
```

Puis copiez **contenu de `wamp/`** → `C:\wamp64\www\suivi_assurance\`

Ouvrez : `http://localhost/suivi_assurance/`

> 📚 **Tutoriel complet :** voir `TUTORIEL.md` (12 chapitres, 10 min) et `wamp/TUTO.md` (express 5 étapes)
> 🎓 **Dans l'app :** Navigation → **Tutoriel** (centre d'aide interactif avec checklist)

## 📚 Documentation

| Fichier | Description |
|---------|-------------|
| `TUTORIEL.md` | Guide complet WAMP + utilisation (recommandé) |
| `wamp/TUTO.md` | Tuto express 5 étapes |
| `wamp/README.md` | Installation rapide WAMP + dépannage |
| `database/schema_wamp.sql` | Schéma MySQL (7 tables) |

## 🛠️ Scripts

```bash
npm run dev         # Dev server avec API Express (tsx server.ts)
npm run build       # Build Vite + esbuild server
npm run build:wamp  # Build pour WAMP (génère wamp/)
npm start           # Lance dist/server.cjs
npm run lint        # tsc --noEmit
```

## 🏗️ Architecture

```
src/
├── components/       # React views
│   ├── Dashboard.tsx
│   ├── PrestationsView.tsx (import PDF SALFA)
│   ├── PaiementsView.tsx (import Excel décomptes)
│   ├── TutoView.tsx  # ← Nouveau : centre d'aide intégré
│   └── ...
├── utils/
│   ├── wampApi.ts    # Sync MySQL via api.php
│   ├── sqlExporter.ts
│   └── ...
└── types.ts

wamp/
├── api.php           # API PHP PDO MySQL
├── config.php        # Config DB
├── .htaccess         # SPA routing + sécurité
├── schema_wamp.sql   # Copié depuis database/
├── TUTO.md           # Tuto express
├── README.md
├── index.html        # Généré par build:wamp
└── assets/           # Généré par build:wamp

scripts/
└── build-wamp.mjs    # Build script Vite → wamp/
```

## ✅ Vérification WAMP

- Health : `http://localhost/suivi_assurance/api.php?action=health` → `database: connected`
- Diagnostic : `http://localhost/suivi_assurance/api.php?action=diagnostic` → JSON complet

## 🔧 Prérequis WAMP

- WampServer 3.x, PHP 7.1+ (recommandé 7.4/8.1), MySQL 5.7+, Apache 2.4
- Extension `pdo_mysql` activée
- Node.js 18+ (uniquement pour build)

## 📦 Déploiement

1. `npm run build:wamp`
2. Copier `wamp/*` → `C:\wamp64\www\suivi_assurance\`
3. Importer `schema_wamp.sql` dans phpMyAdmin
4. Ouvrir `http://localhost/suivi_assurance/`

## 🆘 Dépannage

Voir `TUTORIEL.md` section Dépannage + `wamp/README.md`

- Page blanche → `npm run build:wamp` oublié
- `strict_types` → PHP <7.1 → passer à 7.4+
- `disconnected` → MySQL arrêté, base non importée, port 3306 vs 3308, pdo_mysql désactivée

## 📄 Licence

Privé — Hôpital SALFA Toliara
