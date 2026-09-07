import React from 'react';
import { ShieldCheck, Database, RefreshCw, Server } from 'lucide-react';
import { Societe } from '../types';

interface HeaderProps {
  societes?: Societe[];
  selectedSocieteId?: string;
  onSelectSociete?: (id: string) => void;
  onExportBackup?: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  lastSyncTime?: Date | null;
  dbConnected?: boolean;
  logoUrl?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onExportBackup,
  onRefreshData,
  isRefreshing = false,
  lastSyncTime,
  dbConnected = true,
  logoUrl,
}) => {
  return (
    <header
      id="main-header"
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo SALFA"
              className="h-9 w-9 shrink-0 rounded-xl object-contain bg-white p-0.5 border border-slate-200 shadow-xs"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight text-slate-950 sm:text-base">
              Suivi Assurance SALFA
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">Hôpitaly Loterana Toliary Tanambao</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Statut MySQL WAMP (Mode unique pour wamp_deploy) */}
          <div
            id="mysql-status-indicator"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs ${
              dbConnected
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/70 border-rose-200 text-rose-900'
            }`}
            title={dbConnected ? 'Connecté à la base MySQL WAMP' : 'Déconnecté de la base MySQL WAMP'}
          >
            <span className="relative flex h-2 w-2">
              {dbConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${dbConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <Server className="h-3.5 w-3.5 text-emerald-600" />
            <span>MySQL WAMP</span>
          </div>

          {lastSyncTime && (
            <span className="hidden xl:inline text-[11px] text-slate-500 px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
              Synchro {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}

          {onRefreshData && (
            <button
              id="btn-refresh-data"
              onClick={onRefreshData}
              disabled={isRefreshing}
              title="Synchroniser immédiatement avec la base"
              aria-label="Actualiser les données"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          )}

          {onExportBackup && (
            <button
              id="btn-backup-export"
              onClick={onExportBackup}
              title="Télécharger le Dump SQL pour MySQL / WAMP Server"
              aria-label="Télécharger la sauvegarde SQL"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-95 cursor-pointer"
            >
              <Database className="h-4 w-4 text-emerald-400" />
              <span className="hidden sm:inline">Sauvegarder (.SQL)</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
