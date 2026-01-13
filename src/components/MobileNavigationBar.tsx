// src/components/MobileNavigationBar.tsx
'use client'

import React from 'react'

interface MobileNavigationBarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

const MobileNavigationBar: React.FC<MobileNavigationBarProps> = ({ activeSection, setActiveSection }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'casa', label: 'Casa', icon: '🏠' },
    { id: 'loja', label: 'Loja', icon: '🏪' },
    { id: 'configuracoes', label: 'Ajustes', icon: '⚙️' }
  ];

  const getButtonClass = (id: string) => {
    return activeSection === id
      ? 'text-blue-600 scale-110'
      : 'text-gray-500';
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg md:hidden z-50">
      <div className="flex justify-around items-center h-16">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 ${getButtonClass(item.id)}`}
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MobileNavigationBar;
