import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  Link2, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  User, 
  Unlink
} from 'lucide-react';
import { Paiement, LignePaiement, Prestation } from '../../types';
import { formatMoney, formatDate } from '../../utils/formatters';

interface RelierPaiementModalProps {
  isOpen: boolean;
  onClose: () => void;
  paiement: Paiement | null;
  lignePaiement: LignePaiement | null;
  prestations: Prestation[];
  onSavePaiement: (paiement: Paiement, updatedPrestations: Prestation[]) => void;
}

interface MatchCandidate {
  prestationId: string;
  prestationNum: string;
  prestationDate: string;
  lignePrestationId: string;
  codeActe: string;
  libelleActe: string;
  societeId?: string;
  societeNom?: string;
  sousSociete?: string;
  personneId?: string;
  personneNom: string;
  matricule: string;
  montantInitial: number;
  ticketModerateur: number;
  montantARembourser: number;
  dejaPaye: number;
  resteAPayer: number;
}

function getConfrontationDetails(
  dateSoins?: string,
  montantBrutSettlement?: number,
  netAPayerSettlement?: number,
  candidate?: MatchCandidate
) {
  if (!candidate) {
    return {
      type: 'UNLINKED',
      isSameDate: false,
      isSameMontantBrut: false,
      isSameMontantNet: false,
      isSameMontant: false,
      diffMontantBrut: 0,
      label: 'Non relié',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 font-medium',
      cardBorderClass: 'border-slate-200 bg-slate-50',
      rowBorderClass: 'hover:bg-indigo-50/40',
      tagColor: 'slate'
    };
  }

  const cleanDateSoins = (dateSoins || '').trim().substring(0, 10);
  const candDate = (candidate.prestationDate || '').trim().substring(0, 10);
  const isSameDate = Boolean(cleanDateSoins && candDate && cleanDateSoins === candDate);

  const brut = Number(montantBrutSettlement || 0);
  const net = Number(netAPayerSettlement || 0);

  const candBrut = Number(candidate.montantInitial || 0);
  const candRemb = Number(candidate.montantARembourser || 0);
  const candReste = Number(candidate.resteAPayer || 0);

  const isSameMontantBrut = brut > 0 && Math.abs(brut - candBrut) < 2;
  const isSameMontantNet = net > 0 && (Math.abs(net - candRemb) < 2 || Math.abs(net - candReste) < 2);
  const isSameMontant = isSameMontantBrut || isSameMontantNet;
  const diffMontantBrut = brut - candBrut;

  if (isSameDate && isSameMontant) {
    return {
      type: 'PERFECT',
      isSameDate,
      isSameMontantBrut,
      isSameMontantNet,
      isSameMontant,
      diffMontantBrut,
      label: 'Même Date & Même Montant',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
      cardBorderClass: 'border-emerald-300 bg-emerald-50/70',
      rowBorderClass: 'border-l-4 border-l-emerald-500 bg-emerald-50/30',
      tagColor: 'emerald'
    };
  }

  if (isSameDate && !isSameMontant) {
    return {
      type: 'SAME_DATE',
      isSameDate,
      isSameMontantBrut,
      isSameMontantNet,
      isSameMontant,
      diffMontantBrut,
      label: 'Même Date (Montant différent)',
      badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 font-semibold',
      cardBorderClass: 'border-sky-300 bg-sky-50/60',
      rowBorderClass: 'border-l-4 border-l-sky-500 bg-sky-50/20',
      tagColor: 'sky'
    };
  }

  if (!isSameDate && isSameMontant) {
    return {
      type: 'SAME_AMOUNT',
      isSameDate,
      isSameMontantBrut,
      isSameMontantNet,
      isSameMontant,
      diffMontantBrut,
      label: 'Même Montant (Date différente)',
      badgeClass: 'bg-purple-100 text-purple-900 border-purple-300 font-semibold',
      cardBorderClass: 'border-purple-300 bg-purple-50/60',
      rowBorderClass: 'border-l-4 border-l-purple-500 bg-purple-50/20',
      tagColor: 'purple'
    };
  }

  return {
    type: 'VERIFY',
    isSameDate,
    isSameMontantBrut,
    isSameMontantNet,
    isSameMontant,
    diffMontantBrut,
    label: 'À vérifier (Date & Montant diffèrent)',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-medium',
    cardBorderClass: 'border-amber-300 bg-amber-50/60',
    rowBorderClass: 'border-l-4 border-l-amber-500 bg-amber-50/20',
    tagColor: 'amber'
  };
}

export const RelierPaiementModal: React.FC<RelierPaiementModalProps> = ({
  isOpen,
  onClose,
  paiement,
  lignePaiement,
  prestations,
  onSavePaiement,
}) => {
  const [actSearchQuery, setActSearchQuery] = useState('');

  // Extract patient info & settlement line values
  const activeNom = lignePaiement?.nomAgent || lignePaiement?.nomBaseAssurance || '';
  const activeMat = lignePaiement?.immatriculation || '';
  const activeDate = lignePaiement?.dateSoins || '';
  const activeBrut = lignePaiement?.montantReclame || 
    ((lignePaiement?.totalPaye || 0) + (lignePaiement?.ticketModerateur || 0) + (lignePaiement?.montantExclu || 0));
  const activeNet = lignePaiement?.totalPaye || lignePaiement?.montantPaye || 0;

  // Initialize search query with patient name or matricule on open
  useEffect(() => {
    if (lignePaiement) {
      setActSearchQuery(activeNom || activeMat || '');
    }
  }, [lignePaiement, activeNom, activeMat]);

  // Compute ALL eligible unpaid / partially paid acts across database
  const allEligibleActs: MatchCandidate[] = useMemo(() => {
    const list: MatchCandidate[] = [];

    (prestations || []).forEach(prest => {
      // Exclude fully paid or rejected prestations unless it's currently linked
      if (prest.statut === 'Payé' || prest.statut === 'Rejeté') {
        if (prest.id !== lignePaiement?.prestationId) return;
      }

      const persNom = prest.nomAgent || 'Patient';
      const persMat = prest.matricule || '-';
      const socNom = prest.societeNom || '';
      const sousSoc = prest.sousSociete || '';

      if (prest.lignes && prest.lignes.length > 0) {
        prest.lignes.forEach((ligne, lIdx) => {
          const brut = ligne.totalPrestation || 0;
          const part = ligne.ticketModerateur ?? Math.round((prest.ticketModerateur || 0) / (prest.lignes.length || 1));
          const remb = ligne.montantARembourser ?? Math.max(0, brut - part);
          const dejaPaye = ligne.totalPaye || 0;
          const reste = Math.max(0, remb - dejaPaye);

          if (reste > 0 || prest.id === lignePaiement?.prestationId) {
            list.push({
              prestationId: prest.id,
              prestationNum: prest.numeroFacture,
              prestationDate: prest.date,
              lignePrestationId: ligne.id || `${prest.id}-lig-${lIdx}`,
              codeActe: ligne.code || 'CONS',
              libelleActe: ligne.libelle || ligne.code || 'Acte de soins',
              societeId: prest.societeId,
              societeNom: socNom,
              sousSociete: sousSoc,
              personneId: prest.personneId,
              personneNom: persNom,
              matricule: persMat,
              montantInitial: brut,
              ticketModerateur: part,
              montantARembourser: remb,
              dejaPaye: dejaPaye,
              resteAPayer: reste
            });
          }
        });
      } else {
        const tot = prest.montantTotal ?? prest.totalPrestation ?? 0;
        const mod = prest.ticketModerateur ?? prest.participation ?? 0;
        const remb = prest.montantARembourser ?? Math.max(0, tot - mod);
        const dejaPaye = prest.totalPaye || 0;
        const reste = Math.max(0, remb - dejaPaye);

        if (reste > 0 || prest.id === lignePaiement?.prestationId) {
          list.push({
            prestationId: prest.id,
            prestationNum: prest.numeroFacture,
            prestationDate: prest.date,
            lignePrestationId: `${prest.id}-main`,
            codeActe: 'ACTE',
            libelleActe: prest.commentaires || 'Prestation globale',
            societeId: prest.societeId,
            societeNom: socNom,
            sousSociete: sousSoc,
            personneId: prest.personneId,
            personneNom: persNom,
            matricule: persMat,
            montantInitial: tot,
            ticketModerateur: mod,
            montantARembourser: remb,
            dejaPaye: dejaPaye,
            resteAPayer: reste
          });
        }
      }
    });

    return list;
  }, [prestations, lignePaiement?.prestationId]);

  // Filter & rank search candidates
  const filteredSearchCandidates = useMemo(() => {
    const q = actSearchQuery.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const targetSocId = paiement?.societeId;
    const targetSocNom = (paiement?.societeNom || '').toLowerCase().trim();

    const candidates = allEligibleActs.filter(cand => {
      // STRICT INTER-SOCIETY RULE: Disallow linking payment to prestations of a different society/garant
      if (targetSocId && cand.societeId && cand.societeId !== targetSocId) {
        return false;
      }
      if (targetSocNom && cand.societeNom && cand.societeNom.toLowerCase().trim() !== targetSocNom && cand.societeId !== targetSocId) {
        return false;
      }

      if (!q) return true;
      const cNom = (cand.personneNom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cMat = (cand.matricule || '').toLowerCase();
      const cNum = (cand.prestationNum || '').toLowerCase();
      const cCode = (cand.codeActe || '').toLowerCase();
      const cLib = (cand.libelleActe || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cSoc = (cand.sousSociete || cand.societeNom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cDate = (cand.prestationDate || '');

      return cNom.includes(q) || cMat.includes(q) || cNum.includes(q) || cCode.includes(q) || cLib.includes(q) || cSoc.includes(q) || cDate.includes(q);
    });

    const cleanNom = activeNom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const cleanMat = activeMat.replace(/\s+/g, '').toLowerCase();

    return candidates.sort((a, b) => {
      const scoreCand = (cand: MatchCandidate) => {
        let score = 0;
        const cNom = (cand.personneNom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const cMat = (cand.matricule || '').replace(/\s+/g, '').toLowerCase();

        if (cleanMat && cMat && cMat !== '-' && cleanMat === cMat) score += 100;
        else if (cleanNom && cNom && (cNom.includes(cleanNom) || cleanNom.includes(cNom))) score += 80;

        if (activeDate && cand.prestationDate && activeDate.substring(0, 10) === cand.prestationDate.substring(0, 10)) score += 50;
        if (activeBrut && cand.montantInitial && Math.abs(activeBrut - cand.montantInitial) < 2) score += 50;

        return score;
      };

      return scoreCand(b) - scoreCand(a);
    });
  }, [allEligibleActs, actSearchQuery, activeNom, activeMat, activeDate, activeBrut]);

  if (!isOpen || !paiement || !lignePaiement) return null;

  const handleAssignCandidate = (cand: MatchCandidate | null) => {
    if (!cand) {
      handleUnlink();
      return;
    }

    const targetPrestation = prestations.find(p => p.id === cand.prestationId);
    if (!targetPrestation) return;

    const updatedLignes = (paiement.lignes || []).map(l => {
      if (l.id === lignePaiement.id) {
        return {
          ...l,
          prestationId: targetPrestation.id,
          prestationNumero: targetPrestation.numeroFacture,
          lignePrestationId: cand.lignePrestationId,
          nomAgent: cand.personneNom || l.nomAgent,
          immatriculation: cand.matricule !== '-' ? cand.matricule : l.immatriculation,
          dateSoins: l.dateSoins || targetPrestation.date,
          codeActe: cand.codeActe !== 'ACTE' ? cand.codeActe : l.codeActe,
          libelleActe: cand.libelleActe || l.libelleActe,
        };
      }
      return l;
    });

    const updatedPaiement: Paiement = {
      ...paiement,
      lignes: updatedLignes,
    };

    onSavePaiement(updatedPaiement, [targetPrestation]);
    onClose();
  };

  const handleUnlink = () => {
    const updatedLignes = (paiement.lignes || []).map(l => {
      if (l.id === lignePaiement.id) {
        return {
          ...l,
          prestationId: '',
          prestationNumero: '',
          lignePrestationId: '',
        };
      }
      return l;
    });

    const updatedPaiement: Paiement = {
      ...paiement,
      lignes: updatedLignes,
    };

    onSavePaiement(updatedPaiement, []);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs font-sans antialiased">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-white shrink-0">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-600" />
              <span>Rattacher un acte prescrit à cette ligne de règlement</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Pour : <strong className="text-slate-800">{activeNom || 'Patient'}</strong> (Mat: {activeMat || '-'}) • Date Soins : <strong>{activeDate ? formatDate(activeDate) : 'Non renseignée'}</strong> • Brut sans TM : <strong>{formatMoney(activeBrut)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto min-h-0">
          
          {/* Search input with Quick Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={actSearchQuery}
                onChange={(e) => setActSearchQuery(e.target.value)}
                placeholder="Rechercher par nom de patient, matricule, n° facture, code acte (ex: CONS, MEDIC)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                autoFocus
              />
              {actSearchQuery && (
                <button
                  onClick={() => setActSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {filteredSearchCandidates.length} acte(s) disponible(s) au rattachement (triés par pertinence)
              </span>
              {actSearchQuery && (
                <button
                  onClick={() => setActSearchQuery('')}
                  className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                >
                  Afficher tous les actes ouverts ({allEligibleActs.length})
                </button>
              )}
            </div>
          </div>

          {/* Act candidate list with live comparison badges */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {filteredSearchCandidates.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="text-xs text-slate-600 font-medium">
                  Aucun acte en attente ou partiellement payé correspondant trouvé.
                </div>
                {allEligibleActs.length > 0 && (
                  <button
                    onClick={() => setActSearchQuery('')}
                    className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
                  >
                    Voir tous les {allEligibleActs.length} actes disponibles
                  </button>
                )}
              </div>
            ) : (
              filteredSearchCandidates.map((cand) => {
                const compDetails = getConfrontationDetails(activeDate, activeBrut, activeNet, cand);
                const isCurrentlyLinked = lignePaiement.prestationId === cand.prestationId && 
                  (lignePaiement.lignePrestationId === cand.lignePrestationId || (!lignePaiement.lignePrestationId && cand.lignePrestationId.endsWith('-main')));

                return (
                  <div
                    key={cand.lignePrestationId}
                    className={`p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${compDetails.rowBorderClass}`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* 1. Nom du Patient en évidence (Priorité N°1) */}
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          {cand.personneNom}
                        </span>
                        {cand.matricule && cand.matricule !== '-' && (
                          <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            Mat: {cand.matricule}
                          </span>
                        )}
                        {cand.sousSociete && (
                          <span className="text-indigo-700 font-semibold text-[11px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            ({cand.sousSociete})
                          </span>
                        )}
                        {cand.prestationNum && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            (Facture N° {cand.prestationNum} • {formatDate(cand.prestationDate)})
                          </span>
                        )}
                      </div>

                      {/* 2. Act header & Libelle + Live confrontation badge */}
                      <div className="flex items-center flex-wrap gap-2 pt-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {cand.codeActe}
                        </span>
                        <span className="font-semibold text-slate-800 text-xs truncate">
                          {cand.libelleActe}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${compDetails.badgeClass}`}>
                          <span>{compDetails.label}</span>
                        </span>
                      </div>

                      {/* Detailed price breakdown & live comparison */}
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                        <span>
                          Prix Brut Initial: <strong className="text-slate-900">{formatMoney(cand.montantInitial)}</strong>
                          {compDetails.isSameMontantBrut && (
                            <span className="ml-1 text-[10px] text-emerald-700 font-bold">(Même montant)</span>
                          )}
                        </span>
                        <span>Ticket Mod.: <strong className="text-amber-700">{formatMoney(cand.ticketModerateur)}</strong></span>
                        <span>À Rembourser: <strong className="text-indigo-700">{formatMoney(cand.montantARembourser)}</strong></span>
                        <span>Déjà Réglé: <strong className="text-emerald-700">{formatMoney(cand.dejaPaye)}</strong></span>
                      </div>
                    </div>

                    {/* Right column: Reste a payer & Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Reste à régler</span>
                        <strong className="text-sm font-extrabold text-emerald-800 font-mono">
                          {formatMoney(cand.resteAPayer)}
                        </strong>
                      </div>
                      <button
                        onClick={() => handleAssignCandidate(cand)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                          isCurrentlyLinked
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500'
                        }`}
                      >
                        {isCurrentlyLinked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                        <span>{isCurrentlyLinked ? 'Acte actuellement relié' : 'Rattacher cet Acte'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Unlink / Footer Action */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            {lignePaiement.prestationId ? (
              <button
                onClick={handleUnlink}
                className="inline-flex items-center gap-1.5 text-xs text-rose-700 hover:text-rose-800 font-semibold px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
              >
                <Unlink className="h-3.5 w-3.5" />
                <span>Ne pas rattacher (Délier la prestation)</span>
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
