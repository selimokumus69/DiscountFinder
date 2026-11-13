import { useEffect, useState, type FormEvent } from 'react';
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Source, Brand, Category, ScrapingJob, ScrapingMethod } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatDateShort } from '@/lib/format';

const SCRAPING_METHODS: { value: ScrapingMethod; label: string }[] = [
  { value: 'html', label: 'HTML Analizi' },
  { value: 'api', label: 'API / Ürün Akışı' },
  { value: 'playwright', label: 'Playwright (Tarayıcı)' },
  { value: 'rss', label: 'RSS / XML Feed' },
];

const SCAN_INTERVALS = [
  { value: 1, label: '1 saat' },
  { value: 6, label: '6 saat' },
  { value: 12, label: '12 saat' },
  { value: 24, label: '24 saat' },
  { value: 48, label: '48 saat' },
];

export function AdminSites() {
  const [sources, setSources] = useState<Source[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [latestJobs, setLatestJobs] = useState<Record<string, ScrapingJob>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [scrapingMethod, setScrapingMethod] = useState<ScrapingMethod>('html');
  const [scanInterval, setScanInterval] = useState(12);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    const [sourcesRes, brandsRes, categoriesRes, jobsRes] = await Promise.all([
      supabase.from('sources').select('*, brand:brands(*), category:categories(*)').order('created_at', { ascending: false }),
      supabase.from('brands').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('scraping_jobs').select('*').order('started_at', { ascending: false }).limit(100),
    ]);

    if (sourcesRes.error || jobsRes.error) {
      setLoadError('Siteler ve tarama durumları yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
      setLoading(false);
      return;
    }

    setSources((sourcesRes.data as Source[]) ?? []);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setCategories((categoriesRes.data as Category[]) ?? []);
    const jobsBySource: Record<string, ScrapingJob> = {};
    for (const job of (jobsRes.data as ScrapingJob[]) ?? []) {
      if (job.source_id && !jobsBySource[job.source_id]) jobsBySource[job.source_id] = job;
    }
    setLatestJobs(jobsBySource);
    setLoading(false);
  }

  function openAdd() {
    setEditingSource(null);
    setName('');
    setBrandId('');
    setCategoryId('');
    setSourceUrl('');
    setScrapingMethod('html');
    setScanInterval(12);
    setIsActive(true);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(source: Source) {
    setEditingSource(source);
    setName(source.name);
    setBrandId(source.brand_id ?? '');
    setCategoryId(source.category_id ?? '');
    setSourceUrl(source.source_url);
    setScrapingMethod(source.scraping_method);
    setScanInterval(source.scan_interval_hours);
    setIsActive(source.is_active);
    setFormError(null);
    setDialogOpen(true);
  }

  function validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Site adı gerekli.');
      return;
    }
    if (!sourceUrl.trim()) {
      setFormError('Kategori URL\'si gerekli.');
      return;
    }
    if (!validateUrl(sourceUrl)) {
      setFormError('Geçerli bir URL giriniz (https:// ile başlamalı).');
      return;
    }

    setSubmitting(true);

    const payload = {
      name: name.trim(),
      brand_id: brandId || null,
      category_id: categoryId || null,
      source_url: sourceUrl.trim(),
      scraping_method: scrapingMethod,
      scan_interval_hours: scanInterval,
      is_active: isActive,
    };

    if (editingSource) {
      const { error } = await supabase.from('sources').update(payload).eq('id', editingSource.id);
      if (error) {
        setFormError('Güncelleme sırasında bir hata oluştu: ' + error.message);
        setSubmitting(false);
        return;
      }
      toast.success('Site güncellendi', { description: `"${name}" başarıyla güncellendi.` });
    } else {
      const { error } = await supabase.from('sources').insert(payload);
      if (error) {
        setFormError(error.code === '23505'
          ? 'Bu kaynak URL adresi zaten kayıtlı.'
          : 'Kayıt sırasında bir hata oluştu.');
        setSubmitting(false);
        return;
      }
      toast.success('Site eklendi', { description: `"${name}" başarıyla eklendi.` });
    }

    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  }

  async function handleToggle(source: Source) {
    setActionLoadingId(source.id);
    const { error } = await supabase
      .from('sources')
      .update({ is_active: !source.is_active })
      .eq('id', source.id);
    if (error) {
      toast.error('Durum güncellenemedi', { description: 'Kaynak durumu değiştirilemedi. Lütfen tekrar deneyin.' });
    } else {
      toast.success(source.is_active ? 'Site pasife alındı' : 'Site aktifleştirildi', {
        description: `"${source.name}"`,
      });
    }
    setActionLoadingId(null);
    loadData();
  }

  function handleDelete(source: Source) {
    confirm(
      {
        title: 'Siteyi Sil',
        description: `"${source.name}" kaynağını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
        confirmText: 'Sil',
        destructive: true,
      },
      async () => {
        const { error } = await supabase.from('sources').delete().eq('id', source.id);
        if (error) {
          toast.error('Silme işlemi başarısız', { description: 'Kaynak silinemedi. Lütfen tekrar deneyin.' });
          return;
        }
        toast.success('Site silindi', { description: `"${source.name}" silindi.` });
        loadData();
      }
    );
  }

  async function handleManualScan(source: Source) {
    setActionLoadingId(source.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-koton`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            source_id: source.id,
            source_url: source.source_url,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result.error || result.message || 'Bilinmeyen hata';
        if (result.products_found === 0 && result.success) {
          toast.info('Tarama tamamlandı — ürün bulunamadı', {
            description: result.message || 'Sayfa yapısı değişmiş veya bot koruması aktif olabilir.',
          });
        } else {
          toast.error('Tarama başarısız', { description: errorMsg });
        }
      } else {
        toast.success('Tarama tamamlandı', {
          description: `${result.pages_scanned ?? 1} sayfa, ${result.products_found} ürün bulundu, ${result.products_added} yeni, ${result.products_updated} güncellendi${result.duplicates_skipped ? `, ${result.duplicates_skipped} tekrarlanan atlandı` : ''}${result.campaigns_found ? `, ${result.campaigns_found} kampanya (${result.campaigns_added} yeni)` : ''}.`,
        });
      }

      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ağ hatası';
      toast.error('Tarama başlatılamadı', { description: msg });
    }

    setActionLoadingId(null);
  }

  if (loading) {
    return <LoadingSpinner message="Siteler yükleniyor..." />;
  }

  if (loadError) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Siteler</h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadData}>
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
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Siteler</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Tarama kaynaklarını yönetin — e-ticaret siteleri ve kategori bağlantıları
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Site Ekle
        </Button>
      </div>

      <Card className="overflow-hidden">
        {sources.length === 0 ? (
          <EmptyState
            icon={<Globe className="h-7 w-7" />}
            title="Henüz kaynak site eklenmemiş"
            description="İlk tarama kaynağınızı eklemek için 'Site Ekle' butonuna tıklayın."
            action={
              <Button onClick={openAdd} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Site Ekle
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site Adı</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tarama Yöntemi</TableHead>
                  <TableHead>Sıklık</TableHead>
                  <TableHead>Son Tarama</TableHead>
                  <TableHead>Tarama Sonucu</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div className="font-medium text-neutral-900">{source.name}</div>
                      <a
                        href={source.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600"
                      >
                        {source.source_url.length > 40
                          ? source.source_url.slice(0, 40) + '...'
                          : source.source_url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      {source.brand ? (
                        <span className="text-sm">{source.brand.name}</span>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {source.category ? (
                        <span className="text-sm">{source.category.name}</span>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {SCRAPING_METHODS.find((m) => m.value === source.scraping_method)?.label ?? source.scraping_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      {source.scan_interval_hours} saat
                    </TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      {formatDateShort(source.last_scanned_at)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const job = latestJobs[source.id];
                        if (!job) return <span className="text-sm text-neutral-400">Henüz taranmadı</span>;
                        if (job.status === 'running') return <Badge variant="secondary">Çalışıyor</Badge>;
                        if (job.status === 'failed') return <Badge variant="destructive" title={job.error_message ?? undefined}>Hata</Badge>;
                        return <span className="text-sm text-neutral-600" title={job.error_message ?? undefined}>{job.products_found} ürün</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={source.is_active}
                          disabled={actionLoadingId === source.id}
                          onCheckedChange={() => handleToggle(source)}
                        />
                        {actionLoadingId === source.id && (
                          <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleManualScan(source)}
                          disabled={actionLoadingId === source.id}
                          title="Manuel tarama"
                        >
                          {actionLoadingId === source.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(source)}
                          title="Düzenle"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(source)}
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSource ? 'Site Düzenle' : 'Yeni Site Ekle'}
            </DialogTitle>
            <DialogDescription>
              Tarama yapılacak e-ticaret sitesi veya kategori bağlantısını yapılandırın.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Site Adı *</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Koton"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marka</Label>
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Kategori URL'si *</Label>
              <Input
                id="url"
                required
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.koton.com/kadin-dis-giyim/"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tarama Yöntemi</Label>
                <Select
                  value={scrapingMethod}
                  onValueChange={(v) => setScrapingMethod(v as ScrapingMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCRAPING_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tarama Sıklığı</Label>
                <Select
                  value={String(scanInterval)}
                  onValueChange={(v) => setScanInterval(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCAN_INTERVALS.map((s) => (
                      <SelectItem key={s.value} value={String(s.value)}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="active">Aktif</Label>
                <p className="text-xs text-neutral-400">Pasif kaynaklar otomatik taranmaz.</p>
              </div>
              <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : editingSource ? (
                  'Güncelle'
                ) : (
                  'Siteyi Kaydet'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
