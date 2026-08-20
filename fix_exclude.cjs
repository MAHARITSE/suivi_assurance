const fs = require('fs');
const path = 'src/components/PrestationsView.tsx';
let code = fs.readFileSync(path, 'utf8');

const stateSearch = `  const [lineExcludeContext, setLineExcludeContext] = useState<{ prestation: Prestation, ligne: LignePrestation, maxExclu: number } | null>(null);`;
const stateReplacement = stateSearch + `\n  const [prestationExcludeContext, setPrestationExcludeContext] = useState<{ prestation: Prestation, maxExclu: number } | null>(null);`;
code = code.replace(stateSearch, stateReplacement);

const hooksSearch = `  React.useEffect(() => {
    if (lineExcludeContext) {`;
const hooksReplacement = `  React.useEffect(() => {
    if (prestationExcludeContext) {
      setLineExcludeForm({
        montant: prestationExcludeContext.maxExclu,
        motif: 'Rejet global'
      });
    }
  }, [prestationExcludeContext]);

` + hooksSearch;
code = code.replace(hooksSearch, hooksReplacement);


const saveHandlerSearch = `  const handleSaveLigneExclude = (e: React.FormEvent) => {`;
const saveHandlerReplacement = `  const handleSavePrestationExclude = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prestationExcludeContext || !onSavePaiement) return;
    
    const { prestation, maxExclu } = prestationExcludeContext;
    const { montant, motif } = lineExcludeForm;
    const mnt = Number(montant);
    
    if (mnt <= 0 || mnt > maxExclu) {
       alert('Le montant à exclure doit être supérieur à 0 et inférieur ou égal au reste à payer (' + maxExclu + ').');
       return;
    }

    const pers = personnes.find(p => p.id === prestation.personneId);
    const newId = generateId();
    
    // Distribute excluded amount proportionally among remaining lines
    let remainingToDistribute = mnt;
    const paymentLines = [];
    
    for (const ligne of prestation.lignes) {
      if (remainingToDistribute <= 0) break;
      const lBrut = ligne.totalPrestation || 0;
      const lTicket = ligne.ticketModerateur ?? Math.round((prestation.ticketModerateur || 0) / (prestation.lignes.length || 1));
      const lCharge = ligne.montantARembourser ?? Math.max(0, lBrut - lTicket);
      
      const linePayments = paiements.filter(p => p.lignes.some(pl => pl.lignePrestationId === ligne.id));
      const lTotalPaye = linePayments.reduce((sum, p) => sum + p.lignes.filter(pl => pl.lignePrestationId === ligne.id).reduce((s, pl) => s + (pl.totalPaye || 0), 0), 0);
      const lExcluFromP = linePayments.reduce((sum, p) => sum + p.lignes.filter(pl => pl.lignePrestationId === ligne.id).reduce((s, pl) => s + (pl.montantExclu || 0), 0), 0);
      
      const lReste = Math.max(0, lCharge - lTotalPaye - lExcluFromP);
      if (lReste > 0) {
        const excluForLine = Math.min(lReste, remainingToDistribute);
        remainingToDistribute -= excluForLine;
        
        paymentLines.push({
          id: generateId(),
          paiementId: newId,
          lignePrestationId: ligne.id,
          prestationId: prestation.id,
          immatriculation: pers?.matricule || prestation.matricule || '',
          nomBaseAssurance: pers?.nomPrenom || prestation.nomAgent || '',
          totalPaye: 0,
          ticketModerateur: 0,
          montantExclu: excluForLine,
          commentaire: motif
        });
      }
    }
    
    // If there are no lines with reste, or remaining to distribute, put it on the first line or a dummy line
    if (remainingToDistribute > 0 && prestation.lignes.length > 0) {
       paymentLines.push({
          id: generateId(),
          paiementId: newId,
          lignePrestationId: prestation.lignes[0].id,
          prestationId: prestation.id,
          immatriculation: pers?.matricule || prestation.matricule || '',
          nomBaseAssurance: pers?.nomPrenom || prestation.nomAgent || '',
          totalPaye: 0,
          ticketModerateur: 0,
          montantExclu: remainingToDistribute,
          commentaire: motif
       });
    }

    const exclusionPaiement = {
      id: newId,
      numeroBordereau: \`REJET-\${new Date().getFullYear()}-\${Math.floor(1000 + Math.random() * 9000)}\`,
      datePaiement: new Date().toISOString().split('T')[0],
      dateSaisie: new Date().toISOString(),
      societeId: prestation.societeId,
      nomAgent: pers?.nomPrenom || prestation.nomAgent,
      matricule: pers?.matricule || prestation.matricule,
      modePaiement: 'Virement bancaire',
      referencePaiement: \`REJET-GLOBAL\`,
      totalReclame: mnt,
      totalPaye: 0,
      totalModerateur: 0,
      totalExclu: mnt,
      remise: 0,
      statut: 'Validé',
      notes: motif,
      lignes: paymentLines
    };
    
    onSavePaiement(exclusionPaiement, [prestation]);
    setPrestationExcludeContext(null);
  };

` + saveHandlerSearch;
code = code.replace(saveHandlerSearch, saveHandlerReplacement);

const rowActionSearch = `                            <button
                              onClick={() => {
                                if (confirm(\`Êtes-vous sûr de vouloir supprimer la facture \${prestation.numeroFacture} ?\`)) {
                                  onDeletePrestation(prestation.id);
                                }
                              }}`;
const rowActionReplacement = `                            {fin.resteAPayer > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setPrestationExcludeContext({ prestation, maxExclu: fin.resteAPayer }); setLineExcludeForm({ montant: fin.resteAPayer, motif: 'Rejet global' }); }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Envoyer en exclusion / rejet global"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
` + rowActionSearch;
code = code.replace(rowActionSearch, rowActionReplacement);

const modalSearch = `      {/* Exclude Line Modal */}`;
const modalReplacement = `      {/* Exclude Prestation Modal */}
      {prestationExcludeContext && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center space-x-2 text-rose-900">
                <Ban className="w-5 h-5 text-rose-600" />
                <h3 className="text-lg font-bold">Exclure / Rejeter la Facture</h3>
              </div>
              <button
                onClick={() => setPrestationExcludeContext(null)}
                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSavePrestationExclude} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 text-xs mb-4">
                <p className="font-semibold mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> Action comptable</p>
                <p>Le montant exclu sera enregistré dans le tableau de bord des rejets et réparti sur les actes de cette facture.</p>
              </div>
              
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-1">
                  Montant à exclure (Max: {formatMoney(prestationExcludeContext.maxExclu)}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={prestationExcludeContext.maxExclu}
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
                  placeholder="Ex: Plafond dépassé, Dossier incomplet..."
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPrestationExcludeContext(null)}
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

` + modalSearch;
code = code.replace(modalSearch, modalReplacement);

fs.writeFileSync(path, code, 'utf8');
