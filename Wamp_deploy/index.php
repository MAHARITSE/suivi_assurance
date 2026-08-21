<?php
/**
 * Application de Suivi des Prestations & Règlements d'Assurance
 * Déploiement Local WampServer (PHP / MySQL / Apache)
 */
require_once __DIR__ . '/config.php';

// Vérification de la connexion MySQL
$mysqlStatus = 'OK';
$mysqlError = '';
try {
    $pdo = getPDO();
} catch (Exception $e) {
    $mysqlStatus = 'ERROR';
    $mysqlError = $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="fr" class="h-full bg-slate-50">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gestion & Rapprochement des Prestations d'Assurance (WAMP / MySQL)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .badge-paye { background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-attente { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-partiel { background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .badge-rejete { background-color: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3; }
  </style>
</head>
<body class="h-full flex flex-col text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">

  <!-- Main Top Bar -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
          <i data-lucide="shield-check" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base font-extrabold text-slate-900 tracking-tight">AssurCare Rapprochement</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              WAMP / MySQL
            </span>
          </div>
          <p class="text-xs text-slate-500">SALFA • ASCOMA • MCI CARE • BSA • HAVANA</p>
        </div>
      </div>

      <!-- Quick Global Nav Items -->
      <div class="flex items-center space-x-2">
        <select id="global-societe-select" onchange="window.app.setSocieteFilter(this.value)" class="text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="ALL">Toutes les Sociétés (Global)</option>
        </select>
        
        <button onclick="window.app.openDecompteModal()" class="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer">
          <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
          <span>Import Décompte</span>
        </button>

        <button onclick="window.app.openNewPrestationModal()" class="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>Nouvelle Facture</span>
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 overflow-x-auto border-t border-slate-100 py-1.5">
      <button onclick="window.app.setTab('dashboard')" id="tab-btn-dashboard" class="nav-tab px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 bg-indigo-50 text-indigo-700">
        <i data-lucide="layout-dashboard" class="w-3.5 h-3.5"></i>
        <span>Vue d'ensemble</span>
      </button>
      <button onclick="window.app.setTab('prestations')" id="tab-btn-prestations" class="nav-tab px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition flex items-center space-x-2">
        <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
        <span>Factures Prestations</span>
      </button>
      <button onclick="window.app.setTab('paiements')" id="tab-btn-paiements" class="nav-tab px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition flex items-center space-x-2">
        <i data-lucide="credit-card" class="w-3.5 h-3.5"></i>
        <span>Règlements & Rejets</span>
      </button>
      <button onclick="window.app.setTab('etats')" id="tab-btn-etats" class="nav-tab px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition flex items-center space-x-2">
        <i data-lucide="pie-chart" class="w-3.5 h-3.5"></i>
        <span>États & Recouvrement</span>
      </button>
      <button onclick="window.app.setTab('parametres')" id="tab-btn-parametres" class="nav-tab px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition flex items-center space-x-2">
        <i data-lucide="settings" class="w-3.5 h-3.5"></i>
        <span>Paramètres & Assurés</span>
      </button>
    </nav>
  </header>

  <!-- App Content Area -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6" id="main-content">
    <!-- Dynamic Views are rendered here via app.js -->
  </main>

  <!-- Modals Container -->
  <div id="modal-container"></div>

  <!-- Main Application Script -->
  <script src="app.js"></script>
</body>
</html>
