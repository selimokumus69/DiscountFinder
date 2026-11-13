import { useEffect, useState } from 'react';
import { History, CheckCircle2, XCircle, Clock, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ScrapingJob } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDateTime } from '@/lib/format';

export function AdminScanLogs() {
  const [logs, setLogs] = useState<ScrapingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('scraping_jobs')
      .select('*, source:sources(*)')
      .order('started_at', { ascending: false })
      .limit(50);
    if (error) {
      setLoadError('Tarama geçmişi yüklenirken bir hata oluştu.');
      setLoading(false);
      return;
    }
    setLogs((data as ScrapingJob[]) ?? []);
    setLoading(false);
  }

  if (loading) return <LoadingSpinner message="Tarama geçmişi yükleniyor..." />;

  if (loadError) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Tarama Geçmişi</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <Button variant="outline" size="sm" onClick={load}>
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
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Tarama Geçmişi</h1>
          <p className="mt-1 text-sm text-neutral-500">Son tarama işlemleri ve sonuçları</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Yenile
        </Button>
      </div>

      <Card className="overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState
            icon={<History className="h-7 w-7" />}
            title="Tarama kaydı bulunamadı"
            description="Tarama motoru çalıştığında işlem geçmişi burada listelenecek."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Bulunan</TableHead>
                  <TableHead>Yeni</TableHead>
                  <TableHead>Güncellenen</TableHead>
                  <TableHead>Başlangıç</TableHead>
                  <TableHead>Bitiş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {log.source?.name ?? 'Silinmiş kaynak'}
                    </TableCell>
                    <TableCell>
                      {log.status === 'success' && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Başarılı
                        </Badge>
                      )}
                      {log.status === 'failed' && (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" /> Başarısız
                        </Badge>
                      )}
                      {log.status === 'running' && (
                        <Badge variant="secondary">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Çalışıyor
                        </Badge>
                      )}
                      {log.status === 'pending' && (
                        <Badge variant="secondary">
                          <Clock className="mr-1 h-3 w-3" /> Beklemede
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{log.products_found}</TableCell>
                    <TableCell className="text-green-600">{log.products_added}</TableCell>
                    <TableCell className="text-blue-600">{log.products_updated}</TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      {formatDateTime(log.started_at)}
                    </TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      {formatDateTime(log.completed_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {logs.some((l) => l.error_message) && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-neutral-700">Hata Detayları</h3>
          <div className="space-y-2">
            {logs
              .filter((l) => l.error_message)
              .slice(0, 5)
              .map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"
                >
                  <span className="font-medium">{log.source?.name ?? 'Bilinmeyen'}:</span>{' '}
                  {log.error_message}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
