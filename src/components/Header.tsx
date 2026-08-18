import React from 'react';
import { ShieldCheck, Building2, Download } from 'lucide-react';
import { Societe } from '../types';

interface HeaderProps {
  societes: Societe[];
  selectedSocieteId: string;
  onSelectSociete: (id: string) => void;
  onExportBackup: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  societes,
  selectedSocieteId,
  onSelectSociete,
  onExportBackup,
}) => {
  return (
    <header
      id="main-header"
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight text-slate-950 sm:text-base">
              Suivi Assurance
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">Gestion des prestations santé</p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <label
            htmlFor="header-societe-selector"
            className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-slate-600 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100"
          >
            <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="hidden text-xs font-medium lg:inline">Périmètre</span>
            <select
              id="header-societe-selector"
              aria-label="Filtrer par société"
              value={selectedSocieteId}
              onChange={(e) => onSelectSociete(e.target.value)}
              className="max-w-40 min-w-0 cursor-pointer border-0 bg-transparent text-xs font-semibold text-slate-800 outline-none sm:max-w-56"
            >
              <option value="ALL">Toutes les sociétés</option>
              {societes.map((societe) => (
                <option key={societe.id} value={societe.id}>
                  {societe.nom} ({societe.code})
                </option>
              ))}
            </select>
          </label>

          <button
            id="btn-backup-export"
            onClick={onExportBackup}
            title="Télécharger une sauvegarde des données"
            aria-label="Télécharger une sauvegarde"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            <span className="hidden xl:inline">Sauvegarder</span>
          </button>
        </div>
      </div>
    </header>
  );
};
