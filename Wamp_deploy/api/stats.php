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
    $wherePrest[] = "societeId = ?";
    $paramsPrest[] = $societeId;
    $wherePai[] = "societeId = ?";
    $paramsPai[] = $societeId;
}

$wherePrestSql = count($wherePrest) > 0 ? "WHERE " . implode(" AND ", $wherePrest) : "";
$wherePaiSql = count($wherePai) > 0 ? "WHERE " . implode(" AND ", $wherePai) : "";

// 1. Totaux Prestations
$stmtPrest = $pdo->prepare("SELECT 
    COUNT(*) as totalDossiers,
    COALESCE(SUM(totalPrestation), 0) as totalReclame,
    COALESCE(SUM(participation), 0) as totalTicketModerateurPrest,
    COALESCE(SUM(montantARembourser), 0) as totalARembourser,
    COALESCE(SUM(resteAPayer), 0) as totalResteAPayer,
    COUNT(CASE WHEN statut = 'Payé' OR resteAPayer <= 0 THEN 1 END) as totalPayeCount,
    COUNT(CASE WHEN statut = 'Rejeté' THEN 1 END) as totalRejeteCount,
    COUNT(CASE WHEN statut = 'En attente' AND resteAPayer > 0 THEN 1 END) as totalEnAttenteCount,
    COUNT(CASE WHEN statut = 'Partiellement payé' AND resteAPayer > 0 THEN 1 END) as totalPartielCount
    FROM prestations $wherePrestSql");
$stmtPrest->execute($paramsPrest);
$statsPrest = $stmtPrest->fetch();

// 2. Totaux Paiements & Règlements
$stmtPai = $pdo->prepare("SELECT 
    COUNT(*) as totalBordereaux,
    COALESCE(SUM(totalPaye), 0) as totalPaye,
    COALESCE(SUM(totalModerateur), 0) as totalModerateur,
    COALESCE(SUM(totalExclu), 0) as totalExclu,
    COALESCE(SUM(remise), 0) as totalRemise
    FROM paiements $wherePaiSql");
$stmtPai->execute($paramsPai);
$statsPai = $stmtPai->fetch();

// 3. CA par Société
$stmtCaSoc = $pdo->prepare("SELECT 
    s.nom, 
    COALESCE(SUM(p.totalPrestation), 0) as total
    FROM prestations p
    LEFT JOIN societes s ON p.societeId = s.id
    $wherePrestSql
    GROUP BY p.societeId, s.nom
    ORDER BY total DESC");
$stmtCaSoc->execute($paramsPrest);
$caParSociete = $stmtCaSoc->fetchAll();

// 4. Évolution Mensuelle
$stmtMensuel = $pdo->prepare("SELECT 
    DATE_FORMAT(date, '%Y-%m') as mois,
    COALESCE(SUM(totalPrestation), 0) as totalPrestations,
    COALESCE(SUM(totalPaye), 0) as totalRegle
    FROM prestations
    $wherePrestSql
    GROUP BY DATE_FORMAT(date, '%Y-%m')
    ORDER BY mois ASC
    LIMIT 12");
$stmtMensuel->execute($paramsPrest);
$evolutionMensuelle = $stmtMensuel->fetchAll();

sendJson([
    'success' => true,
    'data' => [
        'totalReclame' => (float)$statsPrest['totalReclame'],
        'totalPaye' => (float)$statsPai['totalPaye'],
        'totalModerateur' => (float)$statsPai['totalModerateur'],
        'totalExclu' => (float)$statsPai['totalExclu'],
        'totalResteAPayer' => (float)$statsPrest['totalResteAPayer'],
        'totalDossiers' => (int)$statsPrest['totalDossiers'],
        'totalPayeCount' => (int)$statsPrest['totalPayeCount'],
        'totalRejeteCount' => (int)$statsPrest['totalRejeteCount'],
        'totalEnAttenteCount' => (int)$statsPrest['totalEnAttenteCount'],
        'totalPartielCount' => (int)$statsPrest['totalPartielCount'],
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
