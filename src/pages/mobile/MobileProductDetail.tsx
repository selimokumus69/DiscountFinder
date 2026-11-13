import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  ExternalLink,
  TrendingDown,
  Clock,
  Tag,
  Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, PriceHistoryEntry } from '@/types/database';
import { useFavorites } from '@/hooks/use-favorites';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatPrice, formatDiscount, timeAgo } from '@/lib/format';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';

export function MobileProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const [product, setProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [id]);

  async function loadProduct() {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from('products')
      .select('*, brand:brands(*), category:categories(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    setProduct(data as Product | null);

    const { data: historyData } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', id)
      .order('recorded_at', { ascending: true });
    setPriceHistory((historyData as PriceHistoryEntry[]) ?? []);

    setLoading(false);
  }

  if (loading) {
    return <LoadingSpinner message="Ürün yükleniyor..." />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-sm text-neutral-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Geri
        </button>
        <EmptyState
          icon={<Info className="h-7 w-7" />}
          title="Ürün yüklenemedi"
          description="Bir hata oluştu. Lütfen tekrar deneyin."
        />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-sm text-neutral-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Geri
        </button>
        <EmptyState
          icon={<Info className="h-7 w-7" />}
          title="Ürün bulunamadı"
          description="Bu ürün silinmiş veya yayından kaldırılmış olabilir."
        />
      </div>
    );
  }

  const hasDiscount =
    product.discount_percentage != null &&
    product.discount_percentage > 0 &&
    product.original_price != null &&
    product.original_price > product.current_price;

  const isFavorite = favoriteIds.has(product.id);

  const chartData = priceHistory.map((h) => ({
    date: new Date(h.recorded_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
    price: Number(h.price),
    original: h.original_price ? Number(h.original_price) : null,
  }));

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Back button */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-white/90 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4 text-neutral-700" />
        </button>
        <button
          onClick={() => toggleFavorite(product)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100"
        >
          <Heart
            className={cn(
              'h-4 w-4',
              isFavorite ? 'fill-red-500 text-red-500' : 'text-neutral-700'
            )}
          />
        </button>
      </div>

      {/* Product image */}
      <div className="relative aspect-[3/4] w-full bg-neutral-50">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            Görsel yok
          </div>
        )}
        {hasDiscount && (
          <span className="absolute left-3 top-3 rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white">
            {formatDiscount(product.discount_percentage)}
          </span>
        )}
      </div>

      <div className="px-4 py-5">
        {/* Brand & category */}
        <div className="mb-2 flex items-center gap-2 text-sm">
          {product.brand && (
            <span className="font-medium text-neutral-500">{product.brand.name}</span>
          )}
          {product.brand && product.category && <span className="text-neutral-300">·</span>}
          {product.category && (
            <span className="flex items-center gap-1 text-neutral-400">
              <Tag className="h-3 w-3" />
              {product.category.name}
            </span>
          )}
        </div>

        {/* Name */}
        <h1 className="text-lg font-semibold leading-snug text-neutral-900">{product.name}</h1>

        {/* Description */}
        {product.description && (
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{product.description}</p>
        )}

        {/* Price */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-2xl font-bold text-neutral-900">
            {formatPrice(product.current_price)}
          </span>
          {hasDiscount && product.original_price && (
            <span className="text-base text-neutral-400 line-through">
              {formatPrice(product.original_price)}
            </span>
          )}
        </div>

        {hasDiscount && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <TrendingDown className="h-4 w-4" />
            <span className="font-medium">
              {formatDiscount(product.discount_percentage)} indirim
            </span>
          </div>
        )}

        {/* Sizes */}
        {product.sizes && product.sizes.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-medium text-neutral-900">Bedenler</h3>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <span
                  key={size}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700"
                >
                  {size}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Colors */}
        {product.colors && product.colors.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-medium text-neutral-900">Renkler</h3>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <span
                  key={color}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700"
                >
                  {color}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Price history */}
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-900">
            <TrendingDown className="h-4 w-4 text-neutral-400" />
            Fiyat Geçmişi
          </h3>

          {chartData.length >= 2 ? (
            <Card className="p-4">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#999' }}
                    tickFormatter={(v) => `₺${v}`}
                  />
                  <Tooltip
                    formatter={(v: number) => formatPrice(v)}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e5e5',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#171717"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#171717' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center">
              <Info className="mx-auto mb-2 h-5 w-5 text-neutral-300" />
              <p className="text-sm text-neutral-400">
                Bu ürün için yeterli fiyat geçmişi henüz yok. Fiyat değişiklikleri tarama
                motoru çalıştığında kaydedilecek.
              </p>
            </div>
          )}
        </div>

        {/* Last checked */}
        <div className="mt-5 flex items-center gap-2 text-xs text-neutral-400">
          <Clock className="h-3.5 w-3.5" />
          <span>Son fiyat kontrolü: {timeAgo(product.last_checked_at)}</span>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-md border-t border-neutral-200 bg-white p-4">
        <a href={product.product_url} target="_blank" rel="noopener noreferrer">
          <Button className="w-full" size="lg">
            <ExternalLink className="mr-2 h-4 w-4" />
            Orijinal Mağazada Görüntüle
          </Button>
        </a>
      </div>
    </div>
  );
}
