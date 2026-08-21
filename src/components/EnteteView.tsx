import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Type,
  AlignLeft,
  AlignCenter,
  AlignJustify,
  Palette,
  Save,
  RotateCcw,
  CheckCircle2,
  FileText,
  Eye,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileCode,
  Layers,
  Sparkles,
  Download
} from 'lucide-react';
import { EnteteConfig, defaultEnteteConfig } from '../types';
import { getStoredEnteteConfig, saveStoredEnteteConfig, resetStoredEnteteConfig } from '../utils/enteteStorage';
import jsPDF from 'jspdf';

interface EnteteViewProps {
  onConfigChange?: (config: EnteteConfig) => void;
}

export const EnteteView: React.FC<EnteteViewProps> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<EnteteConfig>(getStoredEnteteConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setConfig(getStoredEnteteConfig());
  }, []);

  const handleChange = <K extends keyof EnteteConfig>(key: K, value: EnteteConfig[K]) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    if (onConfigChange) onConfigChange(updated);
  };

  const handleSave = () => {
    saveStoredEnteteConfig(config);
    setSavedSuccess(true);
    if (onConfigChange) onConfigChange(config);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    if (window.confirm('Voulez-vous réinitialiser l’en-tête avec les valeurs par défaut de SALFA ?')) {
      const def = resetStoredEnteteConfig();
      setConfig(def);
      if (onConfigChange) onConfigChange(def);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const handleTestExport = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const fontFam = config.fontFamily || 'helvetica';
    const fontStyle = config.formePolice || 'bold';
    const titleText = config.majusculesTitre ? config.etablissement.toUpperCase() : config.etablissement;
    const pageWidth = 210;

    let currentY = 14;

    if (config.styleSeparateur === 'bandeau') {
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(fontFam, fontStyle);
      doc.setFontSize(Math.min(config.titreTaille, 13));
      doc.text(titleText, 12, 10.5);
      if (config.afficherDateGeneration) {
        doc.setFont(fontFam, 'normal');
        doc.setFontSize(8);
        doc.text(`Édité le : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 12, 10.5, { align: 'right' });
      }
      currentY = 24;
    } else {
      doc.setFont(fontFam, fontStyle);
      doc.setFontSize(config.titreTaille);
      doc.setTextColor(30, 41, 59);

      if (config.alignement === 'center') {
        doc.text(titleText, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
        if (config.sousTitre) {
          doc.setFont(fontFam, 'normal');
          doc.setFontSize(config.sousTitreTaille);
          doc.setTextColor(71, 85, 105);
          doc.text(config.sousTitre, pageWidth / 2, currentY, { align: 'center' });
          currentY += 4;
        }
      } else {
        doc.text(titleText, 12, currentY);
        currentY += 5;
        if (config.sousTitre) {
          doc.setFont(fontFam, 'normal');
          doc.setFontSize(config.sousTitreTaille);
          doc.setTextColor(71, 85, 105);
          doc.text(config.sousTitre, 12, currentY);
          currentY += 4;
        }
      }

      const contact = [config.adresse, config.telephone, config.email, config.nifStat].filter(Boolean).join(' • ');
      if (contact) {
        doc.setFont(fontFam, 'normal');
        doc.setFontSize(config.corpsTaille);
        doc.setTextColor(100, 116, 139);
        if (config.alignement === 'center') {
          doc.text(contact, pageWidth / 2, currentY, { align: 'center' });
        } else {
          doc.text(contact, 12, currentY);
        }
        currentY += 4;
      }

      if (config.styleSeparateur === 'ligne_simple') {
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.5);
        doc.line(12, currentY, pageWidth - 12, currentY);
        currentY += 6;
      }
    }

    doc.setFont(fontFam, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(185, 28, 28);
    doc.text('DOCUMENT SPÉCIMEN D’ESSAI D’EN-TÊTE', 12, currentY + 4);

    doc.save('Test_Entete_Personnalise.pdf');
  };

  const getFontFamilyStyle = () => {
    if (config.fontFamily === 'times') return 'font-serif';
    if (config.fontFamily === 'courier') return 'font-mono';
    return 'font-sans';
  };

  const getFontWeightStyle = () => {
    if (config.formePolice === 'bold' || config.formePolice === 'bolditalic') return 'font-bold';
    return 'font-normal';
  };

  const getFontStyleItalic = () => {
    if (config.formePolice === 'italic' || config.formePolice === 'bolditalic') return 'italic';
    return 'not-italic';
  };

  return (
    <div id="entete-management-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Paramétrage & Personnalisation des En-têtes</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Modifiez la police, taille, forme, alignement, coordonnées et style des en-têtes de tous vos états PDF
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            id="reset-entete-btn"
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Réinitialiser</span>
          </button>

          <button
            id="test-export-entete-btn"
            onClick={handleTestExport}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tester PDF</span>
          </button>

          <button
            id="save-entete-btn"
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer l'En-tête</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>L'en-tête a été enregistré avec succès et sera appliqué automatiquement à l'ensemble des exports et états PDF !</span>
        </div>
      )}

      {/* Grid: Form Controls (Left) + Live Interactive Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Customization Settings */}
        <div className="lg:col-span-6 space-y-5">
          {/* Card 1: Coordonnées & Textes Institutionnels */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                1. Textes & Identité de l'Établissement
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom de l'Établissement / Centre Médical
                </label>
                <input
                  type="text"
                  value={config.etablissement}
                  onChange={(e) => handleChange('etablissement', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ex: ÉTABLISSEMENT MÉDICAL SALFA"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sous-titre / Service
                  </label>
                  <input
                    type="text"
                    value={config.sousTitre}
                    onChange={(e) => handleChange('sousTitre', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: Service Facturation & Recouvrement"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Département / Pôle
                  </label>
                  <input
                    type="text"
                    value={config.departement}
                    onChange={(e) => handleChange('departement', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: Pôle Tiers-Payant"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adresse physique
                  </label>
                  <input
                    type="text"
                    value={config.adresse}
                    onChange={(e) => handleChange('adresse', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: Lot IVK 45, Ambohibao"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ville & Pays
                  </label>
                  <input
                    type="text"
                    value={config.villePays}
                    onChange={(e) => handleChange('villePays', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: Antananarivo, Madagascar"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Téléphone(s)
                  </label>
                  <input
                    type="text"
                    value={config.telephone}
                    onChange={(e) => handleChange('telephone', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="+261 20 22 200 00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email de contact
                  </label>
                  <input
                    type="text"
                    value={config.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="facturation@salfa.mg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Identifiants Fiscaux & Statistiques (NIF / STAT)
                </label>
                <input
                  type="text"
                  value={config.nifStat}
                  onChange={(e) => handleChange('nifStat', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  placeholder="NIF: 3000123456 • STAT: 86101 11 2005 0 00123"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mention de bas de page (Pied de page PDF)
                </label>
                <input
                  type="text"
                  value={config.textePiedDePage}
                  onChange={(e) => handleChange('textePiedDePage', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Document Confidentiel de Recouvrement • SALFA"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Police, Taille et Forme de Police */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Type className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                2. Typographie, Taille & Forme de Police
              </h3>
            </div>

            {/* Famille de Police */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Famille de Police</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'helvetica', label: 'Helvetica / Sans', fontClass: 'font-sans', desc: 'Standard moderne' },
                  { key: 'times', label: 'Times / Serif', fontClass: 'font-serif', desc: 'Classique officiel' },
                  { key: 'courier', label: 'Courier / Mono', fontClass: 'font-mono', desc: 'Technique' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleChange('fontFamily', f.key as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      config.fontFamily === f.key
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className={`text-xs font-bold ${f.fontClass}`}>{f.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Forme de Police (Style) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Forme / Style de Police</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'bold', label: 'Gras (Bold)', class: 'font-bold' },
                  { key: 'normal', label: 'Normal (Regular)', class: 'font-normal' },
                  { key: 'italic', label: 'Italique (Italic)', class: 'italic' },
                  { key: 'bolditalic', label: 'Gras Italique', class: 'font-bold italic' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => handleChange('formePolice', s.key as any)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      config.formePolice === s.key
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className={`text-xs ${s.class}`}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders de tailles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Taille Titre</span>
                  <span className="text-indigo-600 font-bold">{config.titreTaille} pt</span>
                </div>
                <input
                  type="range"
                  min="11"
                  max="20"
                  step="1"
                  value={config.titreTaille}
                  onChange={(e) => handleChange('titreTaille', parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Taille Sous-Titre</span>
                  <span className="text-indigo-600 font-bold">{config.sousTitreTaille} pt</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="14"
                  step="1"
                  value={config.sousTitreTaille}
                  onChange={(e) => handleChange('sousTitreTaille', parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Taille Mentions</span>
                  <span className="text-indigo-600 font-bold">{config.corpsTaille} pt</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="11"
                  step="1"
                  value={config.corpsTaille}
                  onChange={(e) => handleChange('corpsTaille', parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Switch Majuscules */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-slate-700">Mettre le titre principal en MAJUSCULES</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.majusculesTitre}
                  onChange={(e) => handleChange('majusculesTitre', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Card 3: Disposition & Thème de Couleurs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Palette className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                3. Alignement & Thème Visuel
              </h3>
            </div>

            {/* Alignement */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Alignement de l'En-tête</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'left', label: 'Gauche', icon: AlignLeft },
                  { key: 'center', label: 'Centré', icon: AlignCenter },
                  { key: 'between', label: 'Réparti', icon: AlignJustify },
                ].map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => handleChange('alignement', a.key as any)}
                      className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        config.alignement === a.key
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style de Séparateur */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Style de Séparateur Supérieur</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'bandeau', label: 'Bandeau Plein' },
                  { key: 'ligne_simple', label: 'Ligne Simple' },
                  { key: 'double_ligne', label: 'Double Ligne' },
                  { key: 'aucun', label: 'Sans Bordure' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => handleChange('styleSeparateur', s.key as any)}
                    className={`p-2 rounded-xl border text-center text-xs font-semibold transition-all cursor-pointer ${
                      config.styleSeparateur === s.key
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Palette de Couleurs */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Thème de Couleur</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'slate', label: 'Ardoise / Slate', color: '#1e293b' },
                  { key: 'rouge', label: 'Rouge SALFA', color: '#991b1b' },
                  { key: 'emeraude', label: 'Émeraude Santé', color: '#065f46' },
                  { key: 'indigo', label: 'Indigo Assurances', color: '#3730a3' },
                  { key: 'sombre', label: 'Noir Minimaliste', color: '#0f172a' },
                  { key: 'custom', label: 'Personnalisé...', color: config.couleurPrimaire },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => handleChange('themeCouleur', c.key as any)}
                    className={`flex items-center space-x-2 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      config.themeCouleur === c.key
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="truncate">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Color Pickers */}
            {config.themeCouleur === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Couleur Primaire</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={config.couleurPrimaire}
                      onChange={(e) => handleChange('couleurPrimaire', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                    />
                    <input
                      type="text"
                      value={config.couleurPrimaire}
                      onChange={(e) => handleChange('couleurPrimaire', e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Couleur Accent</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={config.couleurAccent}
                      onChange={(e) => handleChange('couleurAccent', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                    />
                    <input
                      type="text"
                      value={config.couleurAccent}
                      onChange={(e) => handleChange('couleurAccent', e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Live Preview (Simulating Portrait PDF Page) */}
        <div className="lg:col-span-6 sticky top-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Aperçu en Direct (Rendu Page PDF)
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Orientation Portrait (A4)
            </span>
          </div>

          {/* Paper Sheet Preview */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-lg p-6 min-h-[520px] relative overflow-hidden flex flex-col justify-between">
            {/* Header Section as configured */}
            <div className="space-y-4">
              {config.styleSeparateur === 'bandeau' ? (
                <div
                  className="w-full -mx-6 -mt-6 p-4 text-white flex items-center justify-between"
                  style={{
                    backgroundColor:
                      config.themeCouleur === 'rouge'
                        ? '#991b1b'
                        : config.themeCouleur === 'emeraude'
                        ? '#065f46'
                        : config.themeCouleur === 'indigo'
                        ? '#3730a3'
                        : config.themeCouleur === 'sombre'
                        ? '#0f172a'
                        : config.themeCouleur === 'custom'
                        ? config.couleurPrimaire
                        : '#1e293b',
                  }}
                >
                  <div
                    className={`${getFontFamilyStyle()} ${getFontWeightStyle()} ${getFontStyleItalic()}`}
                    style={{ fontSize: `${config.titreTaille}px` }}
                  >
                    {config.majusculesTitre ? config.etablissement.toUpperCase() : config.etablissement}
                  </div>
                  {config.afficherDateGeneration && (
                    <div className="text-[10px] opacity-85 font-sans">
                      Édité le : {new Date().toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`space-y-1 ${
                    config.alignement === 'center'
                      ? 'text-center'
                      : config.alignement === 'between'
                      ? 'text-left'
                      : 'text-left'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`${getFontFamilyStyle()} ${getFontWeightStyle()} ${getFontStyleItalic()} text-slate-900`}
                      style={{ fontSize: `${config.titreTaille * 1.15}px` }}
                    >
                      {config.majusculesTitre ? config.etablissement.toUpperCase() : config.etablissement}
                    </div>
                    {config.alignement === 'between' && config.afficherDateGeneration && (
                      <div className="text-[11px] text-slate-400 font-sans">
                        Édité le : {new Date().toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </div>

                  {config.sousTitre && (
                    <div
                      className={`${getFontFamilyStyle()} text-slate-600`}
                      style={{ fontSize: `${config.sousTitreTaille * 1.15}px` }}
                    >
                      {config.sousTitre}
                    </div>
                  )}

                  {config.departement && (
                    <div
                      className={`${getFontFamilyStyle()} text-slate-500 italic`}
                      style={{ fontSize: `${config.sousTitreTaille}px` }}
                    >
                      {config.departement}
                    </div>
                  )}

                  {/* Coordonnées & Mentions */}
                  <div
                    className={`${getFontFamilyStyle()} text-slate-400 pt-1 space-y-0.5`}
                    style={{ fontSize: `${config.corpsTaille * 1.1}px` }}
                  >
                    <div>{[config.adresse, config.villePays].filter(Boolean).join(' • ')}</div>
                    <div>
                      {[
                        config.telephone ? `Tél: ${config.telephone}` : '',
                        config.email ? `Email: ${config.email}` : '',
                        config.nifStat,
                      ]
                        .filter(Boolean)
                        .join(' | ')}
                    </div>
                  </div>

                  {/* Separators */}
                  {config.styleSeparateur === 'ligne_simple' && (
                    <div className="pt-2">
                      <div className="w-full h-0.5 bg-slate-800" />
                    </div>
                  )}

                  {config.styleSeparateur === 'double_ligne' && (
                    <div className="pt-2 space-y-0.5">
                      <div className="w-full h-0.5 bg-slate-900" />
                      <div className="w-full h-px bg-rose-600" />
                    </div>
                  )}
                </div>
              )}

              {/* Sample Document Content */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                  <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                    ÉTAT DE RECOUVREMENT & IMPAYÉS • MCI CARE
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Doc Réf : SALFA-REC-2026</span>
                </div>

                {/* Sample summary boxes */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-100">
                    <div className="text-[9px] font-bold text-rose-800">RESTE DÛ</div>
                    <div className="text-xs font-black text-rose-700">81 000 Ar</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="text-[9px] font-bold text-slate-600">BRUT</div>
                    <div className="text-xs font-bold text-slate-800">120 000 Ar</div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <div className="text-[9px] font-bold text-emerald-800">RÉGLÉ</div>
                    <div className="text-xs font-bold text-emerald-700">39 000 Ar</div>
                  </div>
                  <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                    <div className="text-[9px] font-bold text-indigo-800">DOSSIERS</div>
                    <div className="text-xs font-bold text-indigo-700">3 factures</div>
                  </div>
                </div>

                {/* Sample Table Mock */}
                <div className="border border-slate-200 rounded-lg overflow-hidden text-[10px]">
                  <div className="bg-slate-800 text-white font-bold grid grid-cols-12 p-1.5">
                    <div className="col-span-3">Date & Matricule</div>
                    <div className="col-span-4">Patient (Sous-Société)</div>
                    <div className="col-span-2 text-right">Brut</div>
                    <div className="col-span-3 text-right">Reste Dû</div>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    <div className="grid grid-cols-12 p-1.5 items-center">
                      <div className="col-span-3 font-medium text-slate-700">21/08/2026<br/><span className="text-slate-400 font-mono">(156237)</span></div>
                      <div className="col-span-4 font-semibold text-slate-900">RASOANIRINA Christinah<br/><span className="text-[9px] text-slate-500 font-normal">(CONSERVATION INTL)</span></div>
                      <div className="col-span-2 text-right text-slate-600 font-medium">81 000 Ar</div>
                      <div className="col-span-3 text-right font-black text-rose-700">81 000 Ar</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Mock */}
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10px] text-slate-400">
              <span>{config.textePiedDePage || 'Document Confidentiel de Recouvrement • SALFA'}</span>
              <span>Page 1 sur 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
