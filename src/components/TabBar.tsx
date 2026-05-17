import { useApp } from '../context/AppContext';

interface TabBarProps {
  activeTab: 'square' | 'messages' | 'profile';
  onTabChange: (tab: 'square' | 'messages' | 'profile') => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { unreadCount } = useApp();

  const tabs = [
    { id: 'square' as const, label: '世界广场', icon: '🌍' },
    { id: 'messages' as const, label: '消息', icon: '💬', badge: unreadCount },
    { id: 'profile' as const, label: '我', icon: '👤' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-50">
      <div className="max-w-lg mx-auto flex justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center py-2 px-4 rounded-xl transition-all ${
              activeTab === tab.id
                ? 'text-purple-600 bg-purple-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="relative">
              <span className="text-xl">{tab.icon}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </div>
            <span className="text-xs mt-1 font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}