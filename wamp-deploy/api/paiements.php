<?php
/**
 * API Paiements & Décomptes de Règlement (WAMP MySQL)
 */
require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $id = $_GET['id'] ?? null;
        if ($id) {
            $stmt = $pdo->prepare("SELECT id, numero_bordereau AS numeroBordereau, date_paiement AS datePaiement, date_soins AS dateSoins, date_saisie AS dateSaisie, societe_id AS societeId, societe_nom AS societeNom, sous_societe AS sousSociete, nom_agent AS nomAgent, matricule, prestation_id AS prestationId, prestation_numero AS prestationNumero, mode_paiement AS modePaiement, reference_paiement AS referencePaiement, total_reclame AS totalReclame, total_paye AS totalPaye, total_moderateur AS totalModerateur, total_exclu AS totalExclu, remise, statut, notes FROM paiements WHERE id = ?");
            $stmt->execute([$id]);
            $p = $stmt->fetch();
            if (!$p) sendError("Paiement non trouvé", 404);

            $stmtL = $pdo->prepare("SELECT id, paiement_id AS paiementId, ligne_prestation_id AS lignePrestationId, prestation_id AS prestationId, immatriculation, nom_base_assurance AS nomBaseAssurance, nom_agent AS nomAgent, prestation_numero AS prestationNumero, date_soins AS dateSoins, total_paye AS totalPaye, ticket_moderateur AS ticketModerateur, montant_exclu AS montantExclu, montant_reclame AS montantReclame, code_acte AS codeActe, libelle_acte AS libelleActe, actes_payes AS actesPayes, commentaire FROM lignes_paiement WHERE paiement_id = ?");
            $stmtL->execute([$id]);
            $lignes = $stmtL->fetchAll();
            foreach ($lignes as &$l) {
                $l['actesPayes'] = json_decode($l['actesPayes'] ?: '[]', true);
            }
            $p['lignes'] = $lignes;
            sendJson($p);
        } else {
            $stmt = $pdo->query("SELECT id, numero_bordereau AS numeroBordereau, date_paiement AS datePaiement, date_soins AS dateSoins, date_saisie AS dateSaisie, societe_id AS societeId, societe_nom AS societeNom, sous_societe AS sousSociete, nom_agent AS nomAgent, matricule, prestation_id AS prestationId, prestation_numero AS prestationNumero, mode_paiement AS modePaiement, reference_paiement AS referencePaiement, total_reclame AS totalReclame, total_paye AS totalPaye, total_moderateur AS totalModerateur, total_exclu AS totalExclu, remise, statut, notes FROM paiements ORDER BY date_paiement DESC, id DESC");
            $paiements = $stmt->fetchAll();

            $stmtAllLignes = $pdo->query("SELECT id, paiement_id AS paiementId, ligne_prestation_id AS lignePrestationId, prestation_id AS prestationId, immatriculation, nom_base_assurance AS nomBaseAssurance, nom_agent AS nomAgent, prestation_numero AS prestationNumero, date_soins AS dateSoins, total_paye AS totalPaye, ticket_moderateur AS ticketModerateur, montant_exclu AS montantExclu, montant_reclame AS montantReclame, code_acte AS codeActe, libelle_acte AS libelleActe, actes_payes AS actesPayes, commentaire FROM lignes_paiement");
            $lignes = $stmtAllLignes->fetchAll();

            $lignesGrouped = [];
            foreach ($lignes as $l) {
                $l['actesPayes'] = json_decode($l['actesPayes'] ?: '[]', true);
                $lignesGrouped[$l['paiementId']][] = $l;
            }

            foreach ($paiements as &$p) {
                $p['lignes'] = $lignesGrouped[$p['id']] ?? [];
                $p['totalReclame'] = (float)$p['totalReclame'];
                $p['totalPaye'] = (float)$p['totalPaye'];
                $p['totalModerateur'] = (float)$p['totalModerateur'];
                $p['totalExclu'] = (float)$p['totalExclu'];
            }
            sendJson($paiements);
        }
        break;

    case 'POST':
    case 'PUT':
        $data = getJsonInput();
        if (empty($data['id']) || empty($data['numeroBordereau']) || empty($data['societeId'])) {
            sendError("Champs obligatoires manquants: id, numeroBordereau, societeId");
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO paiements (id, numero_bordereau, date_paiement, date_soins, date_saisie, societe_id, societe_nom, sous_societe, nom_agent, matricule, prestation_id, prestation_numero, mode_paiement, reference_paiement, total_reclame, total_paye, total_moderateur, total_exclu, remise, statut, notes)
                VALUES (:id, :numeroBordereau, :datePaiement, :dateSoins, :dateSaisie, :societeId, :societeNom, :sousSociete, :nomAgent, :matricule, :prestationId, :prestationNumero, :modePaiement, :referencePaiement, :totalReclame, :totalPaye, :totalModerateur, :totalExclu, :remise, :statut, :notes)
                ON DUPLICATE KEY UPDATE 
                numero_bordereau = VALUES(numero_bordereau), date_paiement = VALUES(date_paiement), date_soins = VALUES(date_soins), 
                societe_id = VALUES(societe_id), societe_nom = VALUES(societe_nom), sous_societe = VALUES(sous_societe), 
                nom_agent = VALUES(nom_agent), matricule = VALUES(matricule), prestation_id = VALUES(prestation_id), 
                prestation_numero = VALUES(prestation_numero), mode_paiement = VALUES(mode_paiement), 
                reference_paiement = VALUES(reference_paiement), total_reclame = VALUES(total_reclame), 
                total_paye = VALUES(total_paye), total_moderateur = VALUES(total_moderateur), 
                total_exclu = VALUES(total_exclu), remise = VALUES(remise), statut = VALUES(statut), notes = VALUES(notes)");

            $stmt->execute([
                ':id' => $data['id'],
                ':numeroBordereau' => $data['numeroBordereau'],
                ':datePaiement' => $data['datePaiement'] ?? date('Y-m-d'),
                ':dateSoins' => $data['dateSoins'] ?? null,
                ':dateSaisie' => $data['dateSaisie'] ?? date('Y-m-d H:i:s'),
                ':societeId' => $data['societeId'],
                ':societeNom' => $data['societeNom'] ?? '',
                ':sousSociete' => $data['sousSociete'] ?? '',
                ':nomAgent' => $data['nomAgent'] ?? '',
                ':matricule' => $data['matricule'] ?? '',
                ':prestationId' => $data['prestationId'] ?? null,
                ':prestationNumero' => $data['prestationNumero'] ?? null,
                ':modePaiement' => $data['modePaiement'] ?? 'Virement',
                ':referencePaiement' => $data['referencePaiement'] ?? '',
                ':totalReclame' => (float)($data['totalReclame'] ?? $data['montantAPayer'] ?? 0),
                ':totalPaye' => (float)($data['totalPaye'] ?? $data['sommePayee'] ?? 0),
                ':totalModerateur' => (float)($data['totalModerateur'] ?? $data['ticketModerateur'] ?? 0),
                ':totalExclu' => (float)($data['totalExclu'] ?? $data['montantExclu'] ?? 0),
                ':remise' => (float)($data['remise'] ?? 0),
                ':statut' => $data['statut'] ?? 'Validé',
                ':notes' => $data['notes'] ?? null
            ]);

            // Delete old payment lines
            $stmtDel = $pdo->prepare("DELETE FROM lignes_paiement WHERE paiement_id = ?");
            $stmtDel->execute([$data['id']]);

            // Insert new payment lines
            if (!empty($data['lignes']) && is_array($data['lignes'])) {
                $stmtL = $pdo->prepare("INSERT INTO lignes_paiement (id, paiement_id, ligne_prestation_id, prestation_id, immatriculation, nom_base_assurance, nom_agent, prestation_numero, date_soins, total_paye, ticket_moderateur, montant_exclu, montant_reclame, code_acte, libelle_acte, actes_payes, commentaire) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($data['lignes'] as $l) {
                    $actesArr = is_array($l['actesPayes'] ?? null) ? json_encode($l['actesPayes'], JSON_UNESCAPED_UNICODE) : '[]';
                    $stmtL->execute([
                        $l['id'] ?? (uniqid('LPAI-')),
                        $data['id'],
                        $l['lignePrestationId'] ?? null,
                        $l['prestationId'] ?? null,
                        $l['immatriculation'] ?? '',
                        $l['nomBaseAssurance'] ?? '',
                        $l['nomAgent'] ?? '',
                        $l['prestationNumero'] ?? null,
                        $l['dateSoins'] ?? null,
                        (float)($l['totalPaye'] ?? $l['montantPaye'] ?? 0),
                        (float)($l['ticketModerateur'] ?? 0),
                        (float)($l['montantExclu'] ?? 0),
                        (float)($l['montantReclame'] ?? 0),
                        $l['codeActe'] ?? null,
                        $l['libelleActe'] ?? null,
                        $actesArr,
                        $l['commentaire'] ?? null
                    ]);
                }
            }

            $pdo->commit();
            sendJson(['id' => $data['id'], 'message' => 'Paiement enregistré avec succès']);
        } catch (Exception $e) {
            $pdo->rollBack();
            sendError("Erreur lors de l'enregistrement du règlement : " . $e->getMessage(), 500);
        }
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) sendError("ID du paiement obligatoire");

        $stmt = $pdo->prepare("DELETE FROM paiements WHERE id = ?");
        $stmt->execute([$id]);
        sendJson(['id' => $id, 'message' => 'Paiement supprimé']);
        break;

    default:
        sendError("Méthode non autorisée", 405);
}
