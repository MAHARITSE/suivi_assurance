<?php
/**
 * API Backend RESTful PHP pour WAMP
 * Endpoints pour Prestations, Paiements, Sociétés, Personnes, Familles
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';
$pdo = getDbConnection();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

function sendJson($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function getJsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

try {
    switch ($action) {
        // --- SOCIETES ---
        case 'societes':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM societes ORDER BY nom ASC");
                sendJson(['success' => true, 'data' => $stmt->fetchAll()]);
            }
            break;

        // --- FAMILLES D'ACTES ---
        case 'familles':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM familles ORDER BY code ASC");
                sendJson(['success' => true, 'data' => $stmt->fetchAll()]);
            }
            break;

        // --- PERSONNES (ASSURÉS) ---
        case 'personnes':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM personnes ORDER BY nomPrenom ASC");
                sendJson(['success' => true, 'data' => $stmt->fetchAll()]);
            } elseif ($method === 'POST') {
                $body = getJsonInput();
                $stmt = $pdo->prepare("INSERT INTO personnes (id, matricule, nomPrenom, qualite, societeId, sousSociete) VALUES (:id, :matricule, :nomPrenom, :qualite, :societeId, :sousSociete) ON DUPLICATE KEY UPDATE nomPrenom = VALUES(nomPrenom), societeId = VALUES(societeId), sousSociete = VALUES(sousSociete)");
                $stmt->execute([
                    ':id' => $body['id'] ?? uniqid('pers_'),
                    ':matricule' => $body['matricule'] ?? '',
                    ':nomPrenom' => $body['nomPrenom'] ?? '',
                    ':qualite' => $body['qualite'] ?? 'Adhérent',
                    ':societeId' => $body['societeId'] ?? null,
                    ':sousSociete' => $body['sousSociete'] ?? null,
                ]);
                sendJson(['success' => true, 'message' => 'Personne enregistrée']);
            }
            break;

        // --- PRESTATIONS (DOSSIERS & FACTURES) ---
        case 'prestations':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM prestations ORDER BY date DESC, numeroFacture DESC");
                $prestations = $stmt->fetchAll();

                // Charger toutes les lignes
                $lignesStmt = $pdo->query("SELECT * FROM lignes_prestations ORDER BY id ASC");
                $allLignes = $lignesStmt->fetchAll();

                $lignesByPrestation = [];
                foreach ($allLignes as $l) {
                    $lignesByPrestation[$l['prestationId']][] = $l;
                }

                foreach ($prestations as &$p) {
                    $p['lignes'] = $lignesByPrestation[$p['id']] ?? [];
                }

                sendJson(['success' => true, 'data' => $prestations]);
            } elseif ($method === 'POST') {
                $p = getJsonInput();
                $pdo->beginTransaction();

                $stmt = $pdo->prepare("REPLACE INTO prestations (id, numeroFacture, date, societeId, societeNom, sousSociete, personneId, matricule, nomAgent, totalPrestation, participation, montantARembourser, totalPaye, resteAPayer, statut, commentaires) VALUES (:id, :numeroFacture, :date, :societeId, :societeNom, :sousSociete, :personneId, :matricule, :nomAgent, :totalPrestation, :participation, :montantARembourser, :totalPaye, :resteAPayer, :statut, :commentaires)");
                $stmt->execute([
                    ':id' => $p['id'] ?? uniqid('prest_'),
                    ':numeroFacture' => $p['numeroFacture'] ?? '',
                    ':date' => $p['date'] ?? date('Y-m-d'),
                    ':societeId' => $p['societeId'] ?? '',
                    ':societeNom' => $p['societeNom'] ?? null,
                    ':sousSociete' => $p['sousSociete'] ?? null,
                    ':personneId' => $p['personneId'] ?? null,
                    ':matricule' => $p['matricule'] ?? null,
                    ':nomAgent' => $p['nomAgent'] ?? null,
                    ':totalPrestation' => $p['totalPrestation'] ?? 0,
                    ':participation' => $p['participation'] ?? 0,
                    ':montantARembourser' => $p['montantARembourser'] ?? 0,
                    ':totalPaye' => $p['totalPaye'] ?? 0,
                    ':resteAPayer' => $p['resteAPayer'] ?? 0,
                    ':statut' => $p['statut'] ?? 'En attente',
                    ':commentaires' => $p['commentaires'] ?? null,
                ]);

                // Supprimer anciennes lignes et réinsérer
                $del = $pdo->prepare("DELETE FROM lignes_prestations WHERE prestationId = :prestationId");
                $del->execute([':prestationId' => $p['id']]);

                if (!empty($p['lignes']) && is_array($p['lignes'])) {
                    $lStmt = $pdo->prepare("INSERT INTO lignes_prestations (id, prestationId, code, libelle, totalPrestation, ticketModerateur, montantARembourser, totalPaye, statut, motifRejet) VALUES (:id, :prestationId, :code, :libelle, :totalPrestation, :ticketModerateur, :montantARembourser, :totalPaye, :statut, :motifRejet)");
                    foreach ($p['lignes'] as $l) {
                        $lStmt->execute([
                            ':id' => $l['id'] ?? uniqid('lig_'),
                            ':prestationId' => $p['id'],
                            ':code' => $l['code'] ?? 'CONS',
                            ':libelle' => $l['libelle'] ?? '',
                            ':totalPrestation' => $l['totalPrestation'] ?? 0,
                            ':ticketModerateur' => $l['ticketModerateur'] ?? 0,
                            ':montantARembourser' => $l['montantARembourser'] ?? ($l['totalPrestation'] - ($l['ticketModerateur'] ?? 0)),
                            ':totalPaye' => $l['totalPaye'] ?? 0,
                            ':statut' => $l['statut'] ?? 'En attente',
                            ':motifRejet' => $l['motifRejet'] ?? null,
                        ]);
                    }
                }

                $pdo->commit();
                sendJson(['success' => true, 'message' => 'Prestation enregistrée avec succès']);
            } elseif ($method === 'DELETE') {
                $id = $_GET['id'] ?? '';
                if ($id) {
                    $stmt = $pdo->prepare("DELETE FROM prestations WHERE id = :id");
                    $stmt->execute([':id' => $id]);
                    sendJson(['success' => true, 'message' => 'Prestation supprimée']);
                } else {
                    sendJson(['success' => false, 'error' => 'ID manquant'], 400);
                }
            }
            break;

        // --- PAIEMENTS & BORDEREAUX ---
        case 'paiements':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM paiements ORDER BY datePaiement DESC, numeroBordereau DESC");
                $paiements = $stmt->fetchAll();

                $lpStmt = $pdo->query("SELECT * FROM lignes_paiements ORDER BY id ASC");
                $allLp = $lpStmt->fetchAll();

                $lpByPaiement = [];
                foreach ($allLp as $lp) {
                    $lpByPaiement[$lp['paiementId']][] = $lp;
                }

                foreach ($paiements as &$pm) {
                    $pm['lignes'] = $lpByPaiement[$pm['id']] ?? [];
                }

                sendJson(['success' => true, 'data' => $paiements]);
            } elseif ($method === 'POST') {
                $pm = getJsonInput();
                $pdo->beginTransaction();

                $stmt = $pdo->prepare("REPLACE INTO paiements (id, numeroBordereau, datePaiement, dateSaisie, societeId, matricule, nomAgent, modePaiement, referencePaiement, totalReclame, totalPaye, totalModerateur, totalExclu, remise, statut, notes) VALUES (:id, :numeroBordereau, :datePaiement, :dateSaisie, :societeId, :matricule, :nomAgent, :modePaiement, :referencePaiement, :totalReclame, :totalPaye, :totalModerateur, :totalExclu, :remise, :statut, :notes)");
                $stmt->execute([
                    ':id' => $pm['id'] ?? uniqid('pai_'),
                    ':numeroBordereau' => $pm['numeroBordereau'] ?? '',
                    ':datePaiement' => $pm['datePaiement'] ?? date('Y-m-d'),
                    ':dateSaisie' => $pm['dateSaisie'] ?? date('Y-m-d'),
                    ':societeId' => $pm['societeId'] ?? '',
                    ':matricule' => $pm['matricule'] ?? null,
                    ':nomAgent' => $pm['nomAgent'] ?? null,
                    ':modePaiement' => $pm['modePaiement'] ?? 'Virement bancaire',
                    ':referencePaiement' => $pm['referencePaiement'] ?? null,
                    ':totalReclame' => $pm['totalReclame'] ?? 0,
                    ':totalPaye' => $pm['totalPaye'] ?? 0,
                    ':totalModerateur' => $pm['totalModerateur'] ?? 0,
                    ':totalExclu' => $pm['totalExclu'] ?? 0,
                    ':remise' => $pm['remise'] ?? 0,
                    ':statut' => $pm['statut'] ?? 'Validé',
                    ':notes' => $pm['notes'] ?? null,
                ]);

                // Lignes de paiement
                $del = $pdo->prepare("DELETE FROM lignes_paiements WHERE paiementId = :paiementId");
                $del->execute([':paiementId' => $pm['id']]);

                if (!empty($pm['lignes']) && is_array($pm['lignes'])) {
                    $lpStmt = $pdo->prepare("INSERT INTO lignes_paiements (id, paiementId, prestationId, lignePrestationId, prestationNumero, immatriculation, nomBaseAssurance, nomAgent, totalPaye, montantPaye, ticketModerateur, montantExclu, montantReclame, codeActe, libelleActe, commentaire) VALUES (:id, :paiementId, :prestationId, :lignePrestationId, :prestationNumero, :immatriculation, :nomBaseAssurance, :nomAgent, :totalPaye, :montantPaye, :ticketModerateur, :montantExclu, :montantReclame, :codeActe, :libelleActe, :commentaire)");
                    foreach ($pm['lignes'] as $lp) {
                        $lpStmt->execute([
                            ':id' => $lp['id'] ?? uniqid('lp_'),
                            ':paiementId' => $pm['id'],
                            ':prestationId' => $lp['prestationId'] ?? null,
                            ':lignePrestationId' => $lp['lignePrestationId'] ?? null,
                            ':prestationNumero' => $lp['prestationNumero'] ?? null,
                            ':immatriculation' => $lp['immatriculation'] ?? null,
                            ':nomBaseAssurance' => $lp['nomBaseAssurance'] ?? null,
                            ':nomAgent' => $lp['nomAgent'] ?? null,
                            ':totalPaye' => $lp['totalPaye'] ?? 0,
                            ':montantPaye' => $lp['montantPaye'] ?? ($lp['totalPaye'] ?? 0),
                            ':ticketModerateur' => $lp['ticketModerateur'] ?? 0,
                            ':montantExclu' => $lp['montantExclu'] ?? 0,
                            ':montantReclame' => $lp['montantReclame'] ?? 0,
                            ':codeActe' => $lp['codeActe'] ?? null,
                            ':libelleActe' => $lp['libelleActe'] ?? null,
                            ':commentaire' => $lp['commentaire'] ?? null,
                        ]);
                    }
                }

                $pdo->commit();
                sendJson(['success' => true, 'message' => 'Règlement enregistré avec succès']);
            } elseif ($method === 'DELETE') {
                $id = $_GET['id'] ?? '';
                if ($id) {
                    $stmt = $pdo->prepare("DELETE FROM paiements WHERE id = :id");
                    $stmt->execute([':id' => $id]);
                    sendJson(['success' => true, 'message' => 'Règlement supprimé']);
                } else {
                    sendJson(['success' => false, 'error' => 'ID manquant'], 400);
                }
            }
            break;

        default:
            sendJson([
                'status' => 'online',
                'service' => 'API Suivi Assurance SALFA (WAMP MySQL)',
                'version' => '1.0.0',
                'endpoints' => [
                    'GET /api.php?action=societes',
                    'GET /api.php?action=familles',
                    'GET, POST /api.php?action=personnes',
                    'GET, POST, DELETE /api.php?action=prestations',
                    'GET, POST, DELETE /api.php?action=paiements'
                ]
            ]);
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson(['success' => false, 'error' => $e->getMessage()], 500);
}
