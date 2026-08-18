import React, { useState } from 'react';
import { Layers, Plus, Search, Edit3, Trash2, X, Shield, Percent } from 'lucide-react';
import { Famille } from '../types';
import { formatMoney, generateId } from '../utils/formatters';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFamille, setEditingFamille] = useState<Famille | null>(null);
  const [formData, setFormData] = useState<Partial<Famille>>({
    code: '',
    libelle: '',
    plafondAnnuel: 1000000,
    tauxStandard: 80,
    description: '',
  });

  const filtered = familles.filter(f =>
    f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.libelle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenCreate = () => {
    setEditingFamille(null);
    setFormData({
      code: '',
      libelle: '',
      plafondAnnuel: 1000000,
      tauxStandard: 80,
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (f: Famille) => {
    setEditingFamille(f);
    setFormData({ ...f });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.libelle) {
      alert('Veuillez renseigner le code et le libellé de la famille d\'actes.');
      return;
    }

    const toSave: Famille = {
      id: editingFamille ? editingFamille.id : generateId('fam'),
      code: formData.code!.toUpperCase(),
      libelle: formData.libelle!,
      plafondAnnuel: Number(formData.plafondAnnuel) || 0,
      tauxStandard: Number(formData.tauxStandard) || 80,
      description: formData.description || '',
    };

    onSaveFamille(toSave);
    setIsModalOpen(false);
  };

  return (
    <div id="familles-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Familles d'Actes & Barèmes Médicaux</h2>
          <p className="text-xs text-slate-500">
            Nomenclature des actes médicaux (Consultations, Pharmacie, Hospitalisation, Dentaire, Optique...)
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Famille d'Actes</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Recherche par code, libellé..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">{filtered.length} catégories configurées</span>
      </div>

      {/* Grid of Medical Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(fam => (
          <div key={fam.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3 hover:border-indigo-300 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                  {fam.code}
                </span>
                <h3 className="font-bold text-slate-900 text-sm">{fam.libelle}</h3>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleOpenEdit(fam)}
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50"
                  title="Modifier"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer la famille ${fam.libelle} ?`)) {
                      onDeleteFamille(fam.id);
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 line-clamp-2 min-h-8">
              {fam.description || 'Prestations médicales correspondantes au barème conventionnel.'}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Taux Standard</span>
                <span className="font-bold text-emerald-700">{fam.tauxStandard}%</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block">Plafond Annuel</span>
                <span className="font-bold text-slate-900">{formatMoney(fam.plafondAnnuel)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create/Edit Famille */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingFamille ? 'Modifier la Famille d\'Actes' : 'Nouvelle Famille d\'Actes'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formData.code || ''}
                    onChange={(e) => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono uppercase font-bold text-indigo-700"
                    placeholder="Ex: CONS"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Libellé / Désignation *</label>
                  <input
                    type="text"
                    required
                    value={formData.libelle || ''}
                    onChange={(e) => setFormData(p => ({ ...p, libelle: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: Consultations Généralistes"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Taux Prise en Charge (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.tauxStandard || 80}
                    onChange={(e) => setFormData(p => ({ ...p, tauxStandard: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Plafond Annuel (Ar)</label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={formData.plafondAnnuel || 1000000}
                    onChange={(e) => setFormData(p => ({ ...p, plafondAnnuel: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Description & Actes inclus</label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Détails des actes couverts par cette famille..."
                />
              </div>

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
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
