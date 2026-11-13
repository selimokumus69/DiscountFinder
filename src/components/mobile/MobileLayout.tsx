import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, Heart, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', label: 'Ana Sayfa', icon: Home },
  { path: '/explore', label: 'Keşfet', icon: Compass },
  { path: '/favorites', label: 'Favoriler', icon: Heart },
  { path: '/profile', label: 'Profil', icon: User },
];

export function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-neutral-50">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md border-t border-neutral-200 bg-white/95 px-2 py-2 backdrop-blur-md">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive =
              tab.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 transition-colors',
                  isActive ? 'text-neutral-900' : 'text-neutral-400'
                )}
              >
                <tab.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
