<?php
/**
 * Application de Suivi & Rapprochement des Prestations d'Assurance
 * Déploiement Local WampServer (PHP / MySQL / Apache)
 * Interface React intégrée à 100% avec le Backend PHP/MySQL
 */

// Masquer les erreurs PHP directes pour éviter de casser le rendu HTML
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED & ~E_WARNING);

require_once __DIR__ . '/config.php';

// Rendu de l'interface utilisateur
$htmlFile = __DIR__ . '/index.html';
if (file_exists($htmlFile)) {
    $content = file_get_contents($htmlFile);
    if (strpos($content, '<base') === false) {
        $content = str_replace('<head>', '<head>' . "\n" . '    <base href="./">', $content);
    }
    header('Content-Type: text/html; charset=utf-8');
    echo $content;
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
