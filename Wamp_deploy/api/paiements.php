<?php
/**
 * API REST Paiements & Règlements
 */
require_once __DIR__ . '/../config.php';
$pdo = getPDO();
$method = $_SERVER['REQUEST_METHOD'];

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
}

if ($method === 'POST') {
    $pm = getJsonInput();
    $pdo->beginTransaction();

    try {
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
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if ($id) {
        $stmt = $pdo->prepare("DELETE FROM paiements WHERE id = :id");
        $stmt->execute([':id' => $id]);
        sendJson(['success' => true, 'message' => 'Règlement supprimé']);
    } else {
        sendJson(['success' => false, 'error' => 'ID manquant'], 400);
    }
}
