<?php
/**
 * API Familles d'actes (WAMP MySQL)
 */
require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $id = $_GET['id'] ?? null;
        if ($id) {
            $stmt = $pdo->prepare("SELECT id, code, libelle, plafond_annuel AS plafondAnnuel, taux_standard AS tauxStandard, tarif_conventionne AS tarifConventionne, ticket_moderateur_defaut AS ticketModerateurDefaut, description, aliases FROM familles WHERE id = ?");
            $stmt->execute([$id]);
            $res = $stmt->fetch();
            if (!$res) sendError("Famille non trouvée", 404);
            $res['aliases'] = json_decode($res['aliases'] ?: '[]', true);
            sendJson($res);
        } else {
            $stmt = $pdo->query("SELECT id, code, libelle, plafond_annuel AS plafondAnnuel, taux_standard AS tauxStandard, tarif_conventionne AS tarifConventionne, ticket_moderateur_defaut AS ticketModerateurDefaut, description, aliases FROM familles ORDER BY code ASC");
            $rows = $stmt->fetchAll();
            foreach ($rows as &$r) {
                $r['aliases'] = json_decode($r['aliases'] ?: '[]', true);
            }
            sendJson($rows);
        }
        break;

    case 'POST':
    case 'PUT':
        $data = getJsonInput();
        if (empty($data['id']) || empty($data['code']) || empty($data['libelle'])) {
            sendError("Champs obligatoires manquants: id, code, libelle");
        }

        $aliases = is_array($data['aliases'] ?? null) ? json_encode($data['aliases'], JSON_UNESCAPED_UNICODE) : '[]';

        $stmt = $pdo->prepare("INSERT INTO familles (id, code, libelle, plafond_annuel, taux_standard, tarif_conventionne, ticket_moderateur_defaut, description, aliases) 
            VALUES (:id, :code, :libelle, :plafondAnnuel, :tauxStandard, :tarifConventionne, :ticketModerateurDefaut, :description, :aliases)
            ON DUPLICATE KEY UPDATE 
            code = VALUES(code), libelle = VALUES(libelle), plafond_annuel = VALUES(plafond_annuel), 
            taux_standard = VALUES(taux_standard), tarif_conventionne = VALUES(tarif_conventionne), 
            ticket_moderateur_defaut = VALUES(ticket_moderateur_defaut), description = VALUES(description), aliases = VALUES(aliases)");

        $stmt->execute([
            ':id' => $data['id'],
            ':code' => $data['code'],
            ':libelle' => $data['libelle'],
            ':plafondAnnuel' => $data['plafondAnnuel'] ?? null,
            ':tauxStandard' => $data['tauxStandard'] ?? 80.00,
            ':tarifConventionne' => $data['tarifConventionne'] ?? null,
            ':ticketModerateurDefaut' => $data['ticketModerateurDefaut'] ?? null,
            ':description' => $data['description'] ?? null,
            ':aliases' => $aliases
        ]);

        sendJson(['id' => $data['id'], 'message' => 'Famille enregistrée avec succès']);
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) sendError("ID de la famille obligatoire");

        $stmt = $pdo->prepare("DELETE FROM familles WHERE id = ?");
        $stmt->execute([$id]);
        sendJson(['id' => $id, 'message' => 'Famille supprimée']);
        break;

    default:
        sendError("Méthode non autorisée", 405);
}
