/**
 * Helpers de rapprochement de noms de personnes (lignes de décompte vs actes
 * prescrits dans la base). Utilisés par l'import des décomptes et par la
 * fenêtre « Rattacher un acte prescrit » des paiements afin d'appliquer les
 * mêmes garde-fous partout :
 *  - un nom TOTALEMENT différent ne doit jamais être lié (ni auto, ni manuel) ;
 *  - un nom partiellement similaire (prénom coupé, ordre inversé, mots
 *    répartis « EMYMORANE » vs « EMY MORANE ») reste rattachable.
 */

/** Normalise un nom : minuscules, sans accents/caractères spéciaux, espaces uniques. */
export function normalizePersonName(name?: string | null): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export interface PersonNameComparison {
  source: string;
  candidate: string;
  isSame: boolean;
  isPartial: boolean;
  isDifferent: boolean;
}

/**
 * Une correspondance partielle est utile pour les fichiers qui ne contiennent
 * qu'un seul élément du nom complet (ex. « HASINTSOA » contre
 * « HASINTSOA TSARAVINTANA »), ou qui inversent l'ordre des éléments.
 */
export function comparePersonNames(sourceName?: string | null, candidateName?: string | null): PersonNameComparison {
  const source = normalizePersonName(sourceName);
  const candidate = normalizePersonName(candidateName);

  if (!source || !candidate) {
    return { source, candidate, isSame: false, isPartial: false, isDifferent: false };
  }

  if (source === candidate) {
    return { source, candidate, isSame: true, isPartial: false, isDifferent: false };
  }

  const sourceTokens = source.split(' ').filter(token => token.length > 1);
  const candidateTokens = candidate.split(' ').filter(token => token.length > 1);
  const sharesToken = sourceTokens.some(token => candidateTokens.includes(token));
  const isPartial = source.includes(candidate) || candidate.includes(source) || sharesToken;

  return {
    source,
    candidate,
    isSame: false,
    isPartial,
    isDifferent: !isPartial,
  };
}

/**
 * Compare la liste des « mots significatifs » (≥ 2 lettres) entre le nom d'une
 * ligne de règlement et celui d'un acte prescrit, après normalisation.
 * Ex. « RALAIVAO EMYMORANE EMILIAS » vs « RALAIVAO EMY MORANE EMILIAS » :
 * sourceTokens = [ralaivao, emymorane, emilias], candidateTokens = [ralaivao,
 * emy, morane, emilias] → commun = 2 (ralaivao, emilias) > min(3,4)/2 = 1.5
 * → vrai même patient.
 */
export function compareNameTokens(sourceName?: string | null, candidateName?: string | null): boolean {
  const source = normalizePersonName(sourceName);
  const candidate = normalizePersonName(candidateName);
  if (!source || !candidate) return false;
  const sourceTokens = source.split(' ').filter(token => token.length > 1);
  const candidateTokens = candidate.split(' ').filter(token => token.length > 1);
  if (sourceTokens.length === 0 || candidateTokens.length === 0) return false;
  const shorterLength = Math.min(sourceTokens.length, candidateTokens.length);
  const commonCount = sourceTokens.filter(token => candidateTokens.includes(token)).length;
  return commonCount > shorterLength / 2;
}

/**
 * Verdict « à ne pas lier automatiquement » : nom présent des deux côtés,
 * pas identique et pas une simple variante partielle « du même patient »
 * (ex. prénom coupé, ordre inversé). Le nom est alors considéré comme
 * TOTALEMENT différent → aucun rattachement auto, et bouton bloqué.
 */
export function isNameMismatchBlocking(
  sourceName?: string | null,
  candidateName?: string | null,
  opts?: { allowNameOnly?: boolean }
): boolean {
  const source = normalizePersonName(sourceName);
  const candidate = normalizePersonName(candidateName);
  if (!source || !candidate) return false;
  if (source === candidate) return false;

  const isStrongTokenOverlap = compareNameTokens(source, candidate);
  if (isStrongTokenOverlap) return false;

  const sourceTokens = source.split(' ').filter(token => token.length > 1);
  const candidateTokens = candidate.split(' ').filter(token => token.length > 1);
  const sourceLongest = sourceTokens.sort((a, b) => b.length - a.length)[0] || '';
  const candidateLongest = candidateTokens.sort((a, b) => b.length - a.length)[0] || '';
  const sharesRealToken = sourceTokens.some(token => candidateTokens.includes(token));
  const onlyOneSideHasFullName = opts?.allowNameOnly
    ? (sourceTokens.length === 1 && candidateTokens.length >= 2)
    : (sourceTokens.length === 1 || candidateTokens.length === 1);
  const isSamePersonPartialVariant = Boolean(
    (onlyOneSideHasFullName && sharesRealToken) ||
    (sourceLongest && candidateLongest && sourceLongest !== candidateLongest && (sourceLongest.includes(candidateLongest) || candidateLongest.includes(sourceLongest)))
  );

  return !isSamePersonPartialVariant;
}

/** Vrai si deux noms désignent manifestement le même patient (variantes partielles comprises). */
export function isSamePersonName(sourceName?: string | null, candidateName?: string | null): boolean {
  const compared = comparePersonNames(sourceName, candidateName);
  return compared.isSame || !isNameMismatchBlocking(sourceName, candidateName, { allowNameOnly: true });
}
