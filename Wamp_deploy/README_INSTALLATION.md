# Guide de Déploiement WAMP Server avec Base de Données MySQL
## Application : Suivi Assurance & Rapprochement Médical (SALFA)

Ce dossier `Wamp_deploy` contient tout le nécessaire pour installer et héberger l'application et sa base de données MySQL sur **WAMP Server** (ou XAMPP / Laragon).

---

### 1. Structure des Fichiers

* **`schema.sql`** : Script complet de création de la base de données `suivi_assurance_salfa`, avec toutes les tables (`societes`, `familles`, `personnes`, `prestations`, `lignes_prestation`, `paiements`, `lignes_paiement`) et les données initiales de paramétrage.
* **`config.php`** : Fichier de configuration de la connexion MySQL (PDO) avec gestion des erreurs.
* **`api.php`** : API RESTful en PHP pour communiquer entre l'interface utilisateur et la base MySQL.
* **`.htaccess`** : Configuration Apache pour autoriser les requêtes CORS et optimiser le routage.

---

### 2. Étape 1 : Création et Importation de la Base de Données dans WAMP

1. Lancez **WAMP Server** (l'icône dans la barre des tâches doit être **Verte**).
2. Ouvrez votre navigateur et allez sur **phpMyAdmin** : `http://localhost/phpmyadmin/`
3. Connectez-vous (Utilisateur par défaut : `root`, Mot de passe : *(laisser vide)*).
4. Cliquez sur l'onglet **Importer** en haut.
5. Cliquez sur **Parcourir** et sélectionnez le fichier `Wamp_deploy/schema.sql`.
6. Cliquez sur **Exécuter** en bas de la page.
7. La base de données `suivi_assurance_salfa` est maintenant créée avec toutes ses tables !

---

### 3. Étape 2 : Déploiement des Fichiers dans WAMP

1. Accédez au répertoire racine de votre WAMP : `C:\wamp64\www\`
2. Créez un sous-dossier nommé `suivi_assurance` : `C:\wamp64\www\suivi_assurance\`
3. Copiez le contenu de `Wamp_deploy/` (`config.php`, `api.php`, `.htaccess`) dans ce dossier `C:\wamp64\www\suivi_assurance\api\`.
4. Pour déployer le frontend web :
   - Exécutez dans le projet React : `npm run build`
   - Copiez tous les fichiers générés dans le dossier `dist/` vers `C:\wamp64\www\suivi_assurance\`.

---

### 4. Étape 3 : Vérification et Test de l'API

Ouvrez les URLs suivantes dans votre navigateur :
* **Test Statut API** : `http://localhost/suivi_assurance/api/api.php`
* **Liste des Sociétés** : `http://localhost/suivi_assurance/api/api.php?action=societes`
* **Liste des Factures Prestations** : `http://localhost/suivi_assurance/api/api.php?action=prestations`
* **Liste des Règlements** : `http://localhost/suivi_assurance/api/api.php?action=paiements`

---

### 5. Résumé des Paramètres MySQL

| Paramètre | Valeur par défaut WAMP |
| :--- | :--- |
| **Hôte (DB_HOST)** | `localhost` ou `127.0.0.1` |
| **Port (DB_PORT)** | `3306` (ou `3307` si configuré pour MariaDB) |
| **Utilisateur (DB_USER)** | `root` |
| **Mot de passe (DB_PASS)** | `""` (vide) |
| **Nom de la Base (DB_NAME)** | `suivi_assurance_salfa` |
