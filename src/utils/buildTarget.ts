/**
 * Cible de compilation de l'application.
 *
 * - `IS_WAMP_BUILD === true` UNIQUEMENT dans la build générée par
 *   `npm run build:wamp` (mode Vite « wamp », voir scripts/build-wamp.mjs) :
 *   cette version est STRICTEMENT MYSQL — aucune donnée hors base MySQL WAMP.
 *
 * - `false` partout ailleurs (serveur de dev / preview, application hébergée) :
 *   comportement d'origine inchangé (données initiales locales, localStorage).
 */
export const IS_WAMP_BUILD: boolean = import.meta.env.MODE === 'wamp';
