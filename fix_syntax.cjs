const fs = require('fs');
const path = 'src/components/DecompteImportModal.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const data: ParsedFactureAssurance = json?.data || json;\\n        if (!data || !data.lignes) throw new Error(json?.error || 'Format de données invalide après analyse.');",
  "const data: ParsedFactureAssurance = json?.data || json;\n        if (!data || !data.lignes) throw new Error(json?.error || 'Format de données invalide après analyse.');"
);
code = code.replace(
  "setErrorMessage(err.message || 'Erreur lors de l\\'extraction des données du document. Assurez-vous que l\\'image ou le PDF est lisible.');\\n      setIsProcessing(false);",
  "setErrorMessage(err.message || 'Erreur lors de l\\'extraction des données du document. Assurez-vous que l\\'image ou le PDF est lisible.');\n      setIsProcessing(false);"
);

fs.writeFileSync(path, code, 'utf8');
