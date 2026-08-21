<?php
/**
 * API REST Paiements (Règlements & Rejets)
 * GET /api/paiements.php
 * POST /api/paiements.php
 * DELETE /api/paiements.php?id=...
 */

require_once __DIR__ . '/../config.php';
$pdo = getPDO();
$method = $_SERVER['REQUEST_METHOD'];

// ----------------------------------------------------
// 1. GET - Liste des bordereaux de règlement et rejets
// ----------------------------------------------------
if ($method === 'GET') {
    $societeId = $_GET['societeId'] ?? 'ALL';
    $search = trim($_GET['search'] ?? '');

    $where = [];
    $params = [];

    if ($societeId !== 'ALL' && !empty($societeId)) {
        $where[] = "p.societeId = ?";
        $params[] = $societeId;
    }

    if (!empty($search)) {
        $where[] = "(p.numeroBordereau LIKE ? OR p.referencePaiement LIKE ? OR p.nomAgent LIKE ? OR p.matricule LIKE ? OR p.notes LIKE ?)";
        $term = "%$search%";
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    $whereClause = count($where) > 0 ? "WHERE " . implode(" AND ", $where) : "";
    $sql = "SELECT p.*, s.nom AS societeNomRef
            FROM paiements p
            LEFT JOIN societes s ON p.societeId = s.id
            $whereClause
            ORDER BY p.datePaiement DESC, p.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $paiements = $stmt->fetchAll();

    if (count($paiements) > 0) {
        $paiementIds = array_column($paiements, 'id');
        $placeholders = implode(',', array_fill(0, count($paiementIds), '?'));
        $stmtLines = $pdo->prepare("SELECT * FROM paiement_lignes WHERE paiementId IN ($placeholders) ORDER BY id ASC");
        $stmtLines->execute($paiementIds);
        $allLines = $stmtLines->fetchAll();

        $linesByPaiement = [];
        foreach ($allLines as $line) {
            $actesPayes = [];
            if (!empty($line['actesPayes'])) {
                $decoded = json_decode($line['actesPayes'], true);
                if (is_array($decoded)) $actesPayes = $decoded;
            }

            $linesByPaiement[$line['paiementId']][] = [
                'id' => $line['id'],
                'paiementId' => $line['paiementId'],
                'lignePrestationId' => $line['lignePrestationId'],
                'prestationId' => $line['prestationId'],
                'prestationNumero' => $line['prestationNumero'],
                'dateSoins' => $line['dateSoins'],
                'immatriculation' => $line['immatriculation'],
                'nomBaseAssurance' => $line['nomBaseAssurance'],
                'nomAgent' => $line['nomAgent'],
                'totalPaye' => (float)$line['totalPaye'],
                'montantPaye' => (float)$line['montantPaye'],
                'ticketModerateur' => (float)$line['ticketModerateur'],
                'montantExclu' => (float)$line['montantExclu'],
                'montantReclame' => (float)$line['montantReclame'],
                'actesPayes' => $actesPayes,
                'commentaire' => $line['commentaire']
            ];
        }

        foreach ($paiements as &$p) {
            $p['totalReclame'] = (float)$p['totalReclame'];
            $p['totalPaye'] = (float)$p['totalPaye'];
            $p['totalModerateur'] = (float)$p['totalModerateur'];
            $p['totalExclu'] = (float)$p['totalExclu'];
            $p['remise'] = (float)$p['remise'];
            $p['lignes'] = $linesByPaiement[$p['id']] ?? [];
        }
    }

    sendJson(['success' => true, 'data' => $paiements]);
}

// ----------------------------------------------------
// 2. POST - Enregistrement d'un règlement ou rejet
// ----------------------------------------------------
if ($method === 'POST') {
    $data = getJsonBody();
    if (empty($data['numeroBordereau']) || empty($data['societeId'])) {
        sendJson(['success' => false, 'error' => 'Numéro de bordereau ou société manquant'], 400);
    }

    $id = !empty($data['id']) ? $data['id'] : 'pai-' . uniqid();
    $totReclame = (float)($data['totalReclame'] ?? 0);
    $totPaye = (float)($data['totalPaye'] ?? 0);
    $totMod = (float)($data['totalModerateur'] ?? 0);
    $totExclu = (float)($data['totalExclu'] ?? 0);
    $remise = (float)($data['remise'] ?? 0);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO paiements 
            (id, numeroBordereau, datePaiement, dateSaisie, societeId, nomAgent, matricule, modePaiement, referencePaiement, totalReclame, totalPaye, totalModerateur, totalExclu, remise, statut, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id,
            $data['numeroBordereau'],
            $data['datePaiement'] ?? date('Y-m-d'),
            date('Y-m-d H:i:s'),
            $data['societeId'],
            $data['nomAgent'] ?? '',
            $data['matricule'] ?? '',
            $data['modePaiement'] ?? 'Virement bancaire',
            $data['referencePaiement'] ?? '',
            $totReclame,
            $totPaye,
            $totMod,
            $totExclu,
            $remise,
            $data['statut'] ?? 'Validé',
            $data['notes'] ?? ''
        ]);

        if (!empty($data['lignes']) && is_array($data['lignes'])) {
            $stmtLine = $pdo->prepare("INSERT INTO paiement_lignes 
                (id, paiementId, lignePrestationId, prestationId, prestationNumero, dateSoins, immatriculation, nomBaseAssurance, nomAgent, totalPaye, montantPaye, ticketModerateur, montantExclu, montantReclame, actesPayes, commentaire)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            foreach ($data['lignes'] as $l) {
                $plId = !empty($l['id']) ? $l['id'] : 'pl-' . uniqid();
                $lPaye = (float)($l['totalPaye'] ?? $l['montantPaye'] ?? 0);
                $lMod = (float)($l['ticketModerateur'] ?? 0);
                $lExclu = (float)($l['montantExclu'] ?? 0);
                $lReclame = (float)($l['montantReclame'] ?? 0);
                $actesJson = !empty($l['actesPayes']) ? json_encode($l['actesPayes'], JSON_UNESCAPED_UNICODE) : null;

                $stmtLine->execute([
                    $plId,
                    $id,
                    $l['lignePrestationId'] ?? null,
                    $l['prestationId'] ?? null,
                    $l['prestationNumero'] ?? null,
                    $l['dateSoins'] ?? null,
                    $l['immatriculation'] ?? null,
                    $l['nomBaseAssurance'] ?? null,
                    $l['nomAgent'] ?? null,
                    $lPaye,
                    $lPaye,
                    $lMod,
                    $lExclu,
                    $lReclame,
                    $actesJson,
                    $l['commentaire'] ?? null
                ]);

                // Mise à jour de la ligne de prestation
                if (!empty($l['lignePrestationId'])) {
                    $stmtUpdateLig = $pdo->prepare("UPDATE prestation_lignes SET 
                        totalPaye = totalPaye + ?,
                        statut = CASE 
                            WHEN ? > 0 AND totalPaye = 0 AND ? >= montantARembourser THEN 'Rejeté'
                            WHEN (totalPaye + ? + ?) >= montantARembourser THEN 'Payé'
                            WHEN (totalPaye + ?) > 0 THEN 'Partiellement payé'
                            ELSE statut
                        END
                        WHERE id = ?");
                    $stmtUpdateLig->execute([$lPaye, $lExclu, $lExclu, $lPaye, $lExclu, $lPaye, $l['lignePrestationId']]);
                }

                // Mise à jour de la prestation parente
                if (!empty($l['prestationId'])) {
                    $stmtPrestInfo = $pdo->prepare("SELECT montantARembourser, totalPrestation, participation FROM prestations WHERE id = ?");
                    $stmtPrestInfo->execute([$l['prestationId']]);
                    $pInfo = $stmtPrestInfo->fetch();

                    if ($pInfo) {
                        $rembVal = (float)$pInfo['montantARembourser'];
                        $stmtUpdatePrest = $pdo->prepare("UPDATE prestations SET 
                            totalPaye = totalPaye + ?,
                            resteAPayer = GREATEST(0, montantARembourser - (totalPaye + ?) - ?),
                            statut = CASE 
                                WHEN GREATEST(0, montantARembourser - (totalPaye + ?) - ?) <= 0 THEN 'Payé'
                                WHEN (totalPaye + ?) > 0 THEN 'Partiellement payé'
                                ELSE statut
                            END
                            WHERE id = ?");
                        $stmtUpdatePrest->execute([$lPaye, $lPaye, $lExclu, $lPaye, $lExclu, $lPaye, $l['prestationId']]);
                    }
                }
            }
        }

        $pdo->commit();
        sendJson(['success' => true, 'id' => $id, 'message' => 'Règlement enregistré avec succès']);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ----------------------------------------------------
// 3. DELETE - Suppression d'un règlement
// ----------------------------------------------------
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (empty($id)) {
        sendJson(['success' => false, 'error' => 'Identifiant manquant'], 400);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare("DELETE FROM paiement_lignes WHERE paiementId = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM paiements WHERE id = ?")->execute([$id]);
        $pdo->commit();
        sendJson(['success' => true, 'message' => 'Règlement supprimé']);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}
