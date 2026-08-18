import React from 'react';
import { Shield, Building2, UserCheck, Receipt, Download } from 'lucide-react';
import { Societe } from '../types';
import { formatMoney } from '../utils/formatters';

interface HeaderProps {
  societes: Societe[];
  selectedSocieteId: string;
  onSelectSociete: (id: string) => void;
  totalPrestationsCount: number;
  totalMontantPaye: number;
  onExportBackup: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  societes,
  selectedSocieteId,
  onSelectSociete,
  totalPrestationsCount,
  totalMontantPaye,
  onExportBackup,
}) => {
  return (
    <header id="main-header" className="bg-slate-900 text-white border-b border-slate-800 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-inner text-white">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white">SUIVI ASSURANCE</h1>
                <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2 py-0.5 rounded border border-indigo-500/30">
                  v2.0 Web Edition
                </span>
              </div>
              <p className="text-xs text-slate-400">Gestion des Prestations, Règlements & Rapprochements</p>
            </div>
          </div>

          {/* Center Quick Stats */}
          <div className="hidden md:flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400 text-xs">Total Règlements:</span>
              <span className="font-semibold text-emerald-400">{formatMoney(totalMontantPaye)}</span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <UserCheck className="w-4 h-4 text-sky-400" />
              <span className="text-slate-400 text-xs">Prestations:</span>
              <span className="font-semibold text-sky-400">{totalPrestationsCount}</span>
            </div>
          </div>

          {/* Right Controls: Company filter & Data actions */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <select
                id="header-societe-selector"
                value={selectedSocieteId}
                onChange={(e) => onSelectSociete(e.target.value)}
                className="bg-transparent text-xs sm:text-sm text-slate-200 focus:outline-none border-none cursor-pointer pr-2"
              >
                <option value="ALL" className="bg-slate-900 text-white">Toutes les Sociétés</option>
                {societes.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.nom} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              id="btn-backup-export"
              onClick={onExportBackup}
              title="Exporter les données (JSON de sauvegarde)"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
