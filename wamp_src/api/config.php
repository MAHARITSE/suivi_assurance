<?php
/**
 * =====================================================================
 *  SUIVI ASSURANCE SALFA — Configuration de la base de données MySQL
 *  Déploiement WAMP (Apache + MySQL/MariaDB + PHP)
 * =====================================================================
 *
 *  ⚠️  CE FICHIER DOIT ÊTRE ADAPTÉ À VOTRE INSTALLATION WAMP.
 *
 *  Par défaut (installation WAMP standard) :
 *    - Hôte    : 127.0.0.1
 *    - Port    : 3306
 *    - Utilisateur : root
 *    - Mot de passe : (vide)
 *    - Base de données : suivi_assurance_salfa
 *
 *  La base de données « suivi_assurance_salfa » et toutes ses tables
 *  sont créées en important le fichier « schema.sql » via phpMyAdmin
 *  (voir INSTALLATION.md / Installation.html).
 *
 *  🔒 Ce fichier n'est JAMAIS servi directement par Apache
 *     (protection .htaccess + garde-fou ci-dessous).
 */

declare(strict_types=1);

/* Garde-fou : interdiction d'accéder directement à ce fichier */
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    exit("Accès direct au fichier de configuration interdit.\n");
}

/* ---------------------- Identifiants MySQL ---------------------- */

/** Adresse du serveur MySQL (WAMP : 127.0.0.1). */
define('WAMP_DB_HOST', '127.0.0.1');

/** Port du serveur MySQL (WAMP : 3306 par défaut). */
define('WAMP_DB_PORT', '3306');

/** Nom de la base de données (créée par l'import de schema.sql). */
define('WAMP_DB_NAME', 'suivi_assurance_salfa');

/** Utilisateur MySQL — WAMP par défaut : root. */
define('WAMP_DB_USER', 'root');

/** Mot de passe MySQL — WAMP par défaut : vide. */
define('WAMP_DB_PASS', '');

/* ----------------------- Divers --------------------------------- */

/** Fuseau horaire utilisé par l'API pour les horodatages. */
define('WAMP_TIMEZONE', 'Indian/Antananarivo');

date_default_timezone_set(WAMP_TIMEZONE);
