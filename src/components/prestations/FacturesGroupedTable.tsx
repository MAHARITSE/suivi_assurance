import React from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  Sparkles, 
  AlertTriangle, 
  CalendarCheck, 
  Building2, 
  Users, 
  Activity, 
  CreditCard, 
  CheckCircle2, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Receipt
} from 'lucide-react';
import { GroupedFacture, FactureSortField } from '../PrestationsView';
import { formatDate, formatMoney } from '../../utils/formatters';
import { Personne } from '../../types';

interface FacturesGroupedTableProps {
  factures: GroupedFacture[];
  expandedFactureRows: Record<string, boolean>;
  toggleFactureRow: (num: string) => void;
  factureSortField: FactureSortField;
  factureSortDirection: 'asc' | 'desc';
  onSort: (field: FactureSortField) => void;
  onViewFacture: (facture: GroupedFacture) => void;
  getPersonne: (id?: string) => Personne | undefined;
}

export const FacturesGroupedTable: React.FC<FacturesGroupedTableProps> = ({
  factures,
  expandedFactureRows,
  toggleFactureRow,
  factureSortField,
  factureSortDirection,
  onSort,
  onViewFacture,
  getPersonne,
}) => {
  const renderSortIcon = (field: FactureSortField) => {
    if (factureSortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
    }
    return factureSortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 font-bold ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 font-bold ml-1" />
    );
  };

  // Compute overall totals
  const totals = factures.reduce((acc, f) => {
    acc.totalFacture += f.totalFacture;
    acc.totalTicketMod += f.totalTicketMod;
    acc.totalARembourser += f.totalARembourser;
    acc.totalPaye += f.totalPaye;
    acc.resteAReclamer += f.resteAReclamer;
    acc.totalAssures += f.nombreAssures;
    acc.totalActes += f.nombreActes;
    return acc;
  }, {
    totalFacture: 0,
    totalTicketMod: 0,
    totalARembourser: 0,
    totalPaye: 0,
    resteAReclamer: 0,
    totalAssures: 0,
    totalActes: 0,
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
      <div className="overflow-auto flex-1">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200 select-none shadow-2xs">
            <tr>
              <th className="py-3 px-2 w-8"></th>

              {/* N° Facture */}
              <th 
                onClick={() => onSort('numeroFacture')}
                className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${factureSortField === 'numeroFacture' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
              >
                <div className="flex items-center">
                  <span>N° Facture</span>
                  {renderSortIcon('numeroFacture')}
                </div>
              </th>

              {/* Date */}
              <th 
                onClick={() => onSort('date')}
                className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${factureSortField === 'date' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
              >
                <div className="flex items-center">
                  <span>Période / Date</span>
                  {renderSortIcon('date')}
                </div>
              </th>

              {/* Société / Sous-sociétés */}
              <th 
                onClick={() => onSort('societe')}
                className={`py-3 px-3 cursor-pointer group hover:bg-slate-100/80 transition ${factureSortField === 'societe' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
              >
                <div className="flex items-center">
                  <span>Société & Sous-Sociétés</span>
                  {renderSortIcon('societe')}
                </div>
              </th>

              {/* Assurés & Actes */}
              <th 
                onClick={() => onSort('nombreAssures')}
                className={`py-3 px-3 text-center cursor-pointer group hover:bg-slate-100/80 transition ${factureSortField === 'nombreAssures' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
              >
                <div className="flex items-center justify-center">
                  <span>Assurés / Actes</span>
                  {renderSortIcon('nombreAssures')}
                </div>
              </th>

              {/* Montant Brut */}
              <th 
                onClick={() => onSort('totalFacture')}
                className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${factureSortField === 'totalFacture' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
              >
                <div className="flex items-center justify-end">
                  <span>Total Brut</span>
                  {renderSortIcon('totalFacture')}
                </div>
              </th>

              {/* Ticket Modérateur */}
              <th 
                onClick={() => onSort('totalTicketMod')}
                className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${factureSortField === 'totalTicketMod' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
              >
                <div className="flex items-center justify-end">
                  <span>Ticket Mod.</span>
                  {renderSortIcon('totalTicketMod')}
                </div>
              </th>

              {/* Part Assurance (À Rembourser) */}
              <th 
                onClick={() => onSort('totalARembourser')}
                className={`py-3 px-3 text-right cursor-pointer group hover:bg-slate-100/80 transition ${factureSortField === 'totalARembourser' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
              >
                <div className="flex items-center justify-end">
                  <span>Part Assurance</span>
                  {renderSortIcon('totalARembourser')}
                </div>
              </th>

              {/* Total Perçu (Encaissé) */}
              <th 
                onClick={() => onSort('totalPaye')}
                className={`py-3 px-3 text-right cursor-pointer group hover:bg-emerald-50/80 transition ${factureSortField === 'totalPaye' ? 'bg-emerald-100/70 text-emerald-950 font-bold' : 'text-emerald-800'}`}
              >
                <div className="flex items-center justify-end">
                  <span>Total Perçu</span>
                  {renderSortIcon('totalPaye')}
                </div>
              </th>

              {/* Montants Restant à Réclamer */}
              <th 
                onClick={() => onSort('resteAReclamer')}
                className={`py-3 px-3 text-right cursor-pointer group hover:bg-rose-50/80 transition ${factureSortField === 'resteAReclamer' ? 'bg-rose-100/70 text-rose-950 font-bold' : 'text-rose-800'}`}
              >
                <div className="flex items-center justify-end">
                  <span>Reste à Réclamer</span>
                  {renderSortIcon('resteAReclamer')}
                </div>
              </th>

              {/* Statut & Taux */}
              <th 
                onClick={() => onSort('statut')}
                className={`py-3 px-3 text-center cursor-pointer group hover:bg-slate-100/80 transition ${factureSortField === 'statut' ? 'bg-indigo-50/60 text-indigo-900 font-bold' : ''}`}
              >
                <div className="flex items-center justify-center">
                  <span>Statut / Encaissement</span>
                  {renderSortIcon('statut')}
                </div>
              </th>

              {/* Actions */}
              <th className="py-3 px-3 text-center w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {factures.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Receipt className="w-8 h-8 text-slate-300 stroke-1" />
                    <p className="text-sm font-medium text-slate-500">Aucune facture correspondant à vos critères</p>
                    <p className="text-xs text-slate-400">Modifiez vos filtres ou importez de nouvelles factures SALFA</p>
                  </div>
                </td>
              </tr>
            ) : (
              factures.map(facture => {
                const isExpanded = expandedFactureRows[facture.numeroFacture];

                return (
                  <React.Fragment key={facture.numeroFacture}>
                    <tr 
                      onClick={() => toggleFactureRow(facture.numeroFacture)}
                      className={`hover:bg-indigo-50/30 transition-colors cursor-pointer select-none ${
                        isExpanded ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {/* Chevron */}
                      <td className="py-3 px-2 text-center text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-indigo-600 inline-block" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 inline-block" />
                        )}
                      </td>

                      {/* N° Facture */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        <div className="flex items-center space-x-1.5">
                          <span>{facture.numeroFacture}</span>
                          {facture.hasMatch && (
                            <span title="Rapprochement parfait date & montant avec un règlement" className="p-0.5 rounded bg-emerald-100 text-emerald-800">
                              <Sparkles className="w-3 h-3" />
                            </span>
                          )}
                          {facture.hasDuplicate && (
                            <span title="Attention: Autre facture avec même date & montant" className="p-0.5 rounded bg-amber-100 text-amber-800">
                              <AlertTriangle className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {facture.dateMin ? (
                          facture.dateMin === facture.dateMax 
                            ? formatDate(facture.dateMin) 
                            : `${formatDate(facture.dateMin)} - ${formatDate(facture.dateMax)}`
                        ) : '-'}
                      </td>

                      {/* Société & Sous-sociétés */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{facture.societeNom}</div>
                        {facture.sousSocietes.length > 0 && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[200px]" title={facture.sousSocietes.join(', ')}>
                            {facture.sousSocietes.join(', ')}
                          </div>
                        )}
                      </td>

                      {/* Assurés / Actes */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>{facture.nombreAssures} pers.</span>
                          <span className="text-slate-400">•</span>
                          <span>{facture.nombreActes} actes</span>
                        </span>
                      </td>

                      {/* Montant Brut */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                        {formatMoney(facture.totalFacture)}
                      </td>

                      {/* Ticket Modérateur */}
                      <td className="py-3 px-3 text-right font-mono text-amber-700 whitespace-nowrap font-medium">
                        {formatMoney(facture.totalTicketMod)}
                      </td>

                      {/* Part Assurance (À Rembourser) */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatMoney(facture.totalARembourser)}
                      </td>

                      {/* Total Perçu (Encaissé) - Highlighted */}
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700 bg-emerald-50/40 whitespace-nowrap">
                        {formatMoney(facture.totalPaye)}
                      </td>

                      {/* Reste à Réclamer - Highlighted */}
                      <td className="py-3 px-3 text-right font-mono font-extrabold whitespace-nowrap">
                        <span className={facture.resteAReclamer > 0 ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200' : 'text-slate-400'}>
                          {formatMoney(facture.resteAReclamer)}
                        </span>
                      </td>

                      {/* Statut & Taux */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            facture.statut === 'Payé'
                              ? 'bg-emerald-100 text-emerald-800'
                              : facture.statut === 'Partiellement payé'
                              ? 'bg-sky-100 text-sky-800'
                              : facture.statut === 'Rejeté'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {facture.statut}
                          </span>
                          <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                facture.tauxRecouvrement >= 100 ? 'bg-emerald-600' : 'bg-indigo-600'
                              }`} 
                              style={{ width: `${facture.tauxRecouvrement}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onViewFacture(facture)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Voir la synthèse complète de la facture"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Sub-table: Insured beneficiaries under this facture */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-y border-slate-200">
                        <td colSpan={12} className="p-4 space-y-3">
                          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                                  Bénéficiaires & Dossiers inclus dans la Facture {facture.numeroFacture} ({facture.prestations.length})
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-semibold">
                                <span className="text-slate-600">
                                  Total Brut : <strong className="font-mono text-slate-900">{formatMoney(facture.totalFacture)}</strong>
                                </span>
                                <span className="text-emerald-700">
                                  Perçu : <strong className="font-mono">{formatMoney(facture.totalPaye)}</strong>
                                </span>
                                <span className={facture.resteAReclamer > 0 ? 'text-rose-700' : 'text-slate-500'}>
                                  Restant : <strong className="font-mono">{formatMoney(facture.resteAReclamer)}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Insured Beneficiaries Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="text-slate-500 border-b border-slate-100 text-[10px] uppercase font-semibold">
                                    <th className="py-2 px-2.5">Bénéficiaire / Matricule</th>
                                    <th className="py-2 px-2.5">Date Soins</th>
                                    <th className="py-2 px-2.5">Sous-Société</th>
                                    <th className="py-2 px-2.5 text-center">Actes</th>
                                    <th className="py-2 px-2.5 text-right">Montant Brut</th>
                                    <th className="py-2 px-2.5 text-right">Ticket Mod.</th>
                                    <th className="py-2 px-2.5 text-right">Part Assurance</th>
                                    <th className="py-2 px-2.5 text-right text-emerald-700">Total Perçu</th>
                                    <th className="py-2 px-2.5 text-right text-rose-700">Reste</th>
                                    <th className="py-2 px-2.5 text-center">Statut</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {facture.prestations.map((p, pIdx) => {
                                    const pers = getPersonne(p.personneId);
                                    const pNom = p.nomAgent || pers?.nomPrenom || p.matricule || 'Assuré';
                                    const pMat = pers?.matricule || p.matricule || '-';
                                    const pTot = p.totalPrestation || 0;
                                    const pPart = p.participation || 0;
                                    const pRemb = Math.max(0, pTot - pPart);
                                    const pPaye = p.totalPaye || 0;
                                    const pReste = Math.max(0, pRemb - pPaye);

                                    return (
                                      <tr key={p.id || pIdx} className="hover:bg-slate-50/80">
                                        <td className="py-2 px-2.5">
                                          <div className="font-bold text-slate-900">{pNom}</div>
                                          <div className="text-[10px] text-slate-500 font-mono">Mat: {pMat}</div>
                                        </td>
                                        <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">
                                          {formatDate(p.date)}
                                        </td>
                                        <td className="py-2 px-2.5 text-slate-600">
                                          {p.sousSociete || '-'}
                                        </td>
                                        <td className="py-2 px-2.5 text-center font-mono">
                                          {p.lignes?.length || 1}
                                        </td>
                                        <td className="py-2 px-2.5 text-right font-mono text-slate-900">
                                          {formatMoney(pTot)}
                                        </td>
                                        <td className="py-2 px-2.5 text-right font-mono text-amber-700">
                                          {formatMoney(pPart)}
                                        </td>
                                        <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                                          {formatMoney(pRemb)}
                                        </td>
                                        <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700">
                                          {formatMoney(pPaye)}
                                        </td>
                                        <td className="py-2 px-2.5 text-right font-mono font-bold">
                                          <span className={pReste > 0 ? 'text-rose-700' : 'text-slate-400'}>
                                            {formatMoney(pReste)}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2.5 text-center">
                                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                            p.statut === 'Payé'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : p.statut === 'Partiellement payé'
                                              ? 'bg-sky-100 text-sky-800'
                                              : p.statut === 'Rejeté'
                                              ? 'bg-rose-100 text-rose-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {p.statut}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Règlements rattachés sur cette facture */}
                            {facture.bordereaux.length > 0 && (
                              <div className="bg-emerald-50/70 rounded-lg border border-emerald-200 p-2.5 space-y-1.5">
                                <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Bordereaux de Règlements rattachés ({facture.bordereaux.length})</span>
                                  </span>
                                  <span className="font-mono text-emerald-800 font-extrabold">
                                    Total réglé : {formatMoney(facture.totalPaye)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {facture.bordereaux.map((b, bIdx) => (
                                    <div key={bIdx} className="bg-white rounded-md border border-emerald-200 p-2 text-xs flex items-center justify-between">
                                      <div>
                                        <div className="font-bold text-slate-800 font-mono text-[11px]">{b.bordereau}</div>
                                        <div className="text-[10px] text-slate-500">{formatDate(b.date)} • {b.mode}</div>
                                      </div>
                                      <div className="font-mono font-bold text-emerald-700 text-right">
                                        {formatMoney(b.montant)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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

      {/* Bar de Totaux Généraux toujours visible en bas de la page */}
      <div className="sticky bottom-0 z-20 bg-slate-900 text-white border-t border-slate-800 px-4 py-3 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold uppercase text-slate-300 tracking-wider">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
          <span>Total Synthèse Factures ({factures.length} factures / {totals.totalAssures} assurés)</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono font-bold">
          <div className="text-right">
            <span className="text-[10px] uppercase font-sans text-slate-400 block font-normal">Total Brut</span>
            <span className="text-slate-100">{formatMoney(totals.totalFacture)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-sans text-amber-400 block font-normal">Ticket Mod.</span>
            <span className="text-amber-300">{formatMoney(totals.totalTicketMod)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-sans text-indigo-300 block font-normal">Part Assurance</span>
            <span className="text-indigo-200">{formatMoney(totals.totalARembourser)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-sans text-emerald-400 block font-normal">Total Perçu</span>
            <span className="text-emerald-400">{formatMoney(totals.totalPaye)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-sans text-rose-400 block font-normal">Reste à Réclamer</span>
            <span className={totals.resteAReclamer > 0 ? 'text-rose-400 font-extrabold' : 'text-slate-400'}>
              {formatMoney(totals.resteAReclamer)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
