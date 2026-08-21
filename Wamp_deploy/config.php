<?php
/**
 * Configuration de connexion MySQL pour WAMP Server
 * Projet: Suivi Assurance (SALFA)
 */

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'suivi_assurance');
define('DB_PORT', 3306);
define('DB_CHARSET', 'utf8mb4');

function getDbConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Erreur de connexion MySQL : ' . $e->getMessage(),
                'guide' => 'Assurez-vous que MySQL est démarré sur WAMP et que la base "suivi_assurance" est importée depuis schema.sql.'
            ]);
            exit;
        }
    }
    return $pdo;
}
