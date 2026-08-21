/**
 * Application Frontend Vanilla JS / ES6 pour WampServer
 * Gestion complète : Prestations, Règlements, Rejets, Import Décomptes, États
 */

class AssurCareApp {
  constructor() {
    this.activeTab = 'dashboard';
    this.selectedSocieteId = 'ALL';
    this.statusFilter = 'ALL'; // ALL, 'En attente', 'Partiellement payé', 'Payé', 'Rejeté'
    this.soldeFilter = 'ALL'; // ALL, 'NON_SOLDE', 'SOLDE'
    this.searchTerm = '';
    
    this.prestations = [];
    this.paiements = [];
    this.societes = [];
    this.personnes = [];
    this.actes = [];
    this.familles = [];

    this.init();
  }

  async init() {
    await this.loadAllData();
    this.populateSocietesDropdown();
    this.render();
    lucide.createIcons();
  }

  async loadAllData() {
    try {
      const [resSoc, resPer, resAct, resPrest, resPai] = await Promise.all([
        fetch('api/societes.php').then(r => r.json()),
        fetch('api/personnes.php').then(r => r.json()),
        fetch('api/actes.php').then(r => r.json()),
        fetch('api/prestations.php').then(r => r.json()),
        fetch('api/paiements.php').then(r => r.json())
      ]);

      if (resSoc.success) this.societes = resSoc.data;
      if (resPer.success) this.personnes = resPer.data;
      if (resAct.success) {
        this.actes = resAct.data.actes || [];
        this.familles = resAct.data.familles || [];
      }
      if (resPrest.success) this.prestations = resPrest.data;
      if (resPai.success) this.paiements = resPai.data;
    } catch (e) {
      console.warn('Mode fallback données locales :', e);
    }
  }

  populateSocietesDropdown() {
    const sel = document.getElementById('global-societe-select');
    if (!sel) return;
    sel.innerHTML = '<option value="ALL">Toutes les Sociétés (Global)</option>' +
      this.societes.map(s => `<option value="${s.id}">${s.nom}</option>`).join('');
    sel.value = this.selectedSocieteId;
  }

  setTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.nav-tab').forEach(b => {
      b.classList.remove('bg-indigo-50', 'text-indigo-700', 'font-bold');
      b.classList.add('text-slate-600', 'font-medium');
    });
    const activeBtn = document.getElementById(`tab-btn-${tab}`);
    if (activeBtn) {
      activeBtn.classList.add('bg-indigo-50', 'text-indigo-700', 'font-bold');
      activeBtn.classList.remove('text-slate-600', 'font-medium');
    }
    this.render();
    lucide.createIcons();
  }

  setSocieteFilter(socId) {
    this.selectedSocieteId = socId;
    this.render();
    lucide.createIcons();
  }

  formatMoney(num) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(num || 0) + ' MGA';
  }

  getPrestationFinancials(p) {
    const tot = p.montantTotal || p.totalPrestation || 0;
    const mod = p.ticketModerateur || p.participation || 0;
    const remb = p.montantARembourser || Math.max(0, tot - mod);
    const totalPaye = p.totalPaye || 0;
    const totalExclu = (p.lignes || []).reduce((s, l) => s + (l.montantExclu || 0), 0);
    const resteAPayer = Math.max(0, (p.resteAPayer !== undefined ? p.resteAPayer : (remb - totalPaye - totalExclu)));
    
    const isFullyPaid = (totalPaye >= remb && remb > 0) || resteAPayer <= 0;
    const isRejete = p.statut === 'Rejeté' || (totalExclu >= remb && totalPaye === 0);
    const statut = isRejete ? 'Rejeté' : isFullyPaid ? 'Payé' : totalPaye > 0 ? 'Partiellement payé' : 'En attente';

    return { tot, mod, remb, totalPaye, totalExclu, resteAPayer, statut };
  }

  getStatusCounts() {
    let paye = 0, partiel = 0, attente = 0, rejete = 0;
    this.prestations.forEach(p => {
      if (this.selectedSocieteId !== 'ALL' && p.societeId !== this.selectedSocieteId) return;
      const fin = this.getPrestationFinancials(p);
      if (fin.statut === 'Rejeté' || p.statut === 'Rejeté') rejete++;
      else if (fin.statut === 'Payé' || p.statut === 'Payé' || fin.resteAPayer <= 0) paye++;
      else if (fin.statut === 'Partiellement payé' || p.statut === 'Partiellement payé') partiel++;
      else attente++;
    });
    return { all: this.prestations.length, paye, partiel, attente, rejete };
  }

  render() {
    const container = document.getElementById('main-content');
    if (!container) return;

    if (this.activeTab === 'dashboard') {
      this.renderDashboard(container);
    } else if (this.activeTab === 'prestations') {
      this.renderPrestations(container);
    } else if (this.activeTab === 'paiements') {
      this.renderPaiements(container);
    } else if (this.activeTab === 'etats') {
      this.renderEtats(container);
    } else if (this.activeTab === 'parametres') {
      this.renderParametres(container);
    }
  }

  renderDashboard(container) {
    const filteredPrest = this.prestations.filter(p => this.selectedSocieteId === 'ALL' || p.societeId === this.selectedSocieteId);
    const filteredPai = this.paiements.filter(p => this.selectedSocieteId === 'ALL' || p.societeId === this.selectedSocieteId);

    const totalReclame = filteredPrest.reduce((s, p) => s + (p.totalPrestation || 0), 0);
    const totalPaye = filteredPai.reduce((s, p) => s + (p.totalPaye || 0), 0);
    const totalModerateur = filteredPai.reduce((s, p) => s + (p.totalModerateur || 0), 0);
    const totalExclu = filteredPai.reduce((s, p) => s + (p.totalExclu || 0), 0);
    const totalReste = filteredPrest.reduce((s, p) => s + this.getPrestationFinancials(p).resteAPayer, 0);

    const taux = totalReclame > 0 ? Math.round((totalPaye / totalReclame) * 100) : 0;

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-extrabold text-slate-900">Tableau de Bord & Indicateurs Financiers</h2>
            <p class="text-xs text-slate-500">Vue synthétique des factures de soins, encaissements et rejets</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="window.app.setTab('prestations')" class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-2">
              <i data-lucide="file-text" class="w-4 h-4"></i>
              <span>Voir Factures</span>
            </button>
            <button onclick="window.app.setTab('paiements')" class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2">
              <i data-lucide="credit-card" class="w-4 h-4"></i>
              <span>Règlements</span>
            </button>
          </div>
        </div>

        <!-- 4 KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Prestations</span>
              <div class="p-2 rounded-lg bg-indigo-50 text-indigo-600"><i data-lucide="file-text" class="w-4 h-4"></i></div>
            </div>
            <div class="text-2xl font-extrabold text-slate-900">${this.formatMoney(totalReclame)}</div>
            <div class="text-xs text-slate-500">${filteredPrest.length} dossiers médicaux</div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Règlements</span>
              <div class="p-2 rounded-lg bg-emerald-50 text-emerald-600"><i data-lucide="check-circle" class="w-4 h-4"></i></div>
            </div>
            <div class="text-2xl font-extrabold text-emerald-600">${this.formatMoney(totalPaye)}</div>
            <div class="text-xs text-emerald-700 font-semibold">Taux de remboursement : ${taux}%</div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Tickets Modérateurs</span>
              <div class="p-2 rounded-lg bg-amber-50 text-amber-600"><i data-lucide="user-check" class="w-4 h-4"></i></div>
            </div>
            <div class="text-2xl font-extrabold text-amber-600">${this.formatMoney(totalModerateur)}</div>
            <div class="text-xs text-slate-500">Part à charge des adhérents</div>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Exclusions & Rejets</span>
              <div class="p-2 rounded-lg bg-rose-50 text-rose-600"><i data-lucide="alert-triangle" class="w-4 h-4"></i></div>
            </div>
            <div class="text-2xl font-extrabold text-rose-600">${this.formatMoney(totalExclu)}</div>
            <div class="text-xs text-slate-500">Reste net à recouvrer : ${this.formatMoney(totalReste)}</div>
          </div>
        </div>
      </div>
    `;
  }

  renderPrestations(container) {
    const counts = this.getStatusCounts();
    const filtered = this.prestations.filter(p => {
      if (this.selectedSocieteId !== 'ALL' && p.societeId !== this.selectedSocieteId) return false;
      const fin = this.getPrestationFinancials(p);
      
      if (this.statusFilter === 'Payé' && !(fin.statut === 'Payé' || p.statut === 'Payé' || fin.resteAPayer <= 0)) return false;
      if (this.statusFilter === 'Rejeté' && !(fin.statut === 'Rejeté' || p.statut === 'Rejeté')) return false;
      if (this.statusFilter === 'Partiellement payé' && !(fin.statut === 'Partiellement payé' && fin.resteAPayer > 0)) return false;
      if (this.statusFilter === 'En attente' && !(fin.statut === 'En attente' && fin.totalPaye === 0 && fin.resteAPayer > 0)) return false;

      if (this.soldeFilter === 'NON_SOLDE' && fin.resteAPayer <= 0) return false;
      if (this.soldeFilter === 'SOLDE' && fin.resteAPayer > 0) return false;

      if (this.searchTerm) {
        const s = this.searchTerm.toLowerCase();
        return (p.numeroFacture && p.numeroFacture.toLowerCase().includes(s)) ||
               (p.nomAgent && p.nomAgent.toLowerCase().includes(s)) ||
               (p.matricule && p.matricule.toLowerCase().includes(s)) ||
               (p.societeNom && p.societeNom.toLowerCase().includes(s));
      }
      return true;
    });

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Header Actions -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-extrabold text-slate-900">Dossiers de Prestations & Soins</h2>
            <p class="text-xs text-slate-500">Factures médicales, actes, tickets modérateurs et soldes</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="window.app.exportExcelPrestations()" class="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="download" class="w-3.5 h-3.5 text-slate-500"></i>
              <span>Export Excel</span>
            </button>
            <button onclick="window.app.openNewPrestationModal()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>Nouvelle Facture</span>
            </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div class="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div class="relative flex-1">
              <i data-lucide="search" class="w-4 h-4 absolute left-3 top-2.5 text-slate-400"></i>
              <input type="text" placeholder="Recherche n° facture, assuré, matricule..." value="${this.searchTerm}" oninput="window.app.setSearchTerm(this.value)" class="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white" />
            </div>

            <!-- Quick Status Chips with dynamic counts -->
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] text-slate-400 font-semibold mr-1">Statut :</span>
              ${[
                { key: 'ALL', label: 'Tous', count: counts.all },
                { key: 'En attente', label: 'En attente', count: counts.attente },
                { key: 'Partiellement payé', label: 'Partiel', count: counts.partiel },
                { key: 'Payé', label: 'Totalement payé', count: counts.paye },
                { key: 'Rejeté', label: 'Rejeté', count: counts.rejete }
              ].map(st => `
                <button onclick="window.app.setStatusFilter('${st.key}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  this.statusFilter === st.key ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }">
                  <span>${st.label}</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold ${this.statusFilter === st.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}">${st.count}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Table Prestations -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th class="py-3 px-4">Date</th>
                  <th class="py-3 px-3">N° Facture</th>
                  <th class="py-3 px-3">Bénéficiaire / Matricule</th>
                  <th class="py-3 px-3">Société / Garant</th>
                  <th class="py-3 px-3 text-right">Total Facture</th>
                  <th class="py-3 px-3 text-right">Ticket Mod.</th>
                  <th class="py-3 px-3 text-right text-emerald-700">Règlement</th>
                  <th class="py-3 px-3 text-right">Reste à Payer</th>
                  <th class="py-3 px-3 text-center">Statut</th>
                  <th class="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${filtered.length === 0 ? `
                  <tr><td colspan="10" class="py-8 text-center text-slate-400">Aucun dossier trouvé pour ces critères</td></tr>
                ` : filtered.map(p => {
                  const fin = this.getPrestationFinancials(p);
                  const badgeClass = fin.statut === 'Payé' ? 'badge-paye' : fin.statut === 'Rejeté' ? 'badge-rejete' : fin.statut === 'Partiellement payé' ? 'badge-partiel' : 'badge-attente';
                  return `
                    <tr class="hover:bg-slate-50 transition">
                      <td class="py-3 px-4 font-semibold text-slate-600 whitespace-nowrap">${p.date}</td>
                      <td class="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">${p.numeroFacture}</td>
                      <td class="py-3 px-3">
                        <div class="font-bold text-slate-900">${p.nomAgent || '-'}</div>
                        <div class="text-[11px] text-slate-400 font-mono">${p.matricule || '-'}</div>
                      </td>
                      <td class="py-3 px-3 text-slate-600 font-medium">${p.societeNom || '-'}</td>
                      <td class="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">${this.formatMoney(fin.tot)}</td>
                      <td class="py-3 px-3 text-right text-amber-700 font-semibold whitespace-nowrap">${this.formatMoney(fin.mod)}</td>
                      <td class="py-3 px-3 text-right text-emerald-700 font-bold whitespace-nowrap">${this.formatMoney(fin.totalPaye)}</td>
                      <td class="py-3 px-3 text-right font-bold whitespace-nowrap ${fin.resteAPayer > 0 ? 'text-rose-600' : 'text-slate-400'}">${this.formatMoney(fin.resteAPayer)}</td>
                      <td class="py-3 px-3 text-center whitespace-nowrap">
                        <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">${fin.statut}</span>
                      </td>
                      <td class="py-3 px-4 text-right whitespace-nowrap">
                        <button onclick="window.app.openPrestationDetailModal('${p.id}')" title="Détails" class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
                          <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="window.app.openRejectLineModal('${p.id}')" title="Rejeter un acte" class="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer">
                          <i data-lucide="ban" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="window.app.deletePrestation('${p.id}')" title="Supprimer" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  setStatusFilter(st) {
    this.statusFilter = st;
    this.render();
    lucide.createIcons();
  }

  setSearchTerm(s) {
    this.searchTerm = s;
    this.render();
    lucide.createIcons();
  }

  renderPaiements(container) {
    const filtered = this.paiements.filter(p => this.selectedSocieteId === 'ALL' || p.societeId === this.selectedSocieteId);
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-extrabold text-slate-900">Bordereaux de Règlements & Rejets</h2>
            <p class="text-xs text-slate-500">Enregistrement des paiements reçus et des avis de rejets d'actes</p>
          </div>
          <button onclick="window.app.openDecompteModal()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 cursor-pointer">
            <i data-lucide="receipt" class="w-4 h-4"></i>
            <span>Importer Décompte Règlement</span>
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th class="py-3 px-4">Date</th>
                <th class="py-3 px-3">Bordereau / Référence</th>
                <th class="py-3 px-3">Mode & Assureur</th>
                <th class="py-3 px-3 text-right">Montant Réclamé</th>
                <th class="py-3 px-3 text-right text-emerald-700">Total Payé</th>
                <th class="py-3 px-3 text-right text-amber-700">Ticket Mod.</th>
                <th class="py-3 px-3 text-right text-rose-700">Rejets / Exclus</th>
                <th class="py-3 px-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${filtered.length === 0 ? `
                <tr><td colspan="8" class="py-8 text-center text-slate-400">Aucun bordereau enregistré</td></tr>
              ` : filtered.map(p => `
                <tr class="hover:bg-slate-50 transition">
                  <td class="py-3 px-4 font-semibold text-slate-600 whitespace-nowrap">${p.datePaiement}</td>
                  <td class="py-3 px-3 font-bold text-slate-900">${p.numeroBordereau}</td>
                  <td class="py-3 px-3 text-slate-600 font-medium">${p.modePaiement || 'Virement'}</td>
                  <td class="py-3 px-3 text-right font-bold">${this.formatMoney(p.totalReclame)}</td>
                  <td class="py-3 px-3 text-right font-bold text-emerald-700">${this.formatMoney(p.totalPaye)}</td>
                  <td class="py-3 px-3 text-right font-semibold text-amber-700">${this.formatMoney(p.totalModerateur)}</td>
                  <td class="py-3 px-3 text-right font-bold text-rose-700">${this.formatMoney(p.totalExclu)}</td>
                  <td class="py-3 px-3 text-center"><span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Validé</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderEtats(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-extrabold text-slate-900">États Comptables & Rapprochement</h2>
          <p class="text-xs text-slate-500">Suivi des recouvrements, états des créances et rejets d'actes</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 class="font-bold text-slate-900 text-sm">État de Rapprochement des Factures</h3>
            <p class="text-xs text-slate-500">Confrontation facture par facture des montants engagés, tickets modérateurs et remboursements perçus.</p>
            <button onclick="window.app.exportRapprochementPdf()" class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
              <span>Générer État PDF</span>
            </button>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 class="font-bold text-slate-900 text-sm">État des Impayés & Recouvrement (> 3 mois)</h3>
            <p class="text-xs text-slate-500">Liste des factures restant à recouvrer dépassant le délai conventionnel de 90 jours.</p>
            <button onclick="window.app.exportRecouvrementPdf()" class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
              <span>Générer Recouvrement PDF</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderParametres(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-extrabold text-slate-900">Paramètres de Déploiement & Référentiels</h2>
          <p class="text-xs text-slate-500">Gestion des sociétés d'assurance, bénéficiaires et diagnostic MySQL</p>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
            <h3 class="font-bold text-slate-900 text-sm">Base de données MySQL WampServer</h3>
          </div>
          <p class="text-xs text-slate-600">Base active : <code class="bg-slate-100 px-2 py-0.5 rounded font-mono font-bold">suivi_assurance</code> sur <code class="bg-slate-100 px-2 py-0.5 rounded font-mono">localhost:3306</code></p>
          <div class="text-xs text-slate-500">Tables opérationnelles : societes, personnes, familles, actes, prestations, prestation_lignes, paiements, paiement_lignes.</div>
        </div>
      </div>
    `;
  }

  // --- Modals Handlers ---
  openDecompteModal() {
    alert('Pour importer un décompte ASCOMA, MCI CARE ou BSA, utilisez le bouton Décompte Règlement ou l\'outil de rapprochement automatique.');
  }

  openNewPrestationModal() {
    const num = 'FACT-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    const nomAgent = prompt('Nom & Prénom du bénéficiaire / assuré :', 'RAZAFINDRABE Jean-Luc');
    if (!nomAgent) return;
    const matricule = prompt('Matricule de l\'assuré :', 'MAT-8041') || 'MAT-0000';
    const montant = parseFloat(prompt('Montant total de la facture (MGA) :', '100000') || '0');
    if (montant <= 0) return;

    const soc = this.societes[0] || { id: 'soc-1', nom: 'ASCOMA Madagascar', tauxCouvertureDefaut: 80 };
    const part = Math.round(montant * 0.20);
    const remb = montant - part;

    const newP = {
      id: 'prest-' + Date.now(),
      numeroFacture: num,
      date: new Date().toISOString().split('T')[0],
      societeId: soc.id,
      societeNom: soc.nom,
      personneId: this.personnes[0]?.id || 'per-1',
      nomAgent,
      matricule,
      totalPrestation: montant,
      montantTotal: montant,
      participation: part,
      ticketModerateur: part,
      montantARembourser: remb,
      totalPaye: 0,
      resteAPayer: remb,
      statut: 'En attente',
      lignes: [{
        id: 'lig-' + Date.now(),
        code: 'CONS',
        libelle: 'Consultation & Soins',
        totalPrestation: montant,
        ticketModerateur: part,
        montantARembourser: remb,
        totalPaye: 0,
        statut: 'En attente'
      }]
    };

    fetch('api/prestations.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newP)
    }).then(r => r.json()).then(() => {
      this.prestations.unshift(newP);
      this.render();
      lucide.createIcons();
    }).catch(() => {
      this.prestations.unshift(newP);
      this.render();
      lucide.createIcons();
    });
  }

  openRejectLineModal(prestId) {
    const prest = this.prestations.find(p => p.id === prestId);
    if (!prest) return;
    const motif = prompt('Motif du rejet (Ex: Acte hors-barème, Plafond dépassé) :', 'Acte non pris en charge');
    if (!motif) return;
    const mnt = parseFloat(prompt(`Montant à exclure / rejeter (Max ${prest.resteAPayer || prest.montantARembourser} MGA) :`, prest.resteAPayer || prest.montantARembourser) || '0');
    if (mnt <= 0) return;

    const newReste = Math.max(0, (prest.resteAPayer !== undefined ? prest.resteAPayer : prest.montantARembourser) - mnt);
    prest.resteAPayer = newReste;
    if (newReste <= 0 && prest.totalPaye === 0) {
      prest.statut = 'Rejeté';
    } else if (newReste <= 0) {
      prest.statut = 'Payé';
    }

    const rejectionPaiement = {
      id: 'pai-rej-' + Date.now(),
      numeroBordereau: 'REJET-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
      datePaiement: new Date().toISOString().split('T')[0],
      societeId: prest.societeId,
      nomAgent: prest.nomAgent,
      matricule: prest.matricule,
      modePaiement: 'Autre',
      totalReclame: mnt,
      totalPaye: 0,
      totalModerateur: 0,
      totalExclu: mnt,
      remise: 0,
      statut: 'Validé',
      notes: 'Rejet d\'acte : ' + motif,
      lignes: [{
        prestationId: prest.id,
        prestationNumero: prest.numeroFacture,
        totalPaye: 0,
        montantExclu: mnt,
        commentaire: motif
      }]
    };

    fetch('api/paiements.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rejectionPaiement)
    }).finally(() => {
      this.paiements.unshift(rejectionPaiement);
      this.render();
      lucide.createIcons();
    });
  }

  deletePrestation(prestId) {
    if (!confirm('Supprimer cette facture ?')) return;
    fetch(`api/prestations.php?id=${prestId}`, { method: 'DELETE' }).finally(() => {
      this.prestations = this.prestations.filter(p => p.id !== prestId);
      this.render();
      lucide.createIcons();
    });
  }

  exportExcelPrestations() {
    const data = this.prestations.map(p => {
      const f = this.getPrestationFinancials(p);
      return {
        'Date': p.date,
        'N° Facture': p.numeroFacture,
        'Assuré': p.nomAgent,
        'Matricule': p.matricule,
        'Société': p.societeNom,
        'Total Prestation': f.tot,
        'Ticket Modérateur': f.mod,
        'Remboursement': f.totalPaye,
        'Reste à Payer': f.resteAPayer,
        'Statut': f.statut
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prestations");
    XLSX.writeFile(wb, "Prestations_Assurance.xlsx");
  }

  exportRapprochementPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    doc.setFontSize(14);
    doc.text("État de Rapprochement des Factures & Règlements", 40, 40);
    doc.setFontSize(9);
    doc.text("Généré le " + new Date().toLocaleDateString('fr-FR'), 40, 56);

    const rows = this.prestations.map(p => {
      const f = this.getPrestationFinancials(p);
      return [p.date, p.numeroFacture, p.nomAgent, f.tot.toLocaleString('fr-FR'), f.totalPaye.toLocaleString('fr-FR'), f.resteAPayer.toLocaleString('fr-FR'), f.statut];
    });

    doc.autoTable({
      head: [['Date', 'Facture', 'Bénéficiaire', 'Total', 'Payé', 'Reste', 'Statut']],
      body: rows,
      startY: 70,
      styles: { fontSize: 8 }
    });

    doc.save("Etat_Rapprochement.pdf");
  }

  exportRecouvrementPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    doc.setFontSize(14);
    doc.text("État des Créances & Recouvrement (> 90 jours)", 40, 40);

    const rows = this.prestations
      .filter(p => this.getPrestationFinancials(p).resteAPayer > 0)
      .map(p => {
        const f = this.getPrestationFinancials(p);
        return [p.date, p.numeroFacture, p.nomAgent, p.societeNom, f.resteAPayer.toLocaleString('fr-FR')];
      });

    doc.autoTable({
      head: [['Date', 'Facture', 'Bénéficiaire', 'Assureur', 'Reste Impayé (MGA)']],
      body: rows,
      startY: 70,
      styles: { fontSize: 8 }
    });

    doc.save("Etat_Recouvrement_3mois.pdf");
  }
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AssurCareApp();
});
