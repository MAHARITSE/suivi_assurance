<?php
/**
 * Configuration de la connexion MySQL pour WAMP Server / XAMPP (Mode Réseau & Multi-Poste)
 */

define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'suivi_assurance_salfa');
define('DB_USER', 'root');
define('DB_PASS', '');

/**
 * Crée une nouvelle connexion PDO avec les options optimales pour éviter l'erreur 1615
 */
function createPdoConnection() {
    // NOTE : ne pas utiliser PDO::MYSQL_ATTR_INIT_COMMAND pour régler des
    // variables GLOBALES comme table_definition_cache / prepared_stmt_cache_size.
    // Ce sont des variables de portée GLOBAL uniquement : "SET SESSION ..." renvoie
    // l'erreur MySQL 1229 et fait échouer l'ouverture de la connexion, rendant la
    // base inaccessible. Le charset est déjà défini via le DSN (charset=utf8mb4).
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false, // Utiliser les vrais prepared statements de MySQL
    ];
    
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        // Code 1049: Base de données inconnue / introuvable
        if ($e->getCode() == 1049 || strpos($e->getMessage(), 'Unknown database') !== false || strpos($e->getMessage(), '1049') !== false) {
            throw new Exception("La base de données MySQL '" . DB_NAME . "' est introuvable sur le serveur WAMP. Veuillez importer le fichier schema.sql dans phpMyAdmin pour créer la base.");
        }
        // Erreur de connexion au serveur MySQL (service arrêté, port incorrect, mauvais identifiants)
        throw new Exception("Impossible de joindre le serveur MySQL sur " . DB_HOST . ":" . DB_PORT . " (Utilisateur: " . DB_USER . "). Vérifiez que le service MySQL de WAMP est démarré (icône verte) : " . $e->getMessage());
    }
}

function getDbConnection() {
    static $pdo = null;
    static $lastSchemaCheck = 0;
    
    // Réinitialiser la connexion toutes les 5 minutes pour éviter les erreurs 1615
    // causées par l'accumulation de prepared statements invalides
    if ($pdo !== null && (time() - $lastSchemaCheck) > 300) {
        $pdo = null;
    }
    
    if ($pdo === null) {
        $pdo = createPdoConnection();
        $lastSchemaCheck = time();
    }
    
    // Tester la connexion avant de la retourner
    try {
        $pdo->query("SELECT 1");
    } catch (PDOException $e) {
        // Code d'erreur MySQL 1615: Prepared statement needs to be re-prepared
        if (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1615) {
            // Recréer la connexion pour résoudre le problème
            $pdo = createPdoConnection();
            $lastSchemaCheck = time();
        } else {
            throw $e;
        }
    }
    
    return $pdo;
}

