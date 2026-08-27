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
    if (preferredNameOrId && preferredNameOrId !== 'AUTO' && preferredNameOrId !== 'ALL' && preferredNameOrId !== 'CUSTOM') {
      const preferred = societes.find(s => 
        s.id === preferredNameOrId || 
        s.nom.toLowerCase().trim() === preferredNameOrId.toLowerCase().trim() ||
        s.code.toLowerCase().trim() === preferredNameOrId.toLowerCase().trim()
      );
      if (preferred) return preferred;
    }
    return undefined;
  }

  // 2. Strict Exact match (Name or Code)
  const exact = societes.find(s => 
    s.nom.toLowerCase().trim() === clean || 
    s.code.toLowerCase().trim() === clean
  );
  if (exact) return exact;

  // 3. Known Insurance Keywords Priority (prevents false matches between BSA, MCI CARE, ASCOMA, SANLAM, NY HAVANA)

  // 3.A. BSA / ASK GRAS SAVOYE Priority (Must check before MCI to avoid accidental false positives)
  if (
    clean.includes('bsa') || 
    clean.includes('ask gs') ||
    clean.includes('ask-gs') ||
    clean.includes('bsa / ask gs') ||
    clean.includes('gras savoye') || 
    clean.includes('gras-savoye') || 
    clean.includes('grassavoye') || 
    clean.includes('ask gras') ||
    clean.includes('ask gras savoye') ||
    clean.includes('releve de remboursements') ||
    clean.includes('relevé de remboursements') ||
    clean.includes('frais de sante') ||
    clean.includes('frais de santé') ||
    clean.includes('bfv') ||
    clean.includes('bred madagasikara') ||
    clean.includes('bred')
  ) {
    const bsa = societes.find(s => 
      s.code.toUpperCase() === 'BSA' || 
      s.nom.toUpperCase().includes('BSA') || 
      s.nom.toUpperCase().includes('GRAS SAVOYE') ||
      s.nom.toUpperCase().includes('ASK')
    );
    if (bsa) return bsa;
  }

  // 3.B. ASCOMA Priority
  if (
    clean.includes('ascoma') ||
    clean.includes('decompte de reglement tiers payant') ||
    clean.includes('décompte de règlement tiers payant') ||
    clean.includes('dispensaire lutherien') ||
    clean.includes('code : 599') ||
    clean.includes('code 599')
  ) {
    const ascoma = societes.find(s => s.nom.toUpperCase().includes('ASCOMA') || s.code.toUpperCase().includes('ASCOMA'));
    if (ascoma) return ascoma;
  }

  // 3.C. NY HAVANA Priority
  if (
    clean.includes('havana') || 
    clean.includes('ny havana') || 
    clean.includes('ny-havana') ||
    clean.includes('nyhavana')
  ) {
    const havana = societes.find(s => s.nom.toUpperCase().includes('HAVANA') || s.code.toUpperCase().includes('HAVANA'));
    if (havana) return havana;
  }

  // 3.D. SANLAM & MCI CARE Priority
  if (
    clean.includes('mci') || 
    clean.includes('mcicare') || 
    clean.includes('mci care') || 
    clean.includes('sanlamallianz') ||
    clean.includes('sanlam allianz') ||
    clean.includes('compagnie sanlamallianz') ||
    clean.includes('sanlam') ||
    clean.includes('conservation international') ||
    clean.includes('conservation internationale')
  ) {
    // If SANLAM exists separately in societes, match it, otherwise match MCI CARE
    const sanlam = societes.find(s => s.nom.toUpperCase().includes('SANLAM') || s.code.toUpperCase().includes('SANLAM'));
    if (sanlam && (clean.includes('sanlam') || clean.includes('sanlamallianz'))) return sanlam;

    const mci = societes.find(s => s.code.toUpperCase().includes('MCI') || s.nom.toUpperCase().includes('MCI'));
    if (mci) return mci;
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
