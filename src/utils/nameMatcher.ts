/**
 * Normalise un nom provenant d'Excel ou de la base (accents, ponctuation,
 * espaces et ordre des mots ne doivent pas provoquer de faux écarts).
 */
export function normalizePersonName(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Retourne un score entre 0 et 1. Les mots sont comparés indépendamment de
 * leur ordre et une petite faute de saisie est tolérée. Deux noms sans aucun
 * mot commun restent à 0 (même si la date et le montant sont identiques).
 */
export function personNameSimilarity(left: string | null | undefined, right: string | null | undefined): number {
  const a = normalizePersonName(left);
  const b = normalizePersonName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aWords = a.split(' ');
  const bWords = b.split(' ');
  const matched = new Set<number>();
  let total = 0;

  for (const word of aWords) {
    let best = 0;
    let bestIndex = -1;
    bWords.forEach((other, index) => {
      if (matched.has(index)) return;
      const similarity = 1 - levenshtein(word, other) / Math.max(word.length, other.length);
      // Évite de considérer des mots très courts ou différents comme un nom.
      const accepted = word === other || (Math.min(word.length, other.length) >= 4 && similarity >= 0.72);
      if (accepted && similarity > best) {
        best = similarity;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) {
      matched.add(bestIndex);
      total += best;
    }
  }

  // Dice : un nom composé peut être écrit dans un ordre différent.
  const wordScore = (2 * total) / (aWords.length + bWords.length);
  const fullScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return Math.max(0, Math.min(1, wordScore, fullScore + 0.35));
}

/** Seuil volontairement conservateur pour une liaison automatique. */
export function hasSimilarPersonName(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizePersonName(left);
  const b = normalizePersonName(right);
  return Boolean(a && b && personNameSimilarity(a, b) >= 0.5);
}
