import React, { useState } from 'react';
import { Building, Plus, Search, Edit3, Trash2, Phone, Mail, MapPin, X } from 'lucide-react';
import { Societe } from '../types';
import { generateId } from '../utils/formatters';

interface SocietesViewProps {
  societes: Societe[];
  onSaveSociete: (societe: Societe) => void;
  onDeleteSociete: (id: string) => void;
}

export const SocietesView: React.FC<SocietesViewProps> = ({
  societes,
  onSaveSociete,
  onDeleteSociete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSociete, setEditingSociete] = useState<Societe | null>(null);
  const [formData, setFormData] = useState<Partial<Societe>>({
    nom: '',
    code: '',
    contact: '',
    telephone: '',
    email: '',
    adresse: '',
    tauxCouvertureDefaut: 80,
  });

  const filtered = societes.filter(s =>
    s.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contact && s.contact.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenCreate = () => {
    setEditingSociete(null);
    setFormData({
      nom: '',
      code: `SOC-${String(societes.length + 1).padStart(2, '0')}`,
      contact: '',
      telephone: '',
      email: '',
      adresse: '',
      tauxCouvertureDefaut: 80,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Societe) => {
    setEditingSociete(s);
    setFormData({ ...s });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom || !formData.code) {
      alert('Veuillez renseigner le nom et le code de la société.');
      return;
    }

    const toSave: Societe = {
      id: editingSociete ? editingSociete.id : generateId('soc'),
      nom: formData.nom!,
      code: formData.code!,
      contact: formData.contact || '',
      telephone: formData.telephone || '',
      email: formData.email || '',
      adresse: formData.adresse || '',
      tauxCouvertureDefaut: Number(formData.tauxCouvertureDefaut) || 80,
    };

    onSaveSociete(toSave);
    setIsModalOpen(false);
  };

  return (
    <div id="societes-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sociétés & Compagnies d'Assurance</h2>
          <p className="text-xs text-slate-500">
            Gestion des organismes payeurs, taux de prise en charge contractuels et coordonnées
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Société d'Assurance</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une société..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">{filtered.length} sociétés actives</span>
      </div>

      {/* Grid of Company Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(soc => (
          <div key={soc.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 hover:border-indigo-300 transition">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 font-mono">
                  {soc.code}
                </span>
                <h3 className="font-bold text-slate-900 text-base">{soc.nom}</h3>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleOpenEdit(soc)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                  title="Modifier"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer la société ${soc.nom} ?`)) {
                      onDeleteSociete(soc.id);
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500">Taux de couverture standard :</span>
                <span className="font-bold text-emerald-700">{soc.tauxCouvertureDefaut}%</span>
              </div>

              {soc.contact && (
                <div className="text-slate-700">
                  <span className="text-slate-400 mr-1">Contact :</span> {soc.contact}
                </div>
              )}

              {soc.telephone && (
                <div className="flex items-center text-slate-600">
                  <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  <span>{soc.telephone}</span>
                </div>
              )}

              {soc.email && (
                <div className="flex items-center text-slate-600">
                  <Mail className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  <span className="truncate">{soc.email}</span>
                </div>
              )}

              {soc.adresse && (
                <div className="flex items-center text-slate-600">
                  <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                  <span className="truncate">{soc.adresse}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create/Edit Société */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingSociete ? 'Modifier la Société' : 'Nouvelle Société d\'Assurance'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nom de la Société *</label>
                <input
                  type="text"
                  required
                  value={formData.nom || ''}
                  onChange={(e) => setFormData(p => ({ ...p, nom: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ex: Sanlam Santé"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Code / Abrégé *</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={(e) => setFormData(p => ({ ...p, code: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    placeholder="Ex: SNL-01"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Taux Prise en Charge (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.tauxCouvertureDefaut || 80}
                    onChange={(e) => setFormData(p => ({ ...p, tauxCouvertureDefaut: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Personne de Contact</label>
                <input
                  type="text"
                  value={formData.contact || ''}
                  onChange={(e) => setFormData(p => ({ ...p, contact: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ex: M. Rasoanaivo"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={formData.telephone || ''}
                    onChange={(e) => setFormData(p => ({ ...p, telephone: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="+261 20..."
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="contact@assur.mg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Adresse</label>
                <input
                  type="text"
                  value={formData.adresse || ''}
                  onChange={(e) => setFormData(p => ({ ...p, adresse: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ville, Quartier, Rue..."
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
