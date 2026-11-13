import { useEffect, useState, type FormEvent } from 'react';
import { FolderTree, Plus, Pencil, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types/database';
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
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useConfirmDialog } from '@/components/shared/ConfirmDialog';
import { slugify } from '@/lib/format';

export function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
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
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) {
      setLoadError('Kategoriler yüklenirken bir hata oluştu.');
      setLoading(false);
      return;
    }
    setCategories((data as Category[]) ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setName('');
    setParentId('');
    setImageUrl('');
    setIsActive(true);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setName(cat.name);
    setParentId(cat.parent_id ?? '');
    setImageUrl(cat.image_url ?? '');
    setIsActive(cat.is_active);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Kategori adı gerekli.');
      return;
    }
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      slug: slugify(name),
      parent_id: parentId || null,
      image_url: imageUrl.trim() || null,
      is_active: isActive,
    };
    if (editing) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editing.id);
      if (error) {
        setError('Güncelleme sırasında bir hata oluştu: ' + error.message);
        setSubmitting(false);
        return;
      }
      toast.success('Kategori güncellendi', { description: name.trim() });
    } else {
      const { error } = await supabase.from('categories').insert(payload);
      if (error) {
        setError('Ekleme sırasında bir hata oluştu: ' + error.message);
        setSubmitting(false);
        return;
      }
      toast.success('Kategori eklendi', { description: name.trim() });
    }
    setSubmitting(false);
    setDialogOpen(false);
    load();
  }

  async function handleToggle(cat: Category) {
    setActionLoadingId(cat.id);
    const { error } = await supabase
      .from('categories')
      .update({ is_active: !cat.is_active })
      .eq('id', cat.id);
    if (error) {
      toast.error('Durum güncellenemedi', { description: error.message });
    } else {
      toast.success(cat.is_active ? 'Kategori pasife alındı' : 'Kategori aktifleştirildi', {
        description: cat.name,
      });
    }
    setActionLoadingId(null);
    load();
  }

  function handleDelete(cat: Category) {
    confirm(
      {
        title: 'Kategoriyi Sil',
        description: `"${cat.name}" kategorisini silmek istediğinize emin misiniz?`,
        confirmText: 'Sil',
        destructive: true,
      },
      async () => {
        const { error } = await supabase.from('categories').delete().eq('id', cat.id);
        if (error) {
          toast.error('Silme işlemi başarısız', { description: error.message });
          return;
        }
        toast.success('Kategori silindi', { description: cat.name });
        load();
      }
    );
  }

  if (loading) return <LoadingSpinner message="Kategoriler yükleniyor..." />;

  if (loadError) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Kategoriler</h1>
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
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Kategoriler</h1>
          <p className="mt-1 text-sm text-neutral-500">Ürün kategorilerini yönetin</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Kategori Ekle
        </Button>
      </div>

      <Card className="overflow-hidden">
        {categories.length === 0 ? (
          <EmptyState
            icon={<FolderTree className="h-7 w-7" />}
            title="Henüz kategori eklenmemiş"
            description="Site eklerken kategori atayabilmek için önce kategori oluşturun."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori Adı</TableHead>
                  <TableHead>Üst Kategori</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      {cat.parent_id
                        ? categories.find((c) => c.id === cat.parent_id)?.name ?? '-'
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={cat.is_active}
                          disabled={actionLoadingId === cat.id}
                          onCheckedChange={() => handleToggle(cat)}
                        />
                        {actionLoadingId === cat.id && (
                          <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(cat)}>
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
            <DialogTitle>{editing ? 'Kategori Düzenle' : 'Yeni Kategori'}</DialogTitle>
            <DialogDescription>Kategori bilgilerini girin.</DialogDescription>
          </DialogHeader>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Kategori Adı *</Label>
              <Input id="cat-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Kadın Dış Giyim" />
            </div>
            <div className="space-y-2">
              <Label>Üst Kategori</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Üst kategori yok" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-image">Görsel URL</Label>
              <Input id="cat-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="cat-active">Aktif</Label>
              <Switch id="cat-active" checked={isActive} onCheckedChange={setIsActive} />
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
