<?php
/**
 * Configuration de la connexion MySQL pour WAMP.
 *
 * Les valeurs par défaut correspondent à une installation WAMP locale :
 * utilisateur root et mot de passe vide. Modifiez-les si votre installation
 * utilise un autre compte MySQL.
 */

declare(strict_types=1);

if (!defined('SUIVI_DB_HOST')) {
    define('SUIVI_DB_HOST', getenv('SUIVI_DB_HOST') ?: '127.0.0.1');
}

if (!defined('SUIVI_DB_PORT')) {
    define('SUIVI_DB_PORT', getenv('SUIVI_DB_PORT') ?: '3306');
}

if (!defined('SUIVI_DB_NAME')) {
    define('SUIVI_DB_NAME', getenv('SUIVI_DB_NAME') ?: 'suivi_assurance_salfa');
}

if (!defined('SUIVI_DB_USER')) {
    define('SUIVI_DB_USER', getenv('SUIVI_DB_USER') ?: 'root');
}

if (!defined('SUIVI_DB_PASSWORD')) {
    define('SUIVI_DB_PASSWORD', getenv('SUIVI_DB_PASSWORD') ?: '');
}

if (!function_exists('suiviWampPdo')) {
    /**
     * Retourne une connexion PDO partagée pendant la requête HTTP.
     */
    function suiviWampPdo(): PDO
    {
        static $pdo = null;

        if ($pdo instanceof PDO) {
            return $pdo;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            SUIVI_DB_HOST,
            SUIVI_DB_PORT,
            SUIVI_DB_NAME
        );

        $pdo = new PDO($dsn, SUIVI_DB_USER, SUIVI_DB_PASSWORD, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        return $pdo;
    }
}
