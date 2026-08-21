<?php
/**
 * Application de Suivi & Rapprochement des Prestations d'Assurance
 * Déploiement Local WampServer (PHP / MySQL / Apache)
 * Interface React intégrée à 100% avec le Backend PHP/MySQL
 */
require_once __DIR__ . '/config.php';

// Vérification silencieuse de la connexion MySQL
try {
    $pdo = getPDO();
} catch (Exception $e) {
    // Si la base n'est pas encore configurée, l'API renverra un message d'aide explicite
}

// Rendu de l'interface utilisateur React avec fidélité absolue à l'application
if (file_exists(__DIR__ . '/index.html')) {
    echo file_get_contents(__DIR__ . '/index.html');
    exit;
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Suivi Assurance SALFA - WAMP</title>
</head>
<body>
    <h1>Application Suivi Assurance SALFA</h1>
    <p>Veuillez vérifier que <code>index.html</code> et le dossier <code>assets</code> sont bien présents.</p>
</body>
</html>
