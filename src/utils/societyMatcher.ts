import { Societe } from '../types';

/**
 * Intelligent and robust society matcher preventing incorrect assignments (e.g. MCI CARE wrongly assigned to BSA)
 */
export function findBestMatchingSociete(
  rawName: string,
  societes: Societe[],
  preferredNameOrId?: string
): Societe | undefined {
  if (!societes || societes.length === 0) return undefined;

  // 1. If user explicitly provided or selected a preferred society
  if (preferredNameOrId && preferredNameOrId !== 'AUTO' && preferredNameOrId !== 'ALL' && preferredNameOrId !== 'CUSTOM') {
    const byId = societes.find(s => s.id === preferredNameOrId);
    if (byId) return byId;

    const byName = societes.find(s => s.nom.toLowerCase().trim() === preferredNameOrId.toLowerCase().trim());
    if (byName) return byName;
  }

  const clean = (rawName || '').toLowerCase().trim();
  if (!clean || clean === 'organisme' || clean === 'assurance' || clean === 'client' || clean.includes('ascoma / mci / bsa')) {
    // Default to MCI CARE or first available society
    const mci = societes.find(s => s.code.toUpperCase().includes('MCI') || s.nom.toUpperCase().includes('MCI'));
    return mci || societes[0];
  }

  // 2. Strict Exact match (Name or Code)
  const exact = societes.find(s => 
    s.nom.toLowerCase().trim() === clean || 
    s.code.toLowerCase().trim() === clean
  );
  if (exact) return exact;

  // 3. Known Insurance Keywords Priority (prevents false matches between MCI CARE and BSA)
  if (
    clean.includes('mci') || 
    clean.includes('mcicare') || 
    clean.includes('mci care') || 
    clean.includes('conservation international') ||
    clean.includes('conservation internationale')
  ) {
    const mci = societes.find(s => s.code.toUpperCase().includes('MCI') || s.nom.toUpperCase().includes('MCI'));
    if (mci) return mci;
  }

  if (
    clean.includes('havana') || 
    clean.includes('ny havana') || 
    clean.includes('ny-havana') ||
    clean.includes('nyhavana')
  ) {
    const havana = societes.find(s => s.nom.toUpperCase().includes('HAVANA') || s.code.toUpperCase().includes('HAVANA'));
    if (havana) return havana;
  }

  if (clean.includes('ascoma')) {
    const ascoma = societes.find(s => s.nom.toUpperCase().includes('ASCOMA') || s.code.toUpperCase().includes('ASCOMA'));
    if (ascoma) return ascoma;
  }

  if (
    clean.includes('bsa') || 
    clean.includes('gras savoye') || 
    clean.includes('ask gras') ||
    clean.includes('ask gras savoye')
  ) {
    const bsa = societes.find(s => s.code.toUpperCase() === 'BSA' || s.nom.toUpperCase().includes('BSA'));
    if (bsa) return bsa;
  }

  // 4. Substring / Word inclusion match (excluding generic terms)
  const partial = societes.find(s => {
    const sNom = s.nom.toLowerCase().trim();
    const sCode = s.code.toLowerCase().trim();
    if (sNom.length < 3 && sCode.length < 3) return false;
    return (
      (sNom.length >= 3 && clean.includes(sNom)) ||
      (sCode.length >= 3 && clean.includes(sCode)) ||
      (clean.length >= 4 && sNom.includes(clean))
    );
  });
  if (partial) return partial;

  return undefined;
}
