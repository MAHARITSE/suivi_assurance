<?php
/**
 * API REST PHP Backend - Suivi Assurance SALFA
 * Conçue pour WAMP Server / XAMPP avec Base de données MySQL (Mode Multi-Poste & Réseau Local)
 * Supporte les requêtes unitaires et en lot (Bulk Insert/Update), la tolérance de schéma et la réconciliation relationnelle.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';

$action = isset($_GET['action']) ? trim($_GET['action']) : '';

function sendJson($success, $data = null, $error = null, $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'error' => $error
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Nettoyage et conversion sécurisée d'un montant numérique
 */
function cleanAmount($val, $default = 0.0) {
    if ($val === null || $val === '') return $default;
    if (is_numeric($val)) return (float)$val;
    if (is_string($val)) {
        $clean = preg_replace('/[^\d\.\-]/', '', str_replace(',', '.', $val));
        return is_numeric($clean) ? (float)$clean : $default;
    }
    return $default;
}

/**
 * Auto-migration douce du schéma MySQL (Élargit les colonnes sans perte de données et installe les clés étrangères en cascade)
 */
function ensureSchemaIntegrity($pdo) {
    try {
        // Élargissement sécurisé des colonnes sensibles pour éviter les erreurs "Data too long"
        $alterQueries = [
            "ALTER TABLE `societes` MODIFY `id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `societes` MODIFY `code` VARCHAR(100) NOT NULL",
            "ALTER TABLE `personnes` MODIFY `id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `personnes` MODIFY `societe_id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `familles` MODIFY `id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `familles` MODIFY `code` VARCHAR(100) NOT NULL",
            "ALTER TABLE `prestations` MODIFY `id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `prestations` MODIFY `societe_id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `prestations` MODIFY `personne_id` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `prestations` MODIFY `date` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `prestations` MODIFY `date_creation` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `prestations` MODIFY `date_paiement` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `prestations` MODIFY `numero_facture` VARCHAR(255) NOT NULL",
            "ALTER TABLE `prestations` MODIFY `statut` VARCHAR(100) DEFAULT 'En attente'",
            "ALTER TABLE `paiements` MODIFY `id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `paiements` MODIFY `societe_id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `paiements` MODIFY `prestation_id` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `paiements` MODIFY `date_paiement` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `paiements` MODIFY `date_soins` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `paiements` MODIFY `date_saisie` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `paiements` MODIFY `numero_bordereau` VARCHAR(255) NOT NULL",
            "ALTER TABLE `paiements` MODIFY `statut` VARCHAR(100) DEFAULT 'Validé'",
            "ALTER TABLE `lignes_prestation` MODIFY `id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `lignes_prestation` MODIFY `prestation_id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `lignes_prestation` MODIFY `code` VARCHAR(100) NOT NULL",
            "ALTER TABLE `lignes_paiement` MODIFY `id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `lignes_paiement` MODIFY `paiement_id` VARCHAR(100) NOT NULL",
            "ALTER TABLE `lignes_paiement` MODIFY `prestation_id` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `lignes_paiement` MODIFY `ligne_prestation_id` VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE `lignes_paiement` MODIFY `date_soins` VARCHAR(100) DEFAULT NULL"
        ];
        foreach ($alterQueries as $q) {
            try { $pdo->exec($q); } catch (Exception $e) { /* ignore if already modified */ }
        }

        // Ajout des contraintes de clés étrangères avec CASCADE si absentes
        $fkQueries = [
            "ALTER TABLE `personnes` ADD CONSTRAINT `fk_personnes_societe` FOREIGN KEY (`societe_id`) REFERENCES `societes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
            "ALTER TABLE `prestations` ADD CONSTRAINT `fk_prestations_societe` FOREIGN KEY (`societe_id`) REFERENCES `societes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
            "ALTER TABLE `prestations` ADD CONSTRAINT `fk_prestations_personne` FOREIGN KEY (`personne_id`) REFERENCES `personnes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
            "ALTER TABLE `lignes_prestation` ADD CONSTRAINT `fk_lignes_prestation_prestation` FOREIGN KEY (`prestation_id`) REFERENCES `prestations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
            "ALTER TABLE `paiements` ADD CONSTRAINT `fk_paiements_societe` FOREIGN KEY (`societe_id`) REFERENCES `societes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
            "ALTER TABLE `paiements` ADD CONSTRAINT `fk_paiements_prestation` FOREIGN KEY (`prestation_id`) REFERENCES `prestations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
            "ALTER TABLE `lignes_paiement` ADD CONSTRAINT `fk_lignes_paiement_paiement` FOREIGN KEY (`paiement_id`) REFERENCES `paiements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE",
            "ALTER TABLE `lignes_paiement` ADD CONSTRAINT `fk_lignes_paiement_prestation` FOREIGN KEY (`prestation_id`) REFERENCES `prestations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE",
            "ALTER TABLE `lignes_paiement` ADD CONSTRAINT `fk_lignes_paiement_ligne_prestation` FOREIGN KEY (`ligne_prestation_id`) REFERENCES `lignes_prestation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE"
        ];
        foreach ($fkQueries as $fk) {
            try { $pdo->exec($fk); } catch (Exception $e) { /* ignore if constraint already exists */ }
        }
    } catch (Exception $e) {
        // Silent fail on schema integrity check
    }
}

// ----------------------------------------------------
// ROUTE : check_db (Vérification stricte de la base MySQL et des tables)
// ----------------------------------------------------
if ($action === 'check_db' || $action === 'health') {
    try {
        $pdo = getDbConnection();
        ensureSchemaIntegrity($pdo);
        
        $requiredTables = ['societes', 'personnes', 'familles', 'prestations', 'paiements', 'lignes_prestation', 'lignes_paiement'];
        $stmt = $pdo->query("SHOW TABLES");
        $existingTables = [];
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $existingTables[] = strtolower($row[0]);
        }

        $missing = [];
        foreach ($requiredTables as $t) {
            if (!in_array(strtolower($t), $existingTables)) {
                $missing[] = $t;
            }
        }

        if (!empty($missing)) {
            sendJson(false, null, "La base '" . DB_NAME . "' existe mais les tables suivantes sont manquantes : " . implode(', ', $missing) . ". Veuillez importer le fichier schema.sql dans phpMyAdmin.", 500);
        }

        // Compter les enregistrements réels dans MySQL
        $countPrest = (int)$pdo->query("SELECT COUNT(*) FROM `prestations`")->fetchColumn();
        $countPaiem = (int)$pdo->query("SELECT COUNT(*) FROM `paiements`")->fetchColumn();
        $countSoc = (int)$pdo->query("SELECT COUNT(*) FROM `societes`")->fetchColumn();
        $countPers = (int)$pdo->query("SELECT COUNT(*) FROM `personnes`")->fetchColumn();

        sendJson(true, [
            'connected' => true,
            'database' => DB_NAME,
            'message' => 'Connexion à la base MySQL ' . DB_NAME . ' active.',
            'stats' => [
                'societes' => $countSoc,
                'personnes' => $countPers,
                'prestations' => $countPrest,
                'paiements' => $countPaiem
            ],
            'server_time' => date('Y-m-d H:i:s'),
            'timestamp' => date('c')
        ]);
    } catch (PDOException $e) {
        sendJson(false, null, 'Erreur MySQL: ' . $e->getMessage(), 500);
    } catch (Exception $e) {
        sendJson(false, null, $e->getMessage(), 500);
    }
}

$validActions = ['societes', 'personnes', 'familles', 'prestations', 'paiements'];
if (!in_array($action, $validActions)) {
    sendJson(false, null, 'Action non valide: ' . $action, 400);
}

try {
    $pdo = getDbConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // ----------------------------------------------------
    // GET : Lecture robuste depuis MySQL
    // Reconstitution complète à partir des colonnes ET du JSON
    // ----------------------------------------------------
    if ($method === 'GET') {
        if ($action === 'prestations') {
            $stmt = $pdo->prepare("SELECT * FROM `prestations` ORDER BY `date` DESC, `updated_at` DESC");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Charger les lignes de prestation associées
            $lpStmt = $pdo->prepare("SELECT * FROM `lignes_prestation` ORDER BY `created_at` ASC");
            $lpStmt->execute();
            $allLignes = $lpStmt->fetchAll(PDO::FETCH_ASSOC);
            
            $lignesByPrestation = [];
            foreach ($allLignes as $lp) {
                $pid = $lp['prestation_id'];
                if (!isset($lignesByPrestation[$pid])) {
                    $lignesByPrestation[$pid] = [];
                }
                
                $lpObj = null;
                if (!empty($lp['data'])) {
                    $lpObj = json_decode($lp['data'], true);
                }
                if (!$lpObj) {
                    $lpObj = [
                        'id' => (string)$lp['id'],
                        'prestationId' => (string)$lp['prestation_id'],
                        'code' => (string)$lp['code'],
                        'libelle' => (string)($lp['libelle'] ?? ''),
                        'totalPrestation' => cleanAmount($lp['total_prestation']),
                        'ticketModerateur' => cleanAmount($lp['ticket_moderateur']),
                        'montantARembourser' => cleanAmount($lp['montant_a_rembourser']),
                        'totalPaye' => cleanAmount($lp['total_paye']),
                        'montantExclu' => cleanAmount($lp['montant_exclu']),
                        'motifExclusion' => $lp['motif_exclusion'] ?? null,
                        'statut' => (string)($lp['statut'] ?? 'En attente')
                    ];
                }
                $lignesByPrestation[$pid][] = $lpObj;
            }

            $result = [];
            foreach ($rows as $row) {
                $item = null;
                if (!empty($row['data'])) {
                    $item = json_decode($row['data'], true);
                }

                if (!$item || !is_array($item)) {
                    $item = [];
                }

                // Normalisation et fusion avec les colonnes relationnelles
                $item['id'] = (string)$row['id'];
                $item['numeroFacture'] = (string)($row['numero_facture'] ?? $item['numeroFacture'] ?? '');
                $item['date'] = (string)($row['date'] ?? $item['date'] ?? '');
                $item['societeId'] = (string)($row['societe_id'] ?? $item['societeId'] ?? '');
                $item['societeNom'] = (string)($row['societe_nom'] ?? $item['societeNom'] ?? '');
                $item['sousSociete'] = $row['sous_societe'] ?? $item['sousSociete'] ?? '';
                $item['personneId'] = $row['personne_id'] ?? $item['personneId'] ?? '';
                $item['nomAgent'] = (string)($row['nom_agent'] ?? $item['nomAgent'] ?? '');
                $item['matricule'] = (string)($row['matricule'] ?? $item['matricule'] ?? '');
                
                $brut = cleanAmount($row['total_prestation'] ?? $item['totalPrestation'] ?? $item['montantTotal'] ?? 0);
                $part = cleanAmount($row['participation'] ?? $item['participation'] ?? $item['ticketModerateur'] ?? 0);
                $remb = cleanAmount($row['montant_a_rembourser'] ?? $item['montantARembourser'] ?? max(0, $brut - $part));
                $paye = cleanAmount($row['total_paye'] ?? $item['totalPaye'] ?? 0);
                $exclu = cleanAmount($row['montant_exclu'] ?? $item['montantExclu'] ?? 0);
                $reste = cleanAmount($row['reste_a_payer'] ?? $item['resteAPayer'] ?? max(0, $remb - $paye - $exclu));

                $item['totalPrestation'] = $brut;
                $item['montantTotal'] = $brut;
                $item['participation'] = $part;
                $item['ticketModerateur'] = $part;
                $item['montantARembourser'] = $remb;
                $item['totalPaye'] = $paye;
                $item['montantExclu'] = $exclu;
                $item['motifExclusion'] = $row['motif_exclusion'] ?? $item['motifExclusion'] ?? null;
                $item['resteAPayer'] = $reste;
                $item['statut'] = (string)($row['statut'] ?? $item['statut'] ?? 'En attente');
                $item['dateCreation'] = (string)($row['date_creation'] ?? $item['dateCreation'] ?? '');
                $item['datePaiement'] = $row['date_paiement'] ?? $item['datePaiement'] ?? null;
                $item['numeroBordereau'] = $row['numero_bordereau'] ?? $item['numeroBordereau'] ?? null;
                $item['commentaires'] = $row['commentaires'] ?? $item['commentaires'] ?? '';

                // Assurer que le tableau lignes existe toujours et n'est jamais undefined/null
                if (empty($item['lignes']) || !is_array($item['lignes'])) {
                    $item['lignes'] = $lignesByPrestation[$row['id']] ?? [
                        [
                            'id' => $row['id'] . '-act-1',
                            'code' => 'CONS',
                            'libelle' => 'Consultation / Soins',
                            'totalPrestation' => $brut,
                            'ticketModerateur' => $part,
                            'montantARembourser' => $remb,
                            'totalPaye' => $paye,
                            'statut' => $item['statut']
                        ]
                    ];
                }

                $result[] = $item;
            }

            sendJson(true, $result);
        } 
        elseif ($action === 'paiements') {
            $stmt = $pdo->prepare("SELECT * FROM `paiements` ORDER BY `date_paiement` DESC, `updated_at` DESC");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Charger les lignes de paiement
            $lpStmt = $pdo->prepare("SELECT * FROM `lignes_paiement` ORDER BY `created_at` ASC");
            $lpStmt->execute();
            $allLignes = $lpStmt->fetchAll(PDO::FETCH_ASSOC);

            $lignesByPaiement = [];
            foreach ($allLignes as $lp) {
                $pid = $lp['paiement_id'];
                if (!isset($lignesByPaiement[$pid])) {
                    $lignesByPaiement[$pid] = [];
                }
                $lpObj = null;
                if (!empty($lp['data'])) {
                    $lpObj = json_decode($lp['data'], true);
                }
                if (!$lpObj) {
                    $lpObj = [
                        'id' => (string)$lp['id'],
                        'paiementId' => (string)$lp['paiement_id'],
                        'lignePrestationId' => $lp['ligne_prestation_id'] ?? null,
                        'prestationId' => $lp['prestation_id'] ?? null,
                        'immatriculation' => (string)($lp['immatriculation'] ?? ''),
                        'nomBaseAssurance' => (string)($lp['nom_base_assurance'] ?? ''),
                        'nomAgent' => (string)($lp['nom_agent'] ?? ''),
                        'prestationNumero' => (string)($lp['prestation_numero'] ?? ''),
                        'dateSoins' => $lp['date_soins'] ?? null,
                        'totalPaye' => cleanAmount($lp['total_paye']),
                        'ticketModerateur' => cleanAmount($lp['ticket_moderateur']),
                        'montantExclu' => cleanAmount($lp['montant_exclu']),
                        'montantReclame' => cleanAmount($lp['montant_reclame']),
                        'codeActe' => $lp['code_acte'] ?? null,
                        'libelleActe' => $lp['libelle_acte'] ?? null,
                        'actesPayes' => !empty($lp['actes_payes']) ? json_decode($lp['actes_payes'], true) : [],
                        'commentaire' => $lp['commentaire'] ?? null
                    ];
                }
                $lignesByPaiement[$pid][] = $lpObj;
            }

            $result = [];
            foreach ($rows as $row) {
                $item = null;
                if (!empty($row['data'])) {
                    $item = json_decode($row['data'], true);
                }
                if (!$item || !is_array($item)) {
                    $item = [];
                }

                $item['id'] = (string)$row['id'];
                $item['numeroBordereau'] = (string)($row['numero_bordereau'] ?? $item['numeroBordereau'] ?? '');
                $item['datePaiement'] = (string)($row['date_paiement'] ?? $item['datePaiement'] ?? '');
                $item['dateSoins'] = $row['date_soins'] ?? $item['dateSoins'] ?? null;
                $item['dateSaisie'] = $row['date_saisie'] ?? $item['dateSaisie'] ?? null;
                $item['societeId'] = (string)($row['societe_id'] ?? $item['societeId'] ?? '');
                $item['societeNom'] = (string)($row['societe_nom'] ?? $item['societeNom'] ?? '');
                $item['sousSociete'] = $row['sous_societe'] ?? $item['sousSociete'] ?? null;
                $item['nomAgent'] = $row['nom_agent'] ?? $item['nomAgent'] ?? null;
                $item['matricule'] = $row['matricule'] ?? $item['matricule'] ?? null;
                $item['prestationId'] = $row['prestation_id'] ?? $item['prestationId'] ?? null;
                $item['prestationNumero'] = $row['prestation_numero'] ?? $item['prestationNumero'] ?? null;
                $item['modePaiement'] = (string)($row['mode_paiement'] ?? $item['modePaiement'] ?? 'Virement bancaire');
                $item['referencePaiement'] = (string)($row['reference_paiement'] ?? $item['referencePaiement'] ?? '');
                $item['totalReclame'] = cleanAmount($row['total_reclame'] ?? $item['totalReclame'] ?? 0);
                $item['totalPaye'] = cleanAmount($row['total_paye'] ?? $item['totalPaye'] ?? 0);
                $item['totalModerateur'] = cleanAmount($row['total_moderateur'] ?? $item['totalModerateur'] ?? 0);
                $item['totalExclu'] = cleanAmount($row['total_exclu'] ?? $item['totalExclu'] ?? 0);
                $item['remise'] = cleanAmount($row['remise'] ?? $item['remise'] ?? 0);
                $item['statut'] = (string)($row['statut'] ?? $item['statut'] ?? 'Validé');
                $item['notes'] = $row['notes'] ?? $item['notes'] ?? null;

                if (empty($item['lignes']) || !is_array($item['lignes'])) {
                    $item['lignes'] = $lignesByPaiement[$row['id']] ?? [];
                }

                $result[] = $item;
            }

            sendJson(true, $result);
        }
        else {
            // Sociétés, Personnes, Familles
            $stmt = $pdo->prepare("SELECT * FROM `$action` ORDER BY `updated_at` DESC");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $result = [];
            foreach ($rows as $row) {
                $decoded = null;
                if (!empty($row['data'])) {
                    $decoded = json_decode($row['data'], true);
                }
                if (!$decoded || !is_array($decoded)) {
                    $decoded = $row;
                }
                $result[] = $decoded;
            }
            sendJson(true, $result);
        }
    } 
    // ----------------------------------------------------
    // POST : Insertion ou Mise à jour (Unitaire ou En Lot)
    // ----------------------------------------------------
    elseif ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $payload = json_decode($rawInput, true);

        if (!$payload) {
            sendJson(false, null, 'Données JSON invalides ou corps de requête vide.', 400);
        }

        // Support Bulk ou Unique
        $items = [];
        if (isset($payload['items']) && is_array($payload['items'])) {
            $items = $payload['items'];
        } elseif (is_array($payload) && isset($payload[0])) {
            $items = $payload;
        } else {
            $items = [$payload];
        }

        // Filtrer les éléments vides et trier par ID pour garantir un ordre de verrouillage déterministe (prévention des deadlocks MySQL 1213)
        $items = array_values(array_filter($items, function($it) {
            return !empty($it['id']);
        }));

        usort($items, function($a, $b) {
            return strcmp((string)$a['id'], (string)$b['id']);
        });

        if (empty($items)) {
            sendJson(true, ['count' => 0, 'items' => []]);
        }

        // Mécanisme de retry automatique en cas de Deadlock (MySQL 1213 / SQLSTATE 40001) ou Lock Wait Timeout (1205)
        $maxRetries = 5;
        $success = false;
        $lastException = null;

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                $pdo->beginTransaction();

                if ($action === 'societes') {
                    $stmt = $pdo->prepare("INSERT INTO `societes` (`id`, `nom`, `code`, `contact`, `telephone`, `email`, `adresse`, `taux_couverture_defaut`, `data`) 
                        VALUES (:id, :nom, :code, :contact, :telephone, :email, :adresse, :taux, :data)
                        ON DUPLICATE KEY UPDATE 
                            `nom` = VALUES(`nom`), `code` = VALUES(`code`), `contact` = VALUES(`contact`), 
                            `telephone` = VALUES(`telephone`), `email` = VALUES(`email`), `adresse` = VALUES(`adresse`), 
                            `taux_couverture_defaut` = VALUES(`taux_couverture_defaut`), `data` = VALUES(`data`)");
                    
                    foreach ($items as $item) {
                        $id = (string)$item['id'];
                        $stmt->execute([
                            ':id' => $id,
                            ':nom' => $item['nom'] ?? '',
                            ':code' => $item['code'] ?? '',
                            ':contact' => $item['contact'] ?? null,
                            ':telephone' => $item['telephone'] ?? null,
                            ':email' => $item['email'] ?? null,
                            ':adresse' => $item['adresse'] ?? null,
                            ':taux' => cleanAmount($item['tauxCouvertureDefaut'] ?? 80),
                            ':data' => json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                        ]);
                    }
                } 
                elseif ($action === 'personnes') {
                    $stmt = $pdo->prepare("INSERT INTO `personnes` (`id`, `nom_prenom`, `matricule`, `societe_id`, `sous_societe`, `qualite`, `famille_code`, `date_naissance`, `telephone`, `email`, `taux_couverture`, `statut`, `data`)
                        VALUES (:id, :nom, :matricule, :societe_id, :sous_societe, :qualite, :famille_code, :date_naissance, :telephone, :email, :taux, :statut, :data)
                        ON DUPLICATE KEY UPDATE 
                            `nom_prenom` = VALUES(`nom_prenom`), `matricule` = VALUES(`matricule`), `societe_id` = VALUES(`societe_id`),
                            `sous_societe` = VALUES(`sous_societe`), `qualite` = VALUES(`qualite`), `famille_code` = VALUES(`famille_code`),
                            `date_naissance` = VALUES(`date_naissance`), `telephone` = VALUES(`telephone`), `email` = VALUES(`email`),
                            `taux_couverture` = VALUES(`taux_couverture`), `statut` = VALUES(`statut`), `data` = VALUES(`data`)");
                    
                    foreach ($items as $item) {
                        $id = (string)$item['id'];
                        $stmt->execute([
                            ':id' => $id,
                            ':nom' => $item['nomPrenom'] ?? '',
                            ':matricule' => $item['matricule'] ?? '',
                            ':societe_id' => $item['societeId'] ?? '',
                            ':sous_societe' => $item['sousSociete'] ?? null,
                            ':qualite' => $item['qualite'] ?? 'Adhérent Principal',
                            ':famille_code' => $item['familleCode'] ?? null,
                            ':date_naissance' => $item['dateNaissance'] ?? null,
                            ':telephone' => $item['telephone'] ?? null,
                            ':email' => $item['email'] ?? null,
                            ':taux' => cleanAmount($item['tauxCouverture'] ?? 80),
                            ':statut' => $item['statut'] ?? 'Actif',
                            ':data' => json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                        ]);
                    }
                } 
                elseif ($action === 'familles') {
                    $stmt = $pdo->prepare("INSERT INTO `familles` (`id`, `code`, `libelle`, `plafond_annuel`, `taux_standard`, `tarif_conventionne`, `ticket_moderateur_defaut`, `description`, `aliases`, `data`)
                        VALUES (:id, :code, :libelle, :plafond, :taux, :tarif, :ticket, :description, :aliases, :data)
                        ON DUPLICATE KEY UPDATE 
                            `code` = VALUES(`code`), `libelle` = VALUES(`libelle`), `plafond_annuel` = VALUES(`plafond_annuel`),
                            `taux_standard` = VALUES(`taux_standard`), `tarif_conventionne` = VALUES(`tarif_conventionne`),
                            `ticket_moderateur_defaut` = VALUES(`ticket_moderateur_defaut`), `description` = VALUES(`description`),
                            `aliases` = VALUES(`aliases`), `data` = VALUES(`data`)");
                    
                    foreach ($items as $item) {
                        $id = (string)$item['id'];
                        $stmt->execute([
                            ':id' => $id,
                            ':code' => $item['code'] ?? '',
                            ':libelle' => $item['libelle'] ?? '',
                            ':plafond' => cleanAmount($item['plafondAnnuel'] ?? null),
                            ':taux' => cleanAmount($item['tauxStandard'] ?? null),
                            ':tarif' => cleanAmount($item['tarifConventionne'] ?? null),
                            ':ticket' => cleanAmount($item['ticketModerateurDefaut'] ?? null),
                            ':description' => $item['description'] ?? null,
                            ':aliases' => isset($item['aliases']) ? json_encode($item['aliases'], JSON_UNESCAPED_UNICODE) : '[]',
                            ':data' => json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                        ]);
                    }
                } 
                elseif ($action === 'prestations') {
                    $stmt = $pdo->prepare("INSERT INTO `prestations` (`id`, `numero_facture`, `date`, `societe_id`, `societe_nom`, `sous_societe`, `personne_id`, `nom_agent`, `matricule`, `total_prestation`, `participation`, `montant_a_rembourser`, `total_paye`, `montant_exclu`, `motif_exclusion`, `reste_a_payer`, `statut`, `date_creation`, `date_paiement`, `numero_bordereau`, `commentaires`, `data`)
                        VALUES (:id, :num, :date, :soc_id, :soc_nom, :sous_soc, :pers_id, :nom_agent, :mat, :brut, :part, :remb, :paye, :exclu, :motif_exclu, :reste, :statut, :date_crea, :date_pai, :num_bord, :com, :data)
                        ON DUPLICATE KEY UPDATE 
                            `numero_facture` = VALUES(`numero_facture`), `date` = VALUES(`date`), `societe_id` = VALUES(`societe_id`),
                            `societe_nom` = VALUES(`societe_nom`), `sous_societe` = VALUES(`sous_societe`), `personne_id` = VALUES(`personne_id`),
                            `nom_agent` = VALUES(`nom_agent`), `matricule` = VALUES(`matricule`), `total_prestation` = VALUES(`total_prestation`),
                            `participation` = VALUES(`participation`), `montant_a_rembourser` = VALUES(`montant_a_rembourser`),
                            `total_paye` = VALUES(`total_paye`), `montant_exclu` = VALUES(`montant_exclu`), `motif_exclusion` = VALUES(`motif_exclusion`),
                            `reste_a_payer` = VALUES(`reste_a_payer`), `statut` = VALUES(`statut`), `date_creation` = VALUES(`date_creation`),
                            `date_paiement` = VALUES(`date_paiement`), `numero_bordereau` = VALUES(`numero_bordereau`),
                            `commentaires` = VALUES(`commentaires`), `data` = VALUES(`data`)");

                    $delLignes = $pdo->prepare("DELETE FROM `lignes_prestation` WHERE `prestation_id` = ?");
                    $stmtLp = $pdo->prepare("INSERT INTO `lignes_prestation` (`id`, `prestation_id`, `code`, `libelle`, `total_prestation`, `ticket_moderateur`, `montant_a_rembourser`, `total_paye`, `montant_exclu`, `motif_exclusion`, `statut`, `data`)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

                    foreach ($items as $item) {
                        $id = (string)$item['id'];
                        
                        $brut = cleanAmount($item['totalPrestation'] ?? $item['montantTotal'] ?? 0);
                        $part = cleanAmount($item['participation'] ?? $item['ticketModerateur'] ?? 0);
                        $remb = cleanAmount($item['montantARembourser'] ?? max(0, $brut - $part));
                        $paye = cleanAmount($item['totalPaye'] ?? 0);
                        $exclu = cleanAmount($item['montantExclu'] ?? 0);
                        $reste = cleanAmount($item['resteAPayer'] ?? max(0, $remb - $paye - $exclu));

                        // Harmoniser l'objet avant sérialisation JSON
                        $item['totalPrestation'] = $brut;
                        $item['montantTotal'] = $brut;
                        $item['participation'] = $part;
                        $item['ticketModerateur'] = $part;
                        $item['montantARembourser'] = $remb;
                        $item['totalPaye'] = $paye;
                        $item['montantExclu'] = $exclu;
                        $item['resteAPayer'] = $reste;
                        if (!isset($item['lignes']) || !is_array($item['lignes'])) {
                            $item['lignes'] = [];
                        }

                        $jsonString = json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

                        $stmt->execute([
                            ':id' => $id,
                            ':num' => (string)($item['numeroFacture'] ?? ''),
                            ':date' => $item['date'] ?? null,
                            ':soc_id' => (string)($item['societeId'] ?? ''),
                            ':soc_nom' => $item['societeNom'] ?? null,
                            ':sous_soc' => $item['sousSociete'] ?? null,
                            ':pers_id' => $item['personneId'] ?? null,
                            ':nom_agent' => $item['nomAgent'] ?? null,
                            ':mat' => $item['matricule'] ?? null,
                            ':brut' => $brut,
                            ':part' => $part,
                            ':remb' => $remb,
                            ':paye' => $paye,
                            ':exclu' => $exclu,
                            ':motif_exclu' => $item['motifExclusion'] ?? null,
                            ':reste' => $reste,
                            ':statut' => (string)($item['statut'] ?? 'En attente'),
                            ':date_crea' => $item['dateCreation'] ?? null,
                            ':date_pai' => $item['datePaiement'] ?? null,
                            ':num_bord' => $item['numeroBordereau'] ?? null,
                            ':com' => $item['commentaires'] ?? null,
                            ':data' => $jsonString
                        ]);

                        // Synchronisation des lignes
                        if (!empty($item['lignes']) && is_array($item['lignes'])) {
                            $delLignes->execute([$id]);
                            foreach ($item['lignes'] as $ligne) {
                                $lpId = (string)($ligne['id'] ?? ($id . '-' . uniqid()));
                                $lBrut = cleanAmount($ligne['totalPrestation'] ?? $ligne['montant'] ?? 0);
                                $lMod = cleanAmount($ligne['ticketModerateur'] ?? 0);
                                $lRemb = cleanAmount($ligne['montantARembourser'] ?? max(0, $lBrut - $lMod));
                                $lPaye = cleanAmount($ligne['totalPaye'] ?? 0);
                                $lExclu = cleanAmount($ligne['montantExclu'] ?? 0);

                                $stmtLp->execute([
                                    $lpId,
                                    $id,
                                    (string)($ligne['code'] ?? 'CONS'),
                                    $ligne['libelle'] ?? null,
                                    $lBrut,
                                    $lMod,
                                    $lRemb,
                                    $lPaye,
                                    $lExclu,
                                    $ligne['motifExclusion'] ?? null,
                                    (string)($ligne['statut'] ?? 'En attente'),
                                    json_encode($ligne, JSON_UNESCAPED_UNICODE)
                                ]);
                            }
                        }
                    }
                } 
                elseif ($action === 'paiements') {
                    $stmt = $pdo->prepare("INSERT INTO `paiements` (`id`, `numero_bordereau`, `date_paiement`, `date_soins`, `date_saisie`, `societe_id`, `societe_nom`, `sous_societe`, `nom_agent`, `matricule`, `prestation_id`, `prestation_numero`, `mode_paiement`, `reference_paiement`, `total_reclame`, `total_paye`, `total_moderateur`, `total_exclu`, `remise`, `statut`, `notes`, `data`)
                        VALUES (:id, :num_bord, :date_pai, :date_soins, :date_saisie, :soc_id, :soc_nom, :sous_soc, :nom_agent, :mat, :prest_id, :prest_num, :mode, :ref, :reclame, :paye, :mod, :exclu, :remise, :statut, :notes, :data)
                        ON DUPLICATE KEY UPDATE 
                            `numero_bordereau` = VALUES(`numero_bordereau`), `date_paiement` = VALUES(`date_paiement`), `date_soins` = VALUES(`date_soins`),
                            `date_saisie` = VALUES(`date_saisie`), `societe_id` = VALUES(`societe_id`), `societe_nom` = VALUES(`societe_nom`),
                            `sous_societe` = VALUES(`sous_societe`), `nom_agent` = VALUES(`nom_agent`), `matricule` = VALUES(`matricule`),
                            `prestation_id` = VALUES(`prestation_id`), `prestation_numero` = VALUES(`prestation_numero`), `mode_paiement` = VALUES(`mode_paiement`),
                            `reference_paiement` = VALUES(`reference_paiement`), `total_reclame` = VALUES(`total_reclame`), `total_paye` = VALUES(`total_paye`),
                            `total_moderateur` = VALUES(`total_moderateur`), `total_exclu` = VALUES(`total_exclu`), `remise` = VALUES(`remise`),
                            `statut` = VALUES(`statut`), `notes` = VALUES(`notes`), `data` = VALUES(`data`)");

                    $delLignes = $pdo->prepare("DELETE FROM `lignes_paiement` WHERE `paiement_id` = ?");
                    $stmtLp = $pdo->prepare("INSERT INTO `lignes_paiement` (`id`, `paiement_id`, `ligne_prestation_id`, `prestation_id`, `immatriculation`, `nom_base_assurance`, `nom_agent`, `prestation_numero`, `date_soins`, `total_paye`, `ticket_moderateur`, `montant_exclu`, `montant_reclame`, `code_acte`, `libelle_acte`, `actes_payes`, `commentaire`, `data`)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

                    foreach ($items as $item) {
                        $id = (string)$item['id'];
                        
                        $reclame = cleanAmount($item['totalReclame'] ?? $item['montantAPayer'] ?? 0);
                        $paye = cleanAmount($item['totalPaye'] ?? $item['sommePayee'] ?? 0);
                        $mod = cleanAmount($item['totalModerateur'] ?? $item['ticketModerateur'] ?? 0);
                        $exclu = cleanAmount($item['totalExclu'] ?? $item['montantExclu'] ?? 0);
                        $remise = cleanAmount($item['remise'] ?? 0);

                        $item['totalReclame'] = $reclame;
                        $item['totalPaye'] = $paye;
                        $item['totalModerateur'] = $mod;
                        $item['totalExclu'] = $exclu;
                        $item['remise'] = $remise;
                        if (!isset($item['lignes']) || !is_array($item['lignes'])) {
                            $item['lignes'] = [];
                        }

                        $jsonString = json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

                        $stmt->execute([
                            ':id' => $id,
                            ':num_bord' => (string)($item['numeroBordereau'] ?? ''),
                            ':date_pai' => $item['datePaiement'] ?? null,
                            ':date_soins' => $item['dateSoins'] ?? null,
                            ':date_saisie' => $item['dateSaisie'] ?? null,
                            ':soc_id' => (string)($item['societeId'] ?? ''),
                            ':soc_nom' => $item['societeNom'] ?? null,
                            ':sous_soc' => $item['sousSociete'] ?? null,
                            ':nom_agent' => $item['nomAgent'] ?? null,
                            ':mat' => $item['matricule'] ?? null,
                            ':prest_id' => $item['prestationId'] ?? null,
                            ':prest_num' => $item['prestationNumero'] ?? null,
                            ':mode' => (string)($item['modePaiement'] ?? 'Virement bancaire'),
                            ':ref' => $item['referencePaiement'] ?? null,
                            ':reclame' => $reclame,
                            ':paye' => $paye,
                            ':mod' => $mod,
                            ':exclu' => $exclu,
                            ':remise' => $remise,
                            ':statut' => (string)($item['statut'] ?? 'Validé'),
                            ':notes' => $item['notes'] ?? null,
                            ':data' => $jsonString
                        ]);

                        if (!empty($item['lignes']) && is_array($item['lignes'])) {
                            $delLignes->execute([$id]);
                            foreach ($item['lignes'] as $ligne) {
                                $lpId = (string)($ligne['id'] ?? ($id . '-' . uniqid()));
                                $lPaye = cleanAmount($ligne['totalPaye'] ?? $ligne['montantPaye'] ?? 0);
                                $lMod = cleanAmount($ligne['ticketModerateur'] ?? 0);
                                $lExclu = cleanAmount($ligne['montantExclu'] ?? 0);
                                $lReclame = cleanAmount($ligne['montantReclame'] ?? 0);

                                $stmtLp->execute([
                                    $lpId,
                                    $id,
                                    $ligne['lignePrestationId'] ?? null,
                                    $ligne['prestationId'] ?? null,
                                    $ligne['immatriculation'] ?? null,
                                    $ligne['nomBaseAssurance'] ?? null,
                                    $ligne['nomAgent'] ?? null,
                                    $ligne['prestationNumero'] ?? null,
                                    $ligne['dateSoins'] ?? null,
                                    $lPaye,
                                    $lMod,
                                    $lExclu,
                                    $lReclame,
                                    $ligne['codeActe'] ?? null,
                                    $ligne['libelleActe'] ?? null,
                                    isset($ligne['actesPayes']) ? json_encode($ligne['actesPayes'], JSON_UNESCAPED_UNICODE) : null,
                                    $ligne['commentaire'] ?? null,
                                    json_encode($ligne, JSON_UNESCAPED_UNICODE)
                                ]);
                            }
                        }
                    }
                }

                $pdo->commit();
                $success = true;
                break;
            } catch (PDOException $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $lastException = $e;

                $isDeadlock = ($e->getCode() == '40001')
                    || (isset($e->errorInfo[1]) && in_array($e->errorInfo[1], [1213, 1205]))
                    || stripos($e->getMessage(), 'Deadlock') !== false
                    || stripos($e->getMessage(), 'Lock wait timeout') !== false;

                if ($isDeadlock && $attempt < $maxRetries) {
                    // Délai aléatoire (50ms - 150ms * tentative) pour désynchroniser les verrous concurrents
                    usleep(rand(50000, 150000) * $attempt);
                    continue;
                }
                throw $e;
            }
        }

        if ($success) {
            sendJson(true, ['count' => count($items), 'items' => $items]);
        } else if ($lastException) {
            throw $lastException;
        }
    } 
    // ----------------------------------------------------
    // DELETE : Suppression
    // ----------------------------------------------------
    elseif ($method === 'DELETE') {
        $id = isset($_GET['id']) ? trim($_GET['id']) : '';
        if (empty($id)) {
            sendJson(false, null, 'Paramètre id manquant pour la suppression.', 400);
        }

        $pdo->beginTransaction();

        if ($action === 'prestations') {
            $pdo->prepare("DELETE FROM `lignes_prestation` WHERE `prestation_id` = ?")->execute([$id]);
        } elseif ($action === 'paiements') {
            $pdo->prepare("DELETE FROM `lignes_paiement` WHERE `paiement_id` = ?")->execute([$id]);
        }

        $stmt = $pdo->prepare("DELETE FROM `$action` WHERE `id` = :id");
        $stmt->execute([':id' => $id]);

        $pdo->commit();
        sendJson(true, ['id' => $id, 'deleted' => true]);
    } else {
        sendJson(false, null, 'Méthode HTTP non supportée.', 405);
    }
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson(false, null, 'Erreur MySQL: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendJson(false, null, 'Erreur serveur: ' . $e->getMessage(), 500);
}
