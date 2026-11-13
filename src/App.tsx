import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminLogin } from '@/pages/admin/AdminLogin';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminSites } from '@/pages/admin/AdminSites';
import { AdminProducts } from '@/pages/admin/AdminProducts';
import { AdminBrands } from '@/pages/admin/AdminBrands';
import { AdminCategories } from '@/pages/admin/AdminCategories';
import { AdminScanLogs } from '@/pages/admin/AdminScanLogs';
import { AdminCampaigns } from '@/pages/admin/AdminCampaigns';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileHome } from '@/pages/mobile/MobileHome';
import { MobileExplore } from '@/pages/mobile/MobileExplore';
import { MobileFavorites } from '@/pages/mobile/MobileFavorites';
import { MobileProfile } from '@/pages/mobile/MobileProfile';
import { MobileProductDetail } from '@/pages/mobile/MobileProductDetail';
import { MobileCampaignDetail } from '@/pages/mobile/MobileCampaignDetail';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-300" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Admin routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="sites" element={<AdminSites />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="brands" element={<AdminBrands />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="campaigns" element={<AdminCampaigns />} />
        <Route path="scan-logs" element={<AdminScanLogs />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* Mobile app routes */}
      <Route path="/" element={<MobileLayout />}>
        <Route index element={<MobileHome />} />
        <Route path="explore" element={<MobileExplore />} />
        <Route path="favorites" element={<MobileFavorites />} />
        <Route path="profile" element={<MobileProfile />} />
      </Route>
      <Route path="/product/:id" element={<MobileProductDetail />} />
      <Route path="/campaign/:id" element={<MobileCampaignDetail />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}
