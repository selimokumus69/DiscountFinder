import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, TrendingDown, Clock, Tag, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, Brand, Category } from '@/types/database';
import { ProductCard } from '@/components/mobile/ProductCard';
import { useFavorites } from '@/hooks/use-favorites';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export function MobileHome() {
  const navigate = useNavigate();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [topDiscounts, setTopDiscounts] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    const [discountedRes, discountsRes, newRes, brandsRes, categoriesRes] = await Promise.all([
      supabase
        .from('products')
        .select('*, brand:brands(*), category:categories(*)')
        .eq('product_status', 'active')
        .not('discount_percentage', 'is', null)
        .gt('discount_percentage', 0)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('products')
        .select('*, brand:brands(*), category:categories(*)')
        .eq('product_status', 'active')
        .not('discount_percentage', 'is', null)
        .gt('discount_percentage', 0)
        .order('discount_percentage', { ascending: false })
        .limit(10),
      supabase
        .from('products')
        .select('*, brand:brands(*), category:categories(*)')
        .eq('product_status', 'active')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('brands').select('*').eq('is_active', true).order('name').limit(10),
      supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .is('parent_id', null)
        .order('name')
        .limit(6),
    ]);

    const queryError = [discountedRes, discountsRes, newRes, brandsRes, categoriesRes]
      .map((result) => result.error)
      .find((error) => error);

    if (queryError) {
      setLoadError('Veritabanı bağlantısı kurulamadı. Lütfen tekrar deneyin.');
      setLoading(false);
      return;
    }

    setFeatured((discountedRes.data as Product[]) ?? []);
    setTopDiscounts((discountsRes.data as Product[]) ?? []);
    setNewProducts((newRes.data as Product[]) ?? []);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setCategories((categoriesRes.data as Category[]) ?? []);
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/explore?q=${encodeURIComponent(search.trim())}`);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Yükleniyor..." />;
  }

  if (loadError) {
    return (
      <div className="px-4 py-6">
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <p className="text-sm font-medium text-red-700">{loadError}</p>
          <button
            onClick={loadData}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const isEmpty =
    featured.length === 0 && topDiscounts.length === 0 && newProducts.length === 0;

  return (
    <div>
      {/* Header */}
      <div className="bg-white px-4 pb-4 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-neutral-900">İndirimGO</span>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün, marka veya kategori ara..."
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white"
          />
        </form>
      </div>

      {isEmpty ? (
        <div className="px-4">
          <EmptyState
            icon={<Sparkles className="h-7 w-7" />}
            title="Henüz ürün yok"
            description="Ürünler, tarama motoru çalıştığında otomatik olarak burada görünecek."
          />
        </div>
      ) : (
        <div className="space-y-6 px-4 py-4">
          {/* Öne çıkan indirimler */}
          {featured.length > 0 && (
            <Section
              icon={<Sparkles className="h-4 w-4" />}
              title="Yeni İndirimler"
              onSeeAll={() => navigate('/explore?sort=newest')}
            >
              <ProductGrid
                products={featured.slice(0, 6)}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                onClick={(p) => navigate(`/product/${p.id}`)}
              />
            </Section>
          )}

          {/* En yüksek indirim oranları */}
          {topDiscounts.length > 0 && (
            <Section
              icon={<TrendingDown className="h-4 w-4" />}
              title="En Yüksek İndirimler"
              onSeeAll={() => navigate('/explore?sort=discount')}
            >
              <ProductGrid
                products={topDiscounts.slice(0, 6)}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                onClick={(p) => navigate(`/product/${p.id}`)}
              />
            </Section>
          )}

          {/* Yeni eklenen ürünler */}
          {newProducts.length > 0 && (
            <Section
              icon={<Clock className="h-4 w-4" />}
              title="Yeni Eklenenler"
              onSeeAll={() => navigate('/explore?sort=newest')}
            >
              <ProductGrid
                products={newProducts.slice(0, 6)}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                onClick={(p) => navigate(`/product/${p.id}`)}
              />
            </Section>
          )}

          {/* Popüler markalar */}
          {brands.length > 0 && (
            <Section icon={<Tag className="h-4 w-4" />} title="Popüler Markalar">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    className="flex flex-shrink-0 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2"
                  >
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.name}
                        loading="lazy"
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-medium text-neutral-500">
                        {brand.name[0]}
                      </span>
                    )}
                    <span className="text-sm font-medium text-neutral-900">{brand.name}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Kategoriler */}
          {categories.length > 0 && (
            <Section icon={<Tag className="h-4 w-4" />} title="Kategoriler">
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => navigate(`/explore?category=${cat.id}`)}
                    className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition-shadow hover:shadow-sm"
                  >
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        loading="lazy"
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
                        <Tag className="h-4 w-4 text-neutral-400" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-neutral-900">{cat.name}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  onSeeAll,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <span className="text-neutral-400">{icon}</span>
          {title}
        </h2>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            Tümü
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function ProductGrid({
  products,
  favoriteIds,
  onToggleFavorite,
  onClick,
}: {
  products: Product[];
  favoriteIds: Set<string>;
  onToggleFavorite: (p: Product) => void;
  onClick: (p: Product) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isFavorite={favoriteIds.has(product.id)}
          onToggleFavorite={onToggleFavorite}
          onClick={onClick}
        />
      ))}
    </div>
  );
}
