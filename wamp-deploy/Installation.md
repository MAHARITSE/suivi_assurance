# 🚀 Guide d'Installation et Déploiement WAMP Server (MySQL & PHP)
## Application Suivi Assurance SALFA

Ce guide décrit la procédure pas-à-pas pour déployer l'application **Suivi Assurance SALFA** sur un serveur local ou réseau sous **WampServer** (Windows, Apache, MySQL, PHP).

---

## 📋 1. Prérequis Techniques

Avant de commencer, vérifiez que votre serveur Windows dispose des éléments suivants :

* **WampServer 3.x** installé (PHP 8.0+ recommandé, MySQL 5.7+ ou MariaDB 10.3+).
* **Extensions PHP requises** (activées dans WampServer > PHP > Extensions) :
  * `pdo_mysql` (Obligatoire)
  * `curl`
  * `mbstring`
  * `json`
* **Module Apache activé** : `rewrite_module` (dans WampServer > Apache > Modules Apache > `rewrite_module`).

---

## 📂 2. Arborescence du Dossier de Déploiement WAMP

Copiez l'intégralité du contenu du dossier dans votre répertoire web WAMP :  
👉 **`C:\wamp64\www\suivi-assurance\`**

```text
C:\wamp64\www\suivi-assurance\
├── api/                       --> Endpoints API PHP Backend
│   ├── config.php             --> Configuration base de données MySQL
│   ├── index.php              --> Routeur unifié API
│   ├── societes.php           --> CRUD Assurances / Sociétés
│   ├── personnes.php          --> CRUD Bénéficiaires / Patients
│   ├── familles.php           --> CRUD Familles d'actes
│   ├── prestations.php        --> CRUD Factures & Actes de Soins
│   ├── paiements.php          --> CRUD Décomptes & Règlements
│   ├── entete.php             --> Config En-tête PDF
│   └── .htaccess              --> Réécriture d'URL API
├── database/                  --> Scripts SQL
│   └── schema.sql             --> Schéma complet MySQL + Données initiales
├── index.html                 --> Point d'entrée de l'application Web (Frontend SPA)
├── assets/                    --> Fichiers statiques compilés (JS, CSS)
├── .htaccess                  --> Configuration Apache & Réécriture SPA
├── Installation.md            --> Ce guide d'installation
└── INSTALLATION.html          --> Interface graphique interactive d'installation
```

---

## 🛢️ 3. Installation de la Base de Données MySQL

### Option A : Via phpMyAdmin (Recommandé)
1. Ouvrez votre navigateur et accédez à `http://localhost/phpmyadmin`.
2. Connectez-vous (Utilisateur par défaut : `root`, Mot de passe : *vide*).
3. Cliquez sur l'onglet **"Importer"** dans le menu supérieur.
4. Cliquez sur **"Parcourir..."** et sélectionnez le fichier :  
   `C:\wamp64\www\suivi-assurance\database\schema.sql`.
5. Vérifiez que l'encodage est **utf-8** et cliquez sur **"Exécuter"**.
6. La base de données `suivi_assurance_salfa` ainsi que toutes ses tables (`societes`, `personnes`, `familles`, `prestations`, `lignes_prestation`, `paiements`, `lignes_paiement`, `entete_config`) sont automatiquement créées avec leurs données de référence.

### Option B : Via la Console MySQL
Ouvrez l'invite de commande (cmd) et exécutez :
```bash
c:\wamp64\bin\mysql\mysql8.0.31\bin\mysql.exe -u root -p < "C:\wamp64\www\suivi-assurance\database\schema.sql"
```

---

## ⚙️ 4. Configuration des Identifiants MySQL in PHP

Ouvrez le fichier `C:\wamp64\www\suivi-assurance\api\config.php` et ajustez les paramètres si votre installation MySQL utilise un mot de passe ou un port spécifique :

```php
// C:\wamp64\www\suivi-assurance\api\config.php

define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'suivi_assurance_salfa');
define('DB_USER', 'root');
define('DB_PASS', ''); // Mettez votre mot de passe MySQL si défini
```

---

## 🌐 5. Validation de l'API Backend

Testez le bon fonctionnement de votre API dans votre navigateur :

* **Statut Global API** : `http://localhost/suivi-assurance/api/`
* **Liste des Assurances** : `http://localhost/suivi-assurance/api/societes`
* **Liste des Bénéficiaires** : `http://localhost/suivi-assurance/api/personnes`
* **Liste des Prestations** : `http://localhost/suivi-assurance/api/prestations`

Vous devez obtenir un retour JSON du type :
```json
{
  "success": true,
  "data": [ ... ]
}
```

---

## 🖥️ 6. Configuration d'un VirtualHost Apache (Optionnel)

Pour utiliser un nom de domaine local dédié tel que `http://suivi-assurance.local` :

1. Ouvrez WampServer > Vos VirtualHosts > Gestion VirtuallHost.
2. Ajoutez un VirtualHost :
   * **Nom du serveur** : `suivi-assurance.local`
   * **Chemin du VirtualHost** : `C:/wamp64/www/suivi-assurance`
3. Redémarrez les services WampServer.
4. Accédez à l'application via `http://suivi-assurance.local`.

---

## 🛠️ 7. Dépannage & Erreurs Fréquentes

| Problème | Cause Possible | Solution |
| :--- | :--- | :--- |
| **Erreur 404 lors des appels API** | Module Apache `rewrite_module` désactivé | Activez `rewrite_module` dans WampServer > Apache > Modules Apache. |
| **Erreur 500 sur l'API** | Extension `pdo_mysql` manquante ou mauvais identifiants | Vérifiez le fichier `api/config.php` et activez `pdo_mysql` dans WampServer > PHP > Extensions. |
| **Données non sauvegardées** | Base MySQL non créée | Assurez-vous d'avoir exécuté `database/schema.sql`. |
| **Problème de caractères (accents)** | Mauvais encodage de la base | Vérifiez que la base `suivi_assurance_salfa` utilise bien `utf8mb4_unicode_ci`. |

---
*Support Technique SALFA - Version 1.0.0*
