# Dossier de lancement WAMP

Ce dossier prépare une version autonome de **Suivi Assurance SALFA** pour Apache, PHP et MySQL via WAMP. L'interface React existante est conservée telle quelle ; le dossier ajoute uniquement le connecteur PHP/MySQL et les fichiers nécessaires au lancement local.

> 🎓 **Nouveau : Tutoriel intégré !**
> - Dans l'app : Navigation → **Tutoriel** (10 sections, checklist interactive, FAQ)
> - Fichiers : `TUTO.md` (express 5 étapes) et `../TUTORIEL.md` (complet 12 chapitres)
> - Build inclus : après `npm run build:wamp`, le tuto est accessible offline dans l'app

## Versions requises

| Composant | Version minimale | Recommandé |
| --- | --- | --- |
| WampServer | 3.x | 3.2.3 ou plus récent |
| PHP | **7.1** (code testé de 7.4 à 8.5) | 7.4, 8.0, 8.1 ou 8.2 |
| MySQL / MariaDB | MySQL 5.7 ou MariaDB 10.3 | MySQL 8.0 livré avec WAMP |
| Apache | 2.4 | celui livré avec WAMP |
| Extension PHP | `pdo_mysql` activée | activée par défaut dans WAMP |

> Si votre WAMP utilise une version de PHP inférieure à 7.1 (anciens WAMP 2.x),
> l'API affiche une page d'erreur et **rien ne fonctionne** : cliquez sur
> l'icône WAMP → **Apache → Version** et choisissez PHP 7.4 ou supérieur.

## Installation rapide

1. Démarrez **WampServer** et vérifiez que l'icône est **verte** (Apache et MySQL actifs).
2. À la racine du projet, installez les dépendances puis générez le dossier prêt à copier :

   ```bash
   npm install
   npm run build:wamp
   ```

   ⚠️ Cette étape est obligatoire : sans elle, le dossier `wamp` ne contient ni
   `index.html` ni `assets/`, et Apache affiche « Forbidden » ou une page vide.
3. Importez `schema_wamp.sql` dans phpMyAdmin (`http://localhost/phpmyadmin`,
   onglet **Importer**). Le script crée la base `suivi_assurance_salfa` et ses 7 tables.
4. Copiez **le contenu de ce dossier `wamp`** dans un dossier Apache, par exemple :

   ```text
   C:\wamp64\www\suivi_assurance
   ```

   Après `npm run build:wamp`, le dossier contient `index.html`, `assets/`, `api.php`, `config.php`, `.htaccess` et `schema_wamp.sql`.
5. Ouvrez ensuite dans le navigateur :

   ```text
   http://localhost/suivi_assurance/
   ```

   N'ouvrez **pas** le fichier `index.html` directement depuis l'explorateur
   (file://) : l'application et l'API ne fonctionnent que servies par Apache.

## Connexion MySQL

`config.php` utilise par défaut les paramètres d'une installation WAMP locale :

- serveur : `127.0.0.1`
- port : `3306`
- base : `suivi_assurance_salfa`
- utilisateur : `root`
- mot de passe : vide

Si votre installation est différente, modifiez uniquement les constantes au début de `config.php`, ou définissez les variables d'environnement `SUIVI_DB_HOST`, `SUIVI_DB_PORT`, `SUIVI_DB_NAME`, `SUIVI_DB_USER` et `SUIVI_DB_PASSWORD`.

## Vérification

Deux adresses permettent de contrôler l'installation :

1. **État de la connexion** — doit retourner `database: "connected"` :

   ```text
   http://localhost/suivi_assurance/api.php?action=health
   ```

2. **Diagnostic complet** — vérifie la version de PHP, l'extension `pdo_mysql`,
   la connexion MySQL, la présence de la base et de ses 7 tables, et indique la
   marche à suivre pour chaque problème détecté :

   ```text
   http://localhost/suivi_assurance/api.php?action=diagnostic
   ```

   Si quelque chose ne marche pas, ouvrez cette adresse en premier : la réponse
   JSON liste chaque point de contrôle avec `ok: true` ou `ok: false` et la
   correction associée.

Les enregistrements de sociétés, assurés, actes, prestations et règlements sont synchronisés par `api.php`. Si la base n'est pas encore disponible, l'application continue d'utiliser son stockage local comme avant.

## Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| Page blanche ou « Forbidden » | `npm run build:wamp` jamais exécuté | Relancez la commande puis recopiez le dossier `wamp` |
| Page blanche, erreur PHP « syntax error » ou « strict_types » | Version de PHP trop ancienne (< 7.1) | Icône WAMP → Apache → Version → PHP 7.4+ |
| `api.php` renvoie `success: false` avec un message MySQL | MySQL arrêté, base non importée ou mauvais port | Icône WAMP verte, importez `schema_wamp.sql`, vérifiez le port (3306, parfois 3308) |
| « Access denied for user 'root' » | Mot de passe root différent de vide | Adaptez `SUIVI_DB_PASSWORD` dans `config.php` |
| L'application s'affiche mais les données ne s'enregistrent pas en base | Base vide au premier lancement : c'est normal, la synchronisation se fait au fil des saisies | Créez/modifiez un enregistrement puis vérifiez dans phpMyAdmin |
| Erreur « pdo_mysql » dans le diagnostic | Extension désactivée | Icône WAMP → Apache → Modules → cochez `pdo_mysql`, redémarrez Apache |
