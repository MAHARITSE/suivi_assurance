/**
 * Application de Suivi & Rapprochement des Prestations d'Assurance
 * Client JS pour déploiement WAMP / PHP / MySQL
 */

(function () {
  'use strict';

  class App {
    constructor() {
      this.currentTab = 'dashboard';
      this.selectedSociete = 'ALL';
      this.data = {
        societes: [],
        prestations: [],
        paiements: [],
        personnes: [],
        familles: [],
        stats: null
      };
      this.init();
    }

    async init() {
      await this.loadAllData();
      this.renderNav();
      this.render();
      if (window.lucide) window.lucide.createIcons();
    }

    async loadAllData() {
      try {
        const [socRes, prestRes, paiRes, persRes, famRes] = await Promise.all([
          fetch('api.php?action=societes').then(r => r.json()).catch(() => ({ data: [] })),
          fetch('api.php?action=prestations').then(r => r.json()).catch(() => ({ data: [] })),
          fetch('api.php?action=paiements').then(r => r.json()).catch(() => ({ data: [] })),
          fetch('api.php?action=personnes').then(r => r.json()).catch(() => ({ data: [] })),
          fetch('api.php?action=familles').then(r => r.json()).catch(() => ({ data: [] }))
        ]);

        this.data.societes = socRes.data || [];
        this.data.prestations = prestRes.data || [];
        this.data.paiements = paiRes.data || [];
        this.data.personnes = persRes.data || [];
        this.data.familles = famRes.data || [];

        this.populateSocieteDropdown();
      } catch (err) {
        console.error('Erreur chargement données:', err);
      }
    }

    populateSocieteDropdown() {
      const select = document.getElementById('global-societe-select');
      if (!select) return;
      select.innerHTML = '<option value="ALL">Toutes les Sociétés (Global)</option>';
      this.data.societes.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id || s.code;
        opt.textContent = `${s.nom} (${s.code || ''})`;
        select.appendChild(opt);
      });
      select.value = this.selectedSociete;
    }

    setSocieteFilter(socId) {
      this.selectedSociete = socId;
      this.render();
    }

    setTab(tab) {
      this.currentTab = tab;
      this.renderNav();
      this.render();
    }

    renderNav() {
      document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.className = 'nav-tab px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition flex items-center space-x-2 cursor-pointer';
      });
      const activeBtn = document.getElementById(`tab-btn-${this.currentTab}`);
      if (activeBtn) {
        activeBtn.className = 'nav-tab px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-2 bg-indigo-50 text-indigo-700 cursor-pointer';
      }
    }

    getFilteredPrestations() {
      if (this.selectedSociete === 'ALL') return this.data.prestations;
      return this.data.prestations.filter(p => p.societe_id === this.selectedSociete || p.societeId === this.selectedSociete);
    }

    getFilteredPaiements() {
      if (this.selectedSociete === 'ALL') return this.data.paiements;
      return this.data.paiements.filter(p => p.societe_id === this.selectedSociete || p.societeId === this.selectedSociete);
    }

    render() {
      const main = document.getElementById('main-content');
      if (!main) return;

      switch (this.currentTab) {
        case 'dashboard':
          main.innerHTML = this.renderDashboardView();
          break;
        case 'prestations':
          main.innerHTML = this.renderPrestationsView();
          break;
        case 'paiements':
          main.innerHTML = this.renderPaiementsView();
          break;
        case 'etats':
          main.innerHTML = this.renderEtatsView();
          break;
        case 'parametres':
          main.innerHTML = this.renderParametresView();
          break;
        default:
          main.innerHTML = this.renderDashboardView();
      }

      if (window.lucide) window.lucide.createIcons();
    }

    formatMoney(val) {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MGA', maximumFractionDigits: 0 }).format(val || 0).replace('MGA', 'Ar');
    }

    renderDashboardView() {
      const prests = this.getFilteredPrestations();
      const paiems = this.getFilteredPaiements();

      const totalReclame = prests.reduce((acc, p) => acc + (parseFloat(p.total_prestation || p.totalPrestation) || 0), 0);
      const totalPaye = paiems.reduce((acc, p) => acc + (parseFloat(p.total_paye || p.totalPaye) || 0), 0);
      const totalReste = prests.reduce((acc, p) => acc + (parseFloat(p.reste_a_payer || p.resteAPayer) || 0), 0);
      const tauxReglement = totalReclame > 0 ? Math.round((totalPaye / totalReclame) * 100) : 0;

      return `
        <!-- KPI Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-bold uppercase tracking-wider">Total Réclamé (Factures)</span>
              <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="text-xl font-extrabold text-slate-900">${this.formatMoney(totalReclame)}</div>
            <p class="text-xs text-slate-500 mt-1">${prests.length} dossier(s) de prestation</p>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-bold uppercase tracking-wider">Total Réglé (Bordereaux)</span>
              <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <i data-lucide="check-circle-2" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="text-xl font-extrabold text-emerald-700">${this.formatMoney(totalPaye)}</div>
            <p class="text-xs text-slate-500 mt-1">${paiems.length} bordereau(x) reçu(s)</p>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-bold uppercase tracking-wider">Reste à Recouvrer</span>
              <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <i data-lucide="clock" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="text-xl font-extrabold text-amber-600">${this.formatMoney(totalReste)}</div>
            <p class="text-xs text-slate-500 mt-1">Encours auprès des assureurs</p>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-bold uppercase tracking-wider">Taux de Rapprochement</span>
              <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <i data-lucide="pie-chart" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="text-xl font-extrabold text-slate-900">${tauxReglement}%</div>
            <div class="w-full bg-slate-100 rounded-full h-2 mt-2">
              <div class="bg-indigo-600 h-2 rounded-full" style="width: ${Math.min(tauxReglement, 100)}%"></div>
            </div>
          </div>
        </div>

        <!-- Latest Prestations Table -->
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i data-lucide="list" class="w-4 h-4 text-indigo-600"></i>
              Dernières Factures de Prestations
            </h3>
            <button onclick="window.app.setTab('prestations')" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer">
              Voir tout &rarr;
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th class="p-3.5">N° Facture</th>
                  <th class="p-3.5">Date</th>
                  <th class="p-3.5">Société</th>
                  <th class="p-3.5">Assuré / Patient</th>
                  <th class="p-3.5 text-right">Total Facture</th>
                  <th class="p-3.5 text-right">Payé</th>
                  <th class="p-3.5 text-right">Solde</th>
                  <th class="p-3.5 text-center">Statut</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${prests.length === 0 ? `
                  <tr><td colspan="8" class="p-8 text-center text-slate-400">Aucune facture enregistrée dans la base MySQL.</td></tr>
                ` : prests.slice(0, 5).map(p => `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="p-3.5 font-bold text-slate-900">${p.numero_facture || p.numeroFacture || '-'}</td>
                    <td class="p-3.5">${p.date || '-'}</td>
                    <td class="p-3.5 font-medium">${p.societe_nom || p.societeNom || p.societe_id || '-'}</td>
                    <td class="p-3.5 font-medium text-slate-800">${p.nom_agent || p.nomAgent || '-'}</td>
                    <td class="p-3.5 text-right font-semibold">${this.formatMoney(p.total_prestation || p.totalPrestation)}</td>
                    <td class="p-3.5 text-right text-emerald-700 font-semibold">${this.formatMoney(p.total_paye || p.totalPaye)}</td>
                    <td class="p-3.5 text-right text-amber-700 font-semibold">${this.formatMoney(p.reste_a_payer || p.resteAPayer)}</td>
                    <td class="p-3.5 text-center">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${this.getBadgeClass(p.statut)}">
                        ${p.statut || 'En attente'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    getBadgeClass(statut) {
      if (!statut) return 'badge-attente';
      const s = statut.toLowerCase();
      if (s.includes('payé') || s.includes('validé')) return 'badge-paye';
      if (s.includes('partiel')) return 'badge-partiel';
      if (s.includes('rejet')) return 'badge-rejete';
      return 'badge-attente';
    }

    renderPrestationsView() {
      const prests = this.getFilteredPrestations();
      return `
        <div class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-extrabold text-slate-900">Gestion des Factures de Prestations</h2>
            <button onclick="window.app.openNewPrestationModal()" class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition cursor-pointer flex items-center space-x-1.5">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Nouvelle Facture</span>
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th class="p-3.5">N° Facture</th>
                  <th class="p-3.5">Date</th>
                  <th class="p-3.5">Société</th>
                  <th class="p-3.5">Assuré</th>
                  <th class="p-3.5 text-right">Total Facture</th>
                  <th class="p-3.5 text-right">Ticket Modérateur</th>
                  <th class="p-3.5 text-right">Part Assurance</th>
                  <th class="p-3.5 text-right">Réglé</th>
                  <th class="p-3.5 text-right">Reste</th>
                  <th class="p-3.5 text-center">Statut</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${prests.length === 0 ? `
                  <tr><td colspan="10" class="p-8 text-center text-slate-400">Aucune prestation trouvée.</td></tr>
                ` : prests.map(p => `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="p-3.5 font-bold text-slate-900">${p.numero_facture || p.numeroFacture || '-'}</td>
                    <td class="p-3.5">${p.date || '-'}</td>
                    <td class="p-3.5 font-medium">${p.societe_nom || p.societeNom || p.societe_id || '-'}</td>
                    <td class="p-3.5">${p.nom_agent || p.nomAgent || '-'} (${p.matricule || '-'})</td>
                    <td class="p-3.5 text-right font-semibold">${this.formatMoney(p.total_prestation || p.totalPrestation)}</td>
                    <td class="p-3.5 text-right">${this.formatMoney(p.participation)}</td>
                    <td class="p-3.5 text-right font-semibold text-indigo-700">${this.formatMoney(p.montant_a_rembourser || p.montantARembourser)}</td>
                    <td class="p-3.5 text-right font-semibold text-emerald-700">${this.formatMoney(p.total_paye || p.totalPaye)}</td>
                    <td class="p-3.5 text-right font-semibold text-amber-700">${this.formatMoney(p.reste_a_payer || p.resteAPayer)}</td>
                    <td class="p-3.5 text-center">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${this.getBadgeClass(p.statut)}">
                        ${p.statut || 'En attente'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    renderPaiementsView() {
      const paiems = this.getFilteredPaiements();
      return `
        <div class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-extrabold text-slate-900">Bordereaux de Règlement Assureurs</h2>
            <button onclick="window.app.openDecompteModal()" class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer flex items-center space-x-1.5">
              <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
              <span>Importer un Décompte</span>
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th class="p-3.5">N° Bordereau</th>
                  <th class="p-3.5">Date Règlement</th>
                  <th class="p-3.5">Société</th>
                  <th class="p-3.5">Mode</th>
                  <th class="p-3.5 text-right">Montant Réclamé</th>
                  <th class="p-3.5 text-right">Montant Réglé</th>
                  <th class="p-3.5 text-right">Modérateur</th>
                  <th class="p-3.5 text-right">Exclu / Rejet</th>
                  <th class="p-3.5 text-center">Statut</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${paiems.length === 0 ? `
                  <tr><td colspan="9" class="p-8 text-center text-slate-400">Aucun règlement enregistré.</td></tr>
                ` : paiems.map(p => `
                  <tr class="hover:bg-slate-50/80 transition">
                    <td class="p-3.5 font-bold text-slate-900">${p.numero_bordereau || p.numeroBordereau || '-'}</td>
                    <td class="p-3.5">${p.date_paiement || p.datePaiement || '-'}</td>
                    <td class="p-3.5 font-medium">${p.societe_id || p.societeId || '-'}</td>
                    <td class="p-3.5">${p.mode_paiement || p.modePaiement || 'Virement'}</td>
                    <td class="p-3.5 text-right font-semibold">${this.formatMoney(p.total_reclame || p.totalReclame)}</td>
                    <td class="p-3.5 text-right font-semibold text-emerald-700">${this.formatMoney(p.total_paye || p.totalPaye)}</td>
                    <td class="p-3.5 text-right">${this.formatMoney(p.total_moderateur || p.totalModerateur)}</td>
                    <td class="p-3.5 text-right text-rose-600 font-semibold">${this.formatMoney(p.total_exclu || p.totalExclu)}</td>
                    <td class="p-3.5 text-center">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-bold badge-paye">
                        ${p.statut || 'Validé'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    renderEtatsView() {
      return `
        <div class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 class="text-base font-extrabold text-slate-900">États Financiers & Rapports de Recouvrement</h2>
          <p class="text-xs text-slate-500">Générez et exportez les rapports de rapprochement vers Excel ou PDF.</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition space-y-2">
              <div class="font-bold text-xs text-slate-800">État des Restes à Recouvrer</div>
              <p class="text-[11px] text-slate-500">Détail des factures non soldées par assureur.</p>
              <button onclick="alert('Export Excel en cours...')" class="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-xs transition">Export Excel</button>
            </div>
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition space-y-2">
              <div class="font-bold text-xs text-slate-800">Bordereau de Rapprochement</div>
              <p class="text-[11px] text-slate-500">Synthèse des montants réclamés vs réglés.</p>
              <button onclick="alert('Export PDF en cours...')" class="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition">Export PDF</button>
            </div>
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition space-y-2">
              <div class="font-bold text-xs text-slate-800">Analyse des Rejets</div>
              <p class="text-[11px] text-slate-500">Liste des motifs d'exclusion pour réclamation.</p>
              <button onclick="alert('Export en cours...')" class="mt-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs shadow-xs transition">Générer Rapport</button>
            </div>
          </div>
        </div>
      `;
    }

    renderParametresView() {
      return `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 class="text-sm font-bold text-slate-900">Sociétés d'Assurance Enregistrées</h3>
            <ul class="divide-y divide-slate-100 text-xs">
              ${this.data.societes.map(s => `
                <li class="py-2.5 flex items-center justify-between">
                  <div>
                    <span class="font-bold text-slate-900">${s.nom}</span>
                    <span class="text-slate-400 ml-2">(${s.code || ''})</span>
                  </div>
                  <span class="text-slate-500 font-semibold">${s.taux_couverture_defaut || 80}% couv.</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 class="text-sm font-bold text-slate-900">Base des Assurés & Personnes</h3>
            <p class="text-xs text-slate-500">${this.data.personnes.length} assuré(s) répertorié(s) dans la base MySQL.</p>
          </div>
        </div>
      `;
    }

    openDecompteModal() {
      alert('Module d\'importation de décompte prêt pour WAMP.');
    }

    openNewPrestationModal() {
      alert('Module d\'enregistrement de nouvelle facture prêt pour WAMP.');
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
  });
})();
