import React, { useState, useMemo } from 'react';
import { Building, Plus, Search, Edit3, Trash2, Phone, Mail, MapPin, X, Layers, GitMerge, CheckSquare, Square, ArrowRight, Check, Sparkles, RefreshCw } from 'lucide-react';
import { Societe, Prestation, Personne } from '../types';
import { generateId } from '../utils/formatters';

interface SocietesViewProps {
  societes: Societe[];
  prestations?: Prestation[];
  personnes?: Personne[];
  onSaveSociete: (societe: Societe) => void;
  onDeleteSociete: (id: string) => void;
  onMergeSubSocietes?: (societeId: string, sourceNames: string[], targetName: string) => Promise<void> | void;
}

export const SocietesView: React.FC<SocietesViewProps> = ({
  societes,
  prestations = [],
  personnes = [],
  onSaveSociete,
  onDeleteSociete,
  onMergeSubSocietes,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSociete, setEditingSociete] = useState<Societe | null>(null);
  const [societeToDelete, setSocieteToDelete] = useState<Societe | null>(null);
  const [formData, setFormData] = useState<Partial<Societe>>({
    nom: '',
    code: '',
    contact: '',
    telephone: '',
    email: '',
    adresse: '',
    tauxCouvertureDefaut: 80,
  });

  // State for Regrouping Sub-Societés Modal
  const [regroupSociete, setRegroupSociete] = useState<Societe | null>(null);
  const [selectedSubNames, setSelectedSubNames] = useState<string[]>([]);
  const [targetSubName, setTargetSubName] = useState<string>('');
  const [subSearchTerm, setSubSearchTerm] = useState<string>('');
  const [subSortOrder, setSubSortOrder] = useState<'alpha-asc' | 'alpha-desc' | 'volume'>('alpha-asc');
  const [editingSingleSub, setEditingSingleSub] = useState<{ oldName: string; newName: string } | null>(null);
  const [isProcessingMerge, setIsProcessingMerge] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filtered = societes.filter(s =>
    s.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contact && s.contact.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Calculate unique sub-société statistics for the company being managed, sorted alphabetically
  const subSocietesStats = useMemo(() => {
    if (!regroupSociete) return [];

    const socIdLower = regroupSociete.id.toLowerCase().trim();
    const socNomLower = regroupSociete.nom.toLowerCase().trim();

    const map = new Map<string, { name: string; prestationCount: number; personneCount: number }>();

    const getOrCreate = (rawName: string) => {
      const clean = rawName.trim();
      if (!clean) return null;
      let existingKey = Array.from(map.keys()).find(k => k.toLowerCase() === clean.toLowerCase());
      if (!existingKey) {
        map.set(clean, { name: clean, prestationCount: 0, personneCount: 0 });
        return map.get(clean)!;
      }
      return map.get(existingKey)!;
    };

    // Count in prestations
    prestations.forEach(p => {
      const pSocId = (p.societeId || '').toLowerCase().trim();
      const pSocNom = (p.societeNom || '').toLowerCase().trim();
      const matchesSoc = pSocId === socIdLower || (socNomLower && pSocNom === socNomLower);

      if (matchesSoc && p.sousSociete) {
        const item = getOrCreate(p.sousSociete);
        if (item) item.prestationCount++;
      }
    });

    // Count in personnes
    personnes.forEach(p => {
      const pSocId = (p.societeId || '').toLowerCase().trim();
      if (pSocId === socIdLower && p.sousSociete) {
        const item = getOrCreate(p.sousSociete);
        if (item) item.personneCount++;
      }
    });

    // Include defined list on societe if any
    if (regroupSociete.sousSocietes) {
      regroupSociete.sousSocietes.forEach(s => {
        getOrCreate(s);
      });
    }

    // Default alphabetical sorting A-Z for clear and easy grouping
    const list = Array.from(map.values());
    if (subSortOrder === 'alpha-asc') {
      return list.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true }));
    } else if (subSortOrder === 'alpha-desc') {
      return list.sort((a, b) => b.name.localeCompare(a.name, 'fr', { sensitivity: 'base', numeric: true }));
    } else {
      return list.sort((a, b) => (b.prestationCount + b.personneCount) - (a.prestationCount + a.personneCount));
    }
  }, [regroupSociete, prestations, personnes, subSortOrder]);

  const displayedSubSocietes = useMemo(() => {
    if (!subSearchTerm.trim()) return subSocietesStats;
    const term = subSearchTerm.toLowerCase().trim();
    return subSocietesStats.filter(s => s.name.toLowerCase().includes(term));
  }, [subSocietesStats, subSearchTerm]);

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

  // Sub-Sociétés Regrouping handlers
  const handleOpenRegroupModal = (s: Societe) => {
    setRegroupSociete(s);
    setSelectedSubNames([]);
    setTargetSubName('');
    setSubSearchTerm('');
    setSubSortOrder('alpha-asc');
    setEditingSingleSub(null);
    setSuccessMsg(null);
  };

  const handleToggleSelectSub = (name: string) => {
    setSelectedSubNames(prev => {
      if (prev.includes(name)) {
        const next = prev.filter(item => item !== name);
        if (next.length > 0 && !next.includes(targetSubName)) {
          setTargetSubName(next[0]);
        }
        return next;
      } else {
        const next = [...prev, name];
        if (!targetSubName) {
          setTargetSubName(name);
        }
        return next;
      }
    });
  };

  const handleSelectAllSubs = () => {
    const currentList = displayedSubSocietes.map(s => s.name);
    if (selectedSubNames.length === currentList.length) {
      setSelectedSubNames([]);
      setTargetSubName('');
    } else {
      setSelectedSubNames(currentList);
      if (currentList.length > 0 && !targetSubName) {
        setTargetSubName(currentList[0]);
      }
    }
  };

  const handleExecuteMerge = async () => {
    if (!regroupSociete || !onMergeSubSocietes) return;
    if (selectedSubNames.length === 0) {
      alert('Veuillez sélectionner au moins une sous-société à regrouper.');
      return;
    }
    if (!targetSubName.trim()) {
      alert('Veuillez saisir ou choisir le nom unifié de la sous-société.');
      return;
    }

    try {
      setIsProcessingMerge(true);
      await onMergeSubSocietes(regroupSociete.id, selectedSubNames, targetSubName.trim());
      setSuccessMsg(`Regroupement réussi ! ${selectedSubNames.length} sous-sociétés ont été unifiées sous "${targetSubName.trim()}".`);
      setSelectedSubNames([]);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Erreur lors du regroupement : ${err.message || err}`);
    } finally {
      setIsProcessingMerge(false);
    }
  };

  const handleExecuteSingleRename = async (oldName: string, newName: string) => {
    if (!regroupSociete || !onMergeSubSocietes || !newName.trim() || oldName === newName) {
      setEditingSingleSub(null);
      return;
    }

    try {
      setIsProcessingMerge(true);
      await onMergeSubSocietes(regroupSociete.id, [oldName], newName.trim());
      setSuccessMsg(`Sous-société "${oldName}" renommée avec succès en "${newName.trim()}".`);
      setEditingSingleSub(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Erreur : ${err.message || err}`);
    } finally {
      setIsProcessingMerge(false);
    }
  };

  return (
    <div id="societes-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sociétés & Compagnies d'Assurance</h2>
          <p className="text-xs text-slate-500">
            Gestion des organismes payeurs, taux de prise en charge contractuels, coordonnées et harmonisation des sous-sociétés
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
        {filtered.map(soc => {
          // Count total sub-societes associated with this company
          const socIdLower = soc.id.toLowerCase().trim();
          const socNomLower = soc.nom.toLowerCase().trim();
          const subSet = new Set<string>();

          prestations.forEach(p => {
            const pSocId = (p.societeId || '').toLowerCase().trim();
            const pSocNom = (p.societeNom || '').toLowerCase().trim();
            if ((pSocId === socIdLower || (socNomLower && pSocNom === socNomLower)) && p.sousSociete) {
              subSet.add(p.sousSociete.trim());
            }
          });
          personnes.forEach(p => {
            if ((p.societeId || '').toLowerCase().trim() === socIdLower && p.sousSociete) {
              subSet.add(p.sousSociete.trim());
            }
          });

          return (
            <div key={soc.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:border-indigo-300 transition">
              <div className="space-y-4">
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
                      title="Modifier les coordonnées"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSocieteToDelete(soc)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
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

              {/* Action Button: Regroup Sub-Sociétés */}
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleOpenRegroupModal(soc)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition shadow-xs cursor-pointer group"
                >
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform shrink-0" />
                    <span>Regrouper les sous-sociétés</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-200/80 text-indigo-950 text-[11px] font-extrabold">
                    {subSet.size}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Regrouper / Modifier les Sous-Sociétés */}
      {regroupSociete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                    <GitMerge className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Harmoniser & Regrouper les Sous-Sociétés
                    </h3>
                    <p className="text-xs text-indigo-900 font-semibold">
                      Organisme : <strong className="text-slate-900">{regroupSociete.nom}</strong> ({regroupSociete.code})
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setRegroupSociete(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification message */}
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-2xl text-xs font-bold flex items-center space-x-2 shrink-0 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Instructions */}
            <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80 shrink-0">
              💡 <strong>Principe :</strong> cochez les variantes ou doublons de sous-sociétés ci-dessous pour les fusionner instantanément en une seule sous-société officielle sur toutes les prestations et tous les adhérents existants.
            </p>

            {/* List & Controls */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {/* Search & Sort bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={subSearchTerm}
                    onChange={(e) => setSubSearchTerm(e.target.value)}
                    placeholder="Filtrer les sous-sociétés..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                  />
                  {subSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setSubSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider hidden sm:inline">Tri :</span>
                  <button
                    type="button"
                    onClick={() => setSubSortOrder('alpha-asc')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      subSortOrder === 'alpha-asc'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Trier par ordre alphabétique croissant A-Z"
                  >
                    A → Z
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubSortOrder('alpha-desc')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      subSortOrder === 'alpha-desc'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Trier par ordre alphabétique décroissant Z-A"
                  >
                    Z → A
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubSortOrder('volume')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      subSortOrder === 'volume'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Trier par volume d'activité"
                  >
                    Par Volume
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-800">
                  {subSearchTerm ? (
                    <>Sous-sociétés correspondantes ({displayedSubSocietes.length} / {subSocietesStats.length}) :</>
                  ) : (
                    <>Sous-sociétés recensées par ordre alphabétique ({subSocietesStats.length}) :</>
                  )}
                </span>
                {displayedSubSocietes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllSubs}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer"
                  >
                    {selectedSubNames.length === displayedSubSocietes.length ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Tout désélectionner</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        <span>Tout sélectionner</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {displayedSubSocietes.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
                  {subSearchTerm
                    ? `Aucune sous-société trouvée pour "${subSearchTerm}".`
                    : `Aucune sous-société répertoriée pour le moment pour ${regroupSociete.nom}.`}
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedSubSocietes.map((item) => {
                    const isSelected = selectedSubNames.includes(item.name);
                    const isEditing = editingSingleSub?.oldName === item.name;

                    return (
                      <div
                        key={item.name}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectSub(item.name)}
                            className="text-slate-500 hover:text-indigo-600 cursor-pointer shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-indigo-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </button>

                          {isEditing ? (
                            <div className="flex items-center space-x-2 flex-1">
                              <input
                                type="text"
                                value={editingSingleSub.newName}
                                onChange={(e) => setEditingSingleSub({ ...editingSingleSub, newName: e.target.value })}
                                className="px-2 py-1 border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleExecuteSingleRename(editingSingleSub.oldName, editingSingleSub.newName)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-xs"
                              >
                                Valider
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSingleSub(null)}
                                className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1 flex items-center justify-between pr-2">
                              <span className="text-xs font-extrabold text-slate-900 truncate">
                                {item.name}
                              </span>

                              <div className="flex items-center space-x-2 shrink-0">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                                  {item.prestationCount} prestation(s)
                                </span>
                                {item.personneCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                                    {item.personneCount} adhérent(s)
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => setEditingSingleSub({ oldName: item.name, newName: item.name })}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 shrink-0 cursor-pointer"
                            title="Renommer directement"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Merge Action Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Nom unifié de la sous-société cible :</span>
                </label>
                {selectedSubNames.length > 0 && (
                  <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {selectedSubNames.length} élément(s) sélectionné(s)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Saisissez ou choisissez le nom unifié (ex: DIRECTION GENERALE)"
                  value={targetSubName}
                  onChange={(e) => setTargetSubName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />

                <button
                  type="button"
                  onClick={handleExecuteMerge}
                  disabled={selectedSubNames.length === 0 || !targetSubName.trim() || isProcessingMerge}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center space-x-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isProcessingMerge ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <GitMerge className="w-4 h-4" />
                  )}
                  <span>Fusionner vers ce nom</span>
                </button>
              </div>

              {/* Quick suggestions from selected */}
              {selectedSubNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-semibold">Propositions :</span>
                  {selectedSubNames.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setTargetSubName(name)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                        targetSubName === name
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setRegroupSociete(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

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

      {/* Modal: Confirmation de Suppression */}
      {societeToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Supprimer la société ?</h3>
                <p className="text-[11px] text-slate-500 font-mono">{societeToDelete.code}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Voulez-vous vraiment supprimer la société <strong className="text-slate-900 font-bold">{societeToDelete.nom}</strong> ?
              Cette action retirera la société de votre liste d'organismes payeurs.
            </p>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSocieteToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSociete(societeToDelete.id);
                  setSocieteToDelete(null);
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
