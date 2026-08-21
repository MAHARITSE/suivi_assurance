<?php
/**
 * API REST Prestations & Factures
 */
require_once __DIR__ . '/../config.php';
$pdo = getPDO();
$method = $_SERVER['REQUEST_METHOD'];

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
}

if ($method === 'POST') {
    $p = getJsonInput();
    $pdo->beginTransaction();

    try {
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
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if ($id) {
        $stmt = $pdo->prepare("DELETE FROM prestations WHERE id = :id");
        $stmt->execute([':id' => $id]);
        sendJson(['success' => true, 'message' => 'Prestation supprimée']);
    } else {
        sendJson(['success' => false, 'error' => 'ID manquant'], 400);
    }
}
