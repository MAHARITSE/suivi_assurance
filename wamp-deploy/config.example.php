<?php
/**
 * Fichier d'exemple de configuration WAMP / MySQL
 * Renommez ce fichier en config.local.php si vous souhaitez surcharger les paramètres
 */

return [
    'db_host' => 'localhost',
    'db_port' => '3306',
    'db_name' => 'suivi_assurance_salfa',
    'db_user' => 'root',
    'db_pass' => '', // Mot de passe MySQL WAMP
    'charset' => 'utf8mb4',
    'gemini_api_key' => '', // Mettre votre clé API Gemini si scan IA activé
];
