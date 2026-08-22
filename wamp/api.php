<?php
/**
 * API PHP / MySQL utilisée par l'application lorsqu'elle est installée dans WAMP.
 *
 * Les réponses ont toujours la forme { success: boolean, data?: mixed, error?: string }.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/** @param mixed $data */
function suiviWampJsonResponse($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function suiviWampError(string $message, int $status = 400): void
{
    suiviWampJsonResponse([
        'success' => false,
        'error' => $message,
    ], $status);
}

/**
 * Récupère la première valeur présente dans un tableau de données JSON.
 * @param array<string, mixed> $data
 * @param string[] $keys
 * @param mixed $default
 * @return mixed
 */
function suiviWampValue(array $data, array $keys, $default = null)
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $data)) {
            return $data[$key];
        }
    }

    return $default;
}

/** @param mixed $value */
function suiviWampString($value, string $default = ''): string
{
    if ($value === null) {
        return $default;
    }

    return trim((string) $value);
}

/** @param mixed $value */
function suiviWampNullableString($value): ?string
{
    $value = suiviWampString($value);
    return $value === '' ? null : $value;
}

/** @param mixed $value */
function suiviWampNumber($value, float $default = 0.0): float
{
    if ($value === null || $value === '') {
        return $default;
    }

    if (is_int($value) || is_float($value)) {
        return is_finite((float) $value) ? (float) $value : $default;
    }

    $normalized = str_replace(["\xc2\xa0", ' '], '', (string) $value);
    $normalized = str_replace(',', '.', $normalized);
    $normalized = preg_replace('/[^0-9.\-]/', '', $normalized);
    $number = is_numeric($normalized) ? (float) $normalized : $default;

    return is_finite($number) ? $number : $default;
}

/** @param mixed $value */
function suiviWampJsonArray($value): array
{
    if (is_array($value)) {
        return $value;
    }

    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    $decoded = json_decode($value, true);
    if (is_array($decoded)) {
        return $decoded;
    }

    return array_values(array_filter(array_map('trim', explode(',', $value)), static function ($item) {
        return $item !== '';
    }));
}

/** @return array<string, mixed> */
function suiviWampReadJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        suiviWampError('Le corps de la requête JSON est invalide.', 422);
    }

    return $data;
}

/** @param array<string, mixed> $data */
function suiviWampRequiredId(array $data): string
{
    $id = suiviWampString(suiviWampValue($data, ['id']));
    if ($id === '') {
        throw new InvalidArgumentException("L'identifiant est obligatoire.");
    }

    return $id;
}

/**
 * Effectue un upsert compatible MySQL 5.7, MySQL 8 et MariaDB.
 * @param array<string, mixed> $values
 */
function suiviWampUpsert(PDO $pdo, string $table, array $values): void
{
    if ($values === []) {
        throw new InvalidArgumentException('Aucune donnée à enregistrer.');
    }

    $columns = array_keys($values);
    $quotedColumns = array_map(static function (string $column): string {
        return '`' . $column . '`';
    }, $columns);
    $placeholders = array_map(static function (string $column): string {
        return ':' . $column;
    }, $columns);
    $updates = array_map(static function (string $column): string {
        return '`' . $column . '` = VALUES(`' . $column . '`)';
    }, $columns);

    $sql = sprintf(
        'INSERT INTO `%s` (%s) VALUES (%s) ON DUPLICATE KEY UPDATE %s',
        $table,
        implode(', ', $quotedColumns),
        implode(', ', $placeholders),
        implode(', ', $updates)
    );

    $statement = $pdo->prepare($sql);
    foreach ($values as $column => $value) {
        $statement->bindValue(':' . $column, $value);
    }
    $statement->execute();
}

/**
 * Permet de rester compatible avec une base créée avec une ancienne version du
 * schéma, avant l'ajout de la conservation des actes regroupés.
 */
function suiviWampHasColumn(PDO $pdo, string $table, string $column): bool
{
    static $cache = [];
    $cacheKey = $table . '.' . $column;

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM `information_schema`.`COLUMNS` ' .
        'WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = :table_name AND `COLUMN_NAME` = :column_name'
    );
    $statement->execute([
        ':table_name' => $table,
        ':column_name' => $column,
    ]);

    $cache[$cacheKey] = ((int) $statement->fetchColumn()) > 0;
    return $cache[$cacheKey];
}

/** @param array<string, mixed> $data */
function suiviWampSaveSociete(PDO $pdo, array $data): string
{
    $id = suiviWampRequiredId($data);
    $nom = suiviWampString(suiviWampValue($data, ['nom']));
    if ($nom === '') {
        throw new InvalidArgumentException('Le nom de la société est obligatoire.');
    }

    suiviWampUpsert($pdo, 'societes', [
        'id' => $id,
        'nom' => $nom,
        'code' => suiviWampString(suiviWampValue($data, ['code']), $nom),
        'contact' => suiviWampNullableString(suiviWampValue($data, ['contact'])),
        'telephone' => suiviWampNullableString(suiviWampValue($data, ['telephone'])),
        'email' => suiviWampNullableString(suiviWampValue($data, ['email'])),
        'adresse' => suiviWampNullableString(suiviWampValue($data, ['adresse'])),
        'taux_couverture_defaut' => suiviWampNumber(suiviWampValue($data, ['tauxCouvertureDefaut']), 80),
    ]);

    return $id;
}

/** @param array<string, mixed> $data */
function suiviWampSavePersonne(PDO $pdo, array $data): string
{
    $id = suiviWampRequiredId($data);
    $nom = suiviWampString(suiviWampValue($data, ['nomPrenom', 'nom_prenom']));
    if ($nom === '') {
        throw new InvalidArgumentException("Le nom de l'assuré est obligatoire.");
    }

    suiviWampUpsert($pdo, 'personnes', [
        'id' => $id,
        'nom_prenom' => $nom,
        'matricule' => suiviWampString(suiviWampValue($data, ['matricule'])),
        'societe_id' => suiviWampString(suiviWampValue($data, ['societeId', 'societe_id'])),
        'sous_societe' => suiviWampNullableString(suiviWampValue($data, ['sousSociete', 'sous_societe'])),
        'qualite' => suiviWampNullableString(suiviWampValue($data, ['qualite'])),
        'famille_code' => suiviWampNullableString(suiviWampValue($data, ['familleCode', 'famille_code'])),
        'date_naissance' => suiviWampNullableString(suiviWampValue($data, ['dateNaissance', 'date_naissance'])),
        'telephone' => suiviWampNullableString(suiviWampValue($data, ['telephone'])),
        'email' => suiviWampNullableString(suiviWampValue($data, ['email'])),
        'taux_couverture' => suiviWampValue($data, ['tauxCouverture', 'taux_couverture']) === null
            ? null
            : suiviWampNumber(suiviWampValue($data, ['tauxCouverture', 'taux_couverture'])),
        'statut' => suiviWampString(suiviWampValue($data, ['statut']), 'Actif'),
    ]);

    return $id;
}

/** @param array<string, mixed> $data */
function suiviWampSaveFamille(PDO $pdo, array $data): string
{
    $id = suiviWampRequiredId($data);
    $code = suiviWampString(suiviWampValue($data, ['code']));
    $libelle = suiviWampString(suiviWampValue($data, ['libelle']));
    if ($code === '' || $libelle === '') {
        throw new InvalidArgumentException('Le code et le libellé de l’acte sont obligatoires.');
    }

    $aliases = suiviWampJsonArray(suiviWampValue($data, ['aliases']));

    suiviWampUpsert($pdo, 'familles', [
        'id' => $id,
        'code' => $code,
        'libelle' => $libelle,
        'plafond_annuel' => suiviWampValue($data, ['plafondAnnuel', 'plafond_annuel']) === null
            ? null
            : suiviWampNumber(suiviWampValue($data, ['plafondAnnuel', 'plafond_annuel'])),
        'taux_standard' => suiviWampValue($data, ['tauxStandard', 'taux_standard']) === null
            ? null
            : suiviWampNumber(suiviWampValue($data, ['tauxStandard', 'taux_standard'])),
        'tarif_conventionne' => suiviWampValue($data, ['tarifConventionne', 'tarif_conventionne']) === null
            ? null
            : suiviWampNumber(suiviWampValue($data, ['tarifConventionne', 'tarif_conventionne'])),
        'ticket_moderateur_defaut' => suiviWampValue($data, ['ticketModerateurDefaut', 'ticket_moderateur_defaut']) === null
            ? null
            : suiviWampNumber(suiviWampValue($data, ['ticketModerateurDefaut', 'ticket_moderateur_defaut'])),
        'description' => suiviWampNullableString(suiviWampValue($data, ['description'])),
        'aliases' => json_encode(array_values($aliases), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    return $id;
}

/** @param array<string, mixed> $data */
function suiviWampSavePrestation(PDO $pdo, array $data): string
{
    $id = suiviWampRequiredId($data);
    $total = suiviWampNumber(suiviWampValue($data, ['totalPrestation', 'montantTotal']), 0);
    $participation = suiviWampNumber(suiviWampValue($data, ['participation', 'ticketModerateur']), 0);
    $remboursementValue = suiviWampValue($data, ['montantARembourser']);
    $remboursement = ($remboursementValue === null || $remboursementValue === '')
        ? max(0, $total - $participation)
        : suiviWampNumber($remboursementValue);
    $paye = suiviWampNumber(suiviWampValue($data, ['totalPaye']), 0);
    $resteValue = suiviWampValue($data, ['resteAPayer']);
    $reste = ($resteValue === null || $resteValue === '')
        ? max(0, $remboursement - $paye)
        : suiviWampNumber($resteValue);

    suiviWampUpsert($pdo, 'prestations', [
        'id' => $id,
        'numero_facture' => suiviWampString(suiviWampValue($data, ['numeroFacture'])),
        'date' => suiviWampNullableString(suiviWampValue($data, ['date'])),
        'societe_id' => suiviWampString(suiviWampValue($data, ['societeId', 'societe_id'])),
        'societe_nom' => suiviWampNullableString(suiviWampValue($data, ['societeNom', 'societe_nom'])),
        'sous_societe' => suiviWampNullableString(suiviWampValue($data, ['sousSociete', 'sous_societe'])),
        'personne_id' => suiviWampString(suiviWampValue($data, ['personneId', 'personne_id'])),
        'nom_agent' => suiviWampNullableString(suiviWampValue($data, ['nomAgent', 'nom_agent'])),
        'matricule' => suiviWampNullableString(suiviWampValue($data, ['matricule'])),
        'total_prestation' => $total,
        'participation' => $participation,
        'montant_a_rembourser' => $remboursement,
        'total_paye' => $paye,
        'reste_a_payer' => $reste,
        'statut' => suiviWampString(suiviWampValue($data, ['statut']), 'En attente'),
        'date_creation' => suiviWampNullableString(suiviWampValue($data, ['dateCreation', 'date_creation'])),
        'commentaires' => suiviWampNullableString(suiviWampValue($data, ['commentaires'])),
    ]);

    if (array_key_exists('lignes', $data) && is_array($data['lignes'])) {
        $delete = $pdo->prepare('DELETE FROM `lignes_prestation` WHERE `prestation_id` = :prestation_id');
        $delete->execute([':prestation_id' => $id]);

        foreach ($data['lignes'] as $line) {
            if (!is_array($line)) {
                continue;
            }

            $lineId = suiviWampString(suiviWampValue($line, ['id']));
            if ($lineId === '') {
                $lineId = uniqid('lig-', true);
            }

            $lineTotal = suiviWampNumber(suiviWampValue($line, ['totalPrestation', 'montant']), 0);
            $lineParticipation = suiviWampNumber(suiviWampValue($line, ['ticketModerateur']), 0);
            $lineRembValue = suiviWampValue($line, ['montantARembourser']);
            $lineRemb = ($lineRembValue === null || $lineRembValue === '')
                ? max(0, $lineTotal - $lineParticipation)
                : suiviWampNumber($lineRembValue);

            suiviWampUpsert($pdo, 'lignes_prestation', [
                'id' => $lineId,
                'prestation_id' => $id,
                'code' => suiviWampString(suiviWampValue($line, ['code']), 'CONS'),
                'libelle' => suiviWampNullableString(suiviWampValue($line, ['libelle'])),
                'total_prestation' => $lineTotal,
                'ticket_moderateur' => $lineParticipation,
                'montant_a_rembourser' => $lineRemb,
                'total_paye' => suiviWampNumber(suiviWampValue($line, ['totalPaye', 'montantPaye']), 0),
                'statut' => suiviWampString(suiviWampValue($line, ['statut']), 'En attente'),
            ]);
        }
    }

    return $id;
}

/** @param array<string, mixed> $data */
function suiviWampSavePaiement(PDO $pdo, array $data): string
{
    $id = suiviWampRequiredId($data);
    $totalReclame = suiviWampNumber(suiviWampValue($data, ['totalReclame', 'montantAPayer']), 0);
    $totalPaye = suiviWampNumber(suiviWampValue($data, ['totalPaye', 'sommePayee']), 0);
    $totalModerateur = suiviWampNumber(suiviWampValue($data, ['totalModerateur', 'ticketModerateur']), 0);
    $totalExclu = suiviWampNumber(suiviWampValue($data, ['totalExclu', 'montantExclu']), 0);

    suiviWampUpsert($pdo, 'paiements', [
        'id' => $id,
        'numero_bordereau' => suiviWampString(suiviWampValue($data, ['numeroBordereau'])),
        'date_paiement' => suiviWampNullableString(suiviWampValue($data, ['datePaiement'])),
        'date_soins' => suiviWampNullableString(suiviWampValue($data, ['dateSoins'])),
        'date_saisie' => suiviWampNullableString(suiviWampValue($data, ['dateSaisie'])),
        'societe_id' => suiviWampString(suiviWampValue($data, ['societeId', 'societe_id'])),
        'societe_nom' => suiviWampNullableString(suiviWampValue($data, ['societeNom', 'societe_nom'])),
        'sous_societe' => suiviWampNullableString(suiviWampValue($data, ['sousSociete', 'sous_societe'])),
        'nom_agent' => suiviWampNullableString(suiviWampValue($data, ['nomAgent', 'nom_agent'])),
        'matricule' => suiviWampNullableString(suiviWampValue($data, ['matricule'])),
        'prestation_id' => suiviWampNullableString(suiviWampValue($data, ['prestationId', 'prestation_id'])),
        'prestation_numero' => suiviWampNullableString(suiviWampValue($data, ['prestationNumero', 'prestation_numero'])),
        'mode_paiement' => suiviWampNullableString(suiviWampValue($data, ['modePaiement', 'mode_paiement'])) ?: 'Autre',
        'reference_paiement' => suiviWampString(suiviWampValue($data, ['referencePaiement', 'reference_paiement'])),
        'total_reclame' => $totalReclame,
        'total_paye' => $totalPaye,
        'total_moderateur' => $totalModerateur,
        'total_exclu' => $totalExclu,
        'remise' => suiviWampNumber(suiviWampValue($data, ['remise']), 0),
        'statut' => suiviWampString(suiviWampValue($data, ['statut']), 'Validé'),
        'notes' => suiviWampNullableString(suiviWampValue($data, ['notes'])),
    ]);

    if (array_key_exists('lignes', $data) && is_array($data['lignes'])) {
        $delete = $pdo->prepare('DELETE FROM `lignes_paiement` WHERE `paiement_id` = :paiement_id');
        $delete->execute([':paiement_id' => $id]);

        foreach ($data['lignes'] as $line) {
            if (!is_array($line)) {
                continue;
            }

            $lineId = suiviWampString(suiviWampValue($line, ['id']));
            if ($lineId === '') {
                $lineId = uniqid('lp-', true);
            }

            $linePaye = suiviWampNumber(suiviWampValue($line, ['totalPaye', 'montantPaye']), 0);
            $lineModerateur = suiviWampNumber(suiviWampValue($line, ['ticketModerateur']), 0);
            $lineReclameValue = suiviWampValue($line, ['montantReclame']);
            $lineReclame = ($lineReclameValue === null || $lineReclameValue === '')
                ? $linePaye + $lineModerateur
                : suiviWampNumber($lineReclameValue);
            $acts = suiviWampJsonArray(suiviWampValue($line, ['actesPayes']));

            $lineValues = [
                'id' => $lineId,
                'paiement_id' => $id,
                'ligne_prestation_id' => suiviWampNullableString(suiviWampValue($line, ['lignePrestationId', 'ligne_prestation_id'])),
                'prestation_id' => suiviWampNullableString(suiviWampValue($line, ['prestationId', 'prestation_id'])),
                'immatriculation' => suiviWampNullableString(suiviWampValue($line, ['immatriculation'])),
                'nom_base_assurance' => suiviWampNullableString(suiviWampValue($line, ['nomBaseAssurance', 'nom_base_assurance'])),
                'nom_agent' => suiviWampNullableString(suiviWampValue($line, ['nomAgent', 'nom_agent'])),
                'prestation_numero' => suiviWampNullableString(suiviWampValue($line, ['prestationNumero', 'prestation_numero'])),
                'date_soins' => suiviWampNullableString(suiviWampValue($line, ['dateSoins', 'date_soins'])),
                'total_paye' => $linePaye,
                'ticket_moderateur' => $lineModerateur,
                'montant_exclu' => suiviWampNumber(suiviWampValue($line, ['montantExclu']), 0),
                'montant_reclame' => $lineReclame,
                'code_acte' => suiviWampNullableString(suiviWampValue($line, ['codeActe', 'code_acte'])),
                'libelle_acte' => suiviWampNullableString(suiviWampValue($line, ['libelleActe', 'libelle_acte'])),
                'commentaire' => suiviWampNullableString(suiviWampValue($line, ['commentaire'])),
            ];

            if (suiviWampHasColumn($pdo, 'lignes_paiement', 'actes_payes')) {
                $lineValues['actes_payes'] = json_encode(
                    array_values($acts),
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                );
            }

            suiviWampUpsert($pdo, 'lignes_paiement', $lineValues);
        }
    }

    return $id;
}

/** @return array<string, mixed> */
function suiviWampMapSociete(array $row): array
{
    return [
        'id' => suiviWampString($row['id'] ?? ''),
        'nom' => suiviWampString($row['nom'] ?? ''),
        'code' => suiviWampString($row['code'] ?? ''),
        'contact' => suiviWampString($row['contact'] ?? ''),
        'telephone' => suiviWampString($row['telephone'] ?? ''),
        'email' => suiviWampString($row['email'] ?? ''),
        'adresse' => suiviWampString($row['adresse'] ?? ''),
        'tauxCouvertureDefaut' => suiviWampNumber($row['taux_couverture_defaut'] ?? 80, 80),
    ];
}

/** @return array<string, mixed> */
function suiviWampMapPersonne(array $row): array
{
    $taux = $row['taux_couverture'] ?? null;

    return [
        'id' => suiviWampString($row['id'] ?? ''),
        'nomPrenom' => suiviWampString($row['nom_prenom'] ?? ''),
        'matricule' => suiviWampString($row['matricule'] ?? ''),
        'societeId' => suiviWampString($row['societe_id'] ?? ''),
        'sousSociete' => suiviWampString($row['sous_societe'] ?? ''),
        'qualite' => suiviWampString($row['qualite'] ?? ''),
        'familleCode' => suiviWampString($row['famille_code'] ?? ''),
        'dateNaissance' => suiviWampString($row['date_naissance'] ?? ''),
        'telephone' => suiviWampString($row['telephone'] ?? ''),
        'email' => suiviWampString($row['email'] ?? ''),
        'tauxCouverture' => $taux === null ? null : suiviWampNumber($taux),
        'statut' => suiviWampString($row['statut'] ?? 'Actif', 'Actif'),
    ];
}

/** @return array<string, mixed> */
function suiviWampMapFamille(array $row): array
{
    return [
        'id' => suiviWampString($row['id'] ?? ''),
        'code' => suiviWampString($row['code'] ?? ''),
        'libelle' => suiviWampString($row['libelle'] ?? ''),
        'plafondAnnuel' => ($row['plafond_annuel'] ?? null) === null ? null : suiviWampNumber($row['plafond_annuel']),
        'tauxStandard' => ($row['taux_standard'] ?? null) === null ? null : suiviWampNumber($row['taux_standard']),
        'tarifConventionne' => ($row['tarif_conventionne'] ?? null) === null ? null : suiviWampNumber($row['tarif_conventionne']),
        'ticketModerateurDefaut' => ($row['ticket_moderateur_defaut'] ?? null) === null ? null : suiviWampNumber($row['ticket_moderateur_defaut']),
        'description' => suiviWampString($row['description'] ?? ''),
        'aliases' => array_values(suiviWampJsonArray($row['aliases'] ?? '[]')),
    ];
}

/** @param array<string, mixed> $row */
function suiviWampMapLignePrestation(array $row): array
{
    $total = suiviWampNumber($row['total_prestation'] ?? 0);
    $part = suiviWampNumber($row['ticket_moderateur'] ?? 0);
    $remb = suiviWampNumber($row['montant_a_rembourser'] ?? max(0, $total - $part));

    return [
        'id' => suiviWampString($row['id'] ?? ''),
        'prestationId' => suiviWampString($row['prestation_id'] ?? ''),
        'code' => suiviWampString($row['code'] ?? 'CONS', 'CONS'),
        'libelle' => suiviWampString($row['libelle'] ?? ''),
        'totalPrestation' => $total,
        'montant' => $total,
        'ticketModerateur' => $part,
        'montantARembourser' => $remb,
        'totalPaye' => suiviWampNumber($row['total_paye'] ?? 0),
        'statut' => suiviWampString($row['statut'] ?? 'En attente', 'En attente'),
    ];
}

/** @param array<string, mixed> $row */
function suiviWampMapPrestation(array $row, array $lines): array
{
    $total = suiviWampNumber($row['total_prestation'] ?? 0);
    $part = suiviWampNumber($row['participation'] ?? 0);
    $remb = suiviWampNumber($row['montant_a_rembourser'] ?? max(0, $total - $part));
    $paye = suiviWampNumber($row['total_paye'] ?? 0);

    return [
        'id' => suiviWampString($row['id'] ?? ''),
        'numeroFacture' => suiviWampString($row['numero_facture'] ?? ''),
        'date' => suiviWampString($row['date'] ?? ''),
        'societeId' => suiviWampString($row['societe_id'] ?? ''),
        'societeNom' => suiviWampString($row['societe_nom'] ?? ''),
        'sousSociete' => suiviWampString($row['sous_societe'] ?? ''),
        'personneId' => suiviWampString($row['personne_id'] ?? ''),
        'nomAgent' => suiviWampString($row['nom_agent'] ?? ''),
        'matricule' => suiviWampString($row['matricule'] ?? ''),
        'totalPrestation' => $total,
        'montantTotal' => $total,
        'participation' => $part,
        'ticketModerateur' => $part,
        'montantARembourser' => $remb,
        'totalPaye' => $paye,
        'resteAPayer' => suiviWampNumber($row['reste_a_payer'] ?? max(0, $remb - $paye)),
        'statut' => suiviWampString($row['statut'] ?? 'En attente', 'En attente'),
        'lignes' => $lines,
        'dateCreation' => suiviWampString($row['date_creation'] ?? ''),
        'commentaires' => suiviWampString($row['commentaires'] ?? ''),
    ];
}

/** @param array<string, mixed> $row */
function suiviWampMapLignePaiement(array $row): array
{
    $paye = suiviWampNumber($row['total_paye'] ?? 0);
    $part = suiviWampNumber($row['ticket_moderateur'] ?? 0);
    $acts = suiviWampJsonArray($row['actes_payes'] ?? '[]');
    if ($acts === [] && suiviWampString($row['code_acte'] ?? '') !== '') {
        $acts = [[
            'code' => suiviWampString($row['code_acte']),
            'libelle' => suiviWampString($row['libelle_acte'] ?? suiviWampString($row['code_acte'])),
            'montant' => $paye,
        ]];
    }

    return [
        'id' => suiviWampString($row['id'] ?? ''),
        'paiementId' => suiviWampString($row['paiement_id'] ?? ''),
        'lignePrestationId' => suiviWampString($row['ligne_prestation_id'] ?? ''),
        'prestationId' => suiviWampString($row['prestation_id'] ?? ''),
        'immatriculation' => suiviWampString($row['immatriculation'] ?? ''),
        'nomBaseAssurance' => suiviWampString($row['nom_base_assurance'] ?? ''),
        'nomAgent' => suiviWampString($row['nom_agent'] ?? ''),
        'prestationNumero' => suiviWampString($row['prestation_numero'] ?? ''),
        'dateSoins' => suiviWampString($row['date_soins'] ?? ''),
        'totalPaye' => $paye,
        'montantPaye' => $paye,
        'ticketModerateur' => $part,
        'montantExclu' => suiviWampNumber($row['montant_exclu'] ?? 0),
        'montantReclame' => suiviWampNumber($row['montant_reclame'] ?? ($paye + $part)),
        'codeActe' => suiviWampString($row['code_acte'] ?? ''),
        'libelleActe' => suiviWampString($row['libelle_acte'] ?? ''),
        'actesPayes' => array_values($acts),
        'commentaire' => suiviWampString($row['commentaire'] ?? ''),
    ];
}

/** @param array<string, mixed> $row */
function suiviWampMapPaiement(array $row, array $lines): array
{
    return [
        'id' => suiviWampString($row['id'] ?? ''),
        'numeroBordereau' => suiviWampString($row['numero_bordereau'] ?? ''),
        'datePaiement' => suiviWampString($row['date_paiement'] ?? ''),
        'dateSoins' => suiviWampString($row['date_soins'] ?? ''),
        'dateSaisie' => suiviWampString($row['date_saisie'] ?? ''),
        'societeId' => suiviWampString($row['societe_id'] ?? ''),
        'societeNom' => suiviWampString($row['societe_nom'] ?? ''),
        'sousSociete' => suiviWampString($row['sous_societe'] ?? ''),
        'nomAgent' => suiviWampString($row['nom_agent'] ?? ''),
        'matricule' => suiviWampString($row['matricule'] ?? ''),
        'prestationId' => suiviWampString($row['prestation_id'] ?? ''),
        'prestationNumero' => suiviWampString($row['prestation_numero'] ?? ''),
        'modePaiement' => suiviWampString($row['mode_paiement'] ?? 'Autre', 'Autre'),
        'referencePaiement' => suiviWampString($row['reference_paiement'] ?? ''),
        'totalReclame' => suiviWampNumber($row['total_reclame'] ?? 0),
        'montantAPayer' => suiviWampNumber($row['total_reclame'] ?? 0),
        'totalPaye' => suiviWampNumber($row['total_paye'] ?? 0),
        'sommePayee' => suiviWampNumber($row['total_paye'] ?? 0),
        'totalModerateur' => suiviWampNumber($row['total_moderateur'] ?? 0),
        'ticketModerateur' => suiviWampNumber($row['total_moderateur'] ?? 0),
        'totalExclu' => suiviWampNumber($row['total_exclu'] ?? 0),
        'montantExclu' => suiviWampNumber($row['total_exclu'] ?? 0),
        'remise' => suiviWampNumber($row['remise'] ?? 0),
        'statut' => suiviWampString($row['statut'] ?? 'Validé', 'Validé'),
        'lignes' => $lines,
        'notes' => suiviWampString($row['notes'] ?? ''),
    ];
}

/**
 * Génère un diagnostic complet de l'installation WAMP : version de PHP,
 * extension MySQL, serveur web, connexion et contenu de la base.
 *
 * Accessible via : api.php?action=diagnostic
 *
 * @return array<string, mixed>
 */
function suiviWampDiagnostic(): array
{
    $checks = [];
    $ok = true;

    // 1) Version de PHP — le connecteur exige PHP 7.1 minimum.
    $phpOk = version_compare(PHP_VERSION, '7.1.0', '>=');
    $checks[] = [
        'check' => 'Version PHP',
        'ok' => $phpOk,
        'detail' => 'PHP ' . PHP_VERSION . ' détecté. Version minimale requise : PHP 7.1 (PHP 7.4 ou supérieur recommandé). '
            . 'En cas de problème, changez la version via l\'icône WAMP → Apache → Version.',
    ];
    $ok = $ok && $phpOk;

    // 2) Extension PDO MySQL.
    $pdoOk = extension_loaded('pdo_mysql');
    $checks[] = [
        'check' => 'Extension PHP pdo_mysql',
        'ok' => $pdoOk,
        'detail' => $pdoOk
            ? 'L\'extension pdo_mysql est activée.'
            : 'L\'extension pdo_mysql est absente. Activez-la via l\'icône WAMP → Apache → Modules → pdo_mysql (puis redémarrez Apache).',
    ];
    $ok = $ok && $pdoOk;

    // 3) Serveur web (Apache attendu avec WAMP).
    $serverSoftware = suiviWampString($_SERVER['SERVER_SOFTWARE'] ?? '');
    $checks[] = [
        'check' => 'Serveur web',
        'ok' => $serverSoftware !== '',
        'detail' => $serverSoftware !== ''
            ? $serverSoftware
            : 'Serveur web inconnu (le fichier est probablement exécuté hors Apache : ouvrez la page via http://localhost/...).',
    ];

    // 4) Connexion MySQL puis état de la base et des tables.
    $database = [
        'connected' => false,
        'host' => SUIVI_DB_HOST,
        'port' => SUIVI_DB_PORT,
        'name' => SUIVI_DB_NAME,
        'user' => SUIVI_DB_USER,
    ];

    try {
        $pdo = suiviWampPdo();
        $pdo->query('SELECT 1');
        $database['connected'] = true;
        $database['serverVersion'] = suiviWampString($pdo->getAttribute(PDO::ATTR_SERVER_VERSION));

        $expectedTables = [
            'societes',
            'personnes',
            'familles',
            'prestations',
            'lignes_prestation',
            'paiements',
            'lignes_paiement',
        ];

        $statement = $pdo->query('SHOW TABLES');
        $existingTables = array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));

        $missingTables = array_values(array_diff($expectedTables, $existingTables));
        $database['missingTables'] = $missingTables;

        $tablesOk = $missingTables === [];
        $checks[] = [
            'check' => 'Base de données « ' . SUIVI_DB_NAME . ' »',
            'ok' => $tablesOk,
            'detail' => $tablesOk
                ? 'Connexion réussie et les 7 tables sont présentes.'
                : 'Connexion réussie mais tables manquantes : ' . implode(', ', $missingTables)
                    . '. Importez le fichier schema_wamp.sql dans phpMyAdmin (onglet Importer).',
        ];
        $ok = $ok && $tablesOk;

        // 5) Contenu de la base (utile pour distinguer une base vide d'un problème d'accès).
        $counts = [];
        foreach ($expectedTables as $table) {
            if (in_array($table, $existingTables, true)) {
                $count = $pdo->query('SELECT COUNT(*) FROM `' . $table . '`');
                $counts[$table] = (int) $count->fetchColumn();
            }
        }
        $database['rowCounts'] = $counts;
    } catch (Throwable $error) {
        $database['error'] = $error->getMessage();
        $checks[] = [
            'check' => 'Connexion MySQL',
            'ok' => false,
            'detail' => 'Connexion impossible sur ' . SUIVI_DB_HOST . ':' . SUIVI_DB_PORT
                . ' avec l\'utilisateur « ' . SUIVI_DB_USER . ' ». Vérifiez que le service MySQL est démarré '
                . '(icône WAMP verte), que le port est correct (3306 par défaut, parfois 3308) et que le mot de passe '
                . 'dans config.php correspond à votre installation. Erreur : ' . $error->getMessage(),
        ];
        $ok = false;
    }

    return [
        'ok' => $ok,
        'checks' => $checks,
        'database' => $database,
        'timestamp' => gmdate('c'),
    ];
}

/**
 * Lit une collection complète en la convertissant dans le format camelCase attendu par React.
 * @return array<int, mixed>
 */
function suiviWampFetchAction(PDO $pdo, string $action): array
{
    if ($action === 'societes') {
        $rows = $pdo->query('SELECT * FROM `societes` ORDER BY `nom` ASC')->fetchAll();
        return array_map('suiviWampMapSociete', $rows);
    }

    if ($action === 'personnes') {
        $rows = $pdo->query('SELECT * FROM `personnes` ORDER BY `nom_prenom` ASC')->fetchAll();
        return array_map('suiviWampMapPersonne', $rows);
    }

    if ($action === 'familles') {
        $rows = $pdo->query('SELECT * FROM `familles` ORDER BY `code` ASC')->fetchAll();
        return array_map('suiviWampMapFamille', $rows);
    }

    if ($action === 'prestations') {
        $parents = $pdo->query('SELECT * FROM `prestations` ORDER BY `date` DESC, `id` DESC')->fetchAll();
        $lineRows = $pdo->query('SELECT * FROM `lignes_prestation` ORDER BY `id` ASC')->fetchAll();
        $linesByParent = [];

        foreach ($lineRows as $line) {
            $parentId = suiviWampString($line['prestation_id'] ?? '');
            if (!isset($linesByParent[$parentId])) {
                $linesByParent[$parentId] = [];
            }
            $linesByParent[$parentId][] = suiviWampMapLignePrestation($line);
        }

        $result = [];
        foreach ($parents as $parent) {
            $id = suiviWampString($parent['id'] ?? '');
            $result[] = suiviWampMapPrestation($parent, $linesByParent[$id] ?? []);
        }
        return $result;
    }

    if ($action === 'paiements') {
        $parents = $pdo->query('SELECT * FROM `paiements` ORDER BY `date_paiement` DESC, `id` DESC')->fetchAll();
        $lineRows = $pdo->query('SELECT * FROM `lignes_paiement` ORDER BY `id` ASC')->fetchAll();
        $linesByParent = [];

        foreach ($lineRows as $line) {
            $parentId = suiviWampString($line['paiement_id'] ?? '');
            if (!isset($linesByParent[$parentId])) {
                $linesByParent[$parentId] = [];
            }
            $linesByParent[$parentId][] = suiviWampMapLignePaiement($line);
        }

        $result = [];
        foreach ($parents as $parent) {
            $id = suiviWampString($parent['id'] ?? '');
            $result[] = suiviWampMapPaiement($parent, $linesByParent[$id] ?? []);
        }
        return $result;
    }

    throw new InvalidArgumentException('Action WAMP inconnue.');
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = strtolower(suiviWampString($_GET['action'] ?? ''));
$actions = ['societes', 'personnes', 'familles', 'prestations', 'paiements', 'health', 'diagnostic'];

if (!in_array($action, $actions, true)) {
    suiviWampError('Action WAMP inconnue.', 404);
}

// Le diagnostic s'exécute sans connexion préalable : il doit rester utilisable
// même lorsque MySQL n'est pas démarré ou mal configuré.
if ($action === 'diagnostic') {
    suiviWampJsonResponse([
        'success' => true,
        'data' => suiviWampDiagnostic(),
    ]);
}

try {
    $pdo = suiviWampPdo();

    if ($action === 'health') {
        $pdo->query('SELECT 1');
        suiviWampJsonResponse([
            'success' => true,
            'data' => [
                'status' => 'ok',
                'database' => 'connected',
                'timestamp' => gmdate('c'),
            ],
        ]);
    }

    if ($method === 'GET') {
        suiviWampJsonResponse([
            'success' => true,
            'data' => suiviWampFetchAction($pdo, $action),
        ]);
    }

    if ($method === 'POST') {
        $data = suiviWampReadJsonBody();
        $pdo->beginTransaction();

        try {
            switch ($action) {
                case 'societes':
                    $id = suiviWampSaveSociete($pdo, $data);
                    break;
                case 'personnes':
                    $id = suiviWampSavePersonne($pdo, $data);
                    break;
                case 'familles':
                    $id = suiviWampSaveFamille($pdo, $data);
                    break;
                case 'prestations':
                    $id = suiviWampSavePrestation($pdo, $data);
                    break;
                case 'paiements':
                    $id = suiviWampSavePaiement($pdo, $data);
                    break;
                default:
                    throw new InvalidArgumentException('Cette action ne peut pas être enregistrée.');
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }

        suiviWampJsonResponse([
            'success' => true,
            'data' => ['id' => $id],
        ]);
    }

    if ($method === 'DELETE') {
        $id = suiviWampString($_GET['id'] ?? '');
        if ($id === '') {
            suiviWampError("L'identifiant à supprimer est obligatoire.", 422);
        }

        $pdo->beginTransaction();
        try {
            if ($action === 'prestations') {
                $lineDelete = $pdo->prepare('DELETE FROM `lignes_prestation` WHERE `prestation_id` = :id');
                $lineDelete->execute([':id' => $id]);
                $table = 'prestations';
            } elseif ($action === 'paiements') {
                $lineDelete = $pdo->prepare('DELETE FROM `lignes_paiement` WHERE `paiement_id` = :id');
                $lineDelete->execute([':id' => $id]);
                $table = 'paiements';
            } elseif (in_array($action, ['societes', 'personnes', 'familles'], true)) {
                $table = $action;
            } else {
                throw new InvalidArgumentException('Cette action ne peut pas être supprimée.');
            }

            $delete = $pdo->prepare('DELETE FROM `' . $table . '` WHERE `id` = :id');
            $delete->execute([':id' => $id]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }

        suiviWampJsonResponse([
            'success' => true,
            'data' => ['id' => $id],
        ]);
    }

    suiviWampError('Méthode HTTP non supportée.', 405);
} catch (InvalidArgumentException $error) {
    suiviWampError($error->getMessage(), 422);
} catch (PDOException $error) {
    error_log('[suivi_assurance WAMP] ' . $error->getMessage());
    suiviWampError(
        'Connexion ou requête MySQL impossible. Vérifiez que WAMP, Apache et MySQL sont démarrés et que la base suivi_assurance_salfa a été importée. '
        . 'Ouvrez api.php?action=diagnostic pour identifier précisément le problème.',
        503
    );
} catch (Throwable $error) {
    error_log('[suivi_assurance WAMP] ' . $error->getMessage());
    suiviWampError('Une erreur interne est survenue dans le connecteur WAMP.', 500);
}
