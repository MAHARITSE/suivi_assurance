import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  Plus, 
  ArrowRight,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Prestation, Paiement, Societe, Personne, ActiveTab } from '../types';
import { formatMoney, formatDate } from '../utils/formatters';

interface DashboardProps {
  prestations: Prestation[];
  paiements: Paiement[];
  societes: Societe[];
  personnes: Personne[];
  selectedSocieteId: string;
  onNavigate: (tab: ActiveTab) => void;
  onOpenNewPrestation: () => void;
  onOpenNewPaiement: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-lg text-xs">
        <p className="font-bold text-slate-700 mb-1">{label || payload[0].name}</p>
        <p className="text-indigo-600 font-semibold">
          {formatMoney(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export const Dashboard: React.FC<DashboardProps> = ({
  prestations,
  paiements,
  societes,
  personnes,
  selectedSocieteId,
  onNavigate,
  onOpenNewPrestation,
  onOpenNewPaiement,
}) => {
  // Filter by selected society if active
  const isAllSoc = !selectedSocieteId || selectedSocieteId === 'ALL';
  const filteredPrestations = isAllSoc
    ? prestations
    : prestations.filter(p => p.societeId === selectedSocieteId || p.societeNom === selectedSocieteId);

  const filteredPaiements = isAllSoc
    ? paiements
    : paiements.filter(p => p.societeId === selectedSocieteId);

  // Compute key indicators
  const totalReclame = filteredPrestations.reduce((sum, p) => sum + (p.totalPrestation || 0), 0);

  // Total Ticket Modérateur (Part assurés)
  const totalModerateur = filteredPrestations.reduce((sum, p) => {
    return sum + (p.participation || p.ticketModerateur || 0);
  }, 0);

  // Total Règlements Effectués par les assurances
  const totalPaye = filteredPaiements.reduce((sum, p) => sum + (p.totalPaye || 0), 0);

  // Total Exclusions & Rejets
  const totalExclu = filteredPrestations.reduce((sum, p) => sum + (p.montantExclu || 0), 0)
    || filteredPaiements.reduce((sum, p) => sum + (p.totalExclu || 0), 0);

  // Total Factures à Recouvrir (Solde restant dû par les assurances = Part Assurance Net - Règlements - Rejets)
  const totalARecouvrer = filteredPrestations.reduce((sum, p) => {
    const partAssurance = p.montantARembourser ?? Math.max(0, (p.totalPrestation || 0) - (p.participation || p.ticketModerateur || 0));
    const paye = p.totalPaye || 0;
    const exclu = p.montantExclu || 0;
    const reste = Math.max(0, partAssurance - paye - exclu);
    return sum + reste;
  }, 0);

  // Nombre de dossiers non soldés auprès des assurances
  const dossiersARecouvrer = filteredPrestations.filter(p => {
    const partAssurance = p.montantARembourser ?? Math.max(0, (p.totalPrestation || 0) - (p.participation || p.ticketModerateur || 0));
    const paye = p.totalPaye || 0;
    const exclu = p.montantExclu || 0;
    const reste = partAssurance - paye - exclu;
    return reste > 50;
  }).length;

  const totalPartAssurance = filteredPrestations.reduce((sum, p) => {
    return sum + (p.montantARembourser ?? Math.max(0, (p.totalPrestation || 0) - (p.participation || p.ticketModerateur || 0)));
  }, 0);

  const tauxCouvertureGlobal = totalPartAssurance > 0 
    ? Math.round((totalPaye / totalPartAssurance) * 100) 
    : (totalReclame > 0 ? Math.round((totalPaye / totalReclame) * 100) : 0);

  // Helper getters
  const getSocieteNom = (id: string) => societes.find(s => s.id === id)?.nom || 'Société Inconnue';
  const getPersonneNom = (id: string) => personnes.find(p => p.id === id)?.nomPrenom || 'Assuré Inconnu';

  // --- Charts Data Preparation ---
  const caParSocieteMap = filteredPrestations.reduce((acc, p) => {
    const societeNom = getSocieteNom(p.societeId);
    if (!acc[societeNom]) acc[societeNom] = 0;
    acc[societeNom] += p.totalPrestation;
    return acc;
  }, {} as Record<string, number>);

  const caParSocieteData = Object.entries(caParSocieteMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

  const monthlyDataMap = filteredPrestations.reduce((acc, p) => {
    const dateObj = new Date(p.date);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    // Ex: "janv. 26"
    const monthLabel = dateObj.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    
    if (!acc[monthKey]) {
      acc[monthKey] = { label: monthLabel, monthKey, total: 0 };
    }
    acc[monthKey].total += p.totalPrestation;
    return acc;
  }, {} as Record<string, { label: string; monthKey: string; total: number }>);

  const monthlyData = Object.values(monthlyDataMap)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  // ------------------------------

  return (
    <div id="dashboard-view" className="space-y-6">
      {/* En-tête volontairement concis : les actions utiles restent accessibles sans bannière dense. */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Vue d'ensemble</h2>
          <p className="mt-0.5 text-sm text-slate-500">Les indicateurs essentiels de votre activité.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-quick-new-prestation"
            onClick={onOpenNewPrestation}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            <span>Prestations</span>
          </button>

          <button
            id="btn-quick-new-paiement"
            onClick={onOpenNewPaiement}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Receipt className="h-4 w-4" />
            <span>Règlements</span>
          </button>
        </div>
      </div>

      {/* 5 Major Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* 1. Total Prestations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Prestations</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatMoney(totalReclame)}</div>
          <div className="flex items-center text-xs text-slate-500">
            <span className="font-medium text-slate-700 mr-1">{filteredPrestations.length}</span> dossiers enregistrés
          </div>
        </div>

        {/* 2. Tickets Modérateurs (Copay) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tickets Modérateurs (Copay)</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600">{formatMoney(totalModerateur)}</div>
          <div className="text-xs text-slate-500">
            Part restant à la charge directe des assurés
          </div>
        </div>

        {/* 3. Total Règlements Effectués */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Règlements Effectués</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{formatMoney(totalPaye)}</div>
          <div className="flex items-center text-xs text-emerald-700">
            <TrendingUp className="w-3.5 h-3.5 mr-1 inline" />
            <span>Taux de prise en charge : <strong>{tauxCouvertureGlobal}%</strong></span>
          </div>
        </div>

        {/* 4. Factures à Recouvrir */}
        <div 
          onClick={() => onNavigate('prestations')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2 cursor-pointer hover:border-sky-300 hover:shadow-sm transition-all"
          title="Cliquer pour accéder aux prestations non soldées"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Factures à Recouvrir</span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-sky-700">{formatMoney(totalARecouvrer)}</div>
          <div className="flex items-center text-xs text-slate-500">
            <span className="font-medium text-slate-700 mr-1">{dossiersARecouvrer}</span> dossier(s) en attente
          </div>
        </div>

        {/* 5. Exclusions & Rejets */}
        <div 
          onClick={() => onNavigate('rejets')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2 cursor-pointer hover:border-rose-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Exclusions & Rejets</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600">{formatMoney(totalExclu)}</div>
          <div className="text-xs text-slate-500">
            Montants non pris en charge (cliquer pour détails)
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart: Répartition CA par Société */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Répartition par Société</h3>
          <div className="flex-1 min-h-[250px]">
            {caParSocieteData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={caParSocieteData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {caParSocieteData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Aucune donnée disponible
              </div>
            )}
          </div>
          {/* Custom minimal legend */}
          {caParSocieteData.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              {caParSocieteData.slice(0, 8).map((entry, index) => (
                <div key={entry.name} className="flex items-center text-[11px] text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="truncate max-w-[120px]" title={entry.name}>{entry.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bar Chart: Évolution mensuelle */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Évolution Mensuelle</h3>
          <div className="flex-1 min-h-[250px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                  />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Prestations Table */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">Derniers Dossiers de Prestations</h3>
            <button
              onClick={() => onNavigate('prestations')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
            >
              Tout voir <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Facture N°</th>
                  <th className="py-2.5 px-3">Assuré / Adhérent</th>
                  <th className="py-2.5 px-3">Société</th>
                  <th className="py-2.5 px-3 text-right">Montant</th>
                  <th className="py-2.5 px-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPrestations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 px-3 text-center text-slate-400">
                      Aucune prestation enregistrée.
                    </td>
                  </tr>
                )}
                {filteredPrestations.slice(0, 5).map(prestation => {
                  const pTot = prestation.totalPrestation || 0;
                  const pMod = prestation.participation || 0;
                  const pRemb = prestation.montantARembourser ?? Math.max(0, pTot - pMod);
                  const pPaye = prestation.totalPaye || 0;
                  const pExclu = prestation.montantExclu || 0;
                  const pReste = Math.max(0, pRemb - pPaye - pExclu);
                  const isFullyPaid = (pPaye >= pRemb && pRemb > 0) || (pReste <= 0 && pPaye > 0);
                  const isPartiallyPaid = pPaye > 0 && !isFullyPaid && pReste > 0;
                  const isExclu = pExclu >= pRemb && pRemb > 0 && pPaye === 0;
                  const statutDisplay = isExclu
                    ? 'Rejeté'
                    : isFullyPaid
                    ? 'Payé'
                    : isPartiallyPaid
                    ? 'Partiellement payé'
                    : 'En attente';

                  return (
                    <tr key={prestation.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 text-slate-600">{formatDate(prestation.date)}</td>
                      <td className="py-2.5 px-3 font-semibold text-indigo-600">{prestation.numeroFacture}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{getPersonneNom(prestation.personneId)}</td>
                      <td className="py-2.5 px-3 text-slate-600">{getSocieteNom(prestation.societeId)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {formatMoney(prestation.totalPrestation)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          statutDisplay === 'Payé'
                            ? 'bg-emerald-100 text-emerald-800'
                            : statutDisplay === 'Partiellement payé'
                            ? 'bg-sky-100 text-sky-800'
                            : statutDisplay === 'Rejeté'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {statutDisplay}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
