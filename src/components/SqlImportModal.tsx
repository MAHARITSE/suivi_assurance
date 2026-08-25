import React, { useState, useRef } from 'react';
import { Database, Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, X, ArrowRight, HardDrive, Server } from 'lucide-react';
import { parseMySQLDump, SqlImportResult } from '../utils/sqlImporter';
import { Societe, Personne, Famille, Prestation, Paiement } from '../types';

interface SqlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyData: (data: {
    societes: Societe[];
    personnes: Personne[];
    familles: Famille[];
    prestations: Prestation[];
    paiements: Paiement[];
  }, mode: 'merge' | 'replace') => Promise<void>;
  storageMode?: 'server' | 'local';
}

export const SqlImportModal: React.FC<SqlImportModalProps> = ({
  isOpen,
  onClose,
  onApplyData,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [sqlContent, setSqlContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<SqlImportResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('replace');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setErrorMsg('');
    setParseResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setSqlContent(text || '');
      // Auto analyse du dump SQL
      const res = parseMySQLDump(text || '');
      if (res.success) {
        setParseResult(res);
      } else {
        setErrorMsg(res.error || "Impossible d'analyser ce fichier SQL.");
      }
    };
    reader.onerror = () => {
      setErrorMsg('Erreur lors de la lecture du fichier.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyzeText = () => {
    setErrorMsg('');
    setParseResult(null);
    if (!sqlContent.trim()) {
      setErrorMsg('Veuillez coller le script SQL à analyser.');
      return;
    }
    const res = parseMySQLDump(sqlContent);
    if (res.success) {
      setParseResult(res);
    } else {
      setErrorMsg(res.error || "Impossible d'analyser le script SQL.");
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !parseResult.success) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      await onApplyData(parseResult.data, importMode);
      onClose();
    } catch (err: any) {
      console.error('Erreur application SQL:', err);
      setErrorMsg(err.message || "Erreur lors de l'application des données.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Restauration / Import de sauvegarde SQL
              </h2>
              <p className="text-xs text-slate-500">
                Restaurer des prestations, règlements et adhérents depuis un dump MySQL / WAMP Server
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Onglets choix méthode */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => { setActiveTab('file'); setErrorMsg(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeTab === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Fichier .SQL (Upload / Glisser-déposer)</span>
            </button>
            <button
              onClick={() => { setActiveTab('paste'); setErrorMsg(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeTab === 'paste' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Coller du texte SQL</span>
            </button>
          </div>

          {/* Zone fichier */}
          {activeTab === 'file' && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 transition rounded-2xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".sql,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {fileName ? fileName : 'Cliquez pour sélectionner ou glissez votre fichier .SQL ici'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Compatible avec les exports WAMP Server, phpMyAdmin, MySQL 5.7+ / 8.0+
                </p>
              </div>
            </div>
          )}

          {/* Zone texte */}
          {activeTab === 'paste' && (
            <div className="space-y-2">
              <textarea
                value={sqlContent}
                onChange={(e) => {
                  setSqlContent(e.target.value);
                  setParseResult(null);
                  setErrorMsg('');
                }}
                rows={6}
                placeholder="Collez ici les requêtes INSERT INTO `prestations`, `paiements`, `personnes`..."
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAnalyzeText}
                className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer"
              >
                Analyser le script SQL
              </button>
            </div>
          )}

          {/* Message d'erreur éventuel */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Aperçu du résultat d'analyse */}
          {parseResult && parseResult.success && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Sauvegarde SQL analysée avec succès !</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-slate-400 text-[11px]">Prestations</div>
                  <div className="text-base font-bold text-slate-900">{parseResult.counts.prestations}</div>
                  <div className="text-[10px] text-slate-500">{parseResult.counts.lignesPrestation} actes</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-slate-400 text-[11px]">Règlements</div>
                  <div className="text-base font-bold text-slate-900">{parseResult.counts.paiements}</div>
                  <div className="text-[10px] text-slate-500">{parseResult.counts.lignesPaiement} actes</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-slate-400 text-[11px]">Adhérents</div>
                  <div className="text-base font-bold text-slate-900">{parseResult.counts.personnes}</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-slate-400 text-[11px]">Sociétés</div>
                  <div className="text-base font-bold text-slate-900">{parseResult.counts.societes}</div>
                </div>
              </div>

              {/* Mode d'import */}
              <div className="pt-2 border-t border-emerald-100 space-y-2">
                <div className="text-xs font-semibold text-slate-700">Mode de restauration :</div>
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-indigo-600"
                    />
                    <span className="text-slate-800 font-medium">Remplacer la base existante</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-indigo-600"
                    />
                    <span className="text-slate-800 font-medium">Fusionner avec les données existantes</span>
                  </label>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1">
                <Server className="w-3.5 h-3.5 text-emerald-600" />
                <span>Les données seront directement injectées et synchronisées dans la base centrale MySQL WAMP.</span>
              </div>
            </div>
          )}
        </div>

        {/* Pied de modal */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!parseResult || !parseResult.success || isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-xs transition cursor-pointer"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Restauration en cours...</span>
              </>
            ) : (
              <>
                <span>Appliquer et Charger les Données</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
