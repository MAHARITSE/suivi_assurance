import type { SyntheticEvent } from 'react';

/**
 * Indique si l'utilisateur vient de sélectionner du texte à la souris
 * (glisser-relâcher) à l'intérieur de l'élément donné.
 *
 * Sert à distinguer un vrai clic (déplier une ligne, trier une colonne) d'une
 * simple sélection de contenu destinée à être copiée (ex. vers Excel) : un
 * glisser-relâcher dans une ligne ou un en-tête déclenche aussi l'évènement
 * `click`, qu'il faut alors ignorer pour ne pas perturber la sélection.
 */
export function isTextSelectedWithin(element: Element | null): boolean {
  if (typeof window === 'undefined') return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  if (!selection.toString().trim()) return false;
  if (!element) return true;

  const { anchorNode, focusNode } = selection;
  return Boolean((anchorNode && element.contains(anchorNode)) || (focusNode && element.contains(focusNode)));
}

/**
 * Enveloppe un gestionnaire de clic pour qu'il ne s'exécute pas lorsque le
 * clic termine une sélection de texte dans l'élément cliqué.
 *
 * Exemple : `onClick={unlessTextSelected(() => handleSort('date'))}`
 */
export function unlessTextSelected<E extends SyntheticEvent<Element>>(handler: (event: E) => void) {
  return (event: E) => {
    if (isTextSelectedWithin(event.currentTarget)) return;
    handler(event);
  };
}
