const fs = require('fs');

const path = 'src/components/PrestationsView.tsx';
let code = fs.readFileSync(path, 'utf8');

// We need to add `lineEditForm` and `setLineEditForm`
const stateSearch = `  const [lineExcludeForm, setLineExcludeForm] = useState({ montant: 0, motif: '' });`;
const stateReplacement = stateSearch + `\n  const [lineEditForm, setLineEditForm] = useState<{ code: string, libelle: string, totalPrestation: number, ticketModerateur: number }>({ code: '', libelle: '', totalPrestation: 0, ticketModerateur: 0 });`;
code = code.replace(stateSearch, stateReplacement);

// We need to add the `useEffect` to populate forms when context changes
const hookInsertion = `
  // Sync prop selectedSocieteId`;
const hooks = `
  React.useEffect(() => {
    if (lineEditContext) {
      setLineEditForm({
        code: lineEditContext.ligne.code || '',
        libelle: lineEditContext.ligne.libelle || '',
        totalPrestation: lineEditContext.ligne.totalPrestation || 0,
        ticketModerateur: lineEditContext.ligne.ticketModerateur || 0
      });
    }
  }, [lineEditContext]);

  React.useEffect(() => {
    if (lineExcludeContext) {
      setLineExcludeForm({
        montant: lineExcludeContext.maxExclu,
        motif: 'Rejet direct'
      });
    }
  }, [lineExcludeContext]);
`;
code = code.replace(hookInsertion, hooks + hookInsertion);

// We need to add the handlers
const handlersInsertion = `  const handleAddLine = () => {`;
const handlers = `
  const handleSaveLigneEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineEditContext) return;
    const { prestation, ligne } = lineEditContext;
    
    // Update the line
    const updatedLignes = prestation.lignes.map(l => {
      if (l.id === ligne.id) {
        return {
          ...l,
          code: lineEditForm.code,
          libelle: lineEditForm.libelle,
          totalPrestation: Number(lineEditForm.totalPrestation),
          ticketModerateur: Number(lineEditForm.ticketModerateur),
          montantARembourser: Math.max(0, Number(lineEditForm.totalPrestation) - Number(lineEditForm.ticketModerateur))
        };
      }
      return l;
    });

    // Recalculate prestation totals based on updated lines
    const newTotalPrestation = updatedLignes.reduce((sum, l) => sum + (l.totalPrestation || 0), 0);
    const newParticipation = updatedLignes.reduce((sum, l) => sum + (l.ticketModerateur || 0), 0);
    const newMontantARembourser = Math.max(0, newTotalPrestation - newParticipation);

    const updatedPrestation = {
      ...prestation,
      lignes: updatedLignes,
      totalPrestation: newTotalPrestation,
      participation: newParticipation,
      ticketModerateur: newParticipation,
      montantARembourser: newMontantARembourser,
    };

    onSavePrestation(updatedPrestation);
    setLineEditContext(null);
  };

  const handleSaveLigneExclude = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineExcludeContext || !onSavePaiement) return;
    
    const { prestation, ligne, maxExclu } = lineExcludeContext;
    const { montant, motif } = lineExcludeForm;
    const mnt = Number(montant);
    
    if (mnt <= 0 || mnt > maxExclu) {
       alert('Le montant à exclure doit être supérieur à 0 et inférieur ou égal au reste à payer (' + maxExclu + ').');
       return;
    }

    const pers = personnes.find(p => p.id === prestation.personneId);
    const newId = generateId();
    
    const exclusionPaiement: Paiement = {
      id: newId,
      numeroBordereau: \`REJET-\${new Date().getFullYear()}-\${Math.floor(1000 + Math.random() * 9000)}\`,
      datePaiement: new Date().toISOString().split('T')[0],
      dateSaisie: new Date().toISOString(),
      societeId: prestation.societeId,
      nomAgent: pers?.nomPrenom || prestation.nomAgent,
      matricule: pers?.matricule || prestation.matricule,
      modePaiement: 'Virement bancaire',
      referencePaiement: \`REJET-\${ligne.code || 'ACTE'}\`,
      totalReclame: mnt,
      totalPaye: 0,
      totalModerateur: 0,
      totalExclu: mnt,
      remise: 0,
      statut: 'Validé',
      notes: motif,
      lignes: [
        {
          id: generateId(),
          paiementId: newId,
          lignePrestationId: ligne.id,
          prestationId: prestation.id,
          immatriculation: pers?.matricule || prestation.matricule || '',
          nomBaseAssurance: pers?.nomPrenom || prestation.nomAgent || '',
          totalPaye: 0,
          ticketModerateur: 0,
          montantExclu: mnt,
          commentaire: motif
        }
      ]
    };
    
    // update status if fully excluded? 
    // actually it's dynamically calculated in getLineFinancials when the payment is factored in!
    onSavePaiement(exclusionPaiement, [prestation]);
    setLineExcludeContext(null);
  };

`;
code = code.replace(handlersInsertion, handlers + handlersInsertion);


// We need to add the modals at the end
const modalsInsertion = `      {/* Salfa Import Modal */}`;
const modals = `
      {/* Edit Line Modal */}
      {lineEditContext && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2 text-indigo-900">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold">Modifier l'Acte</h3>
              </div>
              <button
                onClick={() => setLineEditContext(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveLigneEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-1">Code Acte / Famille *</label>
                <select
                  value={lineEditForm.code}
                  onChange={(e) => setLineEditForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">Sélectionner une famille...</option>
                  {familles.map(f => (
                    <option key={f.code} value={f.code}>{f.code} - {f.libelle}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-1">Libellé / Description *</label>
                <input
                  type="text"
                  value={lineEditForm.libelle}
                  onChange={(e) => setLineEditForm(prev => ({ ...prev, libelle: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-1">Montant Brut *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineEditForm.totalPrestation}
                    onChange={(e) => setLineEditForm(prev => ({ ...prev, totalPrestation: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-right font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-1">Ticket Modérateur</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineEditForm.ticketModerateur}
                    onChange={(e) => setLineEditForm(prev => ({ ...prev, ticketModerateur: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-right font-bold text-amber-700"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLineEditContext(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exclude Line Modal */}
      {lineExcludeContext && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center space-x-2 text-rose-900">
                <Ban className="w-5 h-5 text-rose-600" />
                <h3 className="text-lg font-bold">Exclure / Rejeter l'Acte</h3>
              </div>
              <button
                onClick={() => setLineExcludeContext(null)}
                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveLigneExclude} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs mb-4">
                <p className="font-semibold mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> Action comptable</p>
                <p>Le montant exclu sera enregistré dans le tableau de bord des rejets et soustrait du reste à payer de la facture.</p>
              </div>
              
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-1">
                  Montant à exclure (Max: {formatMoney(lineExcludeContext.maxExclu)}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={lineExcludeContext.maxExclu}
                  value={lineExcludeForm.montant}
                  onChange={(e) => setLineExcludeForm(prev => ({ ...prev, montant: Number(e.target.value) }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none text-right font-bold text-rose-700"
                  required
                />
              </div>
              
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-1">Motif du rejet / exclusion *</label>
                <input
                  type="text"
                  value={lineExcludeForm.motif}
                  onChange={(e) => setLineExcludeForm(prev => ({ ...prev, motif: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  placeholder="Ex: Plafond dépassé, Acte non garanti..."
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLineExcludeContext(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
                >
                  Confirmer le rejet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

`;
code = code.replace(modalsInsertion, modals + modalsInsertion);

fs.writeFileSync(path, code, 'utf8');
