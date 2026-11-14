import { useEffect, useState, type FormEvent } from 'react';
import {
  Package,
  ExternalLink,
  Pencil,
  Power,
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingDown,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Product, Brand, Category, ProductStatus, DealRating } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatPrice, formatDateShort } from '@/lib/format';
import { getDealRatingConfig } from '@/lib/deal-score';
import { cn } from '@/lib/utils';

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created' | 'deal'>('created');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // edit form
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editOriginalPrice, setEditOriginalPrice] = useState('');
  const [editStatus, setEditStatus] = useState<ProductStatus>('active');
  const [editBrandId, setEditBrandId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  useEffect(() => {
    loadFilters();
    loadProducts();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(loadProducts, 300);
    return () => clearTimeout(timeout);
  }, [search, brandFilter, statusFilter, sortBy]);

  async function loadFilters() {
    const [brandsRes, categoriesRes] = await Promise.all([
      supabase.from('brands').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setCategories((categoriesRes.data as Category[]) ?? []);
  }

  async function loadProducts() {
    setLoading(true);
    setLoadError(null);
    let query = supabase
      .from('products')
      .select('*, brand:brands(*), category:categories(*)')
      .limit(100);

    if (sortBy === 'deal') {
      query = query.order('deal_score', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    if (brandFilter !== 'all') query = query.eq('brand_id', brandFilter);
    if (statusFilter !== 'all') query = query.eq('product_status', statusFilter);
    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);

    const { data, error } = await query;
    if (error) {
      setLoadError('Ürünler yüklenirken bir hata oluştu.');
      setLoading(false);
      return;
    }
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  async function toggleStatus(product: Product) {
    setActionLoadingId(product.id);
    const newStatus: ProductStatus = product.product_status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('products')
      .update({ product_status: newStatus })
      .eq('id', product.id);
    if (error) {
      toast.error('Durum güncellenemedi', { description: error.message });
    } else {
      toast.success(newStatus === 'active' ? 'Ürün aktifleştirildi' : 'Ürün pasife alındı', {
        description: product.name,
      });
    }
    setActionLoadingId(null);
    loadProducts();
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setEditName(product.name);
    setEditPrice(String(product.current_price));
    setEditOriginalPrice(product.original_price ? String(product.original_price) : '');
    setEditStatus(product.product_status);
    setEditBrandId(product.brand_id ?? '');
    setEditCategoryId(product.category_id ?? '');
    setEditDialogOpen(true);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editName.trim()) {
      toast.error('Ürün adı boş olamaz.');
      return;
    }
    setSubmitting(true);

    const price = Number(editPrice);
    const originalPrice = editOriginalPrice ? Number(editOriginalPrice) : null;

    const payload: Record<string, unknown> = {
      name: editName.trim(),
      current_price: price,
      original_price: originalPrice,
      product_status: editStatus,
      brand_id: editBrandId || null,
      category_id: editCategoryId || null,
    };

    if (originalPrice && originalPrice > price) {
      payload.discount_percentage = Math.round(((originalPrice - price) / originalPrice) * 100 * 100) / 100;
    } else {
      payload.discount_percentage = null;
    }

    const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
    if (error) {
      toast.error('Güncelleme başarısız', { description: error.message });
      setSubmitting(false);
      return;
    }

    toast.success('Ürün güncellendi', { description: editName.trim() });
    setSubmitting(false);
    setEditDialogOpen(false);
    loadProducts();
  }

  if (loading) {
    return <LoadingSpinner message="Ürünler yükleniyor..." />;
  }

  if (loadError) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900">Ürünler</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadProducts}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tekrar Dene
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Ürünler</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Sistemdeki tüm ürünleri görüntüleyin ve yönetin
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Ürün ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Marka" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Markalar</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Pasif</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'created' | 'deal')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sıralama" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">En Yeni</SelectItem>
            <SelectItem value="deal">Fırsat Skoru</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {products.length === 0 ? (
          <EmptyState
            icon={<Package className="h-7 w-7" />}
            title="Ürün bulunamadı"
            description="Henüz ürün eklenmemiş veya filtrelere uygun ürün yok. Ürünler tarama motoru çalıştığında otomatik eklenecek."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>İndirim</TableHead>
                  <TableHead>Fırsat Skoru</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Eklenme</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="max-w-xs truncate text-sm font-medium text-neutral-900">
                            {product.name}
                          </p>
                          <a
                            href={product.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600"
                          >
                            Kaynak
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {product.brand?.name ?? '-'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-neutral-900">
                        {formatPrice(product.current_price)}
                      </div>
                      {product.original_price && (
                        <div className="text-xs text-neutral-400 line-through">
                          {formatPrice(product.original_price)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.discount_percentage && product.discount_percentage > 0 ? (
                        <Badge variant="destructive" className="font-medium">
                          %{Math.round(product.discount_percentage)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">
                          {product.deal_score}
                        </span>
                        <DealRatingBadge rating={product.deal_rating} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={product.product_status === 'active' ? 'default' : 'secondary'}
                        className="font-normal"
                      >
                        {product.product_status === 'active' ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-neutral-500">
                      {formatDateShort(product.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleStatus(product)}
                          disabled={actionLoadingId === product.id}
                          title={product.product_status === 'active' ? 'Pasife Al' : 'Aktifleştir'}
                        >
                          {actionLoadingId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(product)}
                          title="Düzenle"
                        >
                          <Pencil className="h-4 w-4" />
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ürün Düzenle</DialogTitle>
            <DialogDescription>
              Ürün bilgilerini güncelleyin. İndirim oranı otomatik hesaplanır.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Ürün Adı *</Label>
              <Input
                id="edit-name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-price">Güncel Fiyat (TL) *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-original">Eski Fiyat (TL)</Label>
                <Input
                  id="edit-original"
                  type="number"
                  step="0.01"
                  value={editOriginalPrice}
                  onChange={(e) => setEditOriginalPrice(e.target.value)}
                  placeholder="Opsiyonel"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marka</Label>
                <Select value={editBrandId} onValueChange={setEditBrandId}>
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
                <Select value={editCategoryId} onValueChange={setEditCategoryId}>
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
              <Label>Durum</Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as ProductStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editOriginalPrice && Number(editOriginalPrice) > Number(editPrice) && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                <TrendingDown className="h-4 w-4" />
                <span>
                  İndirim oranı: %
                  {Math.round(
                    ((Number(editOriginalPrice) - Number(editPrice)) / Number(editOriginalPrice)) * 100
                  )}
                </span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  'Güncelle'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DealRatingBadge({ rating }: { rating: DealRating }) {
  if (rating === 'unknown' || rating === 'bad') {
    return <span className="text-xs text-neutral-400">{rating === 'bad' ? 'Düşük' : 'Puansız'}</span>;
  }
  const config = getDealRatingConfig(rating);
  return (
    <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white', config.bgColor)}>
      {config.shortLabel}
    </span>
  );
}
