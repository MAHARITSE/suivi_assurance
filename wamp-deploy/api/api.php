<?php
/**
 * Router Unifié API & Compatibilité wampApi.ts (`api.php?action=...`)
 */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? $_GET['route'] ?? '';

if (empty($action)) {
    // Si la route est passée par PATH_INFO ou URL rewrite
    $path = trim($_SERVER['PATH_INFO'] ?? $_SERVER['REQUEST_URI'] ?? '', '/');
    $parts = explode('/', $path);
    $action = end($parts);
}

switch (strtolower($action)) {
    case 'societes':
        require __DIR__ . '/societes.php';
        break;

    case 'personnes':
        require __DIR__ . '/personnes.php';
        break;

    case 'familles':
        require __DIR__ . '/familles.php';
        break;

    case 'prestations':
        require __DIR__ . '/prestations.php';
        break;

    case 'paiements':
        require __DIR__ . '/paiements.php';
        break;

    case 'entete':
        require __DIR__ . '/entete.php';
        break;

    default:
        sendJson([
            'status' => 'online',
            'system' => 'Suivi Assurance SALFA - WAMP MySQL API',
            'version' => '1.0.0',
            'available_endpoints' => [
                'societes' => '/api/societes',
                'personnes' => '/api/personnes',
                'familles' => '/api/familles',
                'prestations' => '/api/prestations',
                'paiements' => '/api/paiements',
                'entete' => '/api/entete'
            ]
        ]);
}
