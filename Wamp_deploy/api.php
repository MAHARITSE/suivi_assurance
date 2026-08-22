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
    $pdo = getDbConnection();
    switch ($action) {
        // --- SOCIETES ---
        case 'societes':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM societes ORDER BY nom ASC");
                sendJson(['success' => true, 'data' => $stmt ? $stmt->fetchAll() : []]);
            }
            break;

        // --- FAMILLES D'ACTES ---
        case 'familles':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM familles ORDER BY code ASC");
                sendJson(['success' => true, 'data' => $stmt ? $stmt->fetchAll() : []]);
            }
            break;

        // --- PERSONNES (ASSURÉS) ---
        case 'personnes':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM personnes ORDER BY nom_prenom ASC");
                sendJson(['success' => true, 'data' => $stmt ? $stmt->fetchAll() : []]);
            } elseif ($method === 'POST') {
                $body = getJsonInput();
                $stmt = $pdo->prepare("INSERT INTO personnes (id, matricule, nom_prenom, qualite, societe_id, sous_societe) VALUES (:id, :matricule, :nom_prenom, :qualite, :societe_id, :sous_societe) ON DUPLICATE KEY UPDATE nom_prenom = VALUES(nom_prenom), societe_id = VALUES(societe_id), sous_societe = VALUES(sous_societe)");
                $stmt->execute([
                    ':id' => $body['id'] ?? uniqid('pers_'),
                    ':matricule' => $body['matricule'] ?? '',
                    ':nom_prenom' => $body['nomPrenom'] ?? $body['nom_prenom'] ?? '',
                    ':qualite' => $body['qualite'] ?? 'Adhérent',
                    ':societe_id' => $body['societeId'] ?? $body['societe_id'] ?? null,
                    ':sous_societe' => $body['sousSociete'] ?? $body['sous_societe'] ?? null,
                ]);
                sendJson(['success' => true, 'message' => 'Personne enregistrée']);
            }
            break;

        // --- PRESTATIONS (DOSSIERS & FACTURES) ---
        case 'prestations':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM prestations ORDER BY date DESC, numero_facture DESC");
                $prestations = $stmt ? $stmt->fetchAll() : [];

                $lignesStmt = $pdo->query("SELECT * FROM lignes_prestation ORDER BY id ASC");
                $allLignes = $lignesStmt ? $lignesStmt->fetchAll() : [];

                $lignesByPrestation = [];
                foreach ($allLignes as $l) {
                    $lignesByPrestation[$l['prestation_id']][] = $l;
                }

                foreach ($prestations as &$p) {
                    $p['lignes'] = $lignesByPrestation[$p['id']] ?? [];
                }

                sendJson(['success' => true, 'data' => $prestations]);
            } elseif ($method === 'POST') {
                $p = getJsonInput();
                $pdo->beginTransaction();

                $stmt = $pdo->prepare("REPLACE INTO prestations (id, numero_facture, date, societe_id, societe_nom, sous_societe, personne_id, matricule, nom_agent, total_prestation, participation, montant_a_rembourser, total_paye, reste_a_payer, statut, commentaires) VALUES (:id, :numero_facture, :date, :societe_id, :societe_nom, :sous_societe, :personne_id, :matricule, :nom_agent, :total_prestation, :participation, :montant_a_rembourser, :total_paye, :reste_a_payer, :statut, :commentaires)");
                $stmt->execute([
                    ':id' => $p['id'] ?? uniqid('prest_'),
                    ':numero_facture' => $p['numeroFacture'] ?? $p['numero_facture'] ?? '',
                    ':date' => $p['date'] ?? date('Y-m-d'),
                    ':societe_id' => $p['societeId'] ?? $p['societe_id'] ?? '',
                    ':societe_nom' => $p['societeNom'] ?? $p['societe_nom'] ?? null,
                    ':sous_societe' => $p['sousSociete'] ?? $p['sous_societe'] ?? null,
                    ':personne_id' => $p['personneId'] ?? $p['personne_id'] ?? '',
                    ':matricule' => $p['matricule'] ?? null,
                    ':nom_agent' => $p['nomAgent'] ?? $p['nom_agent'] ?? null,
                    ':total_prestation' => $p['totalPrestation'] ?? $p['total_prestation'] ?? 0,
                    ':participation' => $p['participation'] ?? 0,
                    ':montant_a_rembourser' => $p['montantARembourser'] ?? $p['montant_a_rembourser'] ?? 0,
                    ':total_paye' => $p['totalPaye'] ?? $p['total_paye'] ?? 0,
                    ':reste_a_payer' => $p['resteAPayer'] ?? $p['reste_a_payer'] ?? 0,
                    ':statut' => $p['statut'] ?? 'En attente',
                    ':commentaires' => $p['commentaires'] ?? null,
                ]);

                $del = $pdo->prepare("DELETE FROM lignes_prestation WHERE prestation_id = :prestation_id");
                $del->execute([':prestation_id' => $p['id']]);

                if (!empty($p['lignes']) && is_array($p['lignes'])) {
                    $lStmt = $pdo->prepare("INSERT INTO lignes_prestation (id, prestation_id, code, libelle, total_prestation, ticket_moderateur, montant_a_rembourser, total_paye, statut) VALUES (:id, :prestation_id, :code, :libelle, :total_prestation, :ticket_moderateur, :montant_a_rembourser, :total_paye, :statut)");
                    foreach ($p['lignes'] as $l) {
                        $lStmt->execute([
                            ':id' => $l['id'] ?? uniqid('lig_'),
                            ':prestation_id' => $p['id'],
                            ':code' => $l['code'] ?? 'CONS',
                            ':libelle' => $l['libelle'] ?? '',
                            ':total_prestation' => $l['totalPrestation'] ?? $l['total_prestation'] ?? 0,
                            ':ticket_moderateur' => $l['ticketModerateur'] ?? $l['ticket_moderateur'] ?? 0,
                            ':montant_a_rembourser' => $l['montantARembourser'] ?? $l['montant_a_rembourser'] ?? 0,
                            ':total_paye' => $l['totalPaye'] ?? $l['total_paye'] ?? 0,
                            ':statut' => $l['statut'] ?? 'En attente',
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
                $stmt = $pdo->query("SELECT * FROM paiements ORDER BY date_paiement DESC, numero_bordereau DESC");
                $paiements = $stmt ? $stmt->fetchAll() : [];

                $lpStmt = $pdo->query("SELECT * FROM lignes_paiement ORDER BY id ASC");
                $allLp = $lpStmt ? $lpStmt->fetchAll() : [];

                $lpByPaiement = [];
                foreach ($allLp as $lp) {
                    $lpByPaiement[$lp['paiement_id']][] = $lp;
                }

                foreach ($paiements as &$pm) {
                    $pm['lignes'] = $lpByPaiement[$pm['id']] ?? [];
                }

                sendJson(['success' => true, 'data' => $paiements]);
            } elseif ($method === 'POST') {
                $pm = getJsonInput();
                $pdo->beginTransaction();

                $stmt = $pdo->prepare("REPLACE INTO paiements (id, numero_bordereau, date_paiement, date_saisie, societe_id, matricule, nom_agent, mode_paiement, reference_paiement, total_reclame, total_paye, total_moderateur, total_exclu, remise, statut, notes) VALUES (:id, :numero_bordereau, :date_paiement, :date_saisie, :societe_id, :matricule, :nom_agent, :mode_paiement, :reference_paiement, :total_reclame, :total_paye, :total_moderateur, :total_exclu, :remise, :statut, :notes)");
                $stmt->execute([
                    ':id' => $pm['id'] ?? uniqid('pai_'),
                    ':numero_bordereau' => $pm['numeroBordereau'] ?? $pm['numero_bordereau'] ?? '',
                    ':date_paiement' => $pm['datePaiement'] ?? $pm['date_paiement'] ?? date('Y-m-d'),
                    ':date_saisie' => $pm['dateSaisie'] ?? $pm['date_saisie'] ?? date('Y-m-d'),
                    ':societe_id' => $pm['societeId'] ?? $pm['societe_id'] ?? '',
                    ':matricule' => $pm['matricule'] ?? null,
                    ':nom_agent' => $pm['nomAgent'] ?? $pm['nom_agent'] ?? null,
                    ':mode_paiement' => $pm['modePaiement'] ?? $pm['mode_paiement'] ?? 'Virement bancaire',
                    ':reference_paiement' => $pm['referencePaiement'] ?? $pm['reference_paiement'] ?? null,
                    ':total_reclame' => $pm['totalReclame'] ?? $pm['total_reclame'] ?? 0,
                    ':total_paye' => $pm['totalPaye'] ?? $pm['total_paye'] ?? 0,
                    ':total_moderateur' => $pm['totalModerateur'] ?? $pm['total_moderateur'] ?? 0,
                    ':total_exclu' => $pm['totalExclu'] ?? $pm['total_exclu'] ?? 0,
                    ':remise' => $pm['remise'] ?? 0,
                    ':statut' => $pm['statut'] ?? 'Validé',
                    ':notes' => $pm['notes'] ?? null,
                ]);

                $del = $pdo->prepare("DELETE FROM lignes_paiement WHERE paiement_id = :paiement_id");
                $del->execute([':paiement_id' => $pm['id']]);

                if (!empty($pm['lignes']) && is_array($pm['lignes'])) {
                    $lpStmt = $pdo->prepare("INSERT INTO lignes_paiement (id, paiement_id, prestation_id, ligne_prestation_id, prestation_numero, immatriculation, nom_base_assurance, nom_agent, total_paye, ticket_moderateur, montant_exclu, montant_reclame, code_acte, libelle_acte, commentaire) VALUES (:id, :paiement_id, :prestation_id, :ligne_prestation_id, :prestation_numero, :immatriculation, :nom_base_assurance, :nom_agent, :total_paye, :ticket_moderateur, :montant_exclu, :montant_reclame, :code_acte, :libelle_acte, :commentaire)");
                    foreach ($pm['lignes'] as $lp) {
                        $lpStmt->execute([
                            ':id' => $lp['id'] ?? uniqid('lp_'),
                            ':paiement_id' => $pm['id'],
                            ':prestation_id' => $lp['prestationId'] ?? $lp['prestation_id'] ?? null,
                            ':ligne_prestation_id' => $lp['lignePrestationId'] ?? $lp['ligne_prestation_id'] ?? null,
                            ':prestation_numero' => $lp['prestationNumero'] ?? $lp['prestation_numero'] ?? null,
                            ':immatriculation' => $lp['immatriculation'] ?? null,
                            ':nom_base_assurance' => $lp['nomBaseAssurance'] ?? $lp['nom_base_assurance'] ?? null,
                            ':nom_agent' => $lp['nomAgent'] ?? $lp['nom_agent'] ?? null,
                            ':total_paye' => $lp['totalPaye'] ?? $lp['total_paye'] ?? 0,
                            ':ticket_moderateur' => $lp['ticketModerateur'] ?? $lp['ticket_moderateur'] ?? 0,
                            ':montant_exclu' => $lp['montantExclu'] ?? $lp['montant_exclu'] ?? 0,
                            ':montant_reclame' => $lp['montantReclame'] ?? $lp['montant_reclame'] ?? 0,
                            ':code_acte' => $lp['codeActe'] ?? $lp['code_acte'] ?? null,
                            ':libelle_acte' => $lp['libelleActe'] ?? $lp['libelle_acte'] ?? null,
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
