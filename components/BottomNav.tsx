import React from 'react';
import { ViewState } from '../types';
import { Camera, Ticket, Activity, Award, Settings } from 'lucide-react';

interface BottomNavProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate }) => {
  const navItems = [
    { view: ViewState.HOME, icon: Camera, label: 'Catch' },
    { view: ViewState.DEALS, icon: Ticket, label: 'Deals' },
    { view: ViewState.LIVE, icon: Activity, label: 'Live' },
    { view: ViewState.BADGES, icon: Award, label: 'Badges' },
    { view: ViewState.SETTINGS, icon: Settings, label: 'Settings' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 z-50"
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className="max-w-md mx-auto flex justify-around items-center py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors min-h-[44px] ${
                isActive ? 'text-red-600' : 'text-zinc-400'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
