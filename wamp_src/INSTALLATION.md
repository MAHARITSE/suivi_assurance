# 🚀 Installation — Suivi Assurance SALFA (déploiement WAMP)

Ce dossier est prêt à déployer sous **WAMP Server** (Windows + **Apache** + **MySQL** + **PHP**) :

```
<ce dossier>/
├── index.html          ← Application web (React, compilée)
├── assets/             ← Fichiers statiques (JS / CSS)
├── api.php             ← API PHP (tous les endpoints MySQL)
├── api/
│   └── config.php      ← Configuration de la base de données MySQL
├── schema.sql          ← Schéma de la base « suivi_assurance_salfa »
├── test_api.php        ← Page de diagnostic de l'installation
├── .htaccess           ← Configuration Apache
├── INSTALLATION.md     ← Ce guide (Markdown)
└── Installation.html   ← Ce guide (version HTML, à ouvrir dans le navigateur)
```

> ⛔ **L'application est volontairement BLOQUÉE tant qu'elle n'est pas
> connectée au serveur** : si Apache/PHP ou MySQL ne répondent pas, un écran
> d'erreur plein écran s'affiche et aucune donnée locale n'est utilisée.
> Démarrez WAMP (icône verte) avant d'ouvrir l'application.

---

## 1️⃣ Prérequis

| Élément | Version minimale |
|---|---|
| [WAMP Server](https://www.wampserver.com/en/download/) | 6.4.x ou 6.5.x (Windows 10/11) |
| Apache | 2.4.x (inclus dans WAMP, port **80**) |
| PHP | **8.0 ou supérieur** avec l'extension **`pdo_mysql`** activée |
| MySQL / MariaDB | 5.7+ / 8.x / 10.4+ (inclus dans WAMP, port **3306**) |

Aucun autre logiciel n'est nécessaire : l'application web est déjà compilée.

---

## 2️⃣ Copier le dossier dans WAMP

1. Fermez le navigateur.
2. Copiez **tout le contenu** de ce dossier dans un sous-dossier de `www` de WAMP.
   Par exemple, créez le dossier `C:\wamp64\www\suivi_assurance_salfa\` et copiez
   `index.html`, `api.php`, `api/`, `assets/`, `schema.sql`, `.htaccess`, etc. à l'intérieur.
3. Vérifiez que `C:\wamp64\www\suivi_assurance_salfa\index.html` existe
   (le fichier `schema.sql` est à la racine du même dossier).

> 💡 Si votre version de WAMP s'appelle `C:\wamp\`, adaptez le chemin
> (`C:\wamp\www\suivi_assurance_salfa\`).

---

## 3️⃣ Démarrer WAMP

1. Lancez **WAMP Server** (double-clic sur le raccourci).
2. Attendez que l'icône de la barre des tâches devienne **verte** :
   - **Apache** démarré (port 80)
   - **MySQL** démarré (port 3306)
3. Si l'icône reste **rouge** : clic droit sur l'icône → *Services → MySQL* →
   *Redémarrer*, puis *Services → Apache* → *Redémarrer*.
4. En cas de conflit de port (ex. IIS, Skype, SQL Server Express utilisant le
   port 80 ou 3306) : désactivez le service en cause ou changez le port WAMP
   dans *Outil → Préférences → Utilitaires*.

---

## 4️⃣ Créer la base de données MySQL (schema.sql)

1. Ouvrez **phpMyAdmin** : <http://localhost/phpmyadmin>
   (utilisateur `root`, mot de passe vide par défaut sous WAMP).
2. Dans l'onglet **Importer** (ou *Import*) :
   - *Fichier à importer* : choisissez le fichier **`schema.sql`** (à la racine du dossier déployé),
   - *Méthode d'envoi* : **standard**,
   - cliquez sur **Exécuter**.
3. Le script crée la base **`suivi_assurance_salfa`** avec ses 7 tables :

   | Table | Rôle |
   |---|---|
   | `societes` | Sociétés / organismes d'assurance |
   | `personnes` | Adhérents, conjoints, enfants, ayants droit |
   | `familles` | Familles de prestations (codes, plafonds, tarifs) |
   | `prestations` | Factures / décomptes médicaux |
   | `lignes_prestation` | Actes médicaux détaillés de chaque prestation |
   | `paiements` | Bordereaux de règlement / paiements |
   | `lignes_paiement` | Lignes de chaque bordereau |

> ⚠️ `schema.sql` **récrée** les tables (`DROP TABLE IF EXISTS`) : les
> données existantes de ces tables seraient effacées. Exportez d'abord une
> sauvegarde (phpMyAdmin → *Exporter*) si la base existe déjà.

---

## 5️⃣ Vérifier la configuration MySQL (`api/config.php`)

Ouvrez `api/config.php` (à l'intérieur du dossier déployé) et vérifiez :

```php
define('WAMP_DB_HOST', '127.0.0.1');
define('WAMP_DB_PORT', '3306');
define('WAMP_DB_NAME', 'suivi_assurance_salfa');
define('WAMP_DB_USER', 'root');      // WAMP par défaut : root
define('WAMP_DB_PASS', '');          // WAMP par défaut : mot de passe vide
```

- Installation WAMP standard → **aucun changement nécessaire**.
- Si vous avez défini un mot de passe MySQL (ou utilisez un compte dédié),
  adaptez `WAMP_DB_USER` et `WAMP_DB_PASS`.
- 💡 Bonne pratique : créez un utilisateur MySQL dédié (ex. `salfa_app`) avec
  uniquement les droits sur la base `suivi_assurance_salfa`.

---

## 6️⃣ Ouvrir l'application

1. Ouvrez le navigateur sur :
   **<http://localhost/suivi_assurance_salfa/>**
   (ou `http://localhost/<nom-de-votre-dossier>/` si vous avez choisi un autre nom).
2. L'application vérifie automatiquement la connexion MySQL au démarrage :
   - ✅ **Connexion OK** → l'application se charge et toutes les données
     (sociétés, personnes, familles, prestations, paiements) sont lues **et
     écrites dans MySQL** à chaque modification.
   - ❌ **Échec de connexion** → écran de blocage plein écran
     (« *Application Bloquée : Base de données déconnectée* ») avec le bouton
     *Réessayer la connexion à la base de données MySQL*. **L'application ne
     fonctionne pas en mode déconnecté** : aucune donnée locale (localStorage)
     n'est affichée ni utilisée.

---

## 7️⃣ Tester l'installation

Ouvrez la page de diagnostic :

**<http://localhost/suivi_assurance_salfa/test_api.php>**

Elle affiche : la version PHP, l'activation de `pdo_mysql`, l'accès à la base,
le contenu de chaque table et l'état de chaque endpoint `GET`.

Vous pouvez aussi tester l'API directement dans le navigateur :

```
http://localhost/suivi_assurance_salfa/api.php?action=check_db
http://localhost/suivi_assurance_salfa/api.php?action=societes
http://localhost/suivi_assurance_salfa/api.php?action=prestations
```

La réponse doit être un JSON commençant par `{"success":true,...}`.

---

## 8️⃣ API disponible (référence complète)

Tous les appels sont faits par l'application via `api.php` :

| Méthode | Endpoint | Rôle |
|---|---|---|
| `GET` | `api.php?action=check_db` | **Test de connexion MySQL** (écran de blocage de l'app) |
| `GET` | `api.php?action=societes` | Liste des sociétés |
| `GET` | `api.php?action=personnes` | Liste des personnes |
| `GET` | `api.php?action=familles` | Liste des familles de prestations |
| `GET` | `api.php?action=prestations` | Liste des prestations + lignes (actes) |
| `GET` | `api.php?action=paiements` | Liste des paiements + lignes (bordereaux) |
| `POST` | `api.php?action=societes` | Crée ou met à jour une société (JSON) |
| `POST` | `api.php?action=personnes` | Crée ou met à jour une personne (JSON) |
| `POST` | `api.php?action=familles` | Crée ou met à jour une famille (JSON) |
| `POST` | `api.php?action=prestations` | Crée ou met à jour une prestation + ses lignes (JSON) |
| `POST` | `api.php?action=paiements` | Crée ou met à jour un paiement + ses lignes (JSON) |
| `DELETE` | `api.php?action=<entite>&id=<id>` | Supprime une entité (lignes enfants incluses) |

Format de réponse standard :

```json
{ "success": true,  "data": [ ... ] }
{ "success": false, "error": "Message lisible de l'erreur" }
```

- Le `POST` accepte **un objet** ou **un tableau d'objets** (import groupé) ;
  l'écriture est transactionnelle (tout le lot est écrit ou rien).
- Les identifiants (`id`) sont fournis par l'application (ex. `prest-abc123-x7k2`) :
  l'API est **idempotente** (re-sauvegarder un même `id` = mise à jour).

---

## 9️⃣ Sauvegarde et restauration des données

- **Depuis l'application** : bouton *Exporter la sauvegarde* (en-tête) →
  génère un fichier `suivi_assurance_salfa_dump_YYYY-MM-DD.sql` compatible
  MySQL, ré-importable dans phpMyAdmin.
- **Via phpMyAdmin** : base `suivi_assurance_salfa` → onglet *Exporter* →
  format **SQL** → *Télécharger* (sauvegarde complète recommandée hebdomadaire).
- **Restauration** : phpMyAdmin → *Importer* → sélectionnez le fichier `.sql`.

---

## 🔟 Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Écran « Application Bloquée » — *Serveur WAMP (Apache/PHP) injoignable* | WAMP non démarré, Apache arrêté, ou mauvais URL (port 80) | Démarrez WAMP (icône verte) ; ouvrez `http://localhost/` pour vérifier Apache ; utilisez le bon nom de dossier. |
| *Server error* / page blanche Apache | Erreur PHP (ex. extension manquante) | Clic droit icône WAMP → *Outils → phpinfo()* ; vérifiez que `pdo_mysql` est dans la liste *Loaded PDO drivers*. Sinon : clic droit → *Confirmer → PHP 8.x → Extension* et cochez `pdo_mysql`. |
| *Connexion MySQL impossible* | MySQL non démarré ou identifiants incorrects | Icône WAMP → *Services → MySQL* ; vérifiez le port 3306 ; corrigez `api/config.php`. |
| *Base connectée mais schéma incomplet (tables manquantes…)* | `schema.sql` non importé | phpMyAdmin → *Importer* → `schema.sql` → *Exécuter*. |
| Port 80/3306 occupé (icône orange) | IIS, Skype, SQL Express, VMware… | Désactivez le service concurrent ou changez le port WAMP. |
| Erreur `Access denied for user 'root'` | Mot de passe root défini | Renseignez `WAMP_DB_PASS` dans `api/config.php`. |
| Accents / caractères bizarres | Encodage | Ne modifiez pas les fichiers (UTF-8 sans BOM). Le schéma et l'API utilisent `utf8mb4`. |
| L'application se bloque alors que `test_api.php` est OK | Cache du navigateur | Actualisez en forçant : `Ctrl + F5`. |
| Modification perdus ? | L'écriture a échoué silencieusement | Toutes les sauvegardes passent par MySQL : vérifiez `phpMyAdmin → suivi_assurance_salfa`, puis rechargez l'app. Un `localStorage` de secours existe mais n'est jamais servi si le serveur est coupé. |

**Commandes de diagnostic utiles** (invite de commandes Windows) :

```bat
netstat -ano | findstr :3306        &REM; MySQL écoute-t-il ?
netstat -ano | findstr :80          &REM; Apache écoute-t-il ?
mysql -uroot -e "SHOW DATABASES;"   &REM; la base existe-t-elle ?
```

---

## 📌 Remarques importantes

1. **Bloque volontaire sans serveur** : c'est un comportement assumé de
   l'application — elle refuse de démarrer sans MySQL joignable (pas de mode
   hors-ligne, pas de données locales).
2. **Parsing IA des factures PDF (Gemini)** : la lecture automatique des
   PDF/images via l'IA nécessite le serveur de développement Node.js
   (`npm run dev` dans le dépôt source, avec `GEMINI_API_KEY`). Sous WAMP,
   l'import **Excel** fonctionne entièrement dans le navigateur, sans
   serveur Node.
3. **Un seul utilisateur à la fois** : les enregistrements sont mis à jour
   en entier (remplacement des lignes enfants) ; évitez de modifier la même
   prestation depuis deux postes en même temps.
4. **Mises à jour** : régénérez le dossier de déploiement avec
   `npm run build:wamp` (dépôt source) et **recopiez uniquement les fichiers
   frontend** (`index.html`, `assets/`) — ne remplacez jamais `schema.sql`
   par-dessus une base en production sans sauvegarde.
