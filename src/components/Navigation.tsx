import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  CreditCard, 
  FileSpreadsheet, 
  History, 
  Building, 
  Users, 
  Layers, 
  Printer
} from 'lucide-react';
import { ActiveTab } from '../types';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'prestations', label: 'Prestations', icon: FileText },
    { id: 'paiements', label: 'Saisie & Règlements', icon: CreditCard },
    { id: 'importation', label: 'Importation Excel', icon: FileSpreadsheet },
    { id: 'historique', label: 'Historique', icon: History },
    { id: 'societes', label: 'Sociétés', icon: Building },
    { id: 'personnes', label: 'Adhérents / Assurés', icon: Users },
    { id: 'familles', label: 'Familles & Barèmes', icon: Layers },
    { id: 'etats', label: 'États & Rapports', icon: Printer },
  ];

  return (
    <nav id="primary-navigation" className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
