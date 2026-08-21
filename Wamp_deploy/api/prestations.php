<?php
/**
 * API REST Prestations (Factures de Soins)
 * GET /api/prestations.php
 * POST /api/prestations.php
 * PUT /api/prestations.php?id=...
 * DELETE /api/prestations.php?id=...
 */

require_once __DIR__ . '/../config.php';
$pdo = getPDO();
$method = $_SERVER['REQUEST_METHOD'];

// ----------------------------------------------------
// 1. GET - Liste des prestations avec filtres & lignes
// ----------------------------------------------------
if ($method === 'GET') {
    $societeId = $_GET['societeId'] ?? 'ALL';
    $statut = $_GET['statut'] ?? 'ALL';
    $search = trim($_GET['search'] ?? '');
    $solde = $_GET['solde'] ?? 'ALL'; // ALL, NON_SOLDE, SOLDE
    $dateDebut = $_GET['dateDebut'] ?? '';
    $dateFin = $_GET['dateFin'] ?? '';

    $where = [];
    $params = [];

    if ($societeId !== 'ALL' && !empty($societeId)) {
        $where[] = "p.societeId = ?";
        $params[] = $societeId;
    }

    if ($statut !== 'ALL' && !empty($statut)) {
        if ($statut === 'Payé') {
            $where[] = "(p.statut = 'Payé' OR p.resteAPayer <= 0)";
        } else if ($statut === 'Rejeté') {
            $where[] = "p.statut = 'Rejeté'";
        } else if ($statut === 'Partiellement payé') {
            $where[] = "(p.statut = 'Partiellement payé' AND p.resteAPayer > 0)";
        } else if ($statut === 'En attente') {
            $where[] = "(p.statut = 'En attente' AND p.totalPaye = 0 AND p.resteAPayer > 0)";
        } else {
            $where[] = "p.statut = ?";
            $params[] = $statut;
        }
    }

    if ($solde === 'NON_SOLDE') {
        $where[] = "p.resteAPayer > 0";
    } else if ($solde === 'SOLDE') {
        $where[] = "p.resteAPayer <= 0";
    }

    if (!empty($dateDebut)) {
        $where[] = "p.date >= ?";
        $params[] = $dateDebut;
    }
    if (!empty($dateFin)) {
        $where[] = "p.date <= ?";
        $params[] = $dateFin;
    }

    if (!empty($search)) {
        $where[] = "(p.numeroFacture LIKE ? OR p.nomAgent LIKE ? OR p.matricule LIKE ? OR p.sousSociete LIKE ? OR p.societeNom LIKE ?)";
        $term = "%$search%";
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    $whereClause = count($where) > 0 ? "WHERE " . implode(" AND ", $where) : "";
    $sql = "SELECT p.*, s.nom AS societeNomRef, per.nomPrenom AS personneNomRef, per.matricule AS personneMatriculeRef
            FROM prestations p
            LEFT JOIN societes s ON p.societeId = s.id
            LEFT JOIN personnes per ON p.personneId = per.id
            $whereClause
            ORDER BY p.date DESC, p.numeroFacture DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $prestations = $stmt->fetchAll();

    // Charger les lignes pour chaque prestation
    if (count($prestations) > 0) {
        $prestIds = array_column($prestations, 'id');
        $placeholders = implode(',', array_fill(0, count($prestIds), '?'));
        $stmtLines = $pdo->prepare("SELECT * FROM prestation_lignes WHERE prestationId IN ($placeholders) ORDER BY id ASC");
        $stmtLines->execute($prestIds);
        $allLines = $stmtLines->fetchAll();

        $linesByPrest = [];
        foreach ($allLines as $line) {
            $linesByPrest[$line['prestationId']][] = [
                'id' => $line['id'],
                'prestationId' => $line['prestationId'],
                'code' => $line['code'],
                'libelle' => $line['libelle'],
                'totalPrestation' => (float)$line['totalPrestation'],
                'ticketModerateur' => (float)$line['ticketModerateur'],
                'montantARembourser' => (float)$line['montantARembourser'],
                'totalPaye' => (float)$line['totalPaye'],
                'statut' => $line['statut']
            ];
        }

        foreach ($prestations as &$p) {
            $p['totalPrestation'] = (float)$p['totalPrestation'];
            $p['montantTotal'] = (float)$p['montantTotal'];
            $p['participation'] = (float)$p['participation'];
            $p['ticketModerateur'] = (float)$p['ticketModerateur'];
            $p['montantARembourser'] = (float)$p['montantARembourser'];
            $p['totalPaye'] = (float)$p['totalPaye'];
            $p['resteAPayer'] = (float)$p['resteAPayer'];
            $p['lignes'] = $linesByPrest[$p['id']] ?? [];
        }
    }

    sendJson(['success' => true, 'data' => $prestations]);
}

// ----------------------------------------------------
// 2. POST - Création d'une nouvelle prestation
// ----------------------------------------------------
if ($method === 'POST') {
    $data = getJsonBody();
    if (empty($data['numeroFacture']) || empty($data['societeId']) || empty($data['personneId'])) {
        sendJson(['success' => false, 'error' => 'Champs obligatoires manquants'], 400);
    }

    $id = !empty($data['id']) ? $data['id'] : 'prest-' . uniqid();
    $tot = (float)($data['montantTotal'] ?? $data['totalPrestation'] ?? 0);
    $part = (float)($data['ticketModerateur'] ?? $data['participation'] ?? 0);
    $remb = (float)($data['montantARembourser'] ?? max(0, $tot - $part));
    $totPaye = (float)($data['totalPaye'] ?? 0);
    $reste = max(0, $remb - $totPaye);
    $statut = !empty($data['statut']) ? $data['statut'] : ($reste <= 0 ? 'Payé' : ($totPaye > 0 ? 'Partiellement payé' : 'En attente'));

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO prestations 
            (id, numeroFacture, date, societeId, societeNom, sousSociete, personneId, nomAgent, matricule, totalPrestation, montantTotal, participation, ticketModerateur, montantARembourser, totalPaye, resteAPayer, statut, commentaires)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id,
            $data['numeroFacture'],
            $data['date'] ?? date('Y-m-d'),
            $data['societeId'],
            $data['societeNom'] ?? '',
            $data['sousSociete'] ?? 'Département',
            $data['personneId'],
            $data['nomAgent'] ?? '',
            $data['matricule'] ?? '',
            $tot,
            $tot,
            $part,
            $part,
            $remb,
            $totPaye,
            $reste,
            $statut,
            $data['commentaires'] ?? ''
        ]);

        if (!empty($data['lignes']) && is_array($data['lignes'])) {
            $stmtLine = $pdo->prepare("INSERT INTO prestation_lignes (id, prestationId, code, libelle, totalPrestation, ticketModerateur, montantARembourser, totalPaye, statut)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($data['lignes'] as $l) {
                $lId = !empty($l['id']) ? $l['id'] : 'lig-' . uniqid();
                $lTot = (float)($l['totalPrestation'] ?? 0);
                $lPart = (float)($l['ticketModerateur'] ?? 0);
                $lRemb = (float)($l['montantARembourser'] ?? max(0, $lTot - $lPart));
                $lPaye = (float)($l['totalPaye'] ?? 0);
                $lStatut = $l['statut'] ?? ($lPaye >= $lRemb ? 'Payé' : ($lPaye > 0 ? 'Partiellement payé' : 'En attente'));
                $stmtLine->execute([$lId, $id, $l['code'] ?? 'CONS', $l['libelle'] ?? 'Acte', $lTot, $lPart, $lRemb, $lPaye, $lStatut]);
            }
        }

        $pdo->commit();
        sendJson(['success' => true, 'id' => $id, 'message' => 'Prestation enregistrée avec succès']);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ----------------------------------------------------
// 3. PUT - Modification d'une prestation existante
// ----------------------------------------------------
if ($method === 'PUT') {
    $id = $_GET['id'] ?? '';
    $data = getJsonBody();
    if (empty($id) && !empty($data['id'])) $id = $data['id'];

    if (empty($id)) {
        sendJson(['success' => false, 'error' => 'Identifiant prestation manquant'], 400);
    }

    $tot = (float)($data['montantTotal'] ?? $data['totalPrestation'] ?? 0);
    $part = (float)($data['ticketModerateur'] ?? $data['participation'] ?? 0);
    $remb = (float)($data['montantARembourser'] ?? max(0, $tot - $part));
    $totPaye = (float)($data['totalPaye'] ?? 0);
    $reste = max(0, $remb - $totPaye);
    $statut = !empty($data['statut']) ? $data['statut'] : ($reste <= 0 ? 'Payé' : ($totPaye > 0 ? 'Partiellement payé' : 'En attente'));

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("UPDATE prestations SET 
            numeroFacture = ?, date = ?, societeId = ?, societeNom = ?, sousSociete = ?, personneId = ?, nomAgent = ?, matricule = ?, totalPrestation = ?, montantTotal = ?, participation = ?, ticketModerateur = ?, montantARembourser = ?, totalPaye = ?, resteAPayer = ?, statut = ?, commentaires = ?
            WHERE id = ?");
        $stmt->execute([
            $data['numeroFacture'],
            $data['date'],
            $data['societeId'],
            $data['societeNom'] ?? '',
            $data['sousSociete'] ?? 'Département',
            $data['personneId'],
            $data['nomAgent'] ?? '',
            $data['matricule'] ?? '',
            $tot,
            $tot,
            $part,
            $part,
            $remb,
            $totPaye,
            $reste,
            $statut,
            $data['commentaires'] ?? '',
            $id
        ]);

        if (isset($data['lignes']) && is_array($data['lignes'])) {
            $pdo->prepare("DELETE FROM prestation_lignes WHERE prestationId = ?")->execute([$id]);
            $stmtLine = $pdo->prepare("INSERT INTO prestation_lignes (id, prestationId, code, libelle, totalPrestation, ticketModerateur, montantARembourser, totalPaye, statut)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($data['lignes'] as $l) {
                $lId = !empty($l['id']) ? $l['id'] : 'lig-' . uniqid();
                $lTot = (float)($l['totalPrestation'] ?? 0);
                $lPart = (float)($l['ticketModerateur'] ?? 0);
                $lRemb = (float)($l['montantARembourser'] ?? max(0, $lTot - $lPart));
                $lPaye = (float)($l['totalPaye'] ?? 0);
                $lStatut = $l['statut'] ?? ($lPaye >= $lRemb ? 'Payé' : ($lPaye > 0 ? 'Partiellement payé' : 'En attente'));
                $stmtLine->execute([$lId, $id, $l['code'] ?? 'CONS', $l['libelle'] ?? 'Acte', $lTot, $lPart, $lRemb, $lPaye, $lStatut]);
            }
        }

        $pdo->commit();
        sendJson(['success' => true, 'message' => 'Prestation mise à jour avec succès']);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ----------------------------------------------------
// 4. DELETE - Suppression d'une prestation
// ----------------------------------------------------
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (empty($id)) {
        sendJson(['success' => false, 'error' => 'Identifiant prestation manquant'], 400);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare("DELETE FROM prestation_lignes WHERE prestationId = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM prestations WHERE id = ?")->execute([$id]);
        $pdo->commit();
        sendJson(['success' => true, 'message' => 'Prestation supprimée']);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}
