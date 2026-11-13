import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, Loader2, Package, Megaphone, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, Brand, Category, Campaign } from '@/types/database';
import { ProductCard } from '@/components/mobile/ProductCard';
import { useFavorites } from '@/hooks/use-favorites';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { Tag, Truck, Percent } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SORT_OPTIONS = [
  { value: 'discount', label: 'En Yüksek İndirim' },
  { value: 'price_low', label: 'En Düşük Fiyat' },
  { value: 'price_high', label: 'En Yüksek Fiyat' },
  { value: 'newest', label: 'En Yeni' },
];

const PAGE_SIZE = 20;

export function MobileExplore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [sheetOpen, setSheetOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [brandFilter, setBrandFilter] = useState(searchParams.get('brand') ?? 'all');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? 'all');
  const [minDiscount, setMinDiscount] = useState('0');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') ?? 'discount');
  const [discountTypeFilter, setDiscountTypeFilter] = useState(searchParams.get('type') ?? 'all');

  useEffect(() => {
    loadFilters();
  }, []);

  const loadProducts = useCallback(async () => {
    if (discountTypeFilter === 'campaigns') {
      setLoading(true);
      setHasMore(false);
      let campQuery = supabase
        .from('campaigns')
        .select('*, brand:brands(*)')
        .eq('is_active', true);
      if (brandFilter !== 'all') campQuery = campQuery.eq('brand_id', brandFilter);
      campQuery = campQuery.order('created_at', { ascending: false });
      const { data: campData } = await campQuery;
      setCampaigns((campData as Campaign[]) ?? []);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasMore(true);
    let query = supabase
      .from('products')
      .select('*, brand:brands(*), category:categories(*)')
      .eq('product_status', 'active');

    if (discountTypeFilter === 'product_discounts') {
      query = query.not('discount_percentage', 'is', null).gt('discount_percentage', 0);
    }

    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
    if (brandFilter !== 'all') query = query.eq('brand_id', brandFilter);
    if (categoryFilter !== 'all') query = query.eq('category_id', categoryFilter);
    if (Number(minDiscount) > 0) query = query.gte('discount_percentage', Number(minDiscount));
    if (minPrice) query = query.gte('current_price', Number(minPrice));
    if (maxPrice) query = query.lte('current_price', Number(maxPrice));

    switch (sortBy) {
      case 'price_low': query = query.order('current_price', { ascending: true }); break;
      case 'price_high': query = query.order('current_price', { ascending: false }); break;
      case 'newest': query = query.order('created_at', { ascending: false }); break;
      default: query = query.order('discount_percentage', { ascending: false, nullsFirst: false });
    }

    query = query.range(0, PAGE_SIZE - 1);
    const { data } = await query;
    const result = (data as Product[]) ?? [];
    setProducts(result);
    setHasMore(result.length === PAGE_SIZE);
    setLoading(false);
  }, [discountTypeFilter, search, brandFilter, categoryFilter, minDiscount, minPrice, maxPrice, sortBy]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading || discountTypeFilter === 'campaigns') return;
    setLoadingMore(true);
    let query = supabase
      .from('products')
      .select('*, brand:brands(*), category:categories(*)')
      .eq('product_status', 'active');

    if (discountTypeFilter === 'product_discounts') {
      query = query.not('discount_percentage', 'is', null).gt('discount_percentage', 0);
    }
    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
    if (brandFilter !== 'all') query = query.eq('brand_id', brandFilter);
    if (categoryFilter !== 'all') query = query.eq('category_id', categoryFilter);
    if (Number(minDiscount) > 0) query = query.gte('discount_percentage', Number(minDiscount));
    if (minPrice) query = query.gte('current_price', Number(minPrice));
    if (maxPrice) query = query.lte('current_price', Number(maxPrice));

    switch (sortBy) {
      case 'price_low': query = query.order('current_price', { ascending: true }); break;
      case 'price_high': query = query.order('current_price', { ascending: false }); break;
      case 'newest': query = query.order('created_at', { ascending: false }); break;
      default: query = query.order('discount_percentage', { ascending: false, nullsFirst: false });
    }

    query = query.range(products.length, products.length + PAGE_SIZE - 1);
    const { data } = await query;
    const result = (data as Product[]) ?? [];
    setProducts((prev) => [...prev, ...result]);
    setHasMore(result.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [discountTypeFilter, search, brandFilter, categoryFilter, minDiscount, minPrice, maxPrice, sortBy, products.length, loadingMore, hasMore, loading]);

  useEffect(() => {
    const timeout = setTimeout(loadProducts, 300);
    return () => clearTimeout(timeout);
  }, [loadProducts]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  async function loadFilters() {
    const [brandsRes, categoriesRes] = await Promise.all([
      supabase.from('brands').select('*').eq('is_active', true).order('name'),
      supabase.from('categories').select('*').eq('is_active', true).order('name'),
    ]);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setCategories((categoriesRes.data as Category[]) ?? []);
  }

  function applyFilters() {
    setSheetOpen(false);
    syncUrlParams();
  }

  function syncUrlParams() {
    const params: Record<string, string> = {};
    if (search.trim()) params.q = search.trim();
    if (brandFilter !== 'all') params.brand = brandFilter;
    if (categoryFilter !== 'all') params.category = categoryFilter;
    if (sortBy !== 'discount') params.sort = sortBy;
    if (discountTypeFilter !== 'all') params.type = discountTypeFilter;
    setSearchParams(params, { replace: true });
  }

  function resetFilters() {
    setBrandFilter('all');
    setCategoryFilter('all');
    setMinDiscount('0');
    setMinPrice('');
    setMaxPrice('');
    setSearch('');
    setSortBy('discount');
    setDiscountTypeFilter('all');
    setSearchParams({}, { replace: true });
  }

  const activeFilterCount = [
    brandFilter !== 'all',
    categoryFilter !== 'all',
    Number(minDiscount) > 0,
    minPrice !== '',
    maxPrice !== '',
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen">
      {/* Search bar */}
      <div className="sticky top-0 z-30 bg-white px-4 pb-3 pt-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün ara..."
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-neutral-300 focus:bg-white"
            />
          </div>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white">
                <SlidersHorizontal className="h-4 w-4 text-neutral-600" />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filtreler</SheetTitle>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-6">
                {/* Sort */}
                <div className="space-y-2">
                  <Label>Sıralama</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Brand */}
                <div className="space-y-2">
                  <Label>Marka</Label>
                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tüm Markalar" />
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
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tüm Kategoriler" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Kategoriler</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Min discount */}
                <div className="space-y-2">
                  <Label>Minimum İndirim: %{minDiscount}</Label>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="5"
                    value={minDiscount}
                    onChange={(e) => setMinDiscount(e.target.value)}
                    className="w-full accent-neutral-900"
                  />
                </div>

                {/* Price range */}
                <div className="space-y-2">
                  <Label>Fiyat Aralığı (TL)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                    <span className="text-neutral-400">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={resetFilters}>
                    Sıfırla
                  </Button>
                  <Button className="flex-1" onClick={applyFilters}>
                    Uygula
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Discount type filter tabs */}
        <div className="mt-2 flex gap-1.5">
          {([
            { value: 'all', label: 'Tümü', icon: Layers },
            { value: 'product_discounts', label: 'Ürün İndirimleri', icon: Package },
            { value: 'campaigns', label: 'Kampanyalar', icon: Megaphone },
          ] as const).map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setDiscountTypeFilter(tab.value); }}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                discountTypeFilter === tab.value
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active sort indicator */}
        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
          <span>
            {loading
              ? 'Yükleniyor...'
              : discountTypeFilter === 'campaigns'
              ? `${campaigns.length} kampanya`
              : `${products.length} ürün${hasMore ? '+' : ''}`}
          </span>
          {discountTypeFilter !== 'campaigns' && (
            <>
              <span>·</span>
              <span>{SORT_OPTIONS.find((s) => s.value === sortBy)?.label}</span>
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="px-4 py-4">
        {discountTypeFilter === 'campaigns' ? (
          loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-neutral-100" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="h-7 w-7" />}
              title="Kampanya bulunamadı"
              description="Bu kriterlere uygun aktif kampanya yok."
            />
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
                        <Megaphone className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900">{campaign.title}</h3>
                        {campaign.brand && <p className="text-xs text-neutral-500">{campaign.brand.name}</p>}
                      </div>
                    </div>
                    {campaign.discount_type === 'percentage' && campaign.discount_value != null && (
                      <span className="flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                        <Percent className="h-3 w-3" />{campaign.discount_value}
                      </span>
                    )}
                  </div>
                  {campaign.description && <p className="mt-2 text-sm text-neutral-600">{campaign.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {campaign.coupon_code && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-2 py-1 font-mono text-xs font-medium text-neutral-700">
                        <Tag className="h-3 w-3 text-neutral-400" />{campaign.coupon_code}
                      </span>
                    )}
                    {campaign.minimum_order_amount != null && (
                      <span className="text-xs text-neutral-500">Min. {formatPrice(campaign.minimum_order_amount)}</span>
                    )}
                    {campaign.free_shipping && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
                        <Truck className="h-3 w-3" />Ücretsiz Kargo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Search className="h-7 w-7" />}
            title="Ürün bulunamadı"
            description="Arama kriterlerinize uygun ürün yok. Filtreleri değiştirmeyi deneyin."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isFavorite={favoriteIds.has(product.id)}
                  onToggleFavorite={toggleFavorite}
                  onClick={(p) => navigate(`/product/${p.id}`)}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="flex h-20 items-center justify-center">
              {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-neutral-300" />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="aspect-[3/4] animate-pulse bg-neutral-100" />
      <div className="p-3">
        <div className="mb-1 h-3 w-12 animate-pulse rounded bg-neutral-100" />
        <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
        <div className="mt-2 h-4 w-16 animate-pulse rounded bg-neutral-100" />
      </div>
    </div>
  );
}
