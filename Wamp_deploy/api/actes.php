<?php
/**
 * API REST Nomenclature des Actes et Familles
 */
require_once __DIR__ . '/../config.php';
$pdo = getPDO();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmtActes = $pdo->query("SELECT * FROM actes ORDER BY code ASC");
    $actes = $stmtActes ? $stmtActes->fetchAll() : [];
    foreach ($actes as &$a) {
        $a['tarifConventionnel'] = (float)($a['tarifConventionnel'] ?? 0);
    }

    $stmtFamilles = $pdo->query("SELECT * FROM familles ORDER BY code ASC");
    $familles = $stmtFamilles ? $stmtFamilles->fetchAll() : [];
    foreach ($familles as &$f) {
        $f['tauxDefaut'] = (float)($f['tauxDefaut'] ?? 80);
        $f['plafondAnnuel'] = (float)($f['plafondAnnuel'] ?? 0);
    }

    sendJson([
        'success' => true,
        'data' => [
            'actes' => $actes,
            'familles' => $familles
        ]
    ]);
}

if ($method === 'POST') {
    $data = getJsonInput();
    if (empty($data['code']) || empty($data['libelle'])) {
        sendJson(['success' => false, 'error' => 'Code et Libellé obligatoires'], 400);
    }
    $id = !empty($data['id']) ? $data['id'] : 'act-' . uniqid();
    $stmt = $pdo->prepare("INSERT INTO actes (id, code, libelle, familleCode, tarifConventionnel) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([
        $id,
        strtoupper($data['code']),
        $data['libelle'],
        $data['familleCode'] ?? 'CONS',
        $data['tarifConventionnel'] ?? 0
    ]);
    sendJson(['success' => true, 'id' => $id, 'message' => 'Acte enregistré']);
}
