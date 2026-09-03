import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  Receipt,
  AlertTriangle,
  XCircle,
  Building2,
  Calendar,
  Users,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { formatMoney, formatDate } from '../utils/formatters';
import { unlessTextSelected } from '../utils/textSelection';
import { RejetDetail } from './RejetsView';

export interface GroupedRejetFacture {
  numeroFacture: string;
  societeId: string;
  societeNom: string;
  sousSocietes: string[];
  dateMin: string;
  dateMax: string;
  rejets: RejetDetail[];
  nombreAssures: number;
  nombreLignesRejet: number;
  totalMontantBrut: number;
  totalMontantRejete: number;
  tauxRejet: number; // (totalMontantRejete / totalMontantBrut) * 100
  hasDismissed?: boolean;
}

export type RejetFactureSortField =
  | 'numeroFacture'
  | 'date'
  | 'societe'
  | 'nombreAssures'
  | 'nombreLignesRejet'
  | 'totalMontantBrut'
  | 'totalMontantRejete'
  | 'tauxRejet';

interface FacturesRejetsGroupedTableProps {
  groupedFactures: GroupedRejetFacture[];
  expandedRows: Record<string, boolean>;
  toggleRow: (numeroFacture: string) => void;
  sortField: RejetFactureSortField;
  sortDirection: 'asc' | 'desc';
  onSort: (field: RejetFactureSortField) => void;
  onDismissRejet: (id: string, numFacture: string) => void;
  onRestoreRejet: (id: string, numFacture: string) => void;
  showDismissed: boolean;
}

export const FacturesRejetsGroupedTable: React.FC<FacturesRejetsGroupedTableProps> = ({
  groupedFactures,
  expandedRows,
  toggleRow,
  sortField,
  sortDirection,
  onSort,
  onDismissRejet,
  onRestoreRejet,
  showDismissed
}) => {
  const renderSortIcon = (field: RejetFactureSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-rose-600 font-bold ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-rose-600 font-bold ml-1" />
    );
  };

  const totals = groupedFactures.reduce(
    (acc, f) => {
      acc.totalBrut += f.totalMontantBrut;
      acc.totalRejete += f.totalMontantRejete;
      acc.totalRejetsCount += f.nombreLignesRejet;
      acc.totalAssuresCount += f.nombreAssures;
      return acc;
    },
    { totalBrut: 0, totalRejete: 0, totalRejetsCount: 0, totalAssuresCount: 0 }
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
      <div className="overflow-auto flex-1">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200 shadow-2xs">
            <tr>
              <th className="py-3 px-2 w-8"></th>

              {/* N° Facture */}
              <th
                onClick={unlessTextSelected(() => onSort('numeroFacture'))}
                className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${
                  sortField === 'numeroFacture' ? 'bg-rose-50/60 text-rose-900 font-bold' : ''
                }`}
              >
                <div className="flex items-center">
                  <span>N° Facture</span>
                  {renderSortIcon('numeroFacture')}
                </div>
              </th>

              {/* Date Soins */}
              <th
                onClick={unlessTextSelected(() => onSort('date'))}
                className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${
                  sortField === 'date' ? 'bg-rose-50/60 text-rose-900 font-bold' : ''
                }`}
              >
                <div className="flex items-center">
                  <span>Période / Date</span>
                  {renderSortIcon('date')}
                </div>
              </th>

              {/* Tiers-Payeur */}
              <th
                onClick={unlessTextSelected(() => onSort('societe'))}
                className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${
                  sortField === 'societe' ? 'bg-rose-50/60 text-rose-900 font-bold' : ''
                }`}
              >
                <div className="flex items-center">
                  <span>Organisme Assureur</span>
                  {renderSortIcon('societe')}
                </div>
              </th>

              {/* Assurés & Actes */}
              <th
                onClick={unlessTextSelected(() => onSort('nombreAssures'))}
                className={`py-3 px-3 text-center cursor-pointer group hover:bg-slate-100/80 transition ${
                  sortField === 'nombreAssures' ? 'bg-rose-50/60 text-rose-900 font-bold' : ''
                }`}
              >
                <div className="flex items-center justify-center">
                  <span>Assurés / Rejets</span>
                  {renderSortIcon('nombreAssures')}
                </div>
              </th>

              {/* Montant Initial Brut */}
              <th
                onClick={unlessTextSelected(() => onSort('totalMontantBrut'))}
                className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${
                  sortField === 'totalMontantBrut' ? 'bg-rose-50/60 text-rose-900 font-bold' : ''
                }`}
              >
                <div className="flex items-center justify-end">
                  <span>Total Facturé</span>
                  {renderSortIcon('totalMontantBrut')}
                </div>
              </th>

              {/* Montant Total Rejeté */}
              <th
                onClick={unlessTextSelected(() => onSort('totalMontantRejete'))}
                className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${
                  sortField === 'totalMontantRejete' ? 'bg-rose-50/60 text-rose-900 font-bold' : ''
                }`}
              >
                <div className="flex items-center justify-end">
                  <span className="text-rose-700">Montant Rejeté</span>
                  {renderSortIcon('totalMontantRejete')}
                </div>
              </th>

              {/* Impact / Taux */}
              <th
                onClick={unlessTextSelected(() => onSort('tauxRejet'))}
                className={`py-3 px-3 text-center cursor-pointer group hover:bg-slate-100/80 transition ${
                  sortField === 'tauxRejet' ? 'bg-rose-50/60 text-rose-900 font-bold' : ''
                }`}
              >
                <div className="flex items-center justify-center">
                  <span>Impact Rejet</span>
                  {renderSortIcon('tauxRejet')}
                </div>
              </th>

              <th className="py-3 px-3 text-center">Détails</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {groupedFactures.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold">Aucune facture avec rejet trouvée pour ces critères.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Modifiez les filtres de recherche ou sélectionnez une autre période.
                  </p>
                </td>
              </tr>
            ) : (
              groupedFactures.map((facture) => {
                const isExpanded = !!expandedRows[facture.numeroFacture];

                return (
                  <React.Fragment key={facture.numeroFacture}>
                    <tr
                      onClick={unlessTextSelected(() => toggleRow(facture.numeroFacture))}
                      className={`hover:bg-rose-50/40 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Expand Chevron */}
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(facture.numeroFacture);
                          }}
                          className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-700 transition"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-rose-600 font-bold" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* N° Facture */}
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-indigo-700 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{facture.numeroFacture}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {facture.nombreLignesRejet} ligne(s) d'exclusion/rejet
                        </div>
                      </td>

                      {/* Date Soins */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-700 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>
                            {facture.dateMin
                              ? facture.dateMin === facture.dateMax
                                ? formatDate(facture.dateMin)
                                : `${formatDate(facture.dateMin)} - ${formatDate(facture.dateMax)}`
                              : '-'}
                          </span>
                        </div>
                      </td>

                      {/* Tiers-Payeur */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{facture.societeNom}</span>
                        </div>
                        {facture.sousSocietes.length > 0 && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                            {facture.sousSocietes.join(', ')}
                          </div>
                        )}
                      </td>

                      {/* Assurés & Actes */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full text-[10px]">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>{facture.nombreAssures} patient(s)</span>
                        </div>
                      </td>

                      {/* Total Facturé */}
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {formatMoney(facture.totalMontantBrut)}
                      </td>

                      {/* Total Rejeté */}
                      <td className="py-3 px-3 text-right font-black text-rose-700 bg-rose-50/60 font-mono text-sm">
                        {formatMoney(facture.totalMontantRejete)}
                      </td>

                      {/* Impact / Taux */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            facture.tauxRejet >= 100
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : facture.tauxRejet >= 50
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {facture.tauxRejet.toFixed(0)}%
                          </span>
                          <span className="text-[9px] text-slate-400 mt-0.5">
                            {facture.tauxRejet >= 100 ? 'Rejet 100%' : 'Rejet partiel'}
                          </span>
                        </div>
                      </td>

                      {/* Action Expand Details */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleRow(facture.numeroFacture)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold transition cursor-pointer"
                        >
                          {isExpanded ? 'Masquer' : 'Voir les rejets'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Rows */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={9} className="p-4 space-y-3">
                          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
                            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-rose-700">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Actes Médicaux et Motifs de Rejet pour la facture {facture.numeroFacture}</span>
                              </span>
                              <span className="text-slate-400 lowercase font-normal">
                                {facture.rejets.length} acte(s) / exclusion(s)
                              </span>
                            </div>

                            <table className="w-full text-xs">
                              <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="py-2 px-2 text-left">Date</th>
                                  <th className="py-2 px-2 text-left">Patient / Assuré</th>
                                  <th className="py-2 px-2 text-left">Acte Médical</th>
                                  <th className="py-2 px-2 text-right">Montant Brut</th>
                                  <th className="py-2 px-2 text-right text-rose-700">Montant Rejeté</th>
                                  <th className="py-2 px-2 text-left">Motif notifié</th>
                                  <th className="py-2 px-2 text-center">Bordereau Paiement</th>
                                  <th className="py-2 px-2 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {facture.rejets.map((r) => (
                                  <tr key={r.id} className="hover:bg-rose-50/30">
                                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                                      {formatDate(r.dateSoins)}
                                    </td>
                                    <td className="py-2 px-2">
                                      <div className="font-semibold text-slate-900">{r.nomAgent}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">{r.matricule}</div>
                                    </td>
                                    <td className="py-2 px-2">
                                      <div className="font-mono font-bold text-indigo-700">{r.codeActe}</div>
                                      <div className="text-[10px] text-slate-600">{r.libelleActe}</div>
                                    </td>
                                    <td className="py-2 px-2 text-right font-medium text-slate-700 whitespace-nowrap">
                                      {formatMoney(r.montantInitial)}
                                    </td>
                                    <td className="py-2 px-2 text-right font-black text-rose-700 bg-rose-50/50 whitespace-nowrap">
                                      {formatMoney(r.montantExcluRejete)}
                                    </td>
                                    <td className="py-2 px-2 max-w-[200px]">
                                      <p className="text-[11px] text-slate-700 truncate" title={r.motif}>
                                        {r.motif}
                                      </p>
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono text-[10px] text-slate-600 whitespace-nowrap">
                                      {r.bordereauPaiement || '-'}
                                    </td>
                                    <td className="py-2 px-2 text-center whitespace-nowrap space-x-1">
                                      {showDismissed ? (
                                        <button
                                          type="button"
                                          onClick={() => onRestoreRejet(r.id, r.numeroFacture)}
                                          className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-[10px] font-semibold transition cursor-pointer"
                                          title="Restaurer"
                                        >
                                          <RotateCcw className="w-3 h-3 inline" />
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => onDismissRejet(r.id, r.numeroFacture)}
                                          className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-[10px] font-semibold transition cursor-pointer"
                                          title="Masquer"
                                        >
                                          <XCircle className="w-3 h-3 inline" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bar de Totaux Généraux */}
      <div className="sticky bottom-0 z-20 shrink-0 bg-slate-900 text-white border-t border-slate-800 px-4 py-3 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold uppercase text-slate-300 tracking-wider">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
          <span>Synthèse par Facture ({groupedFactures.length} factures rejetées)</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono font-bold">
          <div className="text-right">
            <span className="text-[10px] uppercase font-sans text-slate-400 block font-normal">Total Facturé</span>
            <span className="text-slate-100">{formatMoney(totals.totalBrut)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-sans text-rose-400 block font-normal">Total Rejeté</span>
            <span className="text-rose-400 font-extrabold text-sm">{formatMoney(totals.totalRejete)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-sans text-slate-400 block font-normal">Impact Global</span>
            <span className="text-amber-300">
              {totals.totalBrut > 0 ? ((totals.totalRejete / totals.totalBrut) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
