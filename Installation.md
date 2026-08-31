# Guide d'Installation WAMP Server - Suivi Assurance SALFA (100% MySQL & Multi-Poste)

Ce dossier `wamp-deploy/` contient l'application web complète configurée en **client-serveur 100% MySQL** pour une utilisation sur un poste unique ou en **réseau multi-poste** (plusieurs utilisateurs connectés à la même base de données en temps réel).

---

## ⚠️ Fonctionnement 100% MySQL Strict

L'application ne conserve aucun cache autonome hors-ligne (`localStorage` désactivé pour les données métiers). Si la base MySQL `suivi_assurance_salfa` est supprimée ou le serveur WAMP arrêté, l'application bloque immédiatement l'accès avec un écran d'alerte explicite pour garantir qu'aucune donnée divergente ne soit saisie.

---

## 1. Copier les fichiers dans WAMP Server

Copiez l'intégralité du contenu de ce dossier `wamp-deploy/` dans le répertoire web de votre WAMP Server :

```text
C:\wamp64\www\suivi-assurance\
```
*(ou `C:\xampp\htdocs\suivi-assurance\` sous XAMPP)*

---

## 2. Démarrer WAMP Server

Vérifiez que l'icône WAMP dans la barre des tâches est **VERTE** (services Apache et MySQL actifs).

---

## 3. Importer la Base de Données MySQL

1. Ouvrez **phpMyAdmin** dans votre navigateur : `http://localhost/phpmyadmin`
2. Cliquez sur l'onglet **Importer** dans le menu supérieur.
3. Sélectionnez le fichier `schema.sql` présent dans ce dossier `wamp-deploy/`.
4. Cliquez sur **Exécuter** en bas de page.

La base `suivi_assurance_salfa` et ses tables (`societes`, `personnes`, `familles`, `prestations`, `paiements`, `lignes_prestation`, `lignes_paiement`) seront instantanément créées et configurées avec les données initiales.

---

## 4. Configuration MySQL (`config.php`)

Le fichier `config.php` à la racine contient la configuration de connexion :

```php
<?php
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'suivi_assurance_salfa');
define('DB_USER', 'root');
define('DB_PASS', ''); // Mot de passe vide par défaut sous WAMP
```

---

## 5. Utilisation en Réseau Multi-Poste (Plusieurs PC)

Pour que d'autres ordinateurs du réseau local (secrétariat, caisse, comptabilité) accèdent à la même base de données :

1. Sur le PC Serveur WAMP, relevez son adresse IP locale (ex: `192.168.1.50` via la commande `ipconfig`).
2. Vérifiez que WAMP autorise les accès du réseau local (*Passer en ligne* ou directive `Require all granted` dans Apache).
3. Sur tous les autres postes du réseau, ouvrez simplement le navigateur web et saisissez :
   ```text
   http://192.168.1.50/suivi-assurance/
   ```
4. **Synchronisation automatique :** Les modifications effectuées sur un poste sont automatiquement synchronisées en arrière-plan en temps réel sur tous les autres postes connectés.

---

## 6. Lancer l'Application sur le Poste Serveur

Ouvrez votre navigateur web et accédez à :
```text
http://localhost/suivi-assurance/
```

---

## Structure des fichiers inclus

```text
📁 wamp-deploy/
├── 📄 index.html         (Application cliente React/SPA compilée)
├── 📁 assets/            (Bundles JavaScript & CSS de production)
├── 📄 api.php            (API REST PHP pour lecture/écriture MySQL)
├── 📄 config.php         (Configuration PDO MySQL)
├── 📄 schema.sql         (Script SQL complet de la base de données)
├── 📄 Installation.html  (Guide d'installation visuel)
└── 📄 Installation.md    (Ce guide d'installation texte)
```
