<?php
/**
 * =====================================================================
 *  SUIVI ASSURANCE SALFA — API PHP (déploiement WAMP)
 * =====================================================================
 *
 *  Point d'entrée unique de l'API, appelé par l'application web :
 *
 *    GET    api.php?action=check_db            → test de connexion MySQL
 *    GET    api.php?action=societes            → liste des sociétés
 *    GET    api.php?action=personnes           → liste des personnes
 *    GET    api.php?action=familles            → liste des familles
 *    GET    api.php?action=prestations         → prestations (+ lignes)
 *    GET    api.php?action=paiements           → paiements (+ lignes)
 *    POST   api.php?action=<entite>            → création / mise à jour (upsert)
 *         (corps JSON : un objet, ou un tableau d'objets pour un import groupé)
 *    DELETE api.php?action=<entite>&id=<id>    → suppression (lignes enfants incluses)
 *
 *  ⛔ L'application web est BLOQUÉE tant que cette API ne répond pas
 *     correctement au test « check_db » (Apache/PHP + MySQL opérationnels).
 *
 *  Exigences : WAMP Server (Apache 2.4, PHP >= 8.0 avec l'extension
 *  pdo_mysql activée), MySQL 5.7+ / 8.x ou MariaDB 10.4+.
 */

declare(strict_types=1);

require_once __DIR__ . '/api/config.php';

/* ===================================================================== */
/*  En-têtes HTTP                                                        */
/* ===================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Cache-Control: no-store');

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

/** Convertit une valeur MySQL en nombre flottant (null si vide). */
function num(?string $v): ?float
{
    return ($v === null || $v === '') ? null : (float) $v;
}

/** Nombre flottant avec valeur par défaut. */
function num_or($v, float $default): float
{
    if ($v === null || $v === '') {
        return $default;
    }
    return is_numeric($v) ? (float) $v : $default;
}

/** Nombre flottant nullable. */
function num_null($v): ?float
{
    if ($v === null || $v === '') {
        return null;
    }
    return is_numeric($v) ? (float) $v : null;
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
    $rows = fetch_all($pdo, 'SELECT * FROM `societes` ORDER BY `nom` ASC');
    $data = [];
    foreach ($rows as $r) {
        $data[] = [
            'id'                   => $r['id'],
            'nom'                  => $r['nom'],
            'code'                 => $r['code'],
            'contact'              => $r['contact'],
            'telephone'            => $r['telephone'],
            'email'                => $r['email'],
            'adresse'              => $r['adresse'],
            'tauxCouvertureDefaut' => num($r['taux_couverture_defaut']) ?? 80.0,
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
            'id'             => $r['id'],
            'nomPrenom'      => $r['nom_prenom'],
            'matricule'      => $r['matricule'],
            'societeId'      => $r['societe_id'],
            'sousSociete'    => $r['sous_societe'],
            'qualite'        => $r['qualite'],
            'familleCode'    => $r['famille_code'],
            'dateNaissance'  => $r['date_naissance'],
            'telephone'      => $r['telephone'],
            'email'          => $r['email'],
            'tauxCouverture' => num($r['taux_couverture']),
            'statut'         => $r['statut'] ?: 'Actif',
        ];
    }
    return $data;
}

/** Familles de prestations (codes, plafonds, aliases). */
function list_familles(PDO $pdo): array
{
    $rows = fetch_all($pdo, 'SELECT * FROM `familles` ORDER BY `code` ASC');
    $data = [];
    foreach ($rows as $r) {
        $data[] = [
            'id'                    => $r['id'],
            'code'                  => $r['code'],
            'libelle'               => $r['libelle'],
            'plafondAnnuel'         => num($r['plafond_annuel']),
            'tauxStandard'          => num($r['taux_standard']),
            'tarifConventionne'     => num($r['tarif_conventionne']),
            'ticketModerateurDefaut' => num($r['ticket_moderateur_defaut']),
            'description'           => $r['description'],
            'aliases'               => json_array($r['aliases']),
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
        $byPrestation[$l['prestation_id']][] = [
            'id'                => $l['id'],
            'prestationId'      => $l['prestation_id'],
            'code'              => $l['code'],
            'libelle'           => $l['libelle'],
            'totalPrestation'   => num($l['total_prestation']) ?? 0.0,
            'montant'           => num($l['total_prestation']) ?? 0.0,
            'ticketModerateur'  => num($l['ticket_moderateur']) ?? 0.0,
            'montantARembourser' => num($l['montant_a_rembourser']) ?? 0.0,
            'totalPaye'         => num($l['total_paye']) ?? 0.0,
            'montantExclu'      => num($l['montant_exclu']) ?? 0.0,
            'motifExclusion'    => $l['motif_exclusion'],
            'statut'            => $l['statut'] ?: 'En attente',
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
        $brut  = num($r['total_prestation']) ?? 0.0;
        $part  = num($r['participation']) ?? 0.0;
        $data[] = [
            'id'               => $r['id'],
            'numeroFacture'    => $r['numero_facture'],
            'date'             => $r['date'],
            'societeId'        => $r['societe_id'],
            'societeNom'       => $r['societe_nom'],
            'sousSociete'      => $r['sous_societe'],
            'personneId'       => $r['personne_id'],
            'nomAgent'         => $r['nom_agent'],
            'matricule'        => $r['matricule'],
            'totalPrestation'  => $brut,
            'montantTotal'     => $brut,
            'participation'    => $part,
            'ticketModerateur' => $part,
            'montantARembourser' => num($r['montant_a_rembourser']) ?? max(0.0, $brut - $part),
            'totalPaye'        => num($r['total_paye']) ?? 0.0,
            'montantExclu'     => num($r['montant_exclu']) ?? 0.0,
            'motifExclusion'   => $r['motif_exclusion'],
            'resteAPayer'      => num($r['reste_a_payer']),
            'statut'           => $r['statut'] ?: 'En attente',
            'lignes'           => $lignesByPrestation[$r['id']] ?? [],
            'dateCreation'     => $r['date_creation'],
            'datePaiement'     => $r['date_paiement'],
            'numeroBordereau'  => $r['numero_bordereau'],
            'commentaires'     => $r['commentaires'],
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
        $paye = num($l['total_paye']) ?? 0.0;
        $byPaiement[$l['paiement_id']][] = [
            'id'                => $l['id'],
            'paiementId'        => $l['paiement_id'],
            'lignePrestationId' => $l['ligne_prestation_id'],
            'prestationId'      => $l['prestation_id'],
            'immatriculation'   => $l['immatriculation'],
            'nomBaseAssurance'  => $l['nom_base_assurance'],
            'nomAgent'          => $l['nom_agent'],
            'prestationNumero'  => $l['prestation_numero'],
            'dateSoins'         => $l['date_soins'],
            'totalPaye'         => $paye,
            'montantPaye'       => $paye,
            'ticketModerateur'  => num($l['ticket_moderateur']) ?? 0.0,
            'montantExclu'      => num($l['montant_exclu']) ?? 0.0,
            'montantReclame'    => num($l['montant_reclame']) ?? 0.0,
            'codeActe'          => $l['code_acte'],
            'libelleActe'       => $l['libelle_acte'],
            'actesPayes'        => json_array($l['actes_payes']),
            'commentaire'       => $l['commentaire'],
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
        $reclame = num($r['total_reclame']) ?? 0.0;
        $paye    = num($r['total_paye']) ?? 0.0;
        $mod     = num($r['total_moderateur']) ?? 0.0;
        $exclu   = num($r['total_exclu']) ?? 0.0;
        $data[] = [
            'id'               => $r['id'],
            'numeroBordereau'  => $r['numero_bordereau'],
            'datePaiement'     => $r['date_paiement'],
            'dateSoins'        => $r['date_soins'],
            'dateSaisie'       => $r['date_saisie'],
            'societeId'        => $r['societe_id'],
            'societeNom'       => $r['societe_nom'],
            'sousSociete'      => $r['sous_societe'],
            'nomAgent'         => $r['nom_agent'],
            'matricule'        => $r['matricule'],
            'prestationId'     => $r['prestation_id'],
            'prestationNumero' => $r['prestation_numero'],
            'modePaiement'     => $r['mode_paiement'],
            'referencePaiement' => $r['reference_paiement'],
            'totalReclame'     => $reclame,
            'montantAPayer'    => $reclame,
            'totalPaye'        => $paye,
            'sommePayee'       => $paye,
            'totalModerateur'  => $mod,
            'ticketModerateur' => $mod,
            'totalExclu'       => $exclu,
            'montantExclu'     => $exclu,
            'remise'           => num($r['remise']) ?? 0.0,
            'statut'           => $r['statut'] ?: 'Validé',
            'lignes'           => $lignesByPaiement[$r['id']] ?? [],
            'notes'            => $r['notes'],
        ];
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
 * Crée ou met à jour une ligne parente (idempotent par `id`).
 * @param array<string, mixed> $data colonnes => valeurs
 */
function upsert_row(PDO $pdo, string $table, array $data): void
{
    $id = (string) $data['id'];

    $st = $pdo->prepare('SELECT COUNT(*) FROM `' . $table . '` WHERE `id` = ?');
    $st->execute([$id]);
    $exists = (int) $st->fetchColumn() > 0;

    $cols = array_keys($data);
    $values = array_values($data);

    if ($exists) {
        $sets = implode(', ', array_map(static fn(string $c): string => '`' . $c . '` = ?', $cols));
        $st = $pdo->prepare('UPDATE `' . $table . '` SET ' . $sets . ' WHERE `id` = ?');
        $st->execute([...$values, $id]);
    } else {
        $list = implode(', ', array_map(static fn(string $c): string => '`' . $c . '`', $cols));
        $marks = implode(', ', array_fill(0, count($cols), '?'));
        $st = $pdo->prepare('INSERT INTO `' . $table . '` (' . $list . ') VALUES (' . $marks . ')');
        $st->execute($values);
    }
}

/**
 * Remplace l'ensemble des lignes enfants d'un parent (ordre préservé).
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
    $st = $pdo->prepare('INSERT INTO `' . $table . '` (' . $list . ') VALUES (' . $marks . ')');
    foreach ($rows as $row) {
        $st->execute($row);
    }
}

/** Enregistre (upsert) une société. */
function save_societe(PDO $pdo, array $o): void
{
    $id   = trim((string) val($o, 'id'));
    $nom  = trim((string) val($o, 'nom'));
    $code = trim((string) val($o, 'code'));
    if ($id === '' || $nom === '') {
        throw new InvalidArgumentException('Société invalide : les champs « id » et « nom » sont obligatoires.');
    }

    upsert_row($pdo, 'societes', [
        'id'                   => $id,
        'nom'                  => $nom,
        'code'                 => $code,
        'contact'              => nullable_str(val($o, 'contact')),
        'telephone'            => nullable_str(val($o, 'telephone')),
        'email'                => nullable_str(val($o, 'email')),
        'adresse'              => nullable_str(val($o, 'adresse')),
        'taux_couverture_defaut' => num_or(val($o, 'tauxCouvertureDefaut'), 80.0),
    ]);
}

/** Enregistre (upsert) une personne. */
function save_personne(PDO $pdo, array $o): void
{
    $id         = trim((string) val($o, 'id'));
    $nomPrenom  = trim((string) val($o, 'nomPrenom'));
    $matricule  = trim((string) val($o, 'matricule'));
    $societeId  = trim((string) val($o, 'societeId'));
    if ($id === '' || $nomPrenom === '' || $matricule === '' || $societeId === '') {
        throw new InvalidArgumentException('Personne invalide : les champs « id », « nomPrenom », « matricule » et « societeId » sont obligatoires.');
    }

    upsert_row($pdo, 'personnes', [
        'id'             => $id,
        'nom_prenom'     => $nomPrenom,
        'matricule'      => $matricule,
        'societe_id'     => $societeId,
        'sous_societe'   => nullable_str(val($o, 'sousSociete')),
        'qualite'        => nullable_str(val($o, 'qualite')),
        'famille_code'   => nullable_str(val($o, 'familleCode')),
        'date_naissance' => nullable_str(val($o, 'dateNaissance')),
        'telephone'      => nullable_str(val($o, 'telephone')),
        'email'          => nullable_str(val($o, 'email')),
        'taux_couverture' => num_null(val($o, 'tauxCouverture')),
        'statut'         => trim((string) val($o, 'statut', 'Actif')) ?: 'Actif',
    ]);
}

/** Enregistre (upsert) une famille de prestations. */
function save_famille(PDO $pdo, array $o): void
{
    $id    = trim((string) val($o, 'id'));
    $code  = trim((string) val($o, 'code'));
    $lib   = trim((string) val($o, 'libelle'));
    if ($id === '' || $code === '' || $lib === '') {
        throw new InvalidArgumentException('Famille invalide : les champs « id », « code » et « libelle » sont obligatoires.');
    }

    $aliases = val($o, 'aliases');
    $aliasesJson = json_encode(
        is_array($aliases) ? array_values($aliases) : [],
        JSON_UNESCAPED_UNICODE
    );

    upsert_row($pdo, 'familles', [
        'id'                      => $id,
        'code'                    => $code,
        'libelle'                 => $lib,
        'plafond_annuel'          => num_null(val($o, 'plafondAnnuel')),
        'taux_standard'           => num_null(val($o, 'tauxStandard')),
        'tarif_conventionne'      => num_null(val($o, 'tarifConventionne')),
        'ticket_moderateur_defaut' => num_null(val($o, 'ticketModerateurDefaut')),
        'description'             => nullable_str(val($o, 'description')),
        'aliases'                 => (string) $aliasesJson,
    ]);
}

/** Construit les lignes de la table `lignes_prestation` depuis les données reçues. */
function build_lignes_prestation_rows(array $o, string $prestationId): array
{
    $lignesIn = val($o, 'lignes');
    $lignesIn = is_array($lignesIn) ? array_values($lignesIn) : [];

    $rows = [];
    foreach ($lignesIn as $i => $l) {
        if (!is_array($l)) {
            continue;
        }
        $lId = trim((string) val($l, 'id'));
        if ($lId === '') {
            $lId = $prestationId . '-ligne-' . ($i + 1);
        }
        $rows[] = [
            $lId,
            $prestationId,
            trim((string) val($l, 'code', '')),
            nullable_str(val($l, 'libelle')),
            num_or(val($l, 'totalPrestation') ?? val($l, 'montant'), 0.0),
            num_or(val($l, 'ticketModerateur'), 0.0),
            num_or(val($l, 'montantARembourser'), 0.0),
            num_or(val($l, 'totalPaye'), 0.0),
            num_or(val($l, 'montantExclu'), 0.0),
            nullable_str(val($l, 'motifExclusion')),
            trim((string) val($l, 'statut', 'En attente')) ?: 'En attente',
        ];
    }
    return $rows;
}

/** Colonnes de la table `lignes_prestation` (ordre d'insertion). */
function lignes_prestation_cols(): array
{
    return ['id', 'prestation_id', 'code', 'libelle', 'total_prestation', 'ticket_moderateur', 'montant_a_rembourser', 'total_paye', 'montant_exclu', 'motif_exclusion', 'statut'];
}

/** Enregistre (upsert) une prestation et ses lignes. */
function save_prestation(PDO $pdo, array $o): void
{
    $id          = trim((string) val($o, 'id'));
    $numero      = trim((string) val($o, 'numeroFacture'));
    $societeId   = trim((string) val($o, 'societeId'));
    $personneId  = trim((string) val($o, 'personneId'));
    if ($id === '') {
        throw new InvalidArgumentException('Prestation invalide : le champ « id » est obligatoire.');
    }
    if ($numero === '') {
        // Générer un numéro de facture par défaut si absent
        $numero = 'FACT-' . substr($id, 0, 8);
    }

    $brut  = num_or(val($o, 'totalPrestation') ?? val($o, 'montantTotal'), 0.0);
    $part  = num_or(val($o, 'participation') ?? val($o, 'ticketModerateur'), 0.0);
    $remb  = num_or(val($o, 'montantARembourser'), max(0.0, $brut - $part));
    $paye  = num_or(val($o, 'totalPaye'), 0.0);
    $exclu = num_or(val($o, 'montantExclu'), 0.0);
    $reste = num_or(val($o, 'resteAPayer'), max(0.0, $remb - $paye - $exclu));

    $inTx = $pdo->inTransaction();
    if (!$inTx) {
        $pdo->beginTransaction();
    }

    try {
        upsert_row($pdo, 'prestations', [
            'id'                   => $id,
            'numero_facture'       => $numero,
            'date'                 => nullable_str(val($o, 'date')),
            'societe_id'           => $societeId,
            'societe_nom'          => nullable_str(val($o, 'societeNom')),
            'sous_societe'         => nullable_str(val($o, 'sousSociete')),
            'personne_id'          => $personneId,
            'nom_agent'            => nullable_str(val($o, 'nomAgent')),
            'matricule'            => nullable_str(val($o, 'matricule')),
            'total_prestation'     => $brut,
            'participation'        => $part,
            'montant_a_rembourser' => $remb,
            'total_paye'           => $paye,
            'montant_exclu'        => $exclu,
            'motif_exclusion'      => nullable_str(val($o, 'motifExclusion')),
            'reste_a_payer'        => $reste,
            'statut'               => trim((string) val($o, 'statut', 'En attente')) ?: 'En attente',
            'date_creation'        => nullable_str(val($o, 'dateCreation')) ?: date('c'),
            'date_paiement'        => nullable_str(val($o, 'datePaiement')),
            'numero_bordereau'     => nullable_str(val($o, 'numeroBordereau')),
            'commentaires'         => nullable_str(val($o, 'commentaires')),
        ]);

        replace_child_rows(
            $pdo,
            'lignes_prestation',
            'prestation_id',
            $id,
            build_lignes_prestation_rows($o, $id),
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

/** Construit les lignes de la table `lignes_paiement` depuis les données reçues. */
function build_lignes_paiement_rows(array $o, string $paiementId): array
{
    $lignesIn = val($o, 'lignes');
    $lignesIn = is_array($lignesIn) ? array_values($lignesIn) : [];

    $rows = [];
    foreach ($lignesIn as $i => $l) {
        if (!is_array($l)) {
            continue;
        }
        $lId = trim((string) val($l, 'id'));
        if ($lId === '') {
            $lId = $paiementId . '-ligne-' . ($i + 1);
        }

        $actesPayes = val($l, 'actesPayes');
        $actesPayes = is_array($actesPayes) ? array_values($actesPayes) : [];

        $rows[] = [
            $lId,
            $paiementId,
            nullable_str(val($l, 'lignePrestationId')),
            nullable_str(val($l, 'prestationId')),
            nullable_str(val($l, 'immatriculation')),
            nullable_str(val($l, 'nomBaseAssurance')),
            nullable_str(val($l, 'nomAgent')),
            nullable_str(val($l, 'prestationNumero')),
            nullable_str(val($l, 'dateSoins')),
            num_or(val($l, 'totalPaye') ?? val($l, 'montantPaye'), 0.0),
            num_or(val($l, 'ticketModerateur'), 0.0),
            num_or(val($l, 'montantExclu'), 0.0),
            num_or(val($l, 'montantReclame'), 0.0),
            nullable_str(val($l, 'codeActe')),
            nullable_str(val($l, 'libelleActe')),
            (string) json_encode($actesPayes, JSON_UNESCAPED_UNICODE),
            nullable_str(val($l, 'commentaire')),
        ];
    }
    return $rows;
}

/** Colonnes de la table `lignes_paiement` (ordre d'insertion). */
function lignes_paiement_cols(): array
{
    return ['id', 'paiement_id', 'ligne_prestation_id', 'prestation_id', 'immatriculation', 'nom_base_assurance', 'nom_agent', 'prestation_numero', 'date_soins', 'total_paye', 'ticket_moderateur', 'montant_exclu', 'montant_reclame', 'code_acte', 'libelle_acte', 'actes_payes', 'commentaire'];
}

/** Enregistre (upsert) un paiement / bordereau et ses lignes. */
function save_paiement(PDO $pdo, array $o): void
{
    $id              = trim((string) val($o, 'id'));
    $numeroBordereau = trim((string) val($o, 'numeroBordereau'));
    $societeId       = trim((string) val($o, 'societeId'));
    if ($id === '') {
        throw new InvalidArgumentException('Paiement invalide : le champ « id » est obligatoire.');
    }
    if ($numeroBordereau === '') {
        $numeroBordereau = 'BRD-' . substr($id, 0, 8);
    }

    $inTx = $pdo->inTransaction();
    if (!$inTx) {
        $pdo->beginTransaction();
    }

    try {
        upsert_row($pdo, 'paiements', [
            'id'                => $id,
            'numero_bordereau'  => $numeroBordereau,
            'date_paiement'     => nullable_str(val($o, 'datePaiement')),
            'date_soins'        => nullable_str(val($o, 'dateSoins')),
            'date_saisie'       => nullable_str(val($o, 'dateSaisie')) ?: date('c'),
            'societe_id'        => $societeId,
            'societe_nom'       => nullable_str(val($o, 'societeNom')),
            'sous_societe'      => nullable_str(val($o, 'sousSociete')),
            'nom_agent'         => nullable_str(val($o, 'nomAgent')),
            'matricule'         => nullable_str(val($o, 'matricule')),
            'prestation_id'     => nullable_str(val($o, 'prestationId')),
            'prestation_numero' => nullable_str(val($o, 'prestationNumero')),
            'mode_paiement'     => nullable_str(val($o, 'modePaiement')),
            'reference_paiement' => nullable_str(val($o, 'referencePaiement')),
            'total_reclame'     => num_or(val($o, 'totalReclame') ?? val($o, 'montantAPayer'), 0.0),
            'total_paye'        => num_or(val($o, 'totalPaye') ?? val($o, 'sommePayee'), 0.0),
            'total_moderateur'  => num_or(val($o, 'totalModerateur') ?? val($o, 'ticketModerateur'), 0.0),
            'total_exclu'       => num_or(val($o, 'totalExclu') ?? val($o, 'montantExclu'), 0.0),
            'remise'            => num_or(val($o, 'remise'), 0.0),
            'statut'            => trim((string) val($o, 'statut', 'Validé')) ?: 'Validé',
            'notes'             => nullable_str(val($o, 'notes')),
        ]);

        replace_child_rows(
            $pdo,
            'lignes_paiement',
            'paiement_id',
            $id,
            build_lignes_paiement_rows($o, $id),
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

function handle_check_db(): void
{
    $tables = ['societes', 'personnes', 'familles', 'prestations', 'lignes_prestation', 'paiements', 'lignes_paiement'];

    try {
        $pdo = get_pdo();
    } catch (Throwable $e) {
        // Le serveur MySQL est injoignable / identifiants invalides :
        // l'application web affichera son écran de blocage.
        fail('Connexion MySQL impossible : ' . $e->getMessage());
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
        'success'  => true,
        'message'  => 'Connexion MySQL établie',
        'database' => WAMP_DB_NAME,
        'server'   => (string) $pdo->getAttribute(PDO::ATTR_SERVER_VERSION),
        'php'      => PHP_VERSION,
        'counts'   => $counts,
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

    $knownActions = ['societes', 'personnes', 'familles', 'prestations', 'paiements'];
    if (!in_array($action, $knownActions, true)) {
        fail(
            'Action inconnue : « ' . $action . ' ». Actions disponibles : check_db, ' . implode(', ', $knownActions) . '.',
            400
        );
    }

    $pdo = get_pdo();

    /* ------------------------------ GET ------------------------------ */
    if ($method === 'GET') {
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

        // Transaction unique pour tout le lot (import groupé)
        $pdo->beginTransaction();
        $saved = 0;
        $errors = [];
        foreach ($items as $idx => $item) {
            try {
                switch ($action) {
                    case 'societes':
                        save_societe($pdo, $item);
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
            } catch (InvalidArgumentException $e) {
                // Validation error — skip this item, continue with the rest
                $itemId = is_array($item) ? ($item['id'] ?? ('index-' . $idx)) : ('index-' . $idx);
                $errors[] = $itemId . ': ' . $e->getMessage();
            }
        }
        $pdo->commit();

        json_out([
            'success' => true,
            'message' => $saved . ' enregistrement(s) enregistré(s) avec succès.' . (count($errors) > 0 ? ' ' . count($errors) . ' ignoré(s).' : ''),
            'count'   => $saved,
            'total'   => count($items),
            'errors'  => $errors,
        ]);
    }

    /* ---------------------------- DELETE ----------------------------- */
    if ($method === 'DELETE') {
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
    // Rollback si une transaction est en cours
    try {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
    } catch (Throwable $ignored) {
        // ignore
    }
    fail('Erreur interne de l\'API : ' . $e->getMessage(), 500);
}
