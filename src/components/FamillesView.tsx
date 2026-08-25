import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Tag,
  Sparkles,
  Check,
  Info,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Database
} from 'lucide-react';
import { Famille } from '../types';
import { generateId } from '../utils/formatters';
import { IS_WAMP_BUILD } from '../utils/buildTarget';
import { initialFamilles } from '../data/initialData';

interface FamillesViewProps {
  familles: Famille[];
  onSaveFamille: (famille: Famille) => void;
  onDeleteFamille: (id: string) => void;
}

export const FamillesView: React.FC<FamillesViewProps> = ({
  familles,
  onSaveFamille,
  onDeleteFamille,
}) => {
  // VERSION WAMP (STRICTEMENT MYSQL) : les familles affichées proviennent
  // exclusivement de la base MySQL WAMP ; aucune donnée codée en dur n'est
  // injectée (les alias de référence sont insérés EN BASE par schema.sql).
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFamille, setEditingFamille] = useState<Famille | null>(null);
  const [familleToDelete, setFamilleToDelete] = useState<Famille | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Quick inline alias input state on cards: { [familleId]: currentText }
  const [quickAliasInputs, setQuickAliasInputs] = useState<Record<string, string>>({});

  // Synchronisation des alias de référence — disponible hors version WAMP
  // (en version WAMP, les alias de référence viennent de schema.sql en base).
  const handleSyncAllAliases = () => {
    let count = 0;
    initialFamilles.forEach(initF => {
      const existing = familles.find(
        f => f.id === initF.id || f.code.toUpperCase() === initF.code.toUpperCase()
      );
      const combinedAliases = Array.from(new Set([
        ...(initF.aliases || []),
        ...(existing?.aliases || [])
      ]));

      const familleToSave: Famille = existing
        ? { ...existing, aliases: combinedAliases }
        : { ...initF, aliases: combinedAliases };

      onSaveFamille(familleToSave);
      count++;
    });

    setSyncStatus(`✅ ${count} familles d'actes et tous leurs alias ont été copiés/synchronisés vers MySQL !`);
    setTimeout(() => setSyncStatus(null), 5000);
  };

  // Modal Form State
  const [formCode, setFormCode] = useState('');
  const [formLibelle, setFormLibelle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAliases, setFormAliases] = useState<string[]>([]);
  const [newAliasInput, setNewAliasInput] = useState('');
  const [formTauxStandard, setFormTauxStandard] = useState<number>(80);

  const filtered = familles.filter(f => {
    const term = searchTerm.toLowerCase();
    const matchesCode = f.code.toLowerCase().includes(term);
    const matchesLib = f.libelle.toLowerCase().includes(term);
    const matchesDesc = (f.description || '').toLowerCase().includes(term);
    const matchesAlias = f.aliases && f.aliases.some(a => a.toLowerCase().includes(term));
    return matchesCode || matchesLib || matchesDesc || matchesAlias;
  });

  const handleOpenCreate = () => {
    setEditingFamille(null);
    setFormCode('');
    setFormLibelle('');
    setFormDescription('');
    setFormAliases([]);
    setNewAliasInput('');
    setFormTauxStandard(80);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (f: Famille) => {
    setEditingFamille(f);
    setFormCode(f.code);
    setFormLibelle(f.libelle);
    setFormDescription(f.description || '');
    setFormAliases(f.aliases ? [...f.aliases] : [f.code]);
    setNewAliasInput('');
    setFormTauxStandard(f.tauxStandard ?? 80);
    setIsModalOpen(true);
  };

  // Add alias in modal
  const handleAddAliasInModal = () => {
    const trimmed = newAliasInput.trim().toUpperCase();
    if (!trimmed) return;
    if (!formAliases.includes(trimmed)) {
      setFormAliases(prev => [...prev, trimmed]);
    }
    setNewAliasInput('');
  };

  const handleRemoveAliasInModal = (aliasToRemove: string) => {
    setFormAliases(prev => prev.filter(a => a !== aliasToRemove));
  };

  // Quick inline add alias directly on a Famille card
  const handleQuickAddAlias = (famille: Famille) => {
    const inputVal = (quickAliasInputs[famille.id] || '').trim().toUpperCase();
    if (!inputVal) return;

    const currentAliases = Array.isArray(famille.aliases) ? famille.aliases : [];
    if (!currentAliases.includes(inputVal)) {
      const updated: Famille = {
        ...famille,
        aliases: [...currentAliases, inputVal],
      };
      onSaveFamille(updated);
    }
    setQuickAliasInputs(prev => ({ ...prev, [famille.id]: '' }));
  };

  // Quick inline remove alias directly on a Famille card
  const handleQuickRemoveAlias = (famille: Famille, aliasToRemove: string) => {
    const currentAliases = Array.isArray(famille.aliases) ? famille.aliases : [];
    const updated: Famille = {
      ...famille,
      aliases: currentAliases.filter(a => a !== aliasToRemove),
    };
    onSaveFamille(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formLibelle.trim()) {
      alert('Veuillez renseigner le code et le libellé de l\'acte.');
      return;
    }

    const codeUpper = formCode.trim().toUpperCase();
    const finalAliases = formAliases.length > 0 ? Array.from(new Set([codeUpper, ...formAliases])) : [codeUpper];

    const toSave: Famille = {
      id: editingFamille ? editingFamille.id : generateId('fam'),
      code: codeUpper,
      libelle: formLibelle.trim(),
      description: formDescription.trim(),
      aliases: finalAliases,
      tauxStandard: Number(formTauxStandard) || 80,
    };

    onSaveFamille(toSave);
    setIsModalOpen(false);
  };

  return (
    <div id="familles-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Reconnaissance Automatique des Décomptes</span>
              </span>
              <span className="text-xs text-slate-400 font-medium">MCI • ASCOMA • BSA • SALFA</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Actes Médicaux & Reconnaissance des Codes d'Assurance
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-relaxed">
              Chaque famille correspond directement à un <strong>acte médical</strong>. Vous pouvez y ajouter <strong>plusieurs descriptions et codes alternatifs</strong> (ex : <code>PH</code>, <code>PHSB</code> ou <code>PHARMACIE</code> pour BSA ; <code>CG</code> ou <code>CONS</code> pour Consultation ; <code>DC</code> ou <code>DK</code> pour Dentaire ; <code>EB</code> pour Laboratoire). Lors des importations de factures et décomptes, le système fait le rattachement automatique instantanément.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {!IS_WAMP_BUILD && (
              <button
                onClick={handleSyncAllAliases}
                title="Copier et synchroniser l'ensemble des alias d'actes locaux vers la base de données"
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
              >
                <Database className="w-4 h-4" />
                <span>Copier les Alias vers MySQL</span>
              </button>
            )}
            <button
              onClick={handleOpenCreate}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel Acte Médical</span>
            </button>
          </div>
        </div>

        {syncStatus && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs font-bold text-emerald-800 flex items-center space-x-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncStatus}</span>
          </div>
        )}

        {/* Quick helper tip */}
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-indigo-900">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Astuce :</strong> Vous pouvez ajouter un nouveau code ou alias directement sur la carte de chaque acte ci-dessous en tapant le code (ex: <code>PHSB</code> ou <code>CG</code>) puis en appuyant sur <strong>Entrée</strong> ou sur le bouton <strong>+</strong>.
          </div>
        </div>
      </div>

      {/* Search & Counter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Recherche par code d'acte, libellé, ou alias (ex: PH, CG, DC, EB)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {filtered.length} acte(s) médical(aux) configuré(s)
        </span>
      </div>

      {/* Grid of Medical Acts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(fam => {
          const aliasesList = Array.isArray(fam.aliases) ? fam.aliases : [fam.code];
          const quickVal = quickAliasInputs[fam.id] || '';

          return (
            <div 
              key={fam.id} 
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-indigo-300 transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header with Code and Edit/Delete */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-900 text-white rounded-lg shadow-xs">
                      {fam.code}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">{fam.libelle}</h3>
                      <span className="text-[10px] text-slate-400 font-medium">{aliasesList.length} code(s) & description(s) reconnus</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(fam)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                      title="Modifier cet acte"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFamilleToDelete(fam)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {fam.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {fam.description}
                  </p>
                )}

                {/* Section: Recognized Insurance Aliases / Descriptions */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                      <Tag className="w-3 h-3 text-indigo-500" />
                      <span>Descriptions & Codes Reconnus :</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Auto-match</span>
                  </div>

                  {/* Chips of aliases */}
                  <div className="flex flex-wrap gap-1.5 min-h-[36px]">
                    {aliasesList.map((alias) => (
                      <span
                        key={alias}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold transition ${
                          alias === fam.code
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <span>{alias}</span>
                        {alias !== fam.code && (
                          <button
                            onClick={() => handleQuickRemoveAlias(fam, alias)}
                            className="text-slate-400 hover:text-rose-600 ml-0.5 focus:outline-hidden"
                            title={`Retirer l'alias ${alias}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Quick Inline Add Alias Field */}
                  <div className="flex items-center space-x-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Ajouter un code (ex: PH, CG, PHSB)..."
                      value={quickVal}
                      onChange={(e) => setQuickAliasInputs(p => ({ ...p, [fam.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddAlias(fam);
                        }
                      }}
                      className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickAddAlias(fam)}
                      disabled={!quickVal.trim()}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 disabled:opacity-40 transition shrink-0"
                      title="Ajouter ce code d'assurance"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom info */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Prise en charge standard :</span>
                <span className="font-semibold text-emerald-700">{fam.tauxStandard ?? 80}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create/Edit Famille d'Acte */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingFamille ? `Modifier l'Acte : ${editingFamille.libelle}` : 'Nouvel Acte Médical'}
                  </h3>
                  <span className="text-[11px] text-slate-400">Configuration de l'acte et de ses alias de décomptes</span>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1">
              {/* Code & Libelle */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Code Principal *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono uppercase font-bold text-indigo-700"
                    placeholder="Ex: PHAR"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Ex: PHAR, CONS, DENT</span>
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Libellé / Désignation de l'Acte *</label>
                  <input
                    type="text"
                    required
                    value={formLibelle}
                    onChange={(e) => setFormLibelle(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold text-slate-800"
                    placeholder="Ex: Pharmacie & Médicaments"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Nom complet affiché dans vos factures</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description & Précisions</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="Détails des prestations couvertes par cet acte médical..."
                />
              </div>

              {/* Multiple Aliases / Descriptions / Codes d'assurance section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-slate-800 font-bold flex items-center space-x-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Descriptions & Codes Reconnus pour les Décomptes (MCI, ASCOMA, BSA...)</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Ajoutez tous les codes et abréviations utilisés par les différentes assurances (ex : pour <code>PHAR</code>, ajoutez <code>PH</code>, <code>PHSB</code>, <code>PHARMACIE</code>, <code>MEDIC</code> ; pour <code>CONS</code>, ajoutez <code>CG</code>, <code>VISITE</code>).
                  </p>
                </div>

                {/* Tag Input */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newAliasInput}
                    onChange={(e) => setNewAliasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAliasInModal();
                      }
                    }}
                    placeholder="Tapez un code ou mot-clé (ex: PH, CG, PHSB) et appuyez sur Entrée..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono uppercase text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddAliasInModal}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center space-x-1 shrink-0 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>

                {/* List of aliases tags */}
                <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
                  {formAliases.map((alias) => (
                    <span
                      key={alias}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white text-indigo-900 border border-indigo-200 shadow-xs"
                    >
                      <span>{alias}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAliasInModal(alias)}
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {formAliases.length === 0 && (
                    <span className="text-[11px] text-slate-400 italic">
                      Aucun code alias additionnel (le code principal {formCode || '...'} sera utilisé).
                    </span>
                  )}
                </div>
              </div>

              {/* Taux standard */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Taux de Prise en Charge par Défaut (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formTauxStandard}
                  onChange={(e) => setFormTauxStandard(Number(e.target.value))}
                  className="w-32 p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-semibold text-emerald-700"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition"
                >
                  Enregistrer l'Acte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmation de Suppression */}
      {familleToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Supprimer l'acte médical ?</h3>
                <p className="text-[11px] text-slate-500 font-mono">Code: {familleToDelete.code}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Voulez-vous vraiment supprimer l'acte médical <strong className="text-slate-900 font-bold">{familleToDelete.libelle}</strong> ?
              Cette action le retirera du catalogue d'actes.
            </p>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFamilleToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteFamille(familleToDelete.id);
                  setFamilleToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
