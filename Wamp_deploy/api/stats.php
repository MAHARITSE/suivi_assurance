<?php
/**
 * API REST Statistiques & KPIs Financiers
 * GET /api/stats.php?societeId=...
 */
require_once __DIR__ . '/../config.php';
$pdo = getPDO();

$societeId = $_GET['societeId'] ?? 'ALL';

$wherePrest = [];
$paramsPrest = [];
$wherePai = [];
$paramsPai = [];

if ($societeId !== 'ALL' && !empty($societeId)) {
    $wherePrest[] = "societe_id = ?";
    $paramsPrest[] = $societeId;
    $wherePai[] = "societe_id = ?";
    $paramsPai[] = $societeId;
}

$wherePrestSql = count($wherePrest) > 0 ? "WHERE " . implode(" AND ", $wherePrest) : "";
$wherePaiSql = count($wherePai) > 0 ? "WHERE " . implode(" AND ", $wherePai) : "";

// 1. Totaux Prestations
$stmtPrest = $pdo->prepare("SELECT 
    COUNT(*) as totalDossiers,
    COALESCE(SUM(total_prestation), 0) as totalReclame,
    COALESCE(SUM(participation), 0) as totalTicketModerateurPrest,
    COALESCE(SUM(montant_a_rembourser), 0) as totalARembourser,
    COALESCE(SUM(reste_a_payer), 0) as totalResteAPayer,
    COUNT(CASE WHEN statut = 'Payé' OR reste_a_payer <= 0 THEN 1 END) as totalPayeCount,
    COUNT(CASE WHEN statut = 'Rejeté' THEN 1 END) as totalRejeteCount,
    COUNT(CASE WHEN statut = 'En attente' AND reste_a_payer > 0 THEN 1 END) as totalEnAttenteCount,
    COUNT(CASE WHEN statut = 'Partiellement payé' AND reste_a_payer > 0 THEN 1 END) as totalPartielCount
    FROM prestations $wherePrestSql");
$stmtPrest->execute($paramsPrest);
$statsPrest = $stmtPrest->fetch() ?: [];

// 2. Totaux Paiements & Règlements
$stmtPai = $pdo->prepare("SELECT 
    COUNT(*) as totalBordereaux,
    COALESCE(SUM(total_paye), 0) as totalPaye,
    COALESCE(SUM(total_moderateur), 0) as totalModerateur,
    COALESCE(SUM(total_exclu), 0) as totalExclu,
    COALESCE(SUM(remise), 0) as totalRemise
    FROM paiements $wherePaiSql");
$stmtPai->execute($paramsPai);
$statsPai = $stmtPai->fetch() ?: [];

// 3. CA par Société
$stmtCaSoc = $pdo->prepare("SELECT 
    s.nom, 
    COALESCE(SUM(p.total_prestation), 0) as total
    FROM prestations p
    LEFT JOIN societes s ON p.societe_id = s.id
    $wherePrestSql
    GROUP BY p.societe_id, s.nom
    ORDER BY total DESC");
$stmtCaSoc->execute($paramsPrest);
$caParSociete = $stmtCaSoc->fetchAll() ?: [];

// 4. Évolution Mensuelle
$stmtMensuel = $pdo->prepare("SELECT 
    DATE_FORMAT(date, '%Y-%m') as mois,
    COALESCE(SUM(total_prestation), 0) as totalPrestations,
    COALESCE(SUM(total_paye), 0) as totalRegle
    FROM prestations
    $wherePrestSql
    GROUP BY DATE_FORMAT(date, '%Y-%m')
    ORDER BY mois ASC
    LIMIT 12");
$stmtMensuel->execute($paramsPrest);
$evolutionMensuelle = $stmtMensuel->fetchAll() ?: [];

sendJson([
    'success' => true,
    'data' => [
        'totalReclame' => (float)($statsPrest['totalReclame'] ?? 0),
        'totalPaye' => (float)($statsPai['totalPaye'] ?? 0),
        'totalModerateur' => (float)($statsPai['totalModerateur'] ?? 0),
        'totalExclu' => (float)($statsPai['totalExclu'] ?? 0),
        'totalResteAPayer' => (float)($statsPrest['totalResteAPayer'] ?? 0),
        'totalDossiers' => (int)($statsPrest['totalDossiers'] ?? 0),
        'totalPayeCount' => (int)($statsPrest['totalPayeCount'] ?? 0),
        'totalRejeteCount' => (int)($statsPrest['totalRejeteCount'] ?? 0),
        'totalEnAttenteCount' => (int)($statsPrest['totalEnAttenteCount'] ?? 0),
        'totalPartielCount' => (int)($statsPrest['totalPartielCount'] ?? 0),
        'caParSociete' => array_map(function($row) {
            return ['name' => $row['nom'] ?? 'Société', 'value' => (float)$row['total']];
        }, $caParSociete),
        'evolutionMensuelle' => array_map(function($row) {
            return [
                'mois' => $row['mois'],
                'totalPrestations' => (float)$row['totalPrestations'],
                'totalRegle' => (float)$row['totalRegle']
            ];
        }, $evolutionMensuelle)
    ]
]);
