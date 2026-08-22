# 🎓 TUTO Express — Déployer SALFA sur WAMP en 5 étapes

> **Temps :** 10 min | **Niveau :** Débutant | **OS :** Windows + WAMP

---

## ✅ Checklist rapide (cochez dans l'app → Tutoriel)

- [ ] WAMP installé, icône verte
- [ ] Node.js 18+ installé
- [ ] `npm install` fait
- [ ] `npm run build:wamp` fait
- [ ] Base `suivi_assurance_salfa` importée
- [ ] Dossier copié dans `C:\wamp64\www\suivi_assurance`
- [ ] `http://localhost/suivi_assurance/api.php?action=health` → connected

---

## 1️⃣ Installer WAMP

1. Télécharger : https://wampserver.aviatechno.net/ (64 bits)
2. Installer dans `C:\wamp64`
3. Lancer → attendre **icône verte**
   - Si orange : port 80 occupé → fermer Skype (Options → Avancé → décocher port 80/443)
4. **PHP 7.4+ obligatoire** : icône → PHP → Version → 7.4/8.0/8.1/8.2
5. Activer extensions : icône → PHP → Extensions → cocher `pdo_mysql` + `mysqli` → Redémarrer services
6. Tester : `http://localhost/phpmyadmin` → root / vide → doit s'ouvrir

---

## 2️⃣ Compiler

Dans le dossier projet :

```bash
npm install
npm run build:wamp
```

Résultat :

```
wamp/
├── index.html
├── assets/ (CSS + JS)
├── api.php
├── config.php
├── .htaccess
└── schema_wamp.sql
```

---

## 3️⃣ Déployer

```text
Source :  votre_projet/wamp/*  (tout le contenu)
   ↓ copier
Dest   :  C:\wamp64\www\suivi_assurance\
```

Créer `suivi_assurance` s'il n'existe pas.

---

## 4️⃣ Base de données

1. Ouvrir `http://localhost/phpmyadmin`
2. Onglet **Importer** → choisir `schema_wamp.sql` (dans `C:\wamp64\www\suivi_assurance\`)
3. Exécuter → base `suivi_assurance_salfa` + 7 tables créées

**Config** (`config.php`) par défaut :

```php
HOST: 127.0.0.1
PORT: 3306 (parfois 3308)
DB: suivi_assurance_salfa
USER: root
PASS: (vide)
```

---

## 5️⃣ Vérifier & Lancer

Ouvrez :

- App : `http://localhost/suivi_assurance/`
- Health : `http://localhost/suivi_assurance/api.php?action=health` → `{"database":"connected"}`
- Diagnostic : `http://localhost/suivi_assurance/api.php?action=diagnostic` → JSON complet

Si tout est vert, créez votre première prestation !

---

## 🆘 Problèmes ?

| Symptôme | Solution |
|----------|----------|
| Page blanche / Forbidden | `npm run build:wamp` oublié → refaire + recopier |
| `strict_types` / syntax error | PHP trop vieux → WAMP → PHP Version → 7.4+ |
| `database: disconnected` | MySQL arrêté, base non importée, port 3306 vs 3308, pdo_mysql désactivée |
| Port 80 occupé (orange) | Fermer Skype ou changer Apache Listen 8080 |

Logs : `C:\wamp64\logs\apache_error.log`

---

## 📖 Tutoriel complet

- Dans l'app : Navigation → **Tutoriel** (10 sections, checklist, FAQ)
- Fichiers : `TUTORIEL.md` (racine projet) + `wamp/README.md`
- Vidéo : 10 min (à venir)

**Bon démarrage !** 🚀

