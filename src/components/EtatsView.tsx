import React, { useState } from 'react';
import { 
  Printer, 
  FileText, 
  Receipt, 
  Users, 
  Building, 
  Layers, 
  Download, 
  Calendar,
  CheckCircle,
  ShieldCheck
} from 'lucide-react';
import { Prestation, Paiement, Societe, Personne, Famille } from '../types';
import { formatMoney, formatDate } from '../utils/formatters';

interface EtatsViewProps {
  prestations: Prestation[];
  paiements: Paiement[];
  societes: Societe[];
  personnes: Personne[];
  familles: Famille[];
  selectedSocieteId: string;
}

type ReportType = 
  | 'bordereau_paiement'
  | 'releve_prestations'
  | 'synthese_societe'
  | 'liste_assures'
  | 'tableau_familles';

export const EtatsView: React.FC<EtatsViewProps> = ({
  prestations,
  paiements,
  societes,
  personnes,
  familles,
  selectedSocieteId,
}) => {
  const [reportType, setReportType] = useState<ReportType>('releve_prestations');
  const [targetPaiementId, setTargetPaiementId] = useState<string>(paiements[0]?.id || '');
  const [targetSocieteId, setTargetSocieteId] = useState<string>(
    selectedSocieteId !== 'ALL' ? selectedSocieteId : societes[0]?.id || ''
  );

  const selectedSociete = societes.find(s => s.id === targetSocieteId) || societes[0];
  const selectedPaiement = paiements.find(p => p.id === targetPaiementId) || paiements[0];

  const getSocieteNom = (id: string) => societes.find(s => s.id === id)?.nom || 'Société';
  const getPersonne = (id: string) => personnes.find(p => p.id === id);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="etats-view" className="space-y-6">
      {/* Control Bar (Hidden on print) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Générateur d'États & Rapports d'Impression</h2>
            <p className="text-xs text-slate-500">
              Générez et imprimez les bordereaux officiels de règlement, relevés de prestations et fiches récapitulatives
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer / Exporter en PDF</span>
          </button>
        </div>

        {/* Report Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => setReportType('releve_prestations')}
            className={`p-2.5 rounded-lg font-medium text-left border transition ${
              reportType === 'releve_prestations'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4 mb-1 text-indigo-600" />
            <span>Relevé des Prestations</span>
          </button>

          <button
            onClick={() => setReportType('bordereau_paiement')}
            className={`p-2.5 rounded-lg font-medium text-left border transition ${
              reportType === 'bordereau_paiement'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Receipt className="w-4 h-4 mb-1 text-emerald-600" />
            <span>Bordereau de Règlement</span>
          </button>

          <button
            onClick={() => setReportType('synthese_societe')}
            className={`p-2.5 rounded-lg font-medium text-left border transition ${
              reportType === 'synthese_societe'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building className="w-4 h-4 mb-1 text-sky-600" />
            <span>Synthèse par Société</span>
          </button>

          <button
            onClick={() => setReportType('liste_assures')}
            className={`p-2.5 rounded-lg font-medium text-left border transition ${
              reportType === 'liste_assures'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4 mb-1 text-purple-600" />
            <span>Registre des Assurés</span>
          </button>

          <button
            onClick={() => setReportType('tableau_familles')}
            className={`p-2.5 rounded-lg font-medium text-left border transition ${
              reportType === 'tableau_familles'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4 mb-1 text-amber-600" />
            <span>Barème des Actes</span>
          </button>
        </div>

        {/* Filter contextual parameters */}
        <div className="flex flex-wrap gap-4 pt-2 text-xs">
          {reportType === 'bordereau_paiement' ? (
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Sélectionner le Bordereau :</span>
              <select
                value={targetPaiementId}
                onChange={(e) => setTargetPaiementId(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
              >
                {paiements.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.numeroBordereau} ({formatDate(p.datePaiement)} - {formatMoney(p.totalPaye)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Filtrer par Société d'Assurance :</span>
              <select
                value={targetSocieteId}
                onChange={(e) => setTargetSocieteId(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-lg text-xs"
              >
                <option value="ALL">Toutes les Sociétés</option>
                {societes.map(s => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Printable Paper Canvas */}
      <div id="printable-section" className="bg-white rounded-xl border border-slate-300 shadow-lg p-8 max-w-4xl mx-auto text-slate-900 space-y-6">
        {/* Document Official Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-7 h-7 text-indigo-700" />
              <span className="text-xl font-black tracking-tight text-slate-900">SUIVI ASSURANCE SANTÉ</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Système de Traitement des Prestations Médicales & Règlements</p>
            <p className="text-[11px] text-slate-400">Date d'édition : {formatDate(new Date().toISOString())}</p>
          </div>

          <div className="text-right text-xs text-slate-600">
            <div className="font-bold text-sm text-slate-900">ETAT OFFICIEL D'ASSURANCE</div>
            <div className="font-mono text-[11px] text-slate-500">Réf: ETAT-{Date.now().toString().slice(-6)}</div>
          </div>
        </div>

        {/* 1. REPORT: RELEVE DES PRESTATIONS */}
        {reportType === 'releve_prestations' && (
          <div className="space-y-4">
            <div className="text-center py-2 bg-slate-100 rounded-lg">
              <h3 className="font-bold text-base uppercase text-slate-900">
                Relevé Général des Prestations & Soins Médicaux
              </h3>
              <p className="text-xs text-slate-600">
                {targetSocieteId === 'ALL' ? 'Toutes Sociétés Confondues' : `Organisme : ${selectedSociete?.nom}`}
              </p>
            </div>

            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">N° Facture</th>
                  <th className="p-2 text-left">Assuré / Matricule</th>
                  <th className="p-2 text-left">Société</th>
                  <th className="p-2 text-right">Total Facturé</th>
                  <th className="p-2 text-right">Ticket Modérateur</th>
                  <th className="p-2 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {prestations
                  .filter(p => targetSocieteId === 'ALL' || p.societeId === targetSocieteId)
                  .map(p => {
                    const personne = getPersonne(p.personneId);
                    return (
                      <tr key={p.id}>
                        <td className="p-2">{formatDate(p.date)}</td>
                        <td className="p-2 font-mono font-bold text-indigo-900">{p.numeroFacture}</td>
                        <td className="p-2">
                          <div className="font-semibold">{personne?.nomPrenom}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{personne?.matricule}</div>
                        </td>
                        <td className="p-2">{getSocieteNom(p.societeId)}</td>
                        <td className="p-2 text-right font-medium">{formatMoney(p.totalPrestation)}</td>
                        <td className="p-2 text-right text-slate-600">{formatMoney(p.participation)}</td>
                        <td className="p-2 text-center font-medium">{p.statut}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. REPORT: BORDEREAU DE PAIEMENT */}
        {reportType === 'bordereau_paiement' && selectedPaiement && (
          <div className="space-y-4">
            <div className="text-center py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <h3 className="font-bold text-base uppercase text-emerald-950">
                Bordereau de Règlement Assurance N° {selectedPaiement.numeroBordereau}
              </h3>
              <p className="text-xs text-emerald-800">
                Organisme : {getSocieteNom(selectedPaiement.societeId)} • Date : {formatDate(selectedPaiement.datePaiement)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">Mode de Paiement :</span>
                <span className="font-semibold">{selectedPaiement.modePaiement}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Réf. Transaction :</span>
                <span className="font-mono font-semibold">{selectedPaiement.referencePaiement}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Statut :</span>
                <span className="font-semibold text-emerald-700">{selectedPaiement.statut}</span>
              </div>
            </div>

            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 text-left">Matricule</th>
                  <th className="p-2 text-left">Nom de l'Assuré</th>
                  <th className="p-2 text-right">Part Réglée (Ar)</th>
                  <th className="p-2 text-right">Ticket Modérateur</th>
                  <th className="p-2 text-right">Exclusion / Rejet</th>
                  <th className="p-2 text-left">Motif / Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedPaiement.lignes.map(l => (
                  <tr key={l.id}>
                    <td className="p-2 font-mono font-bold">{l.immatriculation}</td>
                    <td className="p-2 font-semibold">{l.nomBaseAssurance}</td>
                    <td className="p-2 text-right font-bold text-emerald-800">{formatMoney(l.totalPaye)}</td>
                    <td className="p-2 text-right text-slate-700">{formatMoney(l.ticketModerateur)}</td>
                    <td className="p-2 text-right text-rose-700">{formatMoney(l.montantExclu)}</td>
                    <td className="p-2 text-[11px] text-slate-500">{l.commentaire || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={2} className="p-2 text-right">TOTAUX :</td>
                  <td className="p-2 text-right text-emerald-900">{formatMoney(selectedPaiement.totalPaye)}</td>
                  <td className="p-2 text-right">{formatMoney(selectedPaiement.totalModerateur)}</td>
                  <td className="p-2 text-right text-rose-800">{formatMoney(selectedPaiement.totalExclu)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 3. REPORT: SYNTHESE PAR SOCIETE */}
        {reportType === 'synthese_societe' && (
          <div className="space-y-4">
            <div className="text-center py-2 bg-slate-100 rounded-lg">
              <h3 className="font-bold text-base uppercase text-slate-900">
                Synthèse Financière & Statistique par Compagnie d'Assurance
              </h3>
            </div>

            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Compagnie / Société</th>
                  <th className="p-2 text-right">Taux Contractuel</th>
                  <th className="p-2 text-right">Total Facturé</th>
                  <th className="p-2 text-right">Total Règlements</th>
                  <th className="p-2 text-right">Tickets Modérateurs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {societes.map(soc => {
                  const socPrestations = prestations.filter(p => p.societeId === soc.id);
                  const socPaiements = paiements.filter(p => p.societeId === soc.id);
                  const sumPrestations = socPrestations.reduce((s, p) => s + p.totalPrestation, 0);
                  const sumPaye = socPaiements.reduce((s, p) => s + p.totalPaye, 0);
                  const sumModerateur = socPaiements.reduce((s, p) => s + p.totalModerateur, 0);

                  return (
                    <tr key={soc.id}>
                      <td className="p-2 font-mono font-bold text-indigo-900">{soc.code}</td>
                      <td className="p-2 font-semibold">{soc.nom}</td>
                      <td className="p-2 text-right">{soc.tauxCouvertureDefaut}%</td>
                      <td className="p-2 text-right font-medium">{formatMoney(sumPrestations)}</td>
                      <td className="p-2 text-right font-bold text-emerald-800">{formatMoney(sumPaye)}</td>
                      <td className="p-2 text-right text-slate-600">{formatMoney(sumModerateur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. REPORT: REGISTRE DES ASSURES */}
        {reportType === 'liste_assures' && (
          <div className="space-y-4">
            <div className="text-center py-2 bg-slate-100 rounded-lg">
              <h3 className="font-bold text-base uppercase text-slate-900">
                Registre des Adhérents & Bénéficiaires Couverts
              </h3>
            </div>

            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 text-left">Matricule</th>
                  <th className="p-2 text-left">Nom & Prénom</th>
                  <th className="p-2 text-left">Qualité</th>
                  <th className="p-2 text-left">Société d'Affiliation</th>
                  <th className="p-2 text-left">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {personnes.map(p => (
                  <tr key={p.id}>
                    <td className="p-2 font-mono font-bold">{p.matricule}</td>
                    <td className="p-2 font-semibold">{p.nomPrenom}</td>
                    <td className="p-2">{p.qualite}</td>
                    <td className="p-2">{getSocieteNom(p.societeId)}</td>
                    <td className="p-2 text-slate-600">{p.telephone || p.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. REPORT: TABLEAU DES BAREMES */}
        {reportType === 'tableau_familles' && (
          <div className="space-y-4">
            <div className="text-center py-2 bg-slate-100 rounded-lg">
              <h3 className="font-bold text-base uppercase text-slate-900">
                Nomenclature & Barème des Actes Médicaux
              </h3>
            </div>

            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Désignation de la Famille</th>
                  <th className="p-2 text-right">Taux de Remboursement</th>
                  <th className="p-2 text-right">Plafond Annuel</th>
                  <th className="p-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {familles.map(f => (
                  <tr key={f.id}>
                    <td className="p-2 font-mono font-bold text-indigo-900">{f.code}</td>
                    <td className="p-2 font-semibold">{f.libelle}</td>
                    <td className="p-2 text-right font-bold text-emerald-700">{f.tauxStandard}%</td>
                    <td className="p-2 text-right font-medium">{formatMoney(f.plafondAnnuel)}</td>
                    <td className="p-2 text-[11px] text-slate-500">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signatures & Certification Block for Official Print */}
        <div className="pt-12 grid grid-cols-2 gap-8 text-xs">
          <div className="text-center space-y-12">
            <div className="font-bold text-slate-800">Le Responsable des Prestations</div>
            <div className="border-t border-dashed border-slate-400 w-48 mx-auto pt-1 text-[10px] text-slate-400">
              Signature & Cachet
            </div>
          </div>

          <div className="text-center space-y-12">
            <div className="font-bold text-slate-800">La Direction Médicale & Financière</div>
            <div className="border-t border-dashed border-slate-400 w-48 mx-auto pt-1 text-[10px] text-slate-400">
              Signature & Visa
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
