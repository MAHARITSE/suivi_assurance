const fs = require('fs');
const path = 'src/components/PrestationsView.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove state
code = code.replace(/  const \[prestationExcludeContext, setPrestationExcludeContext\] = useState[^\n]+\n/, '');

// 2. Remove useEffect
code = code.replace(/  React\.useEffect\(\(\) => \{\n    if \(prestationExcludeContext\) \{\n      setLineExcludeForm\(\{\n        montant: prestationExcludeContext\.maxExclu,\n        motif: 'Rejet global'\n      \}\);\n    \}\n  \}, \[prestationExcludeContext\]\);\n\n/, '');

// 3. Remove handler
code = code.replace(/  const handleSavePrestationExclude = \(e: React\.FormEvent\) => \{[\s\S]+?setPrestationExcludeContext\(null\);\n  \};\n\n/, '');

// 4. Remove button from row
code = code.replace(/                            \{fin\.resteAPayer > 0 && \(\n                              <button\n                                onClick=\{\(e\) => \{ e\.stopPropagation\(\); setPrestationExcludeContext[\s\S]+?<\/button>\n                            \)\}\n/, '');

// 5. Remove Modal
code = code.replace(/      \{\/\* Exclude Prestation Modal \*\/\}[\s\S]+?\{\/\* Exclude Line Modal \*\/\}/, '{/* Exclude Line Modal */}');

fs.writeFileSync(path, code, 'utf8');
