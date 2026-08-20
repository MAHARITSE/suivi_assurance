const fs = require('fs');
const path = 'src/components/DecompteImportModal.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace the fallback inside fetch parsing
code = code.replace(
  /json = \{ success: true, data: getAppropriateDecompteFallback\(file\.name, chosenOrg\) \};/,
  "throw new Error('Réponse invalide du serveur (non-JSON). Veuillez vérifier le fichier.');"
);

code = code.replace(
  /const data: ParsedFactureAssurance = json\?\.data \|\| json \|\| getAppropriateDecompteFallback\(file\.name, chosenOrg\);/,
  "const data: ParsedFactureAssurance = json?.data || json;\\n        if (!data || !data.lignes) throw new Error(json?.error || 'Format de données invalide après analyse.');"
);

code = code.replace(
  /processLoadedDocument\(getAppropriateDecompteFallback\(file\?\.name \|\| '', chosenOrg\)\);/,
  "setErrorMessage(err.message || 'Erreur lors de l\\'extraction des données du document. Assurez-vous que l\\'image ou le PDF est lisible.');\\n      setIsProcessing(false);"
);

fs.writeFileSync(path, code, 'utf8');
