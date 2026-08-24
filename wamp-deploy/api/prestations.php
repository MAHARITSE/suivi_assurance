<?php
/**
 * API Prestations & Lignes de Prestation (WAMP MySQL)
 */
require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $id = $_GET['id'] ?? null;
        if ($id) {
            $stmt = $pdo->prepare("SELECT id, numero_facture AS numeroFacture, date, societe_id AS societeId, societe_nom AS societeNom, sous_societe AS sousSociete, personne_id AS personneId, nom_agent AS nomAgent, matricule, total_prestation AS totalPrestation, participation, montant_a_rembourser AS montantARembourser, total_paye AS totalPaye, montant_exclu AS montantExclu, motif_exclusion AS motifExclusion, reste_a_payer AS resteAPayer, statut, date_creation AS dateCreation, commentaires FROM prestations WHERE id = ?");
            $stmt->execute([$id]);
            $p = $stmt->fetch();
            if (!$p) sendError("Prestation non trouvée", 404);

            $stmtL = $pdo->prepare("SELECT id, prestation_id AS prestationId, code, libelle, total_prestation AS totalPrestation, ticket_moderateur AS ticketModerateur, montant_a_rembourser AS montantARembourser, total_paye AS totalPaye, montant_exclu AS montantExclu, motif_exclusion AS motifExclusion, statut FROM lignes_prestation WHERE prestation_id = ?");
            $stmtL->execute([$id]);
            $p['lignes'] = $stmtL->fetchAll();
            sendJson($p);
        } else {
            $stmt = $pdo->query("SELECT id, numero_facture AS numeroFacture, date, societe_id AS societeId, societe_nom AS societeNom, sous_societe AS sousSociete, personne_id AS personneId, nom_agent AS nomAgent, matricule, total_prestation AS totalPrestation, participation, montant_a_rembourser AS montantARembourser, total_paye AS totalPaye, montant_exclu AS montantExclu, motif_exclusion AS motifExclusion, reste_a_payer AS resteAPayer, statut, date_creation AS dateCreation, commentaires FROM prestations ORDER BY date DESC, id DESC");
            $prestations = $stmt->fetchAll();

            $stmtAllLignes = $pdo->query("SELECT id, prestation_id AS prestationId, code, libelle, total_prestation AS totalPrestation, ticket_moderateur AS ticketModerateur, montant_a_rembourser AS montantARembourser, total_paye AS totalPaye, montant_exclu AS montantExclu, motif_exclusion AS motifExclusion, statut FROM lignes_prestation");
            $lignes = $stmtAllLignes->fetchAll();

            $lignesGrouped = [];
            foreach ($lignes as $l) {
                $lignesGrouped[$l['prestationId']][] = $l;
            }

            foreach ($prestations as &$p) {
                $p['lignes'] = $lignesGrouped[$p['id']] ?? [];
                $p['totalPrestation'] = (float)$p['totalPrestation'];
                $p['participation'] = (float)$p['participation'];
                $p['montantARembourser'] = (float)$p['montantARembourser'];
                $p['totalPaye'] = (float)$p['totalPaye'];
                $p['resteAPayer'] = (float)$p['resteAPayer'];
            }
            sendJson($prestations);
        }
        break;

    case 'POST':
    case 'PUT':
        $data = getJsonInput();
        if (empty($data['id']) || empty($data['numeroFacture']) || empty($data['societeId'])) {
            sendError("Champs obligatoires manquants: id, numeroFacture, societeId");
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO prestations (id, numero_facture, date, societe_id, societe_nom, sous_societe, personne_id, nom_agent, matricule, total_prestation, participation, montant_a_rembourser, total_paye, montant_exclu, motif_exclusion, reste_a_payer, statut, date_creation, commentaires)
                VALUES (:id, :numeroFacture, :date, :societeId, :societeNom, :sousSociete, :personneId, :nomAgent, :matricule, :totalPrestation, :participation, :montantARembourser, :totalPaye, :montantExclu, :motifExclusion, :resteAPayer, :statut, :dateCreation, :commentaires)
                ON DUPLICATE KEY UPDATE 
                numero_facture = VALUES(numero_facture), date = VALUES(date), societe_id = VALUES(societe_id), societe_nom = VALUES(societe_nom), sous_societe = VALUES(sous_societe), personne_id = VALUES(personne_id), nom_agent = VALUES(nom_agent), matricule = VALUES(matricule), total_prestation = VALUES(total_prestation), participation = VALUES(participation), montant_a_rembourser = VALUES(montant_a_rembourser), total_paye = VALUES(total_paye), montant_exclu = VALUES(montant_exclu), motif_exclusion = VALUES(motif_exclusion), reste_a_payer = VALUES(reste_a_payer), statut = VALUES(statut), commentaires = VALUES(commentaires)");

            $brut = (float)($data['totalPrestation'] ?? $data['montantTotal'] ?? 0);
            $part = (float)($data['participation'] ?? $data['ticketModerateur'] ?? 0);
            $remb = (float)($data['montantARembourser'] ?? max(0, $brut - $part));
            $paye = (float)($data['totalPaye'] ?? 0);
            $exclu = (float)($data['montantExclu'] ?? 0);
            $reste = (float)($data['resteAPayer'] ?? max(0, $remb - $paye));

            $stmt->execute([
                ':id' => $data['id'],
                ':numeroFacture' => $data['numeroFacture'],
                ':date' => $data['date'] ?? date('Y-m-d'),
                ':societeId' => $data['societeId'],
                ':societeNom' => $data['societeNom'] ?? '',
                ':sousSociete' => $data['sousSociete'] ?? '',
                ':personneId' => $data['personneId'] ?? '',
                ':nomAgent' => $data['nomAgent'] ?? '',
                ':matricule' => $data['matricule'] ?? '',
                ':totalPrestation' => $brut,
                ':participation' => $part,
                ':montantARembourser' => $remb,
                ':totalPaye' => $paye,
                ':montantExclu' => $exclu,
                ':motifExclusion' => $data['motifExclusion'] ?? null,
                ':resteAPayer' => $reste,
                ':statut' => $data['statut'] ?? 'En attente',
                ':dateCreation' => $data['dateCreation'] ?? date('Y-m-d H:i:s'),
                ':commentaires' => $data['commentaires'] ?? null
            ]);

            // Delete existing lines if updating
            $stmtDel = $pdo->prepare("DELETE FROM lignes_prestation WHERE prestation_id = ?");
            $stmtDel->execute([$data['id']]);

            // Insert new lines
            if (!empty($data['lignes']) && is_array($data['lignes'])) {
                $stmtL = $pdo->prepare("INSERT INTO lignes_prestation (id, prestation_id, code, libelle, total_prestation, ticket_moderateur, montant_a_rembourser, total_paye, montant_exclu, motif_exclusion, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($data['lignes'] as $l) {
                    $lBrut = (float)($l['totalPrestation'] ?? $l['montant'] ?? 0);
                    $lPart = (float)($l['ticketModerateur'] ?? 0);
                    $lRemb = (float)($l['montantARembourser'] ?? max(0, $lBrut - $lPart));
                    $stmtL->execute([
                        $l['id'] ?? (uniqid('LP-')),
                        $data['id'],
                        $l['code'] ?? 'CONS',
                        $l['libelle'] ?? ($l['code'] ?? 'Acte de soins'),
                        $lBrut,
                        $lPart,
                        $lRemb,
                        (float)($l['totalPaye'] ?? 0),
                        (float)($l['montantExclu'] ?? 0),
                        $l['motifExclusion'] ?? null,
                        $l['statut'] ?? 'En attente'
                    ]);
                }
            }

            $pdo->commit();
            sendJson(['id' => $data['id'], 'message' => 'Prestation enregistrée avec succès']);
        } catch (Exception $e) {
            $pdo->rollBack();
            sendError("Erreur lors de l'enregistrement : " . $e->getMessage(), 500);
        }
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) sendError("ID de la prestation obligatoire");

        $stmt = $pdo->prepare("DELETE FROM prestations WHERE id = ?");
        $stmt->execute([$id]);
        sendJson(['id' => $id, 'message' => 'Prestation supprimée']);
        break;

    default:
        sendError("Méthode non autorisée", 405);
}
