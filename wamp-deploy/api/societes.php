<?php
/**
 * API Sociétés / Assurances (WAMP MySQL)
 */
require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $id = $_GET['id'] ?? null;
        if ($id) {
            $stmt = $pdo->prepare("SELECT id, nom, code, contact, telephone, email, adresse, taux_couverture_defaut AS tauxCouvertureDefaut FROM societes WHERE id = ?");
            $stmt->execute([$id]);
            $res = $stmt->fetch();
            if (!$res) sendError("Société non trouvée", 404);
            $res['tauxCouvertureDefaut'] = (float) $res['tauxCouvertureDefaut'];
            sendJson($res);
        } else {
            $stmt = $pdo->query("SELECT id, nom, code, contact, telephone, email, adresse, taux_couverture_defaut AS tauxCouvertureDefaut FROM societes ORDER BY nom ASC");
            $rows = $stmt->fetchAll();
            foreach ($rows as &$r) {
                $r['tauxCouvertureDefaut'] = (float) $r['tauxCouvertureDefaut'];
            }
            sendJson($rows);
        }
        break;

    case 'POST':
    case 'PUT':
        $data = getJsonInput();
        if (empty($data['id']) || empty($data['nom'])) {
            sendError("Champs obligatoires manquants: id, nom");
        }

        $stmt = $pdo->prepare("INSERT INTO societes (id, nom, code, contact, telephone, email, adresse, taux_couverture_defaut) 
            VALUES (:id, :nom, :code, :contact, :telephone, :email, :adresse, :tauxCouvertureDefaut)
            ON DUPLICATE KEY UPDATE 
            nom = VALUES(nom), code = VALUES(code), contact = VALUES(contact), telephone = VALUES(telephone), 
            email = VALUES(email), adresse = VALUES(adresse), taux_couverture_defaut = VALUES(taux_couverture_defaut)");

        $stmt->execute([
            ':id' => $data['id'],
            ':nom' => $data['nom'],
            ':code' => $data['code'] ?? strtoupper(substr($data['nom'], 0, 10)),
            ':contact' => $data['contact'] ?? null,
            ':telephone' => $data['telephone'] ?? null,
            ':email' => $data['email'] ?? null,
            ':adresse' => $data['adresse'] ?? null,
            ':tauxCouvertureDefaut' => $data['tauxCouvertureDefaut'] ?? 80.00
        ]);

        sendJson(['id' => $data['id'], 'message' => 'Société enregistrée avec succès']);
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) sendError("ID de la société obligatoire");

        $stmt = $pdo->prepare("DELETE FROM societes WHERE id = ?");
        $stmt->execute([$id]);
        sendJson(['id' => $id, 'message' => 'Société supprimée']);
        break;

    default:
        sendError("Méthode non autorisée", 405);
}
