# Dossier de lancement WAMP

Ce dossier prépare une version autonome de **Suivi Assurance SALFA** pour Apache, PHP et MySQL via WAMP. L'interface React existante est conservée telle quelle ; le dossier ajoute uniquement le connecteur PHP/MySQL et les fichiers nécessaires au lancement local.

## Installation rapide

1. Démarrez **WampServer** et vérifiez que les services Apache et MySQL sont actifs.
2. À la racine du projet, installez les dépendances puis générez le dossier prêt à copier :

   ```bash
   npm install
   npm run build:wamp
   ```

3. Importez `schema_wamp.sql` dans phpMyAdmin (`http://localhost/phpmyadmin`). Le script crée la base `suivi_assurance_salfa` et ses tables.
4. Copiez **le contenu de ce dossier `wamp`** dans un dossier Apache, par exemple :

   ```text
   C:\\wamp64\\www\\suivi_assurance
   ```

   Après `npm run build:wamp`, le dossier contient `index.html`, `assets/`, `api.php`, `config.php`, `.htaccess` et `schema_wamp.sql`.
5. Ouvrez ensuite :

   ```text
   http://localhost/suivi_assurance/
   ```

## Connexion MySQL

`config.php` utilise par défaut les paramètres d'une installation WAMP locale :

- serveur : `127.0.0.1`
- port : `3306`
- base : `suivi_assurance_salfa`
- utilisateur : `root`
- mot de passe : vide

Si votre installation est différente, modifiez uniquement les constantes au début de `config.php`, ou définissez les variables d'environnement `SUIVI_DB_HOST`, `SUIVI_DB_PORT`, `SUIVI_DB_NAME`, `SUIVI_DB_USER` et `SUIVI_DB_PASSWORD`.

## Vérification

Après l'import SQL, cette adresse doit retourner une réponse JSON avec `database: "connected"` :

```text
http://localhost/suivi_assurance/api.php?action=health
```

Les enregistrements de sociétés, assurés, actes, prestations et règlements sont synchronisés par `api.php`. Si la base n'est pas encore disponible, l'application continue d'utiliser son stockage local comme avant.
