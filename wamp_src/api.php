<?php
/**
 * =====================================================================
 *  SUIVI ASSURANCE SALFA — API PHP (déploiement WAMP)
 * =====================================================================
 *
 *  Point d'entrée unique de l'API, appelé par l'application web :
 *
 *    GET    api.php?action=check_db            → test de connexion MySQL + auto-seeding
 *    GET    api.php?action=societes            → liste des sociétés (auto-seed si vide)
 *    GET    api.php?action=personnes           → liste des personnes
 *    GET    api.php?action=familles            → liste des familles (auto-seed si vide)
 *    GET    api.php?action=prestations         → prestations (+ lignes_prestation)
 *    GET    api.php?action=paiements           → paiements (+ lignes_paiement)
 *    GET    api.php?action=parametres          → réglages applicatifs (clé/valeur, stockés en MySQL)
 *    POST   api.php?action=<entite>            → création / mise à jour (upsert unitaire ou lot)
 *    DELETE api.php?action=<entite>&id=<id>    → suppression (lignes enfants incluses)
 *
 *  NOTE STRICTE : l'application persiste TOUTES ses données directement dans
 *  cette base MySQL WAMP (prestations, lignes_prestation, paiements, lignes_paiement,
 *  societes, personnes, familles, parametres).
 *
 *  Exigences : WAMP Server (Apache 2.4, PHP >= 8.0 avec l'extension
 *  pdo_mysql activée), MySQL 5.7+ / 8.x ou MariaDB 10.4+.
 */

declare(strict_types=1);

require_once __DIR__ . '/api/config.php';

/* ===================================================================== */
/*  En-têtes HTTP & CORS                                                 */
/* ===================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Cache-Control: no-store, no-cache, must-revalidate');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ===================================================================== */
/*  Utilitaires génériques                                               */
/* ===================================================================== */

/** Envoie une réponse JSON puis termine le script. */
function json_out(array $payload, int $httpCode = 200): void
{
    http_response_code($httpCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Envoie une réponse d'erreur au format attendu par l'application. */
function fail(string $error, int $httpCode = 200): void
{
    json_out(['success' => false, 'error' => $error], $httpCode);
}

/** Convertit une valeur (nombre, chaîne, avec virgule ou espaces) en float ou null. */
function num($v): ?float
{
    if ($v === null || $v === '') {
        return null;
    }
    if (is_numeric($v)) {
        return (float) $v;
    }
    if (is_string($v)) {
        $clean = str_replace([' ', "\u{00A0}", "\u{202F}"], '', $v);
        $clean = str_replace(',', '.', $clean);
        return is_numeric($clean) ? (float) $clean : null;
    }
    return null;
}

/** Nombre flottant avec valeur par défaut. */
function num_or($v, float $default = 0.0): float
{
    $n = num($v);
    return $n !== null ? $n : $default;
}

/** Nombre flottant nullable. */
function num_null($v): ?float
{
    return num($v);
}

/** Chaîne non vide ou null. */
function nullable_str($v): ?string
{
    if ($v === null) {
        return null;
    }
    $s = is_scalar($v) ? trim((string) $v) : '';
    return $s === '' ? null : $s;
}

/** Décodage JSON tolérant : renvoie toujours un tableau. */
function json_array($v): array
{
    if (is_array($v)) {
        return $v;
    }
    if (!is_string($v) || trim($v) === '') {
        return [];
    }
    $decoded = json_decode($v, true);
    return is_array($decoded) ? $decoded : [];
}

/** Extrait une valeur d'un tableau (objet JSON décodé) ou renvoie le défaut. */
function val(?array $obj, string $key, $default = null)
{
    if (!is_array($obj)) {
        return $default;
    }
    return array_key_exists($key, $obj) && $obj[$key] !== null ? $obj[$key] : $default;
}

/** Connexion PDO unique (lazy) à la base de données configurée. */
function get_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        WAMP_DB_HOST,
        WAMP_DB_PORT,
        WAMP_DB_NAME
    );

    try {
        $pdo = new PDO($dsn, WAMP_DB_USER, WAMP_DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        throw new RuntimeException(
            'Serveur MySQL injoignable ou identifiants invalides (« ' . WAMP_DB_USER . '@' . WAMP_DB_HOST . ':' . WAMP_DB_PORT . '/' . WAMP_DB_NAME . ' »). '
            . 'Vérifiez que WAMP est démarré (icône verte), que le service MySQL écoute sur le port 3306, et la configuration du fichier api/config.php. Détails : ' . $e->getMessage(),
            0,
            $e
        );
    }

    return $pdo;
}

/* ===================================================================== */
/*  Données par défaut (Auto-seeding)                                    */
/* ===================================================================== */

/** Sociétés d'assurance par défaut. */
function default_societes_list(): array
{
    return [
        [
            'id'                     => 'soc-mcicare',
            'nom'                    => 'MCI CARE',
            'code'                   => 'MCI CARE',
            'contact'                => 'Direction Santé & Tiers-Payant',
            'telephone'              => '+261 20 22 200 00',
            'email'                  => 'contact@mcicare.mg',
            'adresse'                => 'Antananarivo, Madagascar',
            'taux_couverture_defaut' => 100.00,
        ],
        [
            'id'                     => 'soc-bsa',
            'nom'                    => 'BSA',
            'code'                   => 'BSA',
            'contact'                => 'Direction Médicale & ASK GS',
            'telephone'              => '+261 20 22 300 00',
            'email'                  => 'contact@bsa.mg',
            'adresse'                => 'Andraharo, Antananarivo, Madagascar',
            'taux_couverture_defaut' => 100.00,
        ],
        [
            'id'                     => 'soc-ascoma',
            'nom'                    => 'ASCOMA',
            'code'                   => 'ASCOMA',
            'contact'                => 'Direction Santé & Tiers-Payant',
            'telephone'              => '+261 20 22 400 00',
            'email'                  => 'sante@ascoma.mg',
            'adresse'                => 'Antananarivo, Madagascar',
            'taux_couverture_defaut' => 100.00,
        ],
        [
            'id'                     => 'soc-sanlam',
            'nom'                    => 'SANLAMALLIANZ',
            'code'                   => 'SANLAM',
            'contact'                => 'Direction Santé & Sinistres',
            'telephone'              => '+261 20 22 200 01',
            'email'                  => 'sante@sanlam.mg',
            'adresse'                => 'Antananarivo, Madagascar',
            'taux_couverture_defaut' => 100.00,
        ],
        [
            'id'                     => 'soc-nyhavana',
            'nom'                    => 'NY HAVANA',
            'code'                   => 'NY HAVANA',
            'contact'                => 'Direction Santé & Sinistres',
            'telephone'              => '+261 20 22 211 44',
            'email'                  => 'sante@nyhavana.mg',
            'adresse'                => 'Antananarivo, Madagascar',
            'taux_couverture_defaut' => 100.00,
        ],
    ];
}

/** Familles de prestations par défaut. */
function default_familles_list(): array
{
    return [
        [
            'id'                       => 'fam-cons',
            'code'                     => 'CONS',
            'libelle'                  => 'Consultations & Visites Médicales',
            'plafond_annuel'           => null,
            'taux_standard'            => null,
            'tarif_conventionne'       => 20000.00,
            'ticket_moderateur_defaut' => 0.00,
            'description'              => 'Consultations de médecine générale et spécialisée',
            'aliases'                  => json_encode(['CONS', 'CG', 'C', 'CS', 'CONSULTATION', 'CONSULT', 'VISITE', 'VISITE MEDICALE', 'MEDECIN', 'CONSULT. GENERALISTE', 'GENERALISTE'], JSON_UNESCAPED_UNICODE),
        ],
        [
            'id'                       => 'fam-medic',
            'code'                     => 'MEDIC',
            'libelle'                  => 'Pharmacie & Médicaments',
            'plafond_annuel'           => null,
            'taux_standard'            => null,
            'tarif_conventionne'       => 0.00,
            'ticket_moderateur_defaut' => 0.00,
            'description'              => 'Médicaments prescrits, spécialités pharmaceutiques et consommables',
            'aliases'                  => json_encode(['MEDIC', 'PH', 'PHSB', 'PHAR', 'PHARMACIE', 'STOCK', 'PRODUITS PHARMACEUTIQUES', 'DROGUERIE', 'MEDICAMENTS', 'AMLOZAAR', 'AMOXICILLINE', 'AMOXICLAV', 'DOLIPRANE', 'ZERODOL', 'MAXILASE', 'HERBOKOF', 'MAG 2', 'BACTOCLAV', 'DOLOWIN', 'VITAMINE C'], JSON_UNESCAPED_UNICODE),
        ],
        [
            'id'                       => 'fam-labo',
            'code'                     => 'LABO',
            'libelle'                  => 'Analyses & Biologie Médicale',
            'plafond_annuel'           => null,
            'taux_standard'            => null,
            'tarif_conventionne'       => 0.00,
            'ticket_moderateur_defaut' => 0.00,
            'description'              => 'Examens de laboratoire, hématologie, biochimie, sérologie',
            'aliases'                  => json_encode(['LABO', 'EB', 'ANALYSES', 'BIOLOGIE', 'EXAMENS', 'TDR', 'TDR PALU', 'NFS', 'BIO', 'ANALYSE DE LABORATOIRE', 'SERVICE BIOLOGIE', 'BIOLOGISTE'], JSON_UNESCAPED_UNICODE),
        ],
        [
            'id'                       => 'fam-soins',
            'code'                     => 'SOINS',
            'libelle'                  => 'Soins Infirmiers & Actes Externes',
            'plafond_annuel'           => null,
            'taux_standard'            => null,
            'tarif_conventionne'       => 0.00,
            'ticket_moderateur_defaut' => 0.00,
            'description'              => 'Injections, pansements, perfusions, aérosols et soins ambulatoires',
            'aliases'                  => json_encode(['SOINS', 'SI', 'PANSEMENT', 'INJECTION', 'PERFUSION', 'ACTES INFIRMIERS', 'SOIN', 'AMI'], JSON_UNESCAPED_UNICODE),
        ],
        [
            'id'                       => 'fam-dent',
            'code'                     => 'DENT',
            'libelle'                  => 'Soins & Prothèses Dentaires',
            'plafond_annuel'           => null,
            'taux_standard'            => null,
            'tarif_conventionne'       => 50000.00,
            'ticket_moderateur_defaut' => 0.00,
            'description'              => 'Soins conservateurs, extractions, détartrage et prothèses dentaires',
            'aliases'                  => json_encode(['DENT', 'DC', 'DK', 'CD', 'DETAR', 'DSC', 'SUP 90', 'DENTAIRE', 'EXTRACTION', 'DETARTRAGE', 'ODONTOLOGIE', 'RADICULAIRE', 'PROTHESE DENTAIRE'], JSON_UNESCAPED_UNICODE),
        ],
        [
            'id'                       => 'fam-hosp',
            'code'                     => 'HOSP',
            'libelle'                  => 'Hospitalisation & Séjour',
            'plafond_annuel'           => null,
            'taux_standard'            => null,
            'tarif_conventionne'       => 60000.00,
            'ticket_moderateur_defaut' => 0.00,
            'description'              => 'Séjours en clinique, frais de chambre, soins intensifs et chirurgie',
            'aliases'                  => json_encode(['HOSP', 'HOSPITALISATION', 'SEJOUR', 'CHIRURGIE', 'CHIRURG', 'ACCOUCHEMENT', 'BLOC'], JSON_UNESCAPED_UNICODE),
        ],
        [
            'id'                       => 'fam-echo',
            'code'                     => 'ECHO',
            'libelle'                  => 'Échographie & Imagerie Médicale',
            'plafond_annuel'           => null,
            'taux_standard'            => null,
            'tarif_conventionne'       => 30000.00,
            'ticket_moderateur_defaut' => 0.00,
            'description'              => 'Échographies abdominales, pelviennes, radiographies standard',
            'aliases'                  => json_encode(['ECHO', 'ECH', 'ECHOGRAPHIE', 'ECHOGRAPHIE PELVIENNE', 'RADI', 'RADIO', 'RADIOLOGIE', 'SCANNER', 'IRM', 'IMAGERIE'], JSON_UNESCAPED_UNICODE),
        ],
        [
            'id'                       => 'fam-opht',
            'code'                     => 'OPHT',
            'libelle'                  => 'Ophtalmologie & Optique',
            'plafond_annuel'           => null,
            'taux_standard'            => null,
            'tarif_conventionne'       => 25000.00,
            'ticket_moderateur_defaut' => 0.00,
            'description'              => 'Consultations ophtalmologiques, verres correcteurs et montures',
            'aliases'                  => json_encode(['OPHT', 'OPHTALMOLOGIE', 'OPHTA', 'LUNETTES', 'VERRES', 'OPTIQUE', 'MONTURE'], JSON_UNESCAPED_UNICODE),
        ],
    ];
}

/** Insère les sociétés d'assurance par défaut si la table est vide. */
function ensure_default_societes(PDO $pdo): void
{
    $count = (int) $pdo->query('SELECT COUNT(*) FROM `societes`')->fetchColumn();
    if ($count === 0) {
        $defaults = default_societes_list();
        $sql = 'INSERT INTO `societes` (`id`, `nom`, `code`, `contact`, `telephone`, `email`, `adresse`, `taux_couverture_defaut`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  `nom` = VALUES(`nom`),
                  `code` = VALUES(`code`),
                  `contact` = VALUES(`contact`),
                  `telephone` = VALUES(`telephone`),
                  `email` = VALUES(`email`),
                  `adresse` = VALUES(`adresse`),
                  `taux_couverture_defaut` = VALUES(`taux_couverture_defaut`)';
        $st = $pdo->prepare($sql);
        foreach ($defaults as $d) {
            $st->execute([
                $d['id'],
                $d['nom'],
                $d['code'],
                $d['contact'],
                $d['telephone'],
                $d['email'],
                $d['adresse'],
                $d['taux_couverture_defaut'],
            ]);
        }
    }
}

/** Insère les familles de prestations par défaut si la table est vide. */
function ensure_default_familles(PDO $pdo): void
{
    $count = (int) $pdo->query('SELECT COUNT(*) FROM `familles`')->fetchColumn();
    if ($count === 0) {
        $defaults = default_familles_list();
        $sql = 'INSERT INTO `familles` (`id`, `code`, `libelle`, `plafond_annuel`, `taux_standard`, `tarif_conventionne`, `ticket_moderateur_defaut`, `description`, `aliases`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  `libelle` = VALUES(`libelle`),
                  `description` = VALUES(`description`),
                  `tarif_conventionne` = VALUES(`tarif_conventionne`),
                  `aliases` = VALUES(`aliases`)';
        $st = $pdo->prepare($sql);
        foreach ($defaults as $d) {
            $st->execute([
                $d['id'],
                $d['code'],
                $d['libelle'],
                $d['plafond_annuel'],
                $d['taux_standard'],
                $d['tarif_conventionne'],
                $d['ticket_moderateur_defaut'],
                $d['description'],
                $d['aliases'],
            ]);
        }
    }
}

/* ===================================================================== */
/*  Lecture des listes (GET)                                             */
/* ===================================================================== */

function fetch_all(PDO $pdo, string $sql): array
{
    $st = $pdo->query($sql);
    return $st->fetchAll();
}

/** Sociétés → tableau d'objets camelCase attendu par l'application. */
function list_societes(PDO $pdo): array
{
    try {
        ensure_default_societes($pdo);
    } catch (Throwable $e) {
        // ignore
    }
    $rows = fetch_all($pdo, 'SELECT * FROM `societes` ORDER BY `nom` ASC');
    $data = [];
    foreach ($rows as $r) {
        $data[] = [
            'id'                   => (string) $r['id'],
            'nom'                  => (string) $r['nom'],
            'code'                 => (string) $r['code'],
            'contact'              => nullable_str($r['contact']),
            'telephone'            => nullable_str($r['telephone']),
            'email'                => nullable_str($r['email']),
            'adresse'              => nullable_str($r['adresse']),
            'tauxCouvertureDefaut' => num_or($r['taux_couverture_defaut'], 100.0),
        ];
    }
    return $data;
}

/** Personnes (adhérents / ayants droit). */
function list_personnes(PDO $pdo): array
{
    $rows = fetch_all($pdo, 'SELECT * FROM `personnes` ORDER BY `nom_prenom` ASC');
    $data = [];
    foreach ($rows as $r) {
        $data[] = [
            'id'             => (string) $r['id'],
            'nomPrenom'      => (string) $r['nom_prenom'],
            'matricule'      => (string) $r['matricule'],
            'societeId'      => (string) $r['societe_id'],
            'sousSociete'    => nullable_str($r['sous_societe']),
            'qualite'        => nullable_str($r['qualite']) ?: 'Adhérent Principal',
            'familleCode'    => nullable_str($r['famille_code']),
            'dateNaissance'  => nullable_str($r['date_naissance']),
            'telephone'      => nullable_str($r['telephone']),
            'email'          => nullable_str($r['email']),
            'tauxCouverture' => num_null($r['taux_couverture']),
            'statut'         => $r['statut'] ?: 'Actif',
        ];
    }
    return $data;
}

/** Familles de prestations (codes, plafonds, aliases). */
function list_familles(PDO $pdo): array
{
    try {
        ensure_default_familles($pdo);
    } catch (Throwable $e) {
        // ignore
    }
    $rows = fetch_all($pdo, 'SELECT * FROM `familles` ORDER BY `code` ASC');
    $data = [];
    foreach ($rows as $r) {
        $data[] = [
            'id'                     => (string) $r['id'],
            'code'                   => (string) $r['code'],
            'libelle'                => (string) $r['libelle'],
            'plafondAnnuel'          => num_null($r['plafond_annuel']),
            'tauxStandard'           => num_null($r['taux_standard']),
            'tarifConventionne'      => num_null($r['tarif_conventionne']),
            'ticketModerateurDefaut' => num_null($r['ticket_moderateur_defaut']),
            'description'            => nullable_str($r['description']),
            'aliases'                => json_array($r['aliases']),
        ];
    }
    return $data;
}

/** Lignes de prestations, regroupées par prestation. */
function map_lignes_prestation(PDO $pdo): array
{
    try {
        $rows = fetch_all($pdo, 'SELECT * FROM `lignes_prestation` ORDER BY `id` ASC');
    } catch (Throwable $e) {
        return [];
    }
    $byPrestation = [];
    foreach ($rows as $l) {
        $brut = num_or($l['total_prestation'], 0.0);
        $part = num_or($l['ticket_moderateur'], 0.0);
        $remb = num_or($l['montant_a_rembourser'], max(0.0, $brut - $part));
        $paye = num_or($l['total_paye'], 0.0);
        $exclu = num_or($l['montant_exclu'], 0.0);

        $byPrestation[$l['prestation_id']][] = [
            'id'                 => (string) $l['id'],
            'prestationId'       => (string) $l['prestation_id'],
            'code'               => (string) $l['code'],
            'libelle'            => nullable_str($l['libelle']) ?: (string) $l['code'],
            'totalPrestation'    => $brut,
            'montant'            => $brut,
            'ticketModerateur'   => $part,
            'montantARembourser' => $remb,
            'totalPaye'          => $paye,
            'montantExclu'       => $exclu,
            'motifExclusion'     => nullable_str($l['motif_exclusion']),
            'statut'             => $l['statut'] ?: 'En attente',
        ];
    }
    return $byPrestation;
}

/** Prestations médicales avec leurs lignes (actes). */
function list_prestations(PDO $pdo): array
{
    try {
        $rows = fetch_all($pdo, "SELECT * FROM `prestations` ORDER BY COALESCE(`date_creation`, '') DESC, `id` DESC");
    } catch (Throwable $e) {
        $rows = [];
    }
    $lignesByPrestation = map_lignes_prestation($pdo);

    $data = [];
    foreach ($rows as $r) {
        $brut  = num_or($r['total_prestation'], 0.0);
        $part  = num_or($r['participation'], 0.0);
        $remb  = num_or($r['montant_a_rembourser'], max(0.0, $brut - $part));
        $paye  = num_or($r['total_paye'], 0.0);
        $exclu = num_or($r['montant_exclu'], 0.0);
        $reste = num_or($r['reste_a_payer'], max(0.0, $remb - $paye - $exclu));

        $pLignes = $lignesByPrestation[$r['id']] ?? [];

        // Si aucune ligne n'est enregistrée dans la table enfant, synthétiser une ligne par défaut
        if (count($pLignes) === 0) {
            $pLignes = [
                [
                    'id'                 => $r['id'] . '-ligne-1',
                    'prestationId'       => (string) $r['id'],
                    'code'               => 'CONS',
                    'libelle'            => 'Prestation de soins',
                    'totalPrestation'    => $brut,
                    'montant'            => $brut,
                    'ticketModerateur'   => $part,
                    'montantARembourser' => $remb,
                    'totalPaye'          => $paye,
                    'montantExclu'       => $exclu,
                    'motifExclusion'     => nullable_str($r['motif_exclusion']),
                    'statut'             => $r['statut'] ?: 'En attente',
                ]
            ];
        }

        $data[] = [
            'id'                 => (string) $r['id'],
            'numeroFacture'      => (string) $r['numero_facture'],
            'date'               => nullable_str($r['date']) ?: '',
            'societeId'          => (string) $r['societe_id'],
            'societeNom'         => nullable_str($r['societe_nom']) ?: '',
            'sousSociete'        => nullable_str($r['sous_societe']) ?: '',
            'personneId'         => (string) $r['personne_id'],
            'nomAgent'           => nullable_str($r['nom_agent']) ?: '',
            'matricule'          => nullable_str($r['matricule']) ?: '',
            'totalPrestation'    => $brut,
            'montantTotal'       => $brut,
            'participation'      => $part,
            'ticketModerateur'   => $part,
            'montantARembourser' => $remb,
            'totalPaye'          => $paye,
            'montantExclu'       => $exclu,
            'motifExclusion'     => nullable_str($r['motif_exclusion']),
            'resteAPayer'        => $reste,
            'statut'             => $r['statut'] ?: 'En attente',
            'lignes'             => $pLignes,
            'dateCreation'       => nullable_str($r['date_creation']) ?: '',
            'datePaiement'       => nullable_str($r['date_paiement']),
            'numeroBordereau'    => nullable_str($r['numero_bordereau']),
            'commentaires'       => nullable_str($r['commentaires']),
        ];
    }
    return $data;
}

/** Lignes de paiements (bordereaux), regroupées par paiement. */
function map_lignes_paiement(PDO $pdo): array
{
    try {
        $rows = fetch_all($pdo, 'SELECT * FROM `lignes_paiement` ORDER BY `id` ASC');
    } catch (Throwable $e) {
        return [];
    }
    $byPaiement = [];
    foreach ($rows as $l) {
        $paye = num_or($l['total_paye'], 0.0);
        $byPaiement[$l['paiement_id']][] = [
            'id'                => (string) $l['id'],
            'paiementId'        => (string) $l['paiement_id'],
            'lignePrestationId' => nullable_str($l['ligne_prestation_id']) ?: '',
            'prestationId'      => nullable_str($l['prestation_id']) ?: '',
            'immatriculation'   => nullable_str($l['immatriculation']) ?: '-',
            'nomBaseAssurance'  => nullable_str($l['nom_base_assurance']) ?: '',
            'nomAgent'          => nullable_str($l['nom_agent']) ?: '',
            'prestationNumero'  => nullable_str($l['prestation_numero']) ?: '',
            'dateSoins'         => nullable_str($l['date_soins']),
            'totalPaye'         => $paye,
            'montantPaye'       => $paye,
            'ticketModerateur'  => num_or($l['ticket_moderateur'], 0.0),
            'montantExclu'      => num_or($l['montant_exclu'], 0.0),
            'montantReclame'    => num_or($l['montant_reclame'], 0.0),
            'codeActe'          => nullable_str($l['code_acte']) ?: 'CONS',
            'libelleActe'       => nullable_str($l['libelle_acte']) ?: 'Acte de soins',
            'actesPayes'        => json_array($l['actes_payes']),
            'commentaire'       => nullable_str($l['commentaire']),
        ];
    }
    return $byPaiement;
}

/** Paiements / bordereaux de règlement avec leurs lignes. */
function list_paiements(PDO $pdo): array
{
    try {
        $rows = fetch_all($pdo, "SELECT * FROM `paiements` ORDER BY COALESCE(`date_paiement`, '') DESC, COALESCE(`date_saisie`, '') DESC, `id` DESC");
    } catch (Throwable $e) {
        $rows = [];
    }
    $lignesByPaiement = map_lignes_paiement($pdo);

    $data = [];
    foreach ($rows as $r) {
        $reclame = num_or($r['total_reclame'], 0.0);
        $paye    = num_or($r['total_paye'], 0.0);
        $mod     = num_or($r['total_moderateur'], 0.0);
        $exclu   = num_or($r['total_exclu'], 0.0);

        $pLignes = $lignesByPaiement[$r['id']] ?? [];

        // Si aucune ligne n'est enregistrée dans la table enfant, synthétiser une ligne par défaut
        if (count($pLignes) === 0) {
            $pLignes = [
                [
                    'id'                => $r['id'] . '-ligne-1',
                    'paiementId'        => (string) $r['id'],
                    'lignePrestationId' => '',
                    'prestationId'      => nullable_str($r['prestation_id']) ?: '',
                    'immatriculation'   => nullable_str($r['matricule']) ?: '-',
                    'nomBaseAssurance'  => nullable_str($r['nom_agent']) ?: '',
                    'nomAgent'          => nullable_str($r['nom_agent']) ?: '',
                    'prestationNumero'  => nullable_str($r['prestation_numero']) ?: '',
                    'dateSoins'         => nullable_str($r['date_soins']) ?: nullable_str($r['date_paiement']),
                    'totalPaye'         => $paye,
                    'montantPaye'       => $paye,
                    'ticketModerateur'  => $mod,
                    'montantExclu'      => $exclu,
                    'montantReclame'    => $reclame,
                    'codeActe'          => 'CONS',
                    'libelleActe'       => 'Règlement',
                    'actesPayes'        => [],
                    'commentaire'       => nullable_str($r['notes']),
                ]
            ];
        }

        $data[] = [
            'id'                => (string) $r['id'],
            'numeroBordereau'   => (string) $r['numero_bordereau'],
            'datePaiement'      => nullable_str($r['date_paiement']) ?: '',
            'dateSoins'         => nullable_str($r['date_soins']),
            'dateSaisie'        => nullable_str($r['date_saisie']) ?: '',
            'societeId'         => (string) $r['societe_id'],
            'societeNom'        => nullable_str($r['societe_nom']) ?: '',
            'sousSociete'       => nullable_str($r['sous_societe']) ?: '',
            'nomAgent'          => nullable_str($r['nom_agent']) ?: '',
            'matricule'         => nullable_str($r['matricule']) ?: '',
            'prestationId'      => nullable_str($r['prestation_id']),
            'prestationNumero'  => nullable_str($r['prestation_numero']),
            'modePaiement'      => nullable_str($r['mode_paiement']) ?: 'Virement bancaire',
            'referencePaiement' => nullable_str($r['reference_paiement']) ?: '',
            'totalReclame'      => $reclame,
            'montantAPayer'     => $reclame,
            'totalPaye'         => $paye,
            'sommePayee'        => $paye,
            'totalModerateur'   => $mod,
            'ticketModerateur'  => $mod,
            'totalExclu'        => $exclu,
            'montantExclu'      => $exclu,
            'remise'            => num_or($r['remise'], 0.0),
            'statut'            => $r['statut'] ?: 'Validé',
            'lignes'            => $pLignes,
            'notes'             => nullable_str($r['notes']),
        ];
    }
    return $data;
}

/** Paramètres applicatifs (clé/valeur JSON stockée en MySQL). */
function list_parametres(PDO $pdo): array
{
    try {
        $rows = fetch_all($pdo, 'SELECT `cle`, `valeur` FROM `parametres` ORDER BY `cle` ASC');
    } catch (Throwable $e) {
        return [];
    }
    $data = [];
    foreach ($rows as $r) {
        $decoded = json_decode((string) $r['valeur'], true);
        $data[$r['cle']] = $decoded !== null ? $decoded : $r['valeur'];
    }
    return $data;
}

/* ===================================================================== */
/*  Écriture (POST / DELETE)                                             */
/* ===================================================================== */

/** Lit et valide le corps JSON de la requête. */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        fail('Corps de requête vide : le contenu JSON est obligatoire pour cette action.');
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        fail('JSON invalide transmis à l\'API : ' . json_last_error_msg());
    }
    return $decoded;
}

/** Accepte un objet unique ou un tableau d'objets (import groupé). */
function as_collection(array $decoded): array
{
    if (count($decoded) === 0) {
        return [];
    }
    return array_keys($decoded) === range(0, count($decoded) - 1) ? $decoded : [$decoded];
}

/**
 * Crée ou met à jour une ligne parente (idempotent et atomique par `id`).
 * Utilise INSERT INTO ... ON DUPLICATE KEY UPDATE pour éviter tout verrouillage ou échec de clé primaire.
 * @param array<string, mixed> $data colonnes => valeurs
 */
function upsert_row(PDO $pdo, string $table, array $data): void
{
    $cols = array_keys($data);
    $values = array_values($data);

    $list = implode(', ', array_map(static fn(string $c): string => '`' . $c . '`', $cols));
    $marks = implode(', ', array_fill(0, count($cols), '?'));
    $updatePairs = implode(', ', array_map(static fn(string $c): string => '`' . $c . '` = VALUES(`' . $c . '`)', $cols));

    $sql = 'INSERT INTO `' . $table . '` (' . $list . ') VALUES (' . $marks . ') ON DUPLICATE KEY UPDATE ' . $updatePairs;
    $st = $pdo->prepare($sql);
    $st->execute($values);
}

/**
 * Remplace l'ensemble des lignes enfants d'un parent (ordre préservé).
 * Utilise ON DUPLICATE KEY UPDATE pour prévenir tout conflit d'identifiant enfant.
 * @param array<int, array<int, mixed>> $rows valeurs positionnées dans l'ordre de $cols
 * @param array<int, string> $cols
 */
function replace_child_rows(PDO $pdo, string $table, string $parentCol, string $parentId, array $rows, array $cols): void
{
    $st = $pdo->prepare('DELETE FROM `' . $table . '` WHERE `' . $parentCol . '` = ?');
    $st->execute([$parentId]);

    if (count($rows) === 0) {
        return;
    }

    $list = implode(', ', array_map(static fn(string $c): string => '`' . $c . '`', $cols));
    $marks = implode(', ', array_fill(0, count($cols), '?'));
    $updatePairs = implode(', ', array_map(static fn(string $c): string => '`' . $c . '` = VALUES(`' . $c . '`)', $cols));

    $sql = 'INSERT INTO `' . $table . '` (' . $list . ') VALUES (' . $marks . ') ON DUPLICATE KEY UPDATE ' . $updatePairs;
    $st = $pdo->prepare($sql);
    foreach ($rows as $row) {
        $st->execute($row);
    }
}

/** Enregistre (upsert) une société avec tolérance aux champs manquants. */
function save_societe(PDO $pdo, array $o): void
{
    $id = trim((string) (val($o, 'id') ?: ''));
    if ($id === '') {
        $id = 'soc-' . bin2hex(random_bytes(4));
    }
    $nom = trim((string) (val($o, 'nom') ?: ''));
    if ($nom === '') {
        $nom = 'Société ' . $id;
    }
    $code = trim((string) (val($o, 'code') ?: ''));
    if ($code === '') {
        $code = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $nom) ?: 'SOC', 0, 8));
    }

    upsert_row($pdo, 'societes', [
        'id'                     => $id,
        'nom'                    => $nom,
        'code'                   => $code,
        'contact'                => nullable_str(val($o, 'contact')),
        'telephone'              => nullable_str(val($o, 'telephone')),
        'email'                  => nullable_str(val($o, 'email')),
        'adresse'                => nullable_str(val($o, 'adresse')),
        'taux_couverture_defaut' => num_or(val($o, 'tauxCouvertureDefaut') ?? val($o, 'taux_couverture_defaut'), 100.0),
    ]);
}

/** Enregistre (upsert) une personne avec tolérance aux champs manquants. */
function save_personne(PDO $pdo, array $o): void
{
    $id = trim((string) (val($o, 'id') ?: ''));
    if ($id === '') {
        $id = 'per-' . bin2hex(random_bytes(4));
    }
    $nomPrenom = trim((string) (val($o, 'nomPrenom') ?? val($o, 'nom_prenom') ?: ''));
    if ($nomPrenom === '') {
        $nomPrenom = 'Assuré ' . $id;
    }
    $matricule = trim((string) (val($o, 'matricule') ?: ''));
    if ($matricule === '' || $matricule === '-') {
        $matricule = 'MAT-' . substr(md5($id), 0, 6);
    }
    $societeId = trim((string) (val($o, 'societeId') ?? val($o, 'societe_id') ?: ''));
    if ($societeId === '') {
        $societeId = 'soc-mcicare';
    }

    upsert_row($pdo, 'personnes', [
        'id'              => $id,
        'nom_prenom'      => $nomPrenom,
        'matricule'       => $matricule,
        'societe_id'      => $societeId,
        'sous_societe'    => nullable_str(val($o, 'sousSociete') ?? val($o, 'sous_societe')),
        'qualite'         => nullable_str(val($o, 'qualite')) ?: 'Adhérent Principal',
        'famille_code'    => nullable_str(val($o, 'familleCode') ?? val($o, 'famille_code')),
        'date_naissance'  => nullable_str(val($o, 'dateNaissance') ?? val($o, 'date_naissance')),
        'telephone'       => nullable_str(val($o, 'telephone')),
        'email'           => nullable_str(val($o, 'email')),
        'taux_couverture' => num_null(val($o, 'tauxCouverture') ?? val($o, 'taux_couverture')),
        'statut'          => trim((string) (val($o, 'statut') ?: 'Actif')) ?: 'Actif',
    ]);
}

/** Enregistre (upsert) une famille de prestations. */
function save_famille(PDO $pdo, array $o): void
{
    $code = strtoupper(trim((string) (val($o, 'code') ?: 'ACTE')));
    if ($code === '') {
        $code = 'ACTE';
    }
    $id = trim((string) (val($o, 'id') ?: ''));
    if ($id === '') {
        $id = 'fam-' . strtolower($code);
    }
    $lib = trim((string) (val($o, 'libelle') ?: ''));
    if ($lib === '') {
        $lib = $code;
    }

    $aliases = val($o, 'aliases');
    $aliasesJson = json_encode(
        is_array($aliases) ? array_values($aliases) : [$code],
        JSON_UNESCAPED_UNICODE
    );

    upsert_row($pdo, 'familles', [
        'id'                       => $id,
        'code'                     => $code,
        'libelle'                  => $lib,
        'plafond_annuel'           => num_null(val($o, 'plafondAnnuel') ?? val($o, 'plafond_annuel')),
        'taux_standard'            => num_null(val($o, 'tauxStandard') ?? val($o, 'taux_standard')),
        'tarif_conventionne'       => num_null(val($o, 'tarifConventionne') ?? val($o, 'tarif_conventionne')),
        'ticket_moderateur_defaut' => num_null(val($o, 'ticketModerateurDefaut') ?? val($o, 'ticket_moderateur_defaut')),
        'description'              => nullable_str(val($o, 'description')),
        'aliases'                  => (string) $aliasesJson,
    ]);
}

/** Colonnes de la table `lignes_prestation` (ordre d'insertion). */
function lignes_prestation_cols(): array
{
    return ['id', 'prestation_id', 'code', 'libelle', 'total_prestation', 'ticket_moderateur', 'montant_a_rembourser', 'total_paye', 'montant_exclu', 'motif_exclusion', 'statut'];
}

/** Construit les lignes de la table `lignes_prestation` depuis les données reçues. */
function build_lignes_prestation_rows(array $o, string $prestationId): array
{
    $lignesIn = val($o, 'lignes') ?? val($o, 'lignesPrestation') ?? val($o, 'lignes_prestation');
    $lignesIn = is_array($lignesIn) ? array_values($lignesIn) : [];

    $rows = [];
    foreach ($lignesIn as $i => $l) {
        if (!is_array($l)) {
            continue;
        }
        $lId = trim((string) (val($l, 'id') ?: ''));
        if ($lId === '') {
            $lId = $prestationId . '-ligne-' . ($i + 1);
        }
        $code = trim((string) (val($l, 'code') ?? val($l, 'codeActe') ?? val($l, 'code_acte') ?: 'CONS'));
        if ($code === '') {
            $code = 'CONS';
        }
        $libelle = nullable_str(val($l, 'libelle') ?? val($l, 'libelleActe') ?? val($l, 'libelle_acte')) ?: $code;
        $totalPres = num_or(val($l, 'totalPrestation') ?? val($l, 'total_prestation') ?? val($l, 'montant'), 0.0);
        $tm = num_or(val($l, 'ticketModerateur') ?? val($l, 'ticket_moderateur') ?? val($l, 'participation'), 0.0);
        $remb = num_or(val($l, 'montantARembourser') ?? val($l, 'montant_a_rembourser'), max(0.0, $totalPres - $tm));
        $paye = num_or(val($l, 'totalPaye') ?? val($l, 'total_paye'), 0.0);
        $exclu = num_or(val($l, 'montantExclu') ?? val($l, 'montant_exclu'), 0.0);
        $motif = nullable_str(val($l, 'motifExclusion') ?? val($l, 'motif_exclusion'));
        $statut = trim((string) (val($l, 'statut') ?: 'En attente')) ?: 'En attente';

        $rows[] = [
            $lId,
            $prestationId,
            $code,
            $libelle,
            $totalPres,
            $tm,
            $remb,
            $paye,
            $exclu,
            $motif,
            $statut,
        ];
    }

    // Si aucune sous-ligne n'est fournie, créer automatiquement une ligne de soins standard
    if (count($rows) === 0) {
        $brut  = num_or(val($o, 'totalPrestation') ?? val($o, 'total_prestation') ?? val($o, 'montantTotal') ?? val($o, 'montant_total'), 0.0);
        $part  = num_or(val($o, 'participation') ?? val($o, 'ticketModerateur') ?? val($o, 'ticket_moderateur'), 0.0);
        $remb  = num_or(val($o, 'montantARembourser') ?? val($o, 'montant_a_rembourser'), max(0.0, $brut - $part));
        $paye  = num_or(val($o, 'totalPaye') ?? val($o, 'total_paye') ?? val($o, 'sommePayee'), 0.0);
        $exclu = num_or(val($o, 'montantExclu') ?? val($o, 'montant_exclu'), 0.0);
        $motif = nullable_str(val($o, 'motifExclusion') ?? val($o, 'motif_exclusion'));
        $statut = trim((string) (val($o, 'statut') ?: 'En attente')) ?: 'En attente';

        $rows[] = [
            $prestationId . '-ligne-1',
            $prestationId,
            'CONS',
            'Prestation de soins',
            $brut,
            $part,
            $remb,
            $paye,
            $exclu,
            $motif,
            $statut,
        ];
    }

    return $rows;
}

/** Enregistre (upsert) une prestation et ses lignes de façon transactionnelle. */
function save_prestation(PDO $pdo, array $o): void
{
    $id = trim((string) (val($o, 'id') ?: ''));
    if ($id === '') {
        $id = 'prest-' . bin2hex(random_bytes(6));
    }
    $numero = trim((string) (val($o, 'numeroFacture') ?? val($o, 'numero_facture') ?: ''));
    if ($numero === '') {
        $numero = 'FACT-' . substr($id, 0, 8);
    }
    $societeId = trim((string) (val($o, 'societeId') ?? val($o, 'societe_id') ?: ''));
    if ($societeId === '') {
        $societeId = 'soc-mcicare';
    }
    $personneId = trim((string) (val($o, 'personneId') ?? val($o, 'personne_id') ?: ''));
    if ($personneId === '') {
        $personneId = 'per-1';
    }

    $brut  = num_or(val($o, 'totalPrestation') ?? val($o, 'total_prestation') ?? val($o, 'montantTotal') ?? val($o, 'montant_total'), 0.0);
    $part  = num_or(val($o, 'participation') ?? val($o, 'ticketModerateur') ?? val($o, 'ticket_moderateur'), 0.0);
    $remb  = num_or(val($o, 'montantARembourser') ?? val($o, 'montant_a_rembourser'), max(0.0, $brut - $part));
    $paye  = num_or(val($o, 'totalPaye') ?? val($o, 'total_paye') ?? val($o, 'sommePayee'), 0.0);
    $exclu = num_or(val($o, 'montantExclu') ?? val($o, 'montant_exclu'), 0.0);
    $reste = num_or(val($o, 'resteAPayer') ?? val($o, 'reste_a_payer'), max(0.0, $remb - $paye - $exclu));

    $inTx = $pdo->inTransaction();
    if (!$inTx) {
        $pdo->beginTransaction();
    }

    try {
        upsert_row($pdo, 'prestations', [
            'id'                   => $id,
            'numero_facture'       => $numero,
            'date'                 => nullable_str(val($o, 'date') ?? val($o, 'date_prestation') ?? val($o, 'datePrestation')) ?: date('Y-m-d'),
            'societe_id'           => $societeId,
            'societe_nom'          => nullable_str(val($o, 'societeNom') ?? val($o, 'societe_nom')),
            'sous_societe'         => nullable_str(val($o, 'sousSociete') ?? val($o, 'sous_societe')),
            'personne_id'          => $personneId,
            'nom_agent'            => nullable_str(val($o, 'nomAgent') ?? val($o, 'nom_agent')),
            'matricule'            => nullable_str(val($o, 'matricule')),
            'total_prestation'     => $brut,
            'participation'        => $part,
            'montant_a_rembourser' => $remb,
            'total_paye'           => $paye,
            'montant_exclu'        => $exclu,
            'motif_exclusion'      => nullable_str(val($o, 'motifExclusion') ?? val($o, 'motif_exclusion')),
            'reste_a_payer'        => $reste,
            'statut'               => trim((string) (val($o, 'statut') ?: 'En attente')) ?: 'En attente',
            'date_creation'        => nullable_str(val($o, 'dateCreation') ?? val($o, 'date_creation')) ?: date('c'),
            'date_paiement'        => nullable_str(val($o, 'datePaiement') ?? val($o, 'date_paiement')),
            'numero_bordereau'     => nullable_str(val($o, 'numeroBordereau') ?? val($o, 'numero_bordereau')),
            'commentaires'         => nullable_str(val($o, 'commentaires')),
        ]);

        $childRows = build_lignes_prestation_rows($o, $id);
        replace_child_rows(
            $pdo,
            'lignes_prestation',
            'prestation_id',
            $id,
            $childRows,
            lignes_prestation_cols()
        );

        if (!$inTx) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if (!$inTx && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/** Colonnes de la table `lignes_paiement` (ordre d'insertion). */
function lignes_paiement_cols(): array
{
    return ['id', 'paiement_id', 'ligne_prestation_id', 'prestation_id', 'immatriculation', 'nom_base_assurance', 'nom_agent', 'prestation_numero', 'date_soins', 'total_paye', 'ticket_moderateur', 'montant_exclu', 'montant_reclame', 'code_acte', 'libelle_acte', 'actes_payes', 'commentaire'];
}

/** Construit les lignes de la table `lignes_paiement` depuis les données reçues. */
function build_lignes_paiement_rows(array $o, string $paiementId): array
{
    $lignesIn = val($o, 'lignes') ?? val($o, 'lignesPaiement') ?? val($o, 'lignes_paiement');
    $lignesIn = is_array($lignesIn) ? array_values($lignesIn) : [];

    $rows = [];
    foreach ($lignesIn as $i => $l) {
        if (!is_array($l)) {
            continue;
        }
        $lId = trim((string) (val($l, 'id') ?: ''));
        if ($lId === '') {
            $lId = $paiementId . '-ligne-' . ($i + 1);
        }

        $actesPayes = val($l, 'actesPayes') ?? val($l, 'actes_payes');
        $actesPayes = is_array($actesPayes) ? array_values($actesPayes) : [];

        $codeActe = nullable_str(val($l, 'codeActe') ?? val($l, 'code_acte') ?? val($l, 'code'));
        if ($codeActe === null && count($actesPayes) > 0 && is_array($actesPayes[0])) {
            $codeActe = nullable_str(val($actesPayes[0], 'code'));
        }
        if (!$codeActe) {
            $codeActe = 'CONS';
        }

        $libelleActe = nullable_str(val($l, 'libelleActe') ?? val($l, 'libelle_acte') ?? val($l, 'libelle'));
        if ($libelleActe === null && count($actesPayes) > 0 && is_array($actesPayes[0])) {
            $libelleActe = nullable_str(val($actesPayes[0], 'libelle'));
        }
        if (!$libelleActe) {
            $libelleActe = $codeActe;
        }

        $paye = num_or(val($l, 'totalPaye') ?? val($l, 'total_paye') ?? val($l, 'montantPaye') ?? val($l, 'montant_paye'), 0.0);
        $tm = num_or(val($l, 'ticketModerateur') ?? val($l, 'ticket_moderateur'), 0.0);
        $exclu = num_or(val($l, 'montantExclu') ?? val($l, 'montant_exclu'), 0.0);
        $reclame = num_or(val($l, 'montantReclame') ?? val($l, 'montant_reclame'), 0.0);

        $rows[] = [
            $lId,
            $paiementId,
            nullable_str(val($l, 'lignePrestationId') ?? val($l, 'ligne_prestation_id')),
            nullable_str(val($l, 'prestationId') ?? val($l, 'prestation_id')),
            nullable_str(val($l, 'immatriculation') ?? val($l, 'matricule')) ?: '-',
            nullable_str(val($l, 'nomBaseAssurance') ?? val($l, 'nom_base_assurance')),
            nullable_str(val($l, 'nomAgent') ?? val($l, 'nom_agent')),
            nullable_str(val($l, 'prestationNumero') ?? val($l, 'prestation_numero')),
            nullable_str(val($l, 'dateSoins') ?? val($l, 'date_soins')),
            $paye,
            $tm,
            $exclu,
            $reclame,
            $codeActe,
            $libelleActe,
            (string) json_encode($actesPayes, JSON_UNESCAPED_UNICODE),
            nullable_str(val($l, 'commentaire')),
        ];
    }

    // Si aucune ligne de règlement n'est fournie, créer une ligne globale
    if (count($rows) === 0) {
        $paye = num_or(val($o, 'totalPaye') ?? val($o, 'total_paye') ?? val($o, 'sommePayee') ?? val($o, 'somme_payee'), 0.0);
        $tm = num_or(val($o, 'totalModerateur') ?? val($o, 'total_moderateur') ?? val($o, 'ticketModerateur') ?? val($o, 'ticket_moderateur'), 0.0);
        $exclu = num_or(val($o, 'totalExclu') ?? val($o, 'total_exclu') ?? val($o, 'montantExclu') ?? val($o, 'montant_exclu'), 0.0);
        $reclame = num_or(val($o, 'totalReclame') ?? val($o, 'total_reclame') ?? val($o, 'montantAPayer') ?? val($o, 'montant_a_payer'), 0.0);

        $rows[] = [
            $paiementId . '-ligne-1',
            $paiementId,
            null,
            nullable_str(val($o, 'prestationId') ?? val($o, 'prestation_id')),
            nullable_str(val($o, 'matricule')) ?: '-',
            nullable_str(val($o, 'nomAgent') ?? val($o, 'nom_agent')),
            nullable_str(val($o, 'nomAgent') ?? val($o, 'nom_agent')),
            nullable_str(val($o, 'prestationNumero') ?? val($o, 'prestation_numero')),
            nullable_str(val($o, 'dateSoins') ?? val($o, 'date_soins') ?? val($o, 'datePaiement') ?? val($o, 'date_paiement')),
            $paye,
            $tm,
            $exclu,
            $reclame,
            'CONS',
            'Règlement',
            '[]',
            nullable_str(val($o, 'notes')),
        ];
    }

    return $rows;
}

/** Enregistre (upsert) un paiement / bordereau et ses lignes de façon transactionnelle. */
function save_paiement(PDO $pdo, array $o): void
{
    $id = trim((string) (val($o, 'id') ?: ''));
    if ($id === '') {
        $id = 'pai-' . bin2hex(random_bytes(6));
    }
    $numeroBordereau = trim((string) (val($o, 'numeroBordereau') ?? val($o, 'numero_bordereau') ?: ''));
    if ($numeroBordereau === '') {
        $numeroBordereau = 'BRD-' . substr($id, 0, 8);
    }
    $societeId = trim((string) (val($o, 'societeId') ?? val($o, 'societe_id') ?: ''));
    if ($societeId === '') {
        $societeId = 'soc-mcicare';
    }

    $inTx = $pdo->inTransaction();
    if (!$inTx) {
        $pdo->beginTransaction();
    }

    try {
        upsert_row($pdo, 'paiements', [
            'id'                 => $id,
            'numero_bordereau'   => $numeroBordereau,
            'date_paiement'      => nullable_str(val($o, 'datePaiement') ?? val($o, 'date_paiement')) ?: date('Y-m-d'),
            'date_soins'         => nullable_str(val($o, 'dateSoins') ?? val($o, 'date_soins')),
            'date_saisie'        => nullable_str(val($o, 'dateSaisie') ?? val($o, 'date_saisie')) ?: date('c'),
            'societe_id'         => $societeId,
            'societe_nom'        => nullable_str(val($o, 'societeNom') ?? val($o, 'societe_nom')),
            'sous_societe'       => nullable_str(val($o, 'sousSociete') ?? val($o, 'sous_societe')),
            'nom_agent'          => nullable_str(val($o, 'nomAgent') ?? val($o, 'nom_agent')),
            'matricule'          => nullable_str(val($o, 'matricule')),
            'prestation_id'      => nullable_str(val($o, 'prestationId') ?? val($o, 'prestation_id')),
            'prestation_numero'  => nullable_str(val($o, 'prestationNumero') ?? val($o, 'prestation_numero')),
            'mode_paiement'      => nullable_str(val($o, 'modePaiement') ?? val($o, 'mode_paiement')) ?: 'Virement bancaire',
            'reference_paiement' => nullable_str(val($o, 'referencePaiement') ?? val($o, 'reference_paiement')),
            'total_reclame'      => num_or(val($o, 'totalReclame') ?? val($o, 'total_reclame') ?? val($o, 'montantAPayer') ?? val($o, 'montant_a_payer'), 0.0),
            'total_paye'         => num_or(val($o, 'totalPaye') ?? val($o, 'total_paye') ?? val($o, 'sommePayee') ?? val($o, 'somme_payee'), 0.0),
            'total_moderateur'   => num_or(val($o, 'totalModerateur') ?? val($o, 'total_moderateur') ?? val($o, 'ticketModerateur') ?? val($o, 'ticket_moderateur'), 0.0),
            'total_exclu'        => num_or(val($o, 'totalExclu') ?? val($o, 'total_exclu') ?? val($o, 'montantExclu') ?? val($o, 'montant_exclu'), 0.0),
            'remise'             => num_or(val($o, 'remise'), 0.0),
            'statut'             => trim((string) (val($o, 'statut') ?: 'Validé')) ?: 'Validé',
            'notes'              => nullable_str(val($o, 'notes')),
        ]);

        $childRows = build_lignes_paiement_rows($o, $id);
        replace_child_rows(
            $pdo,
            'lignes_paiement',
            'paiement_id',
            $id,
            $childRows,
            lignes_paiement_cols()
        );

        if (!$inTx) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if (!$inTx && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/** Enregistre (upsert) un paramètre applicatif clé/valeur en MySQL. */
function save_parametre(PDO $pdo, array $o): void
{
    $cle = trim((string) ($o['cle'] ?? $o['key'] ?? ''));
    if ($cle === '') {
        throw new InvalidArgumentException('Paramètre sans clé (« cle » obligatoire).');
    }
    $valeur = array_key_exists('valeur', $o) ? $o['valeur'] : (array_key_exists('value', $o) ? $o['value'] : null);
    $json = json_encode($valeur, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $sql = 'INSERT INTO `parametres` (`cle`, `valeur`, `date_modification`) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE `valeur` = VALUES(`valeur`), `date_modification` = VALUES(`date_modification`)';
    $st = $pdo->prepare($sql);
    $st->execute([$cle, $json, date('c')]);
}

/** Supprime une entité (et ses lignes enfants le cas échéant). */
function handle_delete(PDO $pdo, string $action, string $label): void
{
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id === '') {
        fail('Paramètre « id » manquant dans l\'URL (DELETE api.php?action=' . $action . '&id=...).');
    }

    $inTx = $pdo->inTransaction();
    if (!$inTx) {
        $pdo->beginTransaction();
    }

    try {
        if ($action === 'prestations') {
            $st = $pdo->prepare('DELETE FROM `lignes_prestation` WHERE `prestation_id` = ?');
            $st->execute([$id]);
        } elseif ($action === 'paiements') {
            $st = $pdo->prepare('DELETE FROM `lignes_paiement` WHERE `paiement_id` = ?');
            $st->execute([$id]);
        }

        $st = $pdo->prepare('DELETE FROM `' . $action . '` WHERE `id` = ?');
        $st->execute([$id]);
        $affected = $st->rowCount();

        if (!$inTx) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if (!$inTx && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    json_out([
        'success' => true,
        'message' => ($affected > 0 ? 'Supprimé' : 'Aucun enregistrement trouvé') . ' — ' . $label,
        'deleted' => $affected,
    ]);
}

/* ===================================================================== */
/*  Test de connexion (check_db) — BLOCANT pour l'application            */
/* ===================================================================== */

/** Crée la table `parametres` si elle n'existe pas encore (migration douce, sans perte de données). */
function ensure_parametres_table(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `parametres` (
            `cle`               VARCHAR(100) NOT NULL,
            `valeur`            LONGTEXT     DEFAULT NULL,
            `date_modification` VARCHAR(30)  DEFAULT NULL,
            PRIMARY KEY (`cle`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function handle_check_db(): void
{
    $tables = ['societes', 'personnes', 'familles', 'prestations', 'lignes_prestation', 'paiements', 'lignes_paiement', 'parametres'];

    try {
        $pdo = get_pdo();
    } catch (Throwable $e) {
        fail('Connexion MySQL impossible : ' . $e->getMessage());
    }

    // Migration douce : créer `parametres` si la base date d'une version précédente
    try {
        ensure_parametres_table($pdo);
    } catch (Throwable $e) {
        // La table sera signalée manquante ci-dessous si la création échoue.
    }

    // Auto-seeding automatique des sociétés et familles par défaut si vides
    try {
        ensure_default_societes($pdo);
        ensure_default_familles($pdo);
    } catch (Throwable $e) {
        // ignore
    }

    $counts = [];
    $missing = [];
    foreach ($tables as $t) {
        try {
            $counts[$t] = (int) $pdo->query('SELECT COUNT(*) FROM `' . $t . '`')->fetchColumn();
        } catch (PDOException $e) {
            $missing[] = $t;
        }
    }

    if (count($missing) > 0) {
        fail(
            'Base de données connectée mais schéma incomplet (tables manquantes : ' . implode(', ', $missing)
            . '). Importez le fichier « schema.sql » via phpMyAdmin (onglet Importer).',
            200
        );
    }

    json_out([
        'success'   => true,
        'message'   => 'Connexion MySQL établie',
        'database'  => WAMP_DB_NAME,
        'server'    => (string) $pdo->getAttribute(PDO::ATTR_SERVER_VERSION),
        'php'       => PHP_VERSION,
        'counts'    => $counts,
        'timestamp' => date('c'),
    ]);
}

/* ===================================================================== */
/*  Routage principal                                                    */
/* ===================================================================== */

$action = strtolower(trim((string) ($_GET['action'] ?? '')));
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

try {
    /* Test de connexion (utilisé par l'écran de blocage de l'application) */
    if ($action === 'check_db' || $action === 'health') {
        handle_check_db();
    }

    $knownActions = ['societes', 'personnes', 'familles', 'prestations', 'paiements', 'parametres'];
    if (!in_array($action, $knownActions, true)) {
        fail(
            'Action inconnue : « ' . $action . ' ». Actions disponibles : check_db, ' . implode(', ', $knownActions) . '.',
            400
        );
    }

    $pdo = get_pdo();

    /* ------------------------------ GET ------------------------------ */
    if ($method === 'GET') {
        // Paramètres applicatifs : lecture d'une clé précise ou de toutes les clés
        if ($action === 'parametres') {
            try {
                ensure_parametres_table($pdo);
            } catch (Throwable $e) {
                // ignore — list_parametres renverra un tableau vide
            }
            $cle = trim((string) ($_GET['cle'] ?? ''));
            $all = list_parametres($pdo);
            if ($cle !== '') {
                json_out(['success' => true, 'data' => array_key_exists($cle, $all) ? $all[$cle] : null]);
            }
            json_out(['success' => true, 'count' => count($all), 'data' => $all]);
        }
        switch ($action) {
            case 'societes':
                $data = list_societes($pdo);
                break;
            case 'personnes':
                $data = list_personnes($pdo);
                break;
            case 'familles':
                $data = list_familles($pdo);
                break;
            case 'prestations':
                $data = list_prestations($pdo);
                break;
            case 'paiements':
                $data = list_paiements($pdo);
                break;
            default:
                $data = [];
        }
        json_out(['success' => true, 'count' => count($data), 'data' => $data]);
    }

    /* ----------------------------- POST ------------------------------ */
    if ($method === 'POST') {
        $items = as_collection(read_json_body());
        if (count($items) === 0) {
            fail('Aucun enregistrement à enregistrer (corps JSON vide).');
        }

        foreach ($items as $item) {
            if (!is_array($item)) {
                fail('Chaque enregistrement doit être un objet JSON.');
            }
        }

        if ($action === 'parametres') {
            try {
                ensure_parametres_table($pdo);
            } catch (Throwable $e) {
                fail('Table « parametres » indisponible : ' . $e->getMessage());
            }
        }

        $saved = 0;
        $errors = [];

        foreach ($items as $idx => $item) {
            try {
                switch ($action) {
                    case 'societes':
                        save_societe($pdo, $item);
                        break;
                    case 'parametres':
                        save_parametre($pdo, $item);
                        break;
                    case 'personnes':
                        save_personne($pdo, $item);
                        break;
                    case 'familles':
                        save_famille($pdo, $item);
                        break;
                    case 'prestations':
                        save_prestation($pdo, $item);
                        break;
                    case 'paiements':
                        save_paiement($pdo, $item);
                        break;
                }
                $saved++;
            } catch (Throwable $e) {
                $itemId = is_array($item) ? ($item['id'] ?? ('index-' . $idx)) : ('index-' . $idx);
                $errors[] = $itemId . ': ' . $e->getMessage();
            }
        }

        json_out([
            'success' => $saved > 0 || count($items) === 0,
            'message' => $saved . ' enregistrement(s) enregistré(s) avec succès dans MySQL.' . (count($errors) > 0 ? ' ' . count($errors) . ' erreur(s).' : ''),
            'count'   => $saved,
            'total'   => count($items),
            'errors'  => $errors,
        ]);
    }

    /* ---------------------------- DELETE ----------------------------- */
    if ($method === 'DELETE') {
        // Suppression d'un paramètre applicatif par sa clé
        if ($action === 'parametres') {
            $cle = trim((string) ($_GET['cle'] ?? $_GET['id'] ?? ''));
            if ($cle === '') {
                fail('Paramètre « cle » manquant dans l\'URL (DELETE api.php?action=parametres&cle=...).');
            }
            try {
                ensure_parametres_table($pdo);
            } catch (Throwable $e) {
                // ignore
            }
            $st = $pdo->prepare('DELETE FROM `parametres` WHERE `cle` = ?');
            $st->execute([$cle]);
            json_out([
                'success' => true,
                'message' => 'Supprimé — paramètre « ' . $cle . ' »',
                'deleted' => $st->rowCount(),
            ]);
        }
        $labels = [
            'societes'    => 'société',
            'personnes'   => 'personne',
            'familles'    => 'famille',
            'prestations' => 'prestation',
            'paiements'   => 'paiement',
        ];
        handle_delete($pdo, $action, $labels[$action] ?? $action);
    }

    fail('Méthode HTTP non autorisée : « ' . $method . ' ». Utilisez GET, POST ou DELETE.', 405);

} catch (Throwable $e) {
    fail('Erreur interne de l\'API : ' . $e->getMessage(), 500);
}
