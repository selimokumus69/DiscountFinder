import { useEffect, useState } from 'react';
import {
  Package,
  TrendingDown,
  Globe,
  Tag,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DashboardStats, ScanLog } from '@/types/database';
import { StatCard } from '@/components/shared/StatCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentScans, setRecentScans] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setLoadError(null);

    const [
      productsRes,
      discountedRes,
      sourcesRes,
      brandsRes,
      todayScansRes,
      failedScansRes,
      scansRes,
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .not('discount_percentage', 'is', null)
        .gt('discount_percentage', 0)
        .eq('product_status', 'active'),
      supabase.from('sources').select('*', { count: 'exact', head: true }),
      supabase.from('brands').select('*', { count: 'exact', head: true }),
      supabase
        .from('scan_logs')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', new Date().toISOString().split('T')[0]),
      supabase
        .from('scan_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('started_at', new Date().toISOString().split('T')[0]),
      supabase
        .from('scan_logs')
        .select('*, source:sources(*)')
        .order('started_at', { ascending: false })
        .limit(10),
    ]);

    const hasError =
      productsRes.error || discountedRes.error || sourcesRes.error || scansRes.error;
    if (hasError) {
      setLoadError('Dashboard verileri yüklenirken bir hata oluştu.');
      setLoading(false);
      return;
    }

    setStats({
      total_products: productsRes.count ?? 0,
      active_discounted_products: discountedRes.count ?? 0,
      total_sources: sourcesRes.count ?? 0,
      total_brands: brandsRes.count ?? 0,
      today_scan_count: todayScansRes.count ?? 0,
      failed_scan_count: failedScansRes.count ?? 0,
    });
    setRecentScans((scansRes.data as ScanLog[]) ?? []);
    setLoading(false);
  }

  if (loading) {
    return <LoadingSpinner message="Dashboard yükleniyor..." />;
  }

  if (loadError) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadDashboard}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tekrar Dene
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sistem genel durumu ve son tarama işlemleri
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboard}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Yenile
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Toplam Ürün"
          value={stats?.total_products ?? 0}
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          label="İndirimli Ürün"
          value={stats?.active_discounted_products ?? 0}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label="Kayıtlı Site"
          value={stats?.total_sources ?? 0}
          icon={<Globe className="h-4 w-4" />}
        />
        <StatCard
          label="Marka"
          value={stats?.total_brands ?? 0}
          icon={<Tag className="h-4 w-4" />}
        />
        <StatCard
          label="Bugünkü Tarama"
          value={stats?.today_scan_count ?? 0}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Başarısız Tarama"
          value={stats?.failed_scan_count ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={stats && stats.failed_scan_count > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-neutral-500" />
              Son Tarama İşlemleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentScans.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-7 w-7" />}
                title="Henüz tarama işlemi yok"
                description="Bir site ekleyip tarama başlattığınızda sonuçlar burada görünecek."
              />
            ) : (
              <div className="space-y-2">
                {recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center gap-3 rounded-lg border border-neutral-100 p-3"
                  >
                    <div className="flex-shrink-0">
                      {scan.status === 'success' && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {scan.status === 'failed' && (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      {scan.status === 'running' && (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-400" />
                      )}
                      {scan.status === 'pending' && (
                        <Clock className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {scan.source?.name ?? 'Bilinmeyen kaynak'}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {formatDateTime(scan.started_at)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-4 text-xs text-neutral-500">
                      {scan.status === 'failed' ? (
                        <span className="text-red-500">Hata</span>
                      ) : (
                        <>
                          <span>{scan.products_found} ürün bulundu</span>
                          <span className="text-green-600">+{scan.products_added} yeni</span>
                          <span className="text-blue-600">~{scan.products_updated} güncellendi</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          <strong>Bilgi:</strong> Ürün tarama motoru henüz entegre edilmedi. Site ekleyip
          yapılandırabilirsiniz, ancak otomatik tarama bir sonraki aşamada aktif olacak.
        </p>
      </div>
    </div>
  );
}
