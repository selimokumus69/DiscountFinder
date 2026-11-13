import { useEffect, useState, type FormEvent } from 'react';
import { Tag, Plus, Pencil, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Brand } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useConfirmDialog } from '@/components/shared/ConfirmDialog';
import { slugify } from '@/lib/format';

export function AdminBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from('brands').select('*').order('name');
    if (error) {
      setLoadError('Markalar yüklenirken bir hata oluştu.');
      setLoading(false);
      return;
    }
    setBrands((data as Brand[]) ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setName('');
    setWebsiteUrl('');
    setLogoUrl('');
    setIsActive(true);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setName(brand.name);
    setWebsiteUrl(brand.website_url ?? '');
    setLogoUrl(brand.logo_url ?? '');
    setIsActive(brand.is_active);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Marka adı gerekli.');
      return;
    }
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      slug: slugify(name),
      website_url: websiteUrl.trim() || null,
      logo_url: logoUrl.trim() || null,
      is_active: isActive,
    };
    if (editing) {
      const { error } = await supabase.from('brands').update(payload).eq('id', editing.id);
      if (error) {
        setError('Güncelleme sırasında bir hata oluştu: ' + error.message);
        setSubmitting(false);
        return;
      }
      toast.success('Marka güncellendi', { description: name.trim() });
    } else {
      const { error } = await supabase.from('brands').insert(payload);
      if (error) {
        setError('Ekleme sırasında bir hata oluştu: ' + error.message);
        setSubmitting(false);
        return;
      }
      toast.success('Marka eklendi', { description: name.trim() });
    }
    setSubmitting(false);
    setDialogOpen(false);
    load();
  }

  async function handleToggle(brand: Brand) {
    setActionLoadingId(brand.id);
    const { error } = await supabase
      .from('brands')
      .update({ is_active: !brand.is_active })
      .eq('id', brand.id);
    if (error) {
      toast.error('Durum güncellenemedi', { description: error.message });
    } else {
      toast.success(brand.is_active ? 'Marka pasife alındı' : 'Marka aktifleştirildi', {
        description: brand.name,
      });
    }
    setActionLoadingId(null);
    load();
  }

  function handleDelete(brand: Brand) {
    confirm(
      {
        title: 'Markayı Sil',
        description: `"${brand.name}" markasını silmek istediğinize emin misiniz?`,
        confirmText: 'Sil',
        destructive: true,
      },
      async () => {
        const { error } = await supabase.from('brands').delete().eq('id', brand.id);
        if (error) {
          toast.error('Silme işlemi başarısız', { description: error.message });
          return;
        }
        toast.success('Marka silindi', { description: brand.name });
        load();
      }
    );
  }

  if (loading) return <LoadingSpinner message="Markalar yükleniyor..." />;

  if (loadError) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Markalar</h1>
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
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Markalar</h1>
          <p className="mt-1 text-sm text-neutral-500">Sistemdeki markaları yönetin</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Marka Ekle
        </Button>
      </div>

      <Card className="overflow-hidden">
        {brands.length === 0 ? (
          <EmptyState
            icon={<Tag className="h-7 w-7" />}
            title="Henüz marka eklenmemiş"
            description="Site eklerken marka atayabilmek için önce marka oluşturun."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marka Adı</TableHead>
                  <TableHead>Web Sitesi</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>
                      {brand.website_url ? (
                        <a
                          href={brand.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-neutral-500 hover:text-neutral-900"
                        >
                          {brand.website_url}
                        </a>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={brand.is_active}
                          disabled={actionLoadingId === brand.id}
                          onCheckedChange={() => handleToggle(brand)}
                        />
                        {actionLoadingId === brand.id && (
                          <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(brand)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(brand)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Marka Düzenle' : 'Yeni Marka'}</DialogTitle>
            <DialogDescription>Marka bilgilerini girin.</DialogDescription>
          </DialogHeader>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Marka Adı *</Label>
              <Input id="brand-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Koton" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-website">Web Sitesi</Label>
              <Input id="brand-website" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://www.koton.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-logo">Logo URL</Label>
              <Input id="brand-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="brand-active">Aktif</Label>
              <Switch id="brand-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Güncelle' : 'Ekle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
