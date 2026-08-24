import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Link2, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  User, 
  Calendar, 
  Building2, 
  Sparkles,
  Unlink,
  Check
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

export const RelierPaiementModal: React.FC<RelierPaiementModalProps> = ({
  isOpen,
  onClose,
  paiement,
  lignePaiement,
  prestations,
  onSavePaiement,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSamePatientOnly, setFilterSamePatientOnly] = useState(true);
  const [selectedPrestationId, setSelectedPrestationId] = useState<string | null>(null);
  const [selectedLigneActId, setSelectedLigneActId] = useState<string | null>(null);

  // Initialize selected values when opening modal
  React.useEffect(() => {
    if (lignePaiement) {
      setSelectedPrestationId(lignePaiement.prestationId || null);
      setSelectedLigneActId(lignePaiement.lignePrestationId || null);
      setSearchTerm('');
    }
  }, [lignePaiement]);

  if (!isOpen || !paiement || !lignePaiement) return null;

  const currentPatientName = (lignePaiement.nomAgent || lignePaiement.nomBaseAssurance || '').trim().toLowerCase();
  const currentMatricule = (lignePaiement.immatriculation || '').trim().toLowerCase();

  // Filter and rank candidate prestations
  const filteredPrestations = useMemo(() => {
    return prestations
      .map(p => {
        const pNom = (p.nomAgent || '').trim().toLowerCase();
        const pMat = (p.matricule || '').trim().toLowerCase();
        const pNum = (p.numeroFacture || '').trim().toLowerCase();

        const isExactPatientMatch = 
          (currentMatricule && pMat && currentMatricule === pMat) ||
          (currentPatientName && pNom && (currentPatientName.includes(pNom) || pNom.includes(currentPatientName)));

        const matchSearch = !searchTerm.trim() || 
          pNum.includes(searchTerm.toLowerCase()) ||
          pNom.includes(searchTerm.toLowerCase()) ||
          pMat.includes(searchTerm.toLowerCase()) ||
          p.date.includes(searchTerm.trim());

        return {
          prestation: p,
          isExactPatientMatch,
          matchSearch,
        };
      })
      .filter(item => {
        if (!item.matchSearch) return false;
        if (filterSamePatientOnly && currentPatientName && !item.isExactPatientMatch) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isExactPatientMatch && !b.isExactPatientMatch) return -1;
        if (!a.isExactPatientMatch && b.isExactPatientMatch) return 1;
        return b.prestation.date.localeCompare(a.prestation.date);
      });
  }, [prestations, currentPatientName, currentMatricule, searchTerm, filterSamePatientOnly]);

  const handleSelectPrestation = (p: Prestation, lineActId?: string) => {
    setSelectedPrestationId(p.id);
    setSelectedLigneActId(lineActId || null);
  };

  const handleConfirmLink = () => {
    if (!selectedPrestationId) {
      alert('Veuillez sélectionner une facture / prestation de soins dans la liste.');
      return;
    }

    const targetPrestation = prestations.find(p => p.id === selectedPrestationId);
    if (!targetPrestation) return;

    // Build updated LignePaiement
    const updatedLignes = (paiement.lignes || []).map(l => {
      if (l.id === lignePaiement.id) {
        return {
          ...l,
          prestationId: targetPrestation.id,
          prestationNumero: targetPrestation.numeroFacture,
          lignePrestationId: selectedLigneActId || '',
          nomAgent: targetPrestation.nomAgent || l.nomAgent,
          immatriculation: targetPrestation.matricule || l.immatriculation,
          dateSoins: l.dateSoins || targetPrestation.date,
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
    // Unlink payment line from any prestation
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

  const selectedPrestation = prestations.find(p => p.id === selectedPrestationId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans antialiased">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-indigo-200">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Relier le Règlement à une Prestation / Facture
              </h2>
              <p className="text-xs text-indigo-200 font-medium">
                Associer cette ligne de paiement à la facture de soins correspondante
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Card - Current Payment Line Details */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Règlement / Bordereau</span>
              <span className="font-mono font-bold text-indigo-700 text-sm">{paiement.numeroBordereau || 'VIR-SOLDE'}</span>
              <span className="text-[11px] text-slate-500 block">{formatDate(paiement.datePaiement)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Assuré / Patient</span>
              <span className="font-bold text-slate-900 block truncate">{lignePaiement.nomAgent || lignePaiement.nomBaseAssurance || 'Non renseigné'}</span>
              <span className="font-mono text-[11px] text-slate-500 block">Mat: {lignePaiement.immatriculation || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Acte / Soins</span>
              <span className="font-semibold text-slate-800 block truncate">{lignePaiement.codeActe || 'CONS'} - {lignePaiement.libelleActe || 'Prestation'}</span>
              <span className="text-[11px] text-slate-500 block">{lignePaiement.dateSoins ? formatDate(lignePaiement.dateSoins) : 'Date N/A'}</span>
            </div>
            <div className="text-right flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Montant Payé (Net)</span>
              <span className="font-mono text-base font-extrabold text-emerald-600">
                {formatMoney(lignePaiement.totalPaye || lignePaiement.montantPaye || 0)}
              </span>
              {lignePaiement.montantExclu > 0 && (
                <span className="text-[10px] text-rose-600 font-bold block">
                  (Rejet : {formatMoney(lignePaiement.montantExclu)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par N° Facture, Nom Assuré, Matricule ou Date..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>

          {currentPatientName && (
            <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 select-none shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={filterSamePatientOnly}
                onChange={(e) => setFilterSamePatientOnly(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Filtrer uniquement cet assuré ({lignePaiement.nomAgent || 'Assuré'})</span>
            </label>
          )}
        </div>

        {/* List of Prestations */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-[250px]">
          {filteredPrestations.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">Aucune prestation ou facture correspondante trouvée</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                {filterSamePatientOnly 
                  ? 'Essayez de décocher l’option de filtrage par assuré pour rechercher parmi toutes les factures.'
                  : 'Vérifiez le terme de recherche ou créez d’abord la prestation dans le module Prestations.'}
              </p>
            </div>
          ) : (
            filteredPrestations.map(({ prestation: p, isExactPatientMatch }) => {
              const isSelected = selectedPrestationId === p.id;
              const pTot = p.montantTotal ?? p.totalPrestation ?? 0;
              const pMod = p.ticketModerateur ?? p.participation ?? 0;
              const pRemb = p.montantARembourser ?? Math.max(0, pTot - pMod);
              const pPaye = p.totalPaye || 0;
              const pReste = p.resteAPayer ?? Math.max(0, pRemb - pPaye);

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPrestation(p)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-sm text-indigo-900">
                            Facture N° {p.numeroFacture}
                          </span>
                          <span className="text-xs text-slate-500">• {formatDate(p.date)}</span>
                          {isExactPatientMatch && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                              <Sparkles className="w-3 h-3 text-emerald-600" />
                              <span>Assuré correspondant</span>
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center space-x-3 text-xs text-slate-700 font-semibold">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{p.nomAgent || 'Assuré anonyme'}</span>
                          </span>
                          {p.matricule && (
                            <span className="font-mono text-[11px] text-slate-500">
                              Mat: {p.matricule}
                            </span>
                          )}
                        </div>

                        {/* Act lines inside prestation */}
                        {p.lignes && p.lignes.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                            <span className="text-[10px] text-slate-400 font-medium block w-full">Actes de soins prescrits :</span>
                            {p.lignes.map(act => {
                              const isActSelected = isSelected && selectedLigneActId === act.id;
                              return (
                                <button
                                  type="button"
                                  key={act.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectPrestation(p, act.id);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                                    isActSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                                  }`}
                                >
                                  <span className="font-bold">{act.code}</span>: {act.libelle} ({formatMoney(act.totalPrestation)})
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prestation Financials */}
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Part Assurance</span>
                      <span className="font-mono text-sm font-bold text-slate-900 block">{formatMoney(pRemb)}</span>
                      
                      <div className="mt-1 text-[11px]">
                        <span className="text-emerald-600 font-semibold">Payé : {formatMoney(pPaye)}</span>
                        <span className="text-slate-300 mx-1">•</span>
                        <span className={pReste > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                          Reste : {formatMoney(pReste)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
          <div>
            {lignePaiement.prestationId && (
              <button
                type="button"
                onClick={handleUnlink}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                <Unlink className="w-4 h-4" />
                <span>Délier de cette prestation</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!selectedPrestationId}
              onClick={handleConfirmLink}
              className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Valider la liaison</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
