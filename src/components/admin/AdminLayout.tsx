import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Globe,
  Package,
  Tag,
  FolderTree,
  History,
  Megaphone,
  Settings,
  LogOut,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/sites', label: 'Siteler', icon: Globe },
  { to: '/admin/products', label: 'Ürünler', icon: Package },
  { to: '/admin/brands', label: 'Markalar', icon: Tag },
  { to: '/admin/categories', label: 'Kategoriler', icon: FolderTree },
  { to: '/admin/campaigns', label: 'Kampanyalar', icon: Megaphone },
  { to: '/admin/scan-logs', label: 'Tarama Geçmişi', icon: History },
  { to: '/admin/settings', label: 'Ayarlar', icon: Settings },
];

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/admin/login');
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-neutral-200 px-6">
          <ShoppingBag className="h-5 w-5 text-neutral-900" />
          <span className="font-semibold tracking-tight text-neutral-900">İndirimGO</span>
          <span className="ml-auto rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
            Yönetim
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-neutral-200 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-sm font-medium text-white">
              {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900">
                {profile?.display_name ?? 'Admin'}
              </p>
              <p className="truncate text-xs text-neutral-400">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-neutral-200 bg-white px-4 md:hidden">
          <ShoppingBag className="h-5 w-5 text-neutral-900" />
          <span className="font-semibold tracking-tight text-neutral-900">İndirimGO</span>
          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Yönetim</span>
          <button onClick={handleSignOut} className="ml-auto text-neutral-500">
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-2 py-2 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                )
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
