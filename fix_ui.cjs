const fs = require('fs');
const path = 'src/components/PrestationsView.tsx';
let code = fs.readFileSync(path, 'utf8');

// Update selected row style in main table
const trSearch = `                        <tr
                          key={prestation.id}
                          onClick={() => toggleRow(prestation.id)}
                          className={\`group hover:bg-slate-50 transition cursor-pointer \${
                            isExpanded ? 'bg-indigo-50/30' : ''
                          }\`}
                        >`;
const trReplacement = `                        <tr
                          key={prestation.id}
                          onClick={() => toggleRow(prestation.id)}
                          className={\`group hover:bg-slate-50 transition cursor-pointer \${
                            selectedPrestations.has(prestation.id) ? 'bg-indigo-50/50' : isExpanded ? 'bg-indigo-50/30' : ''
                          }\`}
                        >`;
code = code.replace(trSearch, trReplacement);

// Make the checkboxes look better
const checkSearch = `                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={selectedPrestations.has(prestation.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedPrestations);
                              if (e.target.checked) newSet.add(prestation.id);
                              else newSet.delete(prestation.id);
                              setSelectedPrestations(newSet);
                            }}
                          />`;
const checkReplacement = `                          <input 
                            type="checkbox" 
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-slate-50"
                            checked={selectedPrestations.has(prestation.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedPrestations);
                              if (e.target.checked) newSet.add(prestation.id);
                              else newSet.delete(prestation.id);
                              setSelectedPrestations(newSet);
                            }}
                          />`;
code = code.replace(checkSearch, checkReplacement);

// Better top bar when items are selected
const topBarSearch = `            {selectedPrestations.size > 0 && (
              <button
                onClick={() => {
                  const prests = filteredAndSortedList.filter(p => selectedPrestations.has(p.id));
                  generateSelectedPrestationsPdf(prests, paiements, societes, personnes, { titreEtablissement: 'TABLEAU DE BORD' });
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition"
              >
                <Download className="w-4 h-4" />
                <span className="font-semibold text-sm">Export Sélection Détaillé ({selectedPrestations.size})</span>
              </button>
            )}`;
            
const topBarReplacement = `            {selectedPrestations.size > 0 && (
              <div className="flex items-center space-x-3 bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-100">
                <span className="text-sm font-semibold">{selectedPrestations.size} dossier(s) sélectionné(s)</span>
                <button
                  onClick={() => {
                    const prests = filteredAndSortedList.filter(p => selectedPrestations.has(p.id));
                    generateSelectedPrestationsPdf(prests, paiements, societes, personnes, { titreEtablissement: 'TABLEAU DE BORD' });
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded shadow-sm hover:bg-indigo-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="font-semibold text-xs">Exporter Détails</span>
                </button>
              </div>
            )}`;
code = code.replace(topBarSearch, topBarReplacement);

fs.writeFileSync(path, code, 'utf8');
