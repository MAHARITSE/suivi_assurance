# Guide de Déploiement WampServer & Base de Données MySQL

Ce dossier `Wamp_deploy` contient l'ensemble des fichiers nécessaires pour installer et exécuter l'application de **Suivi des Prestations Médicales, Rapprochement de Règlements (ASCOMA, MCI CARE, BSA, SALFA), Gestion des Rejets et États de Recouvrement** directement sur un serveur local **WampServer** (Apache, PHP 7.4 / 8.x, MySQL 5.7+ / 8.x ou MariaDB).

---

## 📁 Structure du Dossier `Wamp_deploy`

| Fichier / Dossier | Rôle & Description |
| :--- | :--- |
| **`database.sql`** | Script SQL complet créant la base `suivi_assurance` avec toutes les tables (`societes`, `personnes`, `familles`, `actes`, `prestations`, `prestation_lignes`, `paiements`, `paiement_lignes`) et les données initiales de référence. |
| **`config.php`** | Fichier de configuration de la connexion MySQL (hôte `localhost`, port `3306`, utilisateur `root`, mot de passe vide par défaut). |
| **`index.php`** | Interface principale complète, responsive et moderne pour la gestion quotidienne. |
| **`app.js`** | Moteur client interactif communiquant avec les APIs REST PHP. |
| **`api/`** | Endpoints REST PHP :<br>• `prestations.php` (CRUD factures de soins, multi-critères, filtres solde et statut)<br>• `paiements.php` (CRUD bordereaux de règlement, lettrage d'actes et gestion des rejets)<br>• `societes.php` (Assurances & garants)<br>• `personnes.php` (Assurés & ayants-droit)<br>• `actes.php` (Nomenclature & barèmes)<br>• `stats.php` (Indicateurs & KPIs financiers) |
| **`INSTALLATION_GUIDE_WAMP.txt`** | Résumé express des étapes d'installation sous Windows. |

---

## 🚀 Guide d'Installation Pas à Pas

### Étape 1 : Copier les fichiers dans le répertoire Web de Wamp
1. Localisez le répertoire `www` de votre installation WampServer (généralement `C:\wamp64\www\` ou `C:\wamp\www\`).
2. Créez un sous-dossier nommé `suivi_assurance` :
   ```text
   C:\wamp64\www\suivi_assurance\
   ```
3. Copiez l'intégralité du contenu du dossier `Wamp_deploy` dans ce dossier `C:\wamp64\www\suivi_assurance\`.

---

### Étape 2 : Importer la Base de Données MySQL
1. Démarrez WampServer et assurez-vous que l'icône dans la barre des tâches est **verte**.
2. Ouvrez votre navigateur et rendez-vous sur **phpMyAdmin** :
   ```text
   http://localhost/phpmyadmin
   ```
3. Connectez-vous (Utilisateur : `root`, Mot de passe : *(laisser vide)*, Serveur : `MySQL` ou `MariaDB`).
4. Cliquez sur l'onglet **Importer**.
5. Cliquez sur **Parcourir** et sélectionnez le fichier `database.sql` situé dans `C:\wamp64\www\suivi_assurance\database.sql`.
6. Cliquez sur le bouton **Exécuter** en bas de la page.
> *Note : La base `suivi_assurance` et toutes les tables seront automatiquement créées et alimentées avec les données de test (ASCOMA, MCI CARE, BSA, factures et actes).*

---

### Étape 3 : Vérifier la Configuration (`config.php`)
Ouvrez le fichier `C:\wamp64\www\suivi_assurance\config.php` avec un éditeur de texte (Bloc-notes, VS Code, Notepad++) :
```php
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'suivi_assurance');
define('DB_USER', 'root');
define('DB_PASS', ''); // Si vous avez défini un mot de passe root, indiquez-le ici
```

---

### Étape 4 : Lancer l'Application
Ouvrez votre navigateur web et accédez à :
```text
http://localhost/suivi_assurance
```

---

## ✨ Fonctionnalités Incluses
- **Rapprochement Décomptes Règlements** : Confrontation intelligente par Date de Soins et Montant Brut sans ticket modérateur (ASCOMA, MCI CARE, BSA).
- **Gestion des Rejets d'Actes** : Enregistrement comptable des rejets directs sur chaque ligne d'acte avec motif et déduction du solde restant dû.
- **Filtres Avancés & Compteurs Dynamiques** :
  - `Tous`
  - `En attente`
  - `Partiel`
  - `Totalement payé` (regroupe toutes les prestations soldées où `Reste à Payer = 0`)
  - `Rejeté`
- **États de Recouvrement & Impayés** : Suivi des créances en retard de plus de 3 mois (> 90 jours) avec export PDF et Excel.
