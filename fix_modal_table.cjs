const fs = require('fs');
const path = 'src/components/PrestationsView.tsx';
let code = fs.readFileSync(path, 'utf8');

const modalTableSearch = `            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Actes Médicaux & Lignes</h4>
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-2 text-left">Code</th>
                    <th className="p-2 text-left">Libellé</th>
                    <th className="p-2 text-right">Montant</th>
                    <th className="p-2 text-right">Remboursé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingPrestation.lignes.map(l => (
                    <tr key={l.id}>
                      <td className="p-2 font-mono font-bold text-indigo-600">{l.code}</td>
                      <td className="p-2">{l.libelle}</td>
                      <td className="p-2 text-right font-medium">{formatMoney(l.totalPrestation)}</td>
                      <td className="p-2 text-right font-semibold text-emerald-600">{formatMoney(l.totalPaye)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>`;

const modalTableReplace = `            <div className="space-y-2 bg-white rounded-lg border border-slate-200 p-3 shadow-xs">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-indigo-700">
                  <span>Lignes de Prestation (Actes Médicaux & Montants)</span>
                </span>
                <span className="text-slate-400 lowercase font-normal">{viewingPrestation.lignes.length} actes dans cette prescription</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2 text-left">Code Acte</th>
                      <th className="py-2 px-2 text-left">Libellé / Acte médical</th>
                      <th className="py-2 px-2 text-right">Montant Brut</th>
                      <th className="py-2 px-2 text-right">Ticket Modérateur</th>
                      <th className="py-2 px-2 text-right">À Rembourser</th>
                      <th className="py-2 px-2 text-right">Somme Payée</th>
                      <th className="py-2 px-2 text-right">Reste à payer</th>
                      <th className="py-2 px-2 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingPrestation.lignes.map(ligne => {
                      const lFin = getLineFinancials(ligne, viewingPrestation);
                      return (
                        <tr key={ligne.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{ligne.code}</td>
                          <td className="py-3 px-2 text-slate-700">{ligne.libelle}</td>
                          <td className="py-3 px-2 text-right font-medium whitespace-nowrap text-slate-600">
                            {formatMoney(lFin.lBrut)}
                          </td>
                          <td className="py-3 px-2 text-right text-amber-700 font-medium whitespace-nowrap">
                            {formatMoney(lFin.lPart)}
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatMoney(lFin.lARemb)}
                          </td>
                          <td className="py-3 px-2 text-right text-emerald-700 font-bold whitespace-nowrap">
                            {formatMoney(lFin.lTotalPaye)}
                          </td>
                          <td className="py-3 px-2 text-right font-bold whitespace-nowrap">
                            <span className={lFin.lReste > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}>
                              {formatMoney(lFin.lReste)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={\`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold \${
                              lFin.statut === 'Payé'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : lFin.statut === 'Partiellement payé'
                                ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                : lFin.statut === 'Rejeté'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }\`}>
                              {lFin.statut}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>`;

code = code.replace(modalTableSearch, modalTableReplace);
fs.writeFileSync(path, code, 'utf8');
