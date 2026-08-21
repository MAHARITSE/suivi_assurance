<?php
/**
 * API REST Sociétés d'Assurance
 */
require_once __DIR__ . '/../config.php';
$pdo = getPDO();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM societes ORDER BY nom ASC");
    $list = $stmt ? $stmt->fetchAll() : [];
    sendJson(['success' => true, 'data' => $list]);
}

if ($method === 'POST') {
    $data = getJsonInput();
    if (empty($data['nom'])) {
        sendJson(['success' => false, 'error' => 'Le nom est obligatoire'], 400);
    }
    $id = !empty($data['id']) ? $data['id'] : 'soc-' . uniqid();
    $code = !empty($data['code']) ? $data['code'] : strtoupper(substr($data['nom'], 0, 4));

    $stmt = $pdo->prepare("INSERT INTO societes (id, nom, code, adresse, telephone, email, taux_couverture_defaut) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nom = VALUES(nom), code = VALUES(code)");
    $stmt->execute([
        $id,
        $data['nom'],
        $code,
        $data['adresse'] ?? '',
        $data['telephone'] ?? '',
        $data['email'] ?? '',
        $data['tauxCouvertureDefaut'] ?? 80
    ]);
    sendJson(['success' => true, 'id' => $id, 'message' => 'Société enregistrée']);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (empty($id)) sendJson(['success' => false, 'error' => 'Identifiant manquant'], 400);
    $pdo->prepare("DELETE FROM societes WHERE id = ?")->execute([$id]);
    sendJson(['success' => true, 'message' => 'Société supprimée']);
}
