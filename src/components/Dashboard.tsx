import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Plus, 
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Prestation, Paiement, Societe, Famille, Personne, ActiveTab } from '../types';
import { formatMoney, formatDate } from '../utils/formatters';

interface DashboardProps {
  prestations: Prestation[];
  paiements: Paiement[];
  societes: Societe[];
  familles: Famille[];
  personnes: Personne[];
  selectedSocieteId: string;
  onNavigate: (tab: ActiveTab) => void;
  onOpenNewPrestation: () => void;
  onOpenNewPaiement: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  prestations,
  paiements,
  societes,
  familles,
  personnes,
  selectedSocieteId,
  onNavigate,
  onOpenNewPrestation,
  onOpenNewPaiement,
}) => {
  // Filter by selected society if active
  const filteredPrestations = selectedSocieteId === 'ALL'
    ? prestations
    : prestations.filter(p => p.societeId === selectedSocieteId);

  const filteredPaiements = selectedSocieteId === 'ALL'
    ? paiements
    : paiements.filter(p => p.societeId === selectedSocieteId);

  // Compute key indicators
  const totalReclame = filteredPrestations.reduce((sum, p) => sum + p.totalPrestation, 0);
  const totalPaye = filteredPaiements.reduce((sum, p) => sum + p.totalPaye, 0);
  const totalModerateur = filteredPaiements.reduce((sum, p) => sum + p.totalModerateur, 0);
  const totalExclu = filteredPaiements.reduce((sum, p) => sum + p.totalExclu, 0);

  const resteARegler = Math.max(0, totalReclame - (totalPaye + totalModerateur + totalExclu));
  const tauxCouvertureGlobal = totalReclame > 0 ? Math.round((totalPaye / totalReclame) * 100) : 0;

  // Breakdown by Famille / Medical Category
  const familleBreakdown = familles.map(fam => {
    let sumTotal = 0;
    let sumPaye = 0;
    filteredPrestations.forEach(p => {
      p.lignes.forEach(l => {
        if (l.code === fam.code) {
          sumTotal += l.totalPrestation;
          sumPaye += l.totalPaye;
        }
      });
    });
    return {
      famille: fam,
      total: sumTotal,
      paye: sumPaye,
    };
  }).filter(item => item.total > 0).sort((a, b) => b.total - a.total);

  // Helper getters
  const getSocieteNom = (id: string) => societes.find(s => s.id === id)?.nom || 'Société Inconnue';
  const getPersonneNom = (id: string) => personnes.find(p => p.id === id)?.nomPrenom || 'Assuré Inconnu';

  return (
    <div id="dashboard-view" className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold">Suivi et Rapprochement des Assurances Santé</h2>
          </div>
          <p className="text-slate-300 text-sm max-w-2xl">
            Système centralisé de traitement des dossiers de soins, contrôle des franchises et calcul des bordereaux de règlement assurance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            id="btn-quick-new-prestation"
            onClick={onOpenNewPrestation}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Prestation</span>
          </button>

          <button
            id="btn-quick-new-paiement"
            onClick={onOpenNewPaiement}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow transition"
          >
            <Receipt className="w-4 h-4" />
            <span>Saisie Règlement</span>
          </button>

          <button
            id="btn-quick-import"
            onClick={() => onNavigate('importation')}
            className="flex items-center space-x-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-sm font-semibold px-4 py-2 rounded-xl border border-indigo-400/30 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-300" />
            <span>Importer PDF / Excel</span>
          </button>
        </div>
      </div>

      {/* 4 Major Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <span>Taux de prise en charge effectif : <strong>{tauxCouvertureGlobal}%</strong></span>
          </div>
        </div>

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

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Exclusions & Rejets</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600">{formatMoney(totalExclu)}</div>
          <div className="text-xs text-slate-500">
            Montants non pris en charge ou hors-barème
          </div>
        </div>
      </div>

      {/* Middle Section: Breakdown by Category + Recent Settlements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Breakdown by Medical Category (Familles d'actes) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>Répartition par Type de Soins</span>
            </h3>
            <button
              onClick={() => onNavigate('familles')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
            >
              Barèmes <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          <div className="space-y-3">
            {familleBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucune prestation enregistrée pour cette sélection.</p>
            ) : (
              familleBreakdown.map(item => {
                const percent = totalReclame > 0 ? Math.round((item.total / totalReclame) * 100) : 0;
                return (
                  <div key={item.famille.code} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700">{item.famille.libelle} ({item.famille.code})</span>
                      <span className="text-slate-900 font-semibold">{formatMoney(item.total)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Remboursé: {formatMoney(item.paye)}</span>
                      <span>{percent}% du total</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Prestations Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 lg:col-span-2 space-y-4">
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
                {filteredPrestations.slice(0, 5).map(prestation => (
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
                        prestation.statut === 'Payé'
                          ? 'bg-emerald-100 text-emerald-800'
                          : prestation.statut === 'Partiellement payé'
                          ? 'bg-sky-100 text-sky-800'
                          : prestation.statut === 'Rejeté'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {prestation.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Payments / Bordereaux */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Bordereaux de Règlements Récents</h3>
            <p className="text-xs text-slate-500">Rapprochement financier des paiements reçus des compagnies d'assurance</p>
          </div>
          <button
            onClick={() => onNavigate('paiements')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
          >
            Tous les Règlements <ArrowRight className="w-3 h-3 ml-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPaiements.slice(0, 3).map(paiement => (
            <div key={paiement.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-900 text-sm">{paiement.numeroBordereau}</span>
                <span className="text-xs text-slate-500">{formatDate(paiement.datePaiement)}</span>
              </div>
              <div className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">Société:</span> {getSocieteNom(paiement.societeId)}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Réglé</span>
                  <span className="font-bold text-emerald-600">{formatMoney(paiement.totalPaye)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Ticket Modérateur</span>
                  <span className="font-semibold text-amber-700">{formatMoney(paiement.totalModerateur)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
