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
        $where[] = "societeId = ?";
        $params[] = $societeId;
    }
    if (!empty($search)) {
        $where[] = "(nomPrenom LIKE ? OR matricule LIKE ? OR telephone LIKE ?)";
        $term = "%$search%";
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    $whereClause = count($where) > 0 ? "WHERE " . implode(" AND ", $where) : "";
    $stmt = $pdo->prepare("SELECT * FROM personnes $whereClause ORDER BY nomPrenom ASC");
    $stmt->execute($params);
    $list = $stmt->fetchAll();
    foreach ($list as &$item) {
        $item['plafondConsomme'] = (float)$item['plafondConsomme'];
    }
    sendJson(['success' => true, 'data' => $list]);
}

if ($method === 'POST') {
    $data = getJsonBody();
    if (empty($data['nomPrenom']) || empty($data['matricule']) || empty($data['societeId'])) {
        sendJson(['success' => false, 'error' => 'Champs obligatoires manquants'], 400);
    }
    $id = !empty($data['id']) ? $data['id'] : 'per-' . uniqid();

    $stmt = $pdo->prepare("INSERT INTO personnes (id, matricule, nomPrenom, societeId, qualite, dateNaissance, genre, telephone, email, plafondConsomme) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $id,
        $data['matricule'],
        $data['nomPrenom'],
        $data['societeId'],
        $data['qualite'] ?? 'Adhérent Principal',
        $data['dateNaissance'] ?? null,
        $data['genre'] ?? null,
        $data['telephone'] ?? '',
        $data['email'] ?? '',
        $data['plafondConsomme'] ?? 0
    ]);
    sendJson(['success' => true, 'id' => $id, 'message' => 'Assuré enregistré']);
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? '';
    $data = getJsonBody();
    if (empty($id) && !empty($data['id'])) $id = $data['id'];
    if (empty($id)) sendJson(['success' => false, 'error' => 'Identifiant manquant'], 400);

    $stmt = $pdo->prepare("UPDATE personnes SET matricule = ?, nomPrenom = ?, societeId = ?, qualite = ?, dateNaissance = ?, genre = ?, telephone = ?, email = ?, plafondConsomme = ? WHERE id = ?");
    $stmt->execute([
        $data['matricule'],
        $data['nomPrenom'],
        $data['societeId'],
        $data['qualite'] ?? 'Adhérent Principal',
        $data['dateNaissance'] ?? null,
        $data['genre'] ?? null,
        $data['telephone'] ?? '',
        $data['email'] ?? '',
        $data['plafondConsomme'] ?? 0,
        $id
    ]);
    sendJson(['success' => true, 'message' => 'Assuré mis à jour']);
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (empty($id)) sendJson(['success' => false, 'error' => 'Identifiant manquant'], 400);
    $pdo->prepare("DELETE FROM personnes WHERE id = ?")->execute([$id]);
    sendJson(['success' => true, 'message' => 'Assuré supprimé']);
}
