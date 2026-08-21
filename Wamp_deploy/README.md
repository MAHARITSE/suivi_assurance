# Application de Suivi & Rapprochement des Prestations d'Assurance (SALFA)

Pack de déploiement autonome pour serveur web local **WampServer** (PHP + MySQL + Apache).

---

## 📁 Structure du Dossier

| Fichier / Dossier | Rôle & Description |
| :--- | :--- |
| **`schema.sql`** | Script SQL complet créant la base `suivi_assurance_salfa` avec toutes les tables (`societes`, `personnes`, `familles`, `prestations`, `lignes_prestation`, `paiements`, `lignes_paiement`). |
| **`config.php`** | Fichier de configuration de la connexion MySQL (hôte `localhost`, port `3306`, utilisateur `root`, mot de passe vide par défaut). |
| **`index.php`** | Interface principale complète, responsive et moderne pour la gestion quotidienne. |
| **`app.js`** | Moteur client interactif communiquant avec les APIs REST PHP. |
| **`api.php`** / **`api/`** | Endpoints de l'API Backend RESTful PHP assurant le CRUD complet en MySQL. |
| **`INSTALLATION_GUIDE_WAMP.txt`** | Guide pas-à-pas rapide pour l'installation sur WAMP. |

---

## 🚀 Guide d'Installation Rapide

1. Démarrez **WampServer** (icône verte dans la barre des tâches).
2. Copiez ce dossier dans `C:\wamp64\www\suivi_assurance`.
3. Rendez-vous sur `http://localhost/phpmyadmin`.
4. Importez le fichier `schema.sql`.
5. Ouvrez `http://localhost/suivi_assurance` dans votre navigateur.
