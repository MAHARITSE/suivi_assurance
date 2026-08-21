import React from 'react';
import { ShieldCheck, Database } from 'lucide-react';
import { Societe } from '../types';

interface HeaderProps {
  societes?: Societe[];
  selectedSocieteId?: string;
  onSelectSociete?: (id: string) => void;
  onExportBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
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
              Suivi Assurance SALFA
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">Hôpitaly Loterana Toliary Tanambao</p>
          </div>
        </div>

        {onExportBackup && (
          <div className="flex items-center gap-2">
            <button
              id="btn-backup-export"
              onClick={onExportBackup}
              title="Télécharger le Dump SQL pour MySQL / WAMP Server"
              aria-label="Télécharger la sauvegarde SQL"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
            >
              <Database className="h-4 w-4 text-emerald-400" />
              <span>Sauvegarder (.SQL WAMP)</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};


