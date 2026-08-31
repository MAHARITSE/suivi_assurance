<?php
/**
 * Configuration de la connexion MySQL pour WAMP Server / XAMPP (Mode Réseau & Multi-Poste)
 */

define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'suivi_assurance_salfa');
define('DB_USER', 'root');
define('DB_PASS', '');

function getDbConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            // Code 1049: Base de données inconnue / introuvable
            if ($e->getCode() == 1049 || strpos($e->getMessage(), 'Unknown database') !== false || strpos($e->getMessage(), '1049') !== false) {
                throw new Exception("La base de données MySQL '" . DB_NAME . "' est introuvable sur le serveur WAMP. Veuillez importer le fichier schema.sql dans phpMyAdmin pour créer la base.");
            }
            // Erreur de connexion au serveur MySQL (service arrêté, port incorrect, mauvais identifiants)
            throw new Exception("Impossible de joindre le serveur MySQL sur " . DB_HOST . ":" . DB_PORT . " (Utilisateur: " . DB_USER . "). Vérifiez que le service MySQL de WAMP est démarré (icône verte) : " . $e->getMessage());
        }
    }
    return $pdo;
}

