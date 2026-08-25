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

  const cleanRaw = (rawName || '').toLowerCase().trim();
  const cleanPref = (preferredNameOrId || '').toLowerCase().trim();

  const findExact = (val: string) => societes.find(s => 
    s.nom.toLowerCase().trim() === val || 
    s.code.toLowerCase().trim() === val ||
    s.id === val
  );

  // 1. If rawName is specific and non-empty, evaluate rawName FIRST to find the actual matching company in Excel
  if (cleanRaw && cleanRaw !== 'organisme' && cleanRaw !== 'assurance' && cleanRaw !== 'client' && cleanRaw !== 'auto') {
    // 1a. Strict Exact match on code or name
    const exact = findExact(cleanRaw);
    if (exact) return exact;

    // 1b. Check BSA / GRAS SAVOYE / ASK GS
    if (
      cleanRaw.includes('bsa') || 
      cleanRaw.includes('ask gs') ||
      cleanRaw.includes('bsa / ask gs') ||
      cleanRaw.includes('gras savoye') || 
      cleanRaw.includes('ask gras') ||
      cleanRaw.includes('bfv') ||
      cleanRaw.includes('bred madagasikara')
    ) {
      const bsa = societes.find(s => 
        s.code.toUpperCase() === 'BSA' || 
        s.nom.toUpperCase().includes('BSA') || 
        s.nom.toUpperCase().includes('GRAS SAVOYE')
      );
      if (bsa) return bsa;
    }

    // 1c. Check ASCOMA - ONLY IF cleanRaw explicitly contains 'ascoma'
    if (cleanRaw.includes('ascoma')) {
      const ascoma = societes.find(s => 
        s.code.toUpperCase() === 'ASCOMA' || 
        s.nom.toUpperCase().includes('ASCOMA')
      );
      if (ascoma) return ascoma;
    }

    // 1d. Check MCI CARE
    if (cleanRaw.includes('mci') || cleanRaw.includes('mcicare') || cleanRaw.includes('mci care')) {
      const mci = societes.find(s => 
        s.code.toUpperCase().includes('MCI') || 
        s.nom.toUpperCase().includes('MCI')
      );
      if (mci) return mci;
    }

    // 1e. Check SANLAM
    if (cleanRaw.includes('sanlam') || cleanRaw.includes('sanlamallianz')) {
      const sanlam = societes.find(s => 
        s.code.toUpperCase().includes('SANLAM') || 
        s.nom.toUpperCase().includes('SANLAM')
      );
      if (sanlam) return sanlam;
    }

    // 1f. Check NY HAVANA
    if (cleanRaw.includes('havana') || cleanRaw.includes('ny havana') || cleanRaw.includes('nyhavana')) {
      const havana = societes.find(s => 
        s.code.toUpperCase().includes('HAVANA') || 
        s.nom.toUpperCase().includes('HAVANA')
      );
      if (havana) return havana;
    }

    // 1g. Substring inclusion match (min 3 chars)
    const partial = societes.find(s => {
      const sNom = s.nom.toLowerCase().trim();
      const sCode = s.code.toLowerCase().trim();
      if (sNom.length < 3 && sCode.length < 3) return false;
      return (
        (sNom.length >= 3 && cleanRaw.includes(sNom)) ||
        (sCode.length >= 3 && cleanRaw.includes(sCode)) ||
        (cleanRaw.length >= 4 && sNom.includes(cleanRaw))
      );
    });
    if (partial) return partial;
  }

  // 2. Fallback to preferredNameOrId if rawName was generic or unassigned
  if (cleanPref && cleanPref !== 'auto' && cleanPref !== 'all' && cleanPref !== 'custom') {
    const prefExact = findExact(cleanPref);
    if (prefExact) return prefExact;
  }

  // 3. Fallback for generic text ('organisme', 'assurance', etc.)
  if (!cleanRaw || cleanRaw === 'organisme' || cleanRaw === 'assurance' || cleanRaw === 'client') {
    const mci = societes.find(s => s.code.toUpperCase().includes('MCI') || s.nom.toUpperCase().includes('MCI'));
    return mci || societes[0];
  }

  return undefined;
}
