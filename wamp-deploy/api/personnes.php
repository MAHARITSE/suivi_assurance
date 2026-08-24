<?php
/**
 * API Personnes / Bénéficiaires (WAMP MySQL)
 */
require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $id = $_GET['id'] ?? null;
        if ($id) {
            $stmt = $pdo->prepare("SELECT id, nom_prenom AS nomPrenom, matricule, societe_id AS societeId, sous_societe AS sousSociete, qualite, famille_code AS familleCode, date_naissance AS dateNaissance, telephone, email, taux_couverture AS tauxCouverture, statut FROM personnes WHERE id = ?");
            $stmt->execute([$id]);
            $res = $stmt->fetch();
            if (!$res) sendError("Personne non trouvée", 404);
            if ($res['tauxCouverture'] !== null) $res['tauxCouverture'] = (float)$res['tauxCouverture'];
            sendJson($res);
        } else {
            $stmt = $pdo->query("SELECT id, nom_prenom AS nomPrenom, matricule, societe_id AS societeId, sous_societe AS sousSociete, qualite, famille_code AS familleCode, date_naissance AS dateNaissance, telephone, email, taux_couverture AS tauxCouverture, statut FROM personnes ORDER BY nom_prenom ASC");
            $rows = $stmt->fetchAll();
            foreach ($rows as &$r) {
                if ($r['tauxCouverture'] !== null) $r['tauxCouverture'] = (float)$r['tauxCouverture'];
            }
            sendJson($rows);
        }
        break;

    case 'POST':
    case 'PUT':
        $data = getJsonInput();
        if (empty($data['id']) || empty($data['nomPrenom']) || empty($data['societeId'])) {
            sendError("Champs obligatoires manquants: id, nomPrenom, societeId");
        }

        $stmt = $pdo->prepare("INSERT INTO personnes (id, nom_prenom, matricule, societe_id, sous_societe, qualite, famille_code, date_naissance, telephone, email, taux_couverture, statut) 
            VALUES (:id, :nomPrenom, :matricule, :societeId, :sousSociete, :qualite, :familleCode, :dateNaissance, :telephone, :email, :tauxCouverture, :statut)
            ON DUPLICATE KEY UPDATE 
            nom_prenom = VALUES(nom_prenom), matricule = VALUES(matricule), societe_id = VALUES(societe_id), 
            sous_societe = VALUES(sous_societe), qualite = VALUES(qualite), famille_code = VALUES(famille_code), 
            date_naissance = VALUES(date_naissance), telephone = VALUES(telephone), email = VALUES(email), 
            taux_couverture = VALUES(taux_couverture), statut = VALUES(statut)");

        $stmt->execute([
            ':id' => $data['id'],
            ':nomPrenom' => $data['nomPrenom'],
            ':matricule' => $data['matricule'] ?? '',
            ':societeId' => $data['societeId'],
            ':sousSociete' => $data['sousSociete'] ?? null,
            ':qualite' => $data['qualite'] ?? 'Adhérent Principal',
            ':familleCode' => $data['familleCode'] ?? null,
            ':dateNaissance' => $data['dateNaissance'] ?? null,
            ':telephone' => $data['telephone'] ?? null,
            ':email' => $data['email'] ?? null,
            ':tauxCouverture' => $data['tauxCouverture'] ?? null,
            ':statut' => $data['statut'] ?? 'Actif'
        ]);

        sendJson(['id' => $data['id'], 'message' => 'Personne enregistrée avec succès']);
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) sendError("ID de la personne obligatoire");

        $stmt = $pdo->prepare("DELETE FROM personnes WHERE id = ?");
        $stmt->execute([$id]);
        sendJson(['id' => $id, 'message' => 'Personne supprimée']);
        break;

    default:
        sendError("Méthode non autorisée", 405);
}
