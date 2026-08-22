import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Download,
  Server,
  Database,
  Settings,
  Play,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  Users,
  Building,
  Printer,
  HelpCircle,
  ExternalLink,
  Copy,
  Terminal,
  FolderOpen,
  Globe,
  Wrench,
  Lightbulb,
  Video,
  ChevronDown,
  ChevronRight,
  Search,
  ShieldCheck,
  LayoutDashboard,
  Layers,
} from 'lucide-react';

type TutoSection = 'intro' | 'prerequis' | 'wamp' | 'build' | 'deploy' | 'db' | 'usage' | 'import' | 'debug' | 'faq';

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

const TUTO_CHECKLIST_KEY = 'suivi_assurance_tuto_checklist';

export const TutoView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<TutoSection>('intro');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    const saved = localStorage.getItem(TUTO_CHECKLIST_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [
      { id: 'wamp-install', label: 'WAMP installé et icône verte', done: false },
      { id: 'node-install', label: 'Node.js 18+ installé', done: false },
      { id: 'npm-install', label: 'npm install exécuté', done: false },
      { id: 'build-wamp', label: 'npm run build:wamp exécuté', done: false },
      { id: 'db-import', label: 'Base suivi_assurance_salfa importée', done: false },
      { id: 'copy-www', label: 'Dossier wamp/ copié dans C:\\wamp64\\www\\suivi_assurance', done: false },
      { id: 'health-check', label: 'api.php?action=health retourne connected', done: false },
      { id: 'first-prestation', label: 'Première prestation créée', done: false },
    ];
  });

  useEffect(() => {
    localStorage.setItem(TUTO_CHECKLIST_KEY, JSON.stringify(checklist));
  }, [checklist]);

  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const progress = Math.round((checklist.filter(c => c.done).length / checklist.length) * 100);

  const sections: { id: TutoSection; label: string; icon: any; desc: string }[] = [
    { id: 'intro', label: 'Introduction', icon: BookOpen, desc: "Vue d'ensemble" },
    { id: 'prerequis', label: 'Prérequis', icon: ShieldCheck, desc: "Ce qu'il vous faut" },
    { id: 'wamp', label: 'Installer WAMP', icon: Server, desc: 'Apache, MySQL, PHP' },
    { id: 'build', label: 'Compiler l\'app', icon: Terminal, desc: 'npm run build:wamp' },
    { id: 'deploy', label: 'Déployer', icon: FolderOpen, desc: 'Copier dans www' },
    { id: 'db', label: 'Base de données', icon: Database, desc: 'Importer le SQL' },
    { id: 'usage', label: 'Utiliser l\'app', icon: Play, desc: 'Guide fonctionnel' },
    { id: 'import', label: 'Imports PDF/Excel', icon: FileText, desc: 'Factures & décomptes' },
    { id: 'debug', label: 'Dépannage', icon: Wrench, desc: 'Résoudre les problèmes' },
    { id: 'faq', label: 'FAQ', icon: HelpCircle, desc: 'Questions fréquentes' },
  ];

  const faqs = [
    { q: 'Page blanche ou Forbidden après copie dans www ?', a: 'Vous avez oublié npm run build:wamp. Le dossier wamp/ doit contenir index.html + assets/. Refaites : npm install puis npm run build:wamp, puis recopiez tout le contenu de wamp/ dans C:\\wamp64\\www\\suivi_assurance\\' },
    { q: 'api.php renvoie "database: disconnected" ?', a: 'Vérifiez : 1) WAMP icône verte (MySQL démarré), 2) Base suivi_assurance_salfa importée via phpMyAdmin, 3) Port MySQL (3306 par défaut, parfois 3308 sur WAMP récent) dans config.php, 4) Extension pdo_mysql activée (icône WAMP > PHP > Extensions).' },
    { q: 'Erreur "syntax error" ou "strict_types" ?', a: 'Version PHP trop ancienne (<7.1). Cliquez sur icône WAMP → PHP → Version → choisissez 7.4, 8.0, 8.1 ou 8.2. Redémarrez WAMP.' },
    { q: 'Dois-je ouvrir index.html en double-cliquant ?', a: 'Non ! Toujours via Apache : http://localhost/suivi_assurance/. Ouvrir en file:// casse le routing et l\'API.' },
    { q: 'Où sont stockées mes données sans WAMP ?', a: 'En mode dev (npm run dev), données en localStorage navigateur. Avec WAMP, synchronisation MySQL via api.php + fallback localStorage si offline.' },
    { q: 'Comment sauvegarder ?', a: 'Bouton "Sauvegarder (.SQL WAMP)" en haut à droite génère un dump complet. Ou via phpMyAdmin > Exporter > base suivi_assurance_salfa.' },
    { q: 'Puis-je changer le mot de passe root MySQL ?', a: 'Oui. Modifiez config.php : define SUIVI_DB_PASSWORD ou via variable d\'env SUIVI_DB_PASSWORD. Ou laissez root sans mot de passe (par défaut WAMP).' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-indigo-200 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Centre d'aide & Tutoriel</h1>
              <p className="mt-1 max-w-2xl text-sm text-indigo-100">
                Guide complet d'installation WAMP et d'utilisation de <strong>Suivi Assurance SALFA</strong> – Hôpital SALFA Toliara.
                Suivez les étapes, cochez votre progression, et lancez l'application en 10 minutes.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                  <Video className="h-3.5 w-3.5" /> 10 min pour démarrer
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                  <Globe className="h-3.5 w-3.5" /> 100% offline avec WAMP
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-emerald-50 ring-1 ring-emerald-300/30">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Compatible PHP 7.1 → 8.5
                </span>
              </div>
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur ring-1 ring-white/20">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-100">
                <span>Progression installation</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-black/20">
                <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-3 space-y-1.5">
                {checklist.map(item => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-2 text-xs text-indigo-50">
                    <input type="checkbox" checked={item.done} onChange={() => toggleCheck(item.id)} className="h-3.5 w-3.5 rounded border-white/30 bg-white/20 text-indigo-600 focus:ring-0" />
                    <span className={item.done ? 'line-through opacity-70' : ''}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar nav */}
        <aside className="lg:sticky lg:top-[112px] lg:h-fit">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sommaire</h2>
            </div>
            <nav className="space-y-0.5">
              {sections.map(s => {
                const Icon = s.icon;
                const active = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="flex-1">
                      <span className="block font-medium leading-none">{s.label}</span>
                      <span className="mt-0.5 block text-[11px] opacity-70">{s.desc}</span>
                    </span>
                    {active && <ChevronRight className="h-4 w-4 text-indigo-400" />}
                  </button>
                );
              })}
            </nav>

            <div className="mt-4 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <div className="flex gap-2">
                <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-800">
                  <strong>Astuce :</strong> Après chaque étape, testez <code className="rounded bg-amber-100 px-1 py-0.5">api.php?action=diagnostic</code> pour un rapport complet.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 space-y-6">
          {/* INTRO */}
          {activeSection === 'intro' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><BookOpen className="h-5 w-5 text-indigo-600" /> Bienvenue dans Suivi Assurance SALFA</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Application de gestion du tiers-payant pour l'Hôpital Loterana SALFA Toliara. Elle centralise :
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[
                    { icon: Building, title: 'Sociétés & Assurances', desc: 'MCI CARE, NY HAVANA, BSA, ASCOMA, AXIAN...' },
                    { icon: Users, title: 'Assurés & Familles', desc: 'Adhérents, ayants droit, plafonds, taux' },
                    { icon: FileText, title: 'Prestations', desc: 'Factures de soins, actes médicaux, tickets modérateurs' },
                    { icon: CreditCard, title: 'Règlements', desc: 'Bordereaux, paiements, rapprochement, rejets' },
                  ].map((f, i) => (
                    <div key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200"><f.icon className="h-4 w-4 text-indigo-600" /></div>
                      <div><h4 className="text-sm font-semibold text-slate-900">{f.title}</h4><p className="mt-0.5 text-xs text-slate-500">{f.desc}</p></div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-xl bg-slate-900 p-5 text-slate-100">
                  <h4 className="flex items-center gap-2 text-sm font-semibold"><Terminal className="h-4 w-4 text-emerald-400" /> Démarrage ultra-rapide (3 commandes)</h4>
                  <div className="mt-3 space-y-2 font-mono text-xs">
                    {[
                      { id: 'c1', cmd: 'npm install' },
                      { id: 'c2', cmd: 'npm run build:wamp' },
                      { id: 'c3', cmd: 'Copier wamp/ → C:\\wamp64\\www\\suivi_assurance\\' },
                    ].map(c => (
                      <div key={c.id} className="group flex items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 ring-1 ring-white/10">
                        <span>{c.cmd}</span>
                        <button onClick={() => copyToClipboard(c.cmd, c.id)} className="rounded-md bg-white/10 px-2 py-1 text-[11px] hover:bg-white/15">
                          {copied === c.id ? 'Copié !' : <><Copy className="mr-1 inline h-3 w-3" />Copier</>}
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Puis ouvrez <code className="rounded bg-white/10 px-1.5 py-0.5 text-emerald-300">http://localhost/suivi_assurance/</code></p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Search className="h-4 w-4 text-indigo-500" /> Diagnostic intégré</h4>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">Ouvrez <code>api.php?action=diagnostic</code> pour vérifier PHP, pdo_mysql, MySQL, tables.</p>
                  <a href={`${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/api.php?action=diagnostic`} target="_blank" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">Tester maintenant <ExternalLink className="h-3 w-3" /></a>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Database className="h-4 w-4 text-emerald-600" /> Sauvegarde 1 clic</h4>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">Bouton en haut à droite : génère un .sql complet compatible WAMP/phpMyAdmin.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="h-4 w-4 text-violet-600" /> Import intelligent</h4>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">Glissez vos PDF SALFA ou Excel décomptes : extraction auto, mapping actes.</p>
                </div>
              </div>
            </div>
          )}

          {/* PREREQUIS */}
          {activeSection === 'prerequis' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Prérequis système</h2>
              <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr><th className="px-4 py-3">Composant</th><th className="px-4 py-3">Version minimale</th><th className="px-4 py-3">Recommandé</th><th className="px-4 py-3">Où le trouver</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="px-4 py-3 font-medium">WampServer</td><td className="px-4 py-3">3.x</td><td className="px-4 py-3">3.2.6+ / 3.3.x</td><td className="px-4 py-3 text-xs text-slate-500">wampserver.aviatechno.net</td></tr>
                    <tr><td className="px-4 py-3 font-medium">PHP</td><td className="px-4 py-3">7.1 (strict_types)</td><td className="px-4 py-3">7.4, 8.0, 8.1, 8.2</td><td className="px-4 py-3 text-xs text-slate-500">Inclus dans WAMP, icône → PHP → Version</td></tr>
                    <tr><td className="px-4 py-3 font-medium">MySQL / MariaDB</td><td className="px-4 py-3">5.7 / 10.3</td><td className="px-4 py-3">8.0 / 10.4+</td><td className="px-4 py-3 text-xs text-slate-500">Inclus dans WAMP</td></tr>
                    <tr><td className="px-4 py-3 font-medium">Apache</td><td className="px-4 py-3">2.4</td><td className="px-4 py-3">2.4.x</td><td className="px-4 py-3 text-xs text-slate-500">Inclus dans WAMP</td></tr>
                    <tr><td className="px-4 py-3 font-medium">Node.js (build uniquement)</td><td className="px-4 py-3">18.x</td><td className="px-4 py-3">20 LTS</td><td className="px-4 py-3 text-xs text-slate-500">nodejs.org</td></tr>
                    <tr><td className="px-4 py-3 font-medium">Extension PHP</td><td colSpan={2} className="px-4 py-3">pdo_mysql activée</td><td className="px-4 py-3 text-xs text-slate-500">WAMP → PHP → Extensions → pdo_mysql</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
                  <h4 className="text-sm font-semibold text-indigo-900">Vous n'avez pas Node.js ?</h4>
                  <p className="mt-1 text-xs leading-relaxed text-indigo-700">Node est nécessaire uniquement pour compiler (npm run build:wamp). Si quelqu'un vous a déjà fourni le dossier wamp/ buildé (avec index.html + assets/), vous pouvez sauter directement à l'étape Déployer.</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <h4 className="text-sm font-semibold text-emerald-900">Vérif rapide</h4>
                  <ul className="mt-2 list-disc pl-4 text-xs leading-relaxed text-emerald-800">
                    <li>Icône WAMP verte = Apache + MySQL OK</li>
                    <li>http://localhost/phpmyadmin accessible</li>
                    <li>php -v ≥ 7.1 et node -v ≥ 18</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* WAMP */}
          {activeSection === 'wamp' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Server className="h-5 w-5 text-violet-600" /> Étape 1 — Installer & configurer WAMP</h2>
                <ol className="mt-6 space-y-5">
                  {[
                    { title: 'Télécharger WampServer', text: 'Allez sur wampserver.aviatechno.net → Télécharger la version 64 bits. Installez dans C:\\wamp64 (chemin par défaut).', code: 'https://wampserver.aviatechno.net/' },
                    { title: 'Lancer WAMP et attendre le vert', text: 'Double-clic sur WampServer. L\'icône passe rouge → orange → vert. Vert = tout est démarré. Si orange, port 80 occupé (Skype, IIS) : clic droit icône → Outils → Tester port 80.', code: null },
                    { title: 'Choisir PHP 7.4+ (très important)', text: 'Clic gauche icône WAMP → PHP → Version → sélectionnez 7.4.x, 8.0, 8.1 ou 8.2. Si vous êtes en PHP 5.x, l\'API plantera avec "strict_types".', code: null },
                    { title: 'Activer pdo_mysql', text: 'Icône WAMP → PHP → Extensions → cochez php_pdo_mysql et php_mysqli. Redémarrez tous les services (icône → Redémarrer tous les services).', code: null },
                    { title: 'Vérifier phpMyAdmin', text: 'Ouvrez http://localhost/phpmyadmin — vous devez voir l\'interface sans mot de passe (root / vide). Si erreur, vérifiez MySQL démarré.', code: 'http://localhost/phpmyadmin' },
                  ].map((step, idx) => (
                    <li key={idx} className="flex gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900">{step.title}</h4>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.text}</p>
                        {step.code && <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-100">{step.code}<button onClick={() => copyToClipboard(step.code!, `wamp-${idx}`)} className="ml-2 rounded bg-white/10 px-1.5 py-0.5">{copied === `wamp-${idx}` ? 'Copié' : <Copy className="h-3 w-3" />}</button></div>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h4 className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle className="h-4 w-4" /> Problèmes fréquents WAMP</h4>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-amber-800">
                  <li>• <strong>Icône reste orange :</strong> Port 80 utilisé. Fermez Skype → Options → Avancé → Connexion → décocher port 80/443. Ou changez port Apache : icône → Apache → httpd.conf → Listen 8080.</li>
                  <li>• <strong>MSVCR110.dll manquant :</strong> Installez Visual C++ Redistributable 2012-2022 (toutes versions x64) depuis Microsoft.</li>
                  <li>• <strong>Accès refusé phpMyAdmin :</strong> MySQL n'a pas démarré. Vérifiez my.ini port, ou réinstallez WAMP en administrateur.</li>
                </ul>
              </div>
            </div>
          )}

          {/* BUILD */}
          {activeSection === 'build' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Terminal className="h-5 w-5 text-slate-800" /> Étape 2 — Compiler l'application pour WAMP</h2>
                <p className="mt-2 text-sm text-slate-600">Cette étape transforme le code React en fichiers statiques (HTML/CSS/JS) que Apache peut servir.</p>

                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Download className="h-4 w-4" /> 1. Ouvrir un terminal dans le projet</h4>
                    <p className="mt-1 text-xs text-slate-600">Clic droit dans le dossier du projet → Ouvrir dans Terminal, ou :</p>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
                      <span>cd C:\chemin\vers\suivi_assurance</span>
                      <button onClick={() => copyToClipboard('cd C:\\chemin\\vers\\suivi_assurance', 'build-cd')} className="rounded bg-white/10 px-2 py-1">{copied === 'build-cd' ? 'Copié' : 'Copier'}</button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="text-sm font-semibold text-slate-900">2. Installer les dépendances (1ère fois uniquement)</h4>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-300">
                      <span>npm install</span>
                      <button onClick={() => copyToClipboard('npm install', 'build-npm-i')} className="rounded bg-white/10 px-2 py-1 text-slate-100">{copied === 'build-npm-i' ? 'Copié' : 'Copier'}</button>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">Installe 295 paquets (vite, react, tailwind...). ~30 sec.</p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><Settings className="h-4 w-4" /> 3. Générer le dossier wamp/</h4>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-300">
                      <span>npm run build:wamp</span>
                      <button onClick={() => copyToClipboard('npm run build:wamp', 'build-wamp')} className="rounded bg-white/10 px-2 py-1 text-slate-100">{copied === 'build-wamp' ? 'Copié' : 'Copier'}</button>
                    </div>
                    <div className="mt-3 rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-600 ring-1 ring-emerald-200">
                      <strong>Ce que fait la commande :</strong>
                      <ul className="mt-1 list-disc pl-4">
                        <li>Supprime ancien <code>wamp/assets</code> et <code>wamp/index.html</code> (conserve api.php, config.php, .htaccess)</li>
                        <li>Lance <code>vite build</code> → génère index.html + assets/ dans wamp/</li>
                        <li>Copie <code>database/schema_wamp.sql</code> → <code>wamp/schema_wamp.sql</code></li>
                      </ul>
                      <div className="mt-2 font-mono text-[11px] text-slate-500">✓ 2452 modules transformed<br />✓ Dossier WAMP prêt : wamp</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl bg-slate-900 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Résultat attendu</h4>
                  <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-slate-100">{`wamp/
├── index.html              (1.7 kB) ← généré
├── assets/
│   ├── index-*.css         (66 kB)
│   └── index-*.js          (1.9 MB)
├── api.php                 (conservé)
├── config.php              (conservé)
├── .htaccess               (conservé)
├── schema_wamp.sql         (copié)
└── README.md`}</pre>
                </div>
              </div>
            </div>
          )}

          {/* DEPLOY */}
          {activeSection === 'deploy' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FolderOpen className="h-5 w-5 text-amber-600" /> Étape 3 — Déployer dans WAMP</h2>
              <div className="mt-6 space-y-5">
                <div className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">1</span>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Créer le dossier dans www</h4>
                    <p className="mt-1 text-sm text-slate-600">Allez dans <code className="rounded bg-slate-100 px-1.5 py-0.5">C:\wamp64\www\</code> et créez un dossier <code className="rounded bg-amber-100 px-1.5 py-0.5">suivi_assurance</code></p>
                    <div className="mt-2 rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">C:\wamp64\www\suivi_assurance\</div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">2</span>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Copier le contenu de wamp/</h4>
                    <p className="mt-1 text-sm text-slate-600">Sélectionnez <strong>tout</strong> le contenu du dossier <code>wamp/</code> du projet (pas le dossier lui-même, son contenu) et collez-le dans <code>C:\wamp64\www\suivi_assurance\</code></p>
                    <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                      Source : <code>.../suivi_assurance/wamp/</code> → Destination : <code>C:\wamp64\www\suivi_assurance\</code><br />
                      Doit contenir : index.html, assets/, api.php, config.php, .htaccess, schema_wamp.sql
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">3</span>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-900">Ouvrir dans le navigateur</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href="http://localhost/suivi_assurance/" target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"><Globe className="h-4 w-4" /> http://localhost/suivi_assurance/ <ExternalLink className="h-3 w-3 opacity-70" /></a>
                      <span className="inline-flex items-center rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">⚠️ Pas en file://, toujours via localhost</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-indigo-900"><Lightbulb className="h-4 w-4" /> Mise à jour future ?</h4>
                <p className="mt-1 text-xs leading-relaxed text-indigo-800">Refaites <code>npm run build:wamp</code> puis recopiez uniquement <code>index.html</code> et <code>assets/</code>. Gardez <code>api.php</code> et <code>config.php</code> si vous les avez personnalisés, ou écrasez tout si vous n'avez rien changé.</p>
              </div>
            </div>
          )}

          {/* DB */}
          {activeSection === 'db' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Database className="h-5 w-5 text-emerald-600" /> Étape 4 — Importer la base de données</h2>
                <ol className="mt-6 space-y-4">
                  <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">1</span><div><p className="text-sm text-slate-700"><strong>Ouvrez phpMyAdmin :</strong> <a href="http://localhost/phpmyadmin" target="_blank" className="text-emerald-600 underline">http://localhost/phpmyadmin</a></p></div></li>
                  <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">2</span><div><p className="text-sm text-slate-700"><strong>Onglet Importer</strong> → Choisir fichier → sélectionnez <code>schema_wamp.sql</code> (dans <code>C:\wamp64\www\suivi_assurance\</code> ou dans le projet <code>wamp/</code>)</p></div></li>
                  <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">3</span><div><p className="text-sm text-slate-700"><strong>Exécuter</strong> : le script crée la base <code>suivi_assurance_salfa</code> + 7 tables (societes, personnes, familles, prestations, lignes_prestation, paiements, lignes_paiement)</p></div></li>
                </ol>

                <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Tables créées</div>
                  <div className="grid grid-cols-2 gap-px bg-slate-200 text-xs">
                    {[
                      ['societes', 'Assurances : MCI, BSA...'],
                      ['personnes', 'Adhérents & ayants droit'],
                      ['familles', 'Actes médicaux & tarifs'],
                      ['prestations', 'Factures de soins'],
                      ['lignes_prestation', 'Détail actes par facture'],
                      ['paiements', 'Bordereaux de règlement'],
                      ['lignes_paiement', 'Détail actes payés'],
                    ].map(([t, d]) => (
                      <div key={t} className="bg-white px-4 py-2.5"><span className="font-mono font-semibold text-slate-900">{t}</span><span className="ml-2 text-slate-500">— {d}</span></div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Vérification connexion</h4>
                  <p className="mt-1 text-xs text-slate-600">Testez ces 2 URLs après import :</p>
                  <div className="mt-3 space-y-2">
                    {[
                      { url: 'http://localhost/suivi_assurance/api.php?action=health', label: 'Health check → doit retourner database: connected' },
                      { url: 'http://localhost/suivi_assurance/api.php?action=diagnostic', label: 'Diagnostic complet → JSON avec tous les checks' },
                    ].map(l => (
                      <div key={l.url} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                        <div><div className="font-mono text-xs text-indigo-600">{l.url}</div><div className="text-[11px] text-slate-500">{l.label}</div></div>
                        <a href={l.url} target="_blank" className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"><ExternalLink className="h-3 w-3" /></a>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-xl bg-slate-900 p-4">
                  <h4 className="text-sm font-semibold text-white">config.php — paramètres par défaut</h4>
                  <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-emerald-300">{`define('SUIVI_DB_HOST', '127.0.0.1');
define('SUIVI_DB_PORT', '3306'); // parfois 3308 sur WAMP récent
define('SUIVI_DB_NAME', 'suivi_assurance_salfa');
define('SUIVI_DB_USER', 'root');
define('SUIVI_DB_PASSWORD', ''); // vide par défaut WAMP`}</pre>
                  <p className="mt-2 text-[11px] text-slate-400">Modifiez directement le fichier ou via variables d'environnement SUIVI_DB_*</p>
                </div>
              </div>
            </div>
          )}

          {/* USAGE */}
          {activeSection === 'usage' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Play className="h-5 w-5 text-indigo-600" /> Guide d'utilisation fonctionnel</h2>
                <div className="mt-6 grid gap-4">
                  {[
                    { icon: LayoutDashboard, title: 'Tableau de bord', desc: 'Vue d\'ensemble : CA, impayés, rejets, top sociétés. Filtre par société. Raccourcis Nouvelle prestation / Nouveau règlement.' },
                    { icon: FileText, title: 'Prestations', desc: 'Liste des factures SALFA. Création manuelle, import PDF SALFA (extraction auto actes), filtres, export, détail facture avec lignes.' },
                    { icon: CreditCard, title: 'Règlements', desc: 'Bordereaux de paiement assurances. Import Excel décomptes MCI/Ascoma/BSA. Rapprochement auto avec prestations, calcul reste à payer.' },
                    { icon: AlertTriangle, title: 'Rejets', desc: 'Actes rejetés ou partiellement payés. Analyse motifs, relance, régularisation.' },
                    { icon: Building, title: 'Sociétés', desc: 'Gestion assurances : code, contact, taux couverture défaut. Utilisé pour mapping auto lors des imports.' },
                    { icon: Users, title: 'Assurés', desc: 'Base adhérents : matricule, société, qualité (Principal/Conjoint/Enfant), statut. Recherche rapide.' },
                    { icon: Layers, title: 'Actes / Familles', desc: 'Référentiel actes médicaux : CONS, PHAR, LABO, RADIO... avec plafonds, tarifs, aliases pour mapping auto PDF.' },
                    { icon: Printer, title: 'Rapports / États', desc: 'Génération PDF : états de recouvrement, factures groupées, exports comptables. Entête personnalisable.' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200"><item.icon className="h-5 w-5 text-indigo-600" /></div>
                      <div><h4 className="text-sm font-semibold text-slate-900">{item.title}</h4><p className="mt-1 text-xs leading-relaxed text-slate-600">{item.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
                <h3 className="text-sm font-bold text-indigo-900">Flux de travail recommandé</h3>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-white px-3 py-1.5 font-medium shadow-sm ring-1 ring-indigo-200">1. Paramétrer Sociétés & Actes</span>
                  <span className="text-indigo-400">→</span>
                  <span className="rounded-full bg-white px-3 py-1.5 font-medium shadow-sm ring-1 ring-indigo-200">2. Importer Assurés (Excel)</span>
                  <span className="text-indigo-400">→</span>
                  <span className="rounded-full bg-white px-3 py-1.5 font-medium shadow-sm ring-1 ring-indigo-200">3. Importer Prestations (PDF SALFA)</span>
                  <span className="text-indigo-400">→</span>
                  <span className="rounded-full bg-white px-3 py-1.5 font-medium shadow-sm ring-1 ring-indigo-200">4. Importer Règlements (Excel décomptes)</span>
                  <span className="text-indigo-400">→</span>
                  <span className="rounded-full bg-emerald-600 px-3 py-1.5 font-medium text-white shadow-sm">5. Suivre rejets & rapports</span>
                </div>
              </div>
            </div>
          )}

          {/* IMPORT */}
          {activeSection === 'import' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FileText className="h-5 w-5 text-violet-600" /> Imports PDF & Excel — mode d'emploi</h2>

                <div className="mt-6 space-y-6">
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-violet-900"><FileText className="h-4 w-4" /> Import Factures SALFA (PDF)</h4>
                    <ul className="mt-3 list-disc pl-5 text-xs leading-relaxed text-violet-800">
                      <li>Dans <strong>Prestations → Importer PDF SALFA</strong>, glissez un ou plusieurs PDF générés par SALFA.</li>
                      <li>L'app extrait : n° facture, date, matricule, nom, société, actes (code + libellé + montant), total, ticket modérateur.</li>
                      <li>Si un acte n'est pas reconnu (ex: nouveau code), une modale de mapping s'ouvre : choisissez la famille correspondante (ex: PHAR → Pharmacie).</li>
                      <li>Les assurés et sociétés inconnus sont créés automatiquement (option désactivable).</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-900"><CreditCard className="h-4 w-4" /> Import Décomptes / Règlements (Excel)</h4>
                    <ul className="mt-3 list-disc pl-5 text-xs leading-relaxed text-emerald-800">
                      <li>Dans <strong>Règlements → Importer Décompte</strong>, glissez fichier Excel (MCI CARE, ASCOMA, BSA, etc.).</li>
                      <li>Formats supportés : .xlsx, .xls, .csv. Colonnes attendues : matricule, nom, n° facture, date soins, montants, code acte.</li>
                      <li>L'app fait le rapprochement : trouve la prestation d'origine via n° facture + matricule, calcule payé / rejeté / reste.</li>
                      <li>Si société dans parenthèses (ex: BFV EMPLOYES (BFV RETRAITES)), la sous-société est extraite auto.</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Modèles Excel</h4>
                    <p className="mt-1 text-xs text-slate-600">Utilisez <code>utils/excelTemplates.ts</code> → bouton Modèle dans chaque vue pour télécharger un modèle conforme.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DEBUG */}
          {activeSection === 'debug' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Wrench className="h-5 w-5 text-amber-600" /> Dépannage — solutions rapides</h2>
                <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr><th className="px-4 py-3 w-[30%]">Symptôme</th><th className="px-4 py-3 w-[30%]">Cause probable</th><th className="px-4 py-3">Solution</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      <tr><td className="px-4 py-3 font-medium">Page blanche / Forbidden</td><td className="px-4 py-3 text-slate-600">build:wamp jamais fait</td><td className="px-4 py-3 text-slate-700">npm run build:wamp → recopier wamp/</td></tr>
                      <tr><td className="px-4 py-3 font-medium">Erreur PHP strict_types / syntax error</td><td className="px-4 py-3 text-slate-600">PHP &lt; 7.1</td><td className="px-4 py-3 text-slate-700">WAMP → PHP → Version → 7.4+ → Redémarrer</td></tr>
                      <tr><td className="px-4 py-3 font-medium">api.php → success: false MySQL</td><td className="px-4 py-3 text-slate-600">MySQL arrêté / base non importée / port</td><td className="px-4 py-3 text-slate-700">Icône verte, importer schema_wamp.sql, vérifier port 3306 vs 3308</td></tr>
                      <tr><td className="px-4 py-3 font-medium">Access denied for user root</td><td className="px-4 py-3 text-slate-600">Mot de passe root différent</td><td className="px-4 py-3 text-slate-700">Modifier SUIVI_DB_PASSWORD dans config.php</td></tr>
                      <tr><td className="px-4 py-3 font-medium">Données ne s'enregistrent pas en base</td><td className="px-4 py-3 text-slate-600">Normal au 1er lancement, sync à la saisie</td><td className="px-4 py-3 text-slate-700">Créez une prestation → vérifiez phpMyAdmin → prestations</td></tr>
                      <tr><td className="px-4 py-3 font-medium">pdo_mysql manquant dans diagnostic</td><td className="px-4 py-3 text-slate-600">Extension désactivée</td><td className="px-4 py-3 text-slate-700">WAMP → PHP → Extensions → cocher pdo_mysql</td></tr>
                      <tr><td className="px-4 py-3 font-medium">Port 80 occupé (WAMP orange)</td><td className="px-4 py-3 text-slate-600">Skype, IIS, autre Apache</td><td className="px-4 py-3 text-slate-700">Fermer Skype port 80/443 ou changer Apache Listen 8080</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-900 p-4 text-slate-100">
                    <h4 className="text-sm font-semibold">Commande diagnostic ultime</h4>
                    <p className="mt-1 text-xs text-slate-400">Ouvrez cette URL, copiez le JSON et envoyez-le au support si besoin.</p>
                    <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 font-mono text-xs">http://localhost/suivi_assurance/api.php?action=diagnostic</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Lightbulb className="h-4 w-4" /> Logs Apache / PHP</h4>
                    <p className="mt-1 text-xs leading-relaxed text-amber-800">Icône WAMP → Apache → Logs d'erreurs → affiche error.log. Utile si page blanche sans message.</p>
                    <p className="mt-2 text-xs text-amber-700">Chemin : <code>C:\wamp64\logs\apache_error.log</code> et <code>php_error.log</code></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FAQ */}
          {activeSection === 'faq' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><HelpCircle className="h-5 w-5 text-indigo-600" /> FAQ</h2>
                <div className="mt-6 space-y-3">
                  {faqs.map((faq, i) => (
                    <div key={i} className="overflow-hidden rounded-xl border border-slate-200">
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left hover:bg-slate-50">
                        <span className="text-sm font-medium text-slate-900">{faq.q}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                      </button>
                      {openFaq === i && <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">{faq.a}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900">Besoin d'aide supplémentaire ?</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <h4 className="text-xs font-semibold text-slate-900">Documentation WAMP</h4>
                    <p className="mt-1 text-[11px] text-slate-500">wamp/README.md dans le projet</p>
                    <code className="mt-2 block rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100">wamp/README.md</code>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <h4 className="text-xs font-semibold text-slate-900">Tuto complet MD</h4>
                    <p className="mt-1 text-[11px] text-slate-500">Guide installation détaillé</p>
                    <code className="mt-2 block rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100">TUTORIEL.md / wamp/TUTO.md</code>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <h4 className="text-xs font-semibold text-slate-900">API Docs</h4>
                    <p className="mt-1 text-[11px] text-slate-500">Endpoints & diagnostic</p>
                    <code className="mt-2 block rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100">api.php?action=diagnostic</code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer tip */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
        <p className="text-xs text-slate-500">💡 Astuce : Ce tutoriel est accessible hors-ligne même sans WAMP, car intégré dans l'application. Pour le mettre à jour sur WAMP, refaites <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run build:wamp</code>.</p>
      </div>
    </div>
  );
};
