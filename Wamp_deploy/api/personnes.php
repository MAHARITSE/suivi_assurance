<?php
/**
 * API REST Assurés & Ayants-droit
 */
require_once __DIR__ . '/../config.php';
$pdo = getPDO();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $societeId = $_GET['societeId'] ?? 'ALL';
    $search = trim($_GET['search'] ?? '');

    $where = [];
    $params = [];
    if ($societeId !== 'ALL' && !empty($societeId)) {
        $where[] = "societe_id = ?";
        $params[] = $societeId;
    }
    if (!empty($search)) {
        $where[] = "(nom_prenom LIKE ? OR matricule LIKE ? OR telephone LIKE ?)";
        $term = "%$search%";
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    $whereClause = count($where) > 0 ? "WHERE " . implode(" AND ", $where) : "";
    $stmt = $pdo->prepare("SELECT * FROM personnes $whereClause ORDER BY nom_prenom ASC");
    $stmt->execute($params);
    $list = $stmt->fetchAll();
    sendJson(['success' => true, 'data' => $list]);
}

if ($method === 'POST') {
    $data = getJsonInput();
    if (empty($data['nomPrenom']) || empty($data['matricule']) || empty($data['societeId'])) {
        sendJson(['success' => false, 'error' => 'Champs obligatoires manquants'], 400);
    }
    $id = !empty($data['id']) ? $data['id'] : 'per-' . uniqid();

    $stmt = $pdo->prepare("INSERT INTO personnes (id, matricule, nom_prenom, societe_id, qualite, date_naissance, telephone, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nom_prenom = VALUES(nom_prenom), societe_id = VALUES(societe_id)");
    $stmt->execute([
        $id,
        $data['matricule'],
        $data['nomPrenom'],
        $data['societeId'],
        $data['qualite'] ?? 'Adhérent Principal',
        $data['dateNaissance'] ?? null,
        $data['telephone'] ?? '',
        $data['email'] ?? ''
    ]);
    sendJson(['success' => true, 'id' => $id, 'message' => 'Assuré enregistré']);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (empty($id)) sendJson(['success' => false, 'error' => 'Identifiant manquant'], 400);
    $pdo->prepare("DELETE FROM personnes WHERE id = ?")->execute([$id]);
    sendJson(['success' => true, 'message' => 'Assuré supprimé']);
}
