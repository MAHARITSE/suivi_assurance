<?php
/**
 * =====================================================================
 *  SUIVI ASSURANCE SALFA — Page de test de l'API WAMP
 * =====================================================================
 *  Ouvrez cette page dans le navigateur après l'installation :
 *
 *      http://localhost/<votre-dossier>/test_api.php
 *
 *  Elle vérifie : PHP + extension PDO/MySQL, la connexion à la base
 *  « suivi_assurance_salfa » et la disponibilité de chaque table.
 */

declare(strict_types=1);

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test de l'API — Suivi Assurance SALFA</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; margin: 0; background: #f1f5f9; color: #0f172a; }
  .wrap { max-width: 860px; margin: 40px auto; padding: 0 20px 60px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, .08); overflow: hidden; }
  .head { background: #0f172a; color: #fff; padding: 22px 28px; }
  .head h1 { margin: 0; font-size: 20px; }
  .head p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
  .body { padding: 24px 28px; }
  .row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 10px; background: #f8fafc; }
  .row.ok { border-color: #bbf7d0; background: #f0fdf4; }
  .row.ko { border-color: #fecaca; background: #fef2f2; }
  .row.wait { border-color: #fde68a; background: #fffbeb; }
  .badge { flex: 0 0 auto; font-weight: 700; font-size: 12px; padding: 5px 12px; border-radius: 999px; margin-top: 2px; }
  .ok .badge { background: #16a34a; color: #fff; }
  .ko .badge { background: #dc2626; color: #fff; }
  .wait .badge { background: #d97706; color: #fff; }
  .row .txt { font-size: 14px; font-weight: 600; }
  .row .sub { font-size: 12.5px; color: #475569; margin-top: 3px; word-break: break-word; }
  .row .sub code, .sub code { background: #e2e8f0; border-radius: 6px; padding: 1px 6px; font-size: 12px; }
  h2 { font-size: 15px; margin: 26px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
  .hint { font-size: 13px; color: #475569; line-height: 1.55; }
  .hint li { margin-bottom: 6px; }
  .btn { display: inline-block; margin-top: 18px; padding: 10px 22px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 13.5px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="head">
      <h1>🩺 Test de l'API — Suivi Assurance SALFA</h1>
      <p>Diagnostic WAMP : Apache + PHP + MySQL/MariaDB + base <code>suivi_assurance_salfa</code></p>
    </div>
    <div class="body">
      <div id="results">
        <div class="row wait"><span class="badge">…</span>
          <div><div class="txt">Analyse en cours…</div></div>
        </div>
      </div>
      <h2>Tables de la base de données</h2>
      <div id="tables"><em class="hint">En attente du test de connexion…</em></div>
      <div id="help" style="display:none">
        <h2>❌ L'API ne répond pas — comment débloquer ?</h2>
        <ol class="hint">
          <li>Démarrez <strong>WAMP Server</strong> (icône <strong>verte</strong> dans la barre des tâches) et vérifiez que <strong>Apache</strong> (port 80) et <strong>MySQL</strong> (port 3306) sont bien démarrés.</li>
          <li>Ouvrez <strong>phpMyAdmin</strong> (<code>http://localhost/phpmyadmin</code>) et importez le fichier <code>schema.sql</code> (onglet <em>Importer</em>) pour créer la base <code>suivi_assurance_salfa</code>.</li>
          <li>Si vous avez un mot de passe MySQL, modifiez <code>api/config.php</code> (WAMP par défaut : utilisateur <code>root</code>, mot de passe vide).</li>
          <li>Consultez le guide d'installation complet : <a href="Installation.html">Installation.html</a> / <a href="INSTALLATION.md">INSTALLATION.md</a>.</li>
        </ol>
      </div>
      <a class="btn" href="./">↩ Ouvrir l'application</a>
    </div>
  </div>
</div>

<script>
(function () {
  var results = document.getElementById('results');
  var tablesDiv = document.getElementById('tables');

  function row(cls, label, title, sub) {
    var div = document.createElement('div');
    div.className = 'row ' + cls;
    div.innerHTML = '<span class="badge">' + label + '</span>' +
      '<div><div class="txt">' + title + '</div>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
    return div;
  }

  var htmlVersion = document.createElement('div');
  results.appendChild(row('ok', 'PHP', 'PHP détecté par Apache',
    'Version : <code>' + '<?= PHP_VERSION ?>' + '</code> — extension PDO/MySQL : ' +
    (<?= function_exists('pdo_drivers') && in_array('mysql', pdo_drivers(), true) ? 'true' : 'false' ?> ?
      '<code>pdo_mysql activée ✓</code>' : '<code>pdo_mysql INACTIVÉE ✗ — activez l\'extension dans la coche WAMP</code>')));

  // 1) Test check_db
  fetch('api.php?action=check_db', { cache: 'no-store' })
    .then(function (res) { return res.json().catch(function () { return null; }); })
    .then(function (json) {
      if (json && json.success) {
        results.appendChild(row('ok', 'MySQL',
          'Base « ' + (json.database || '') + ' » accessible',
          'Serveur : <code>' + (json.server || '') + '</code> — tables : ' +
          Object.keys(json.counts || {}).map(function (t) {
            return '<code>' + t + '</code> (' + (json.counts[t] || 0) + ' ligne' + ((json.counts[t] || 0) > 1 ? 's' : '') + ')';
          }).join(' · ')));
        tablesDiv.innerHTML = '<table><thead><tr><th>Table</th><th>Enregistrements</th></tr></thead><tbody>' +
          Object.keys(json.counts || {}).map(function (t) {
            return '<tr><td><code>' + t + '</code></td><td>' + (json.counts[t] || 0) + '</td></tr>';
          }).join('') + '</tbody></table>';
      } else {
        results.appendChild(row('ko', 'MySQL',
          'Connexion MySQL impossible ou schéma manquant',
          json && json.error ? json.error : 'Réponse inattendue de l\'API.'));
        document.getElementById('help').style.display = 'block';
      }

      // 2) Test de lecture de chaque entité
      var actions = ['societes', 'personnes', 'familles', 'prestations', 'paiements'];
      var pending = actions.length;
      var tableHtml = '<table><thead><tr><th>Endpoint GET</th><th>État</th><th>Enregistrements</th></tr></thead><tbody>';
      actions.forEach(function (a) {
        fetch('api.php?action=' + a, { cache: 'no-store' })
          .then(function (res) { return res.json().catch(function () { return null; }); })
          .then(function (j) {
            var ok = !!(j && j.success);
            tableHtml += '<tr><td><code>api.php?action=' + a + '</code></td><td>' +
              (ok ? '✅ OK' : '❌ Échec') + '</td><td>' + (ok ? (j.count || 0) : '—') + '</td></tr>';
            pending--;
            if (pending === 0) { tablesDiv.innerHTML = tableHtml + '</tbody></table>'; }
          })
          .catch(function () {
            tableHtml += '<tr><td><code>api.php?action=' + a + '</code></td><td>❌ Erreur réseau</td><td>—</td></tr>';
            pending--;
            if (pending === 0) { tablesDiv.innerHTML = tableHtml + '</tbody></table>'; }
          });
      });
    })
    .catch(function (err) {
      results.appendChild(row('ko', 'API',
        'API PHP injoignable (erreur réseau)',
        'Apache ne sert pas ce dossier ou PHP n\'est pas configuré. Erreur : <code>' + err + '</code>'));
      document.getElementById('help').style.display = 'block';
    });
})();
</script>
</body>
</html>
