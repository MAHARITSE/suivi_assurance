import React, { useState } from 'react';
import { ShieldCheck, Database, RefreshCw, Server, HardDrive, ArrowLeftRight, ChevronDown } from 'lucide-react';
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
  storageMode?: 'server' | 'local';
  onToggleStorageMode?: (mode: 'server' | 'local') => void;
  onSyncLocalToServer?: () => void;
  onSyncServerToLocal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onExportBackup,
  onRefreshData,
  isRefreshing = false,
  lastSyncTime,
  dbConnected = true,
  logoUrl,
  storageMode = 'server',
  onToggleStorageMode,
  onSyncLocalToServer,
  onSyncServerToLocal,
}) => {
  const [showModeMenu, setShowModeMenu] = useState(false);

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
          {/* Storage Mode Selector (Serveur MySQL WAMP vs. LocalStorage) */}
          <div className="relative">
            <button
              onClick={() => setShowModeMenu(prev => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition cursor-pointer ${
                storageMode === 'server'
                  ? dbConnected
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100/70'
                    : 'bg-rose-50/70 border-rose-200 text-rose-900 hover:bg-rose-100/70'
                  : 'bg-blue-50/70 border-blue-200 text-blue-900 hover:bg-blue-100/70'
              }`}
              title="Cliquer pour changer de mode de stockage (Serveur MySQL / Mode Local)"
            >
              {storageMode === 'server' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    {dbConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${dbConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  </span>
                  <Server className="h-3.5 w-3.5 text-emerald-600" />
                  <span>MySQL Serveur WAMP</span>
                </>
              ) : (
                <>
                  <HardDrive className="h-3.5 w-3.5 text-blue-600" />
                  <span>Mode Local (LocalStorage)</span>
                </>
              )}
              <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
            </button>

            {showModeMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowModeMenu(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-40 text-xs animate-in fade-in zoom-in-95 duration-100 space-y-1">
                  <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Mode d'exécution & Stockage
                  </div>

                  <button
                    onClick={() => {
                      setShowModeMenu(false);
                      if (onToggleStorageMode) onToggleStorageMode('server');
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-start gap-2.5 transition cursor-pointer ${
                      storageMode === 'server' ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Server className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Serveur MySQL WAMP</span>
                        {storageMode === 'server' && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px]">Actif</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Base centrale MySQL multi-poste en réseau local via <code className="font-mono">api.php</code>
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowModeMenu(false);
                      if (onToggleStorageMode) onToggleStorageMode('local');
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-start gap-2.5 transition cursor-pointer ${
                      storageMode === 'local' ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <HardDrive className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Mode Local (LocalStorage)</span>
                        {storageMode === 'local' && (
                          <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px]">Actif</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Stockage autonome dans le navigateur sans dépendance serveur MySQL
                      </p>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 my-1 pt-1">
                    {onSyncLocalToServer && (
                      <button
                        onClick={() => {
                          setShowModeMenu(false);
                          onSyncLocalToServer();
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-slate-50 rounded-lg text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Transférer données Locales vers MySQL</span>
                      </button>
                    )}
                    {onSyncServerToLocal && (
                      <button
                        onClick={() => {
                          setShowModeMenu(false);
                          onSyncServerToLocal();
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-slate-50 rounded-lg text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Copier base MySQL vers le Local</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {storageMode === 'server' && lastSyncTime && (
            <span className="hidden xl:inline text-[11px] text-slate-500 px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
              Synchro {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}

          {storageMode === 'server' && onRefreshData && (
            <button
              id="btn-refresh-data"
              onClick={onRefreshData}
              disabled={isRefreshing}
              title="Synchroniser immédiatement avec la base MySQL centrale"
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



