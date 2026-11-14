import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, LogIn, Bell, BellRing, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { usePriceAlerts, getAlertStatus, getAlertStatusConfig } from '@/hooks/use-price-alerts';
import type { Product, PriceAlert } from '@/types/database';
import { ProductCardWide } from '@/components/mobile/ProductCard';
import { useFavorites } from '@/hooks/use-favorites';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

export function MobileFavorites() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite, loading: favLoading } = useFavorites();
  const { alerts, unseenEventCount } = usePriceAlerts();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, [favoriteIds]);

  async function loadProducts() {
    if (favoriteIds.size === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*, brand:brands(*), category:categories(*)')
      .in('id', [...favoriteIds])
      .eq('product_status', 'active');
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  if (loading || favLoading) {
    return <LoadingSpinner message="Favoriler yükleniyor..." />;
  }

  const alertProducts = alerts
    .filter((a) => a.is_active && a.product)
    .map((a) => ({ alert: a, product: a.product! }));

  return (
    <div className="min-h-screen px-4 py-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight text-neutral-900">Favorilerim</h1>

      {/* Active price alerts section */}
      {user && alertProducts.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-amber-900">
                Aktif Fiyat Alarmları ({alertProducts.length})
              </h2>
            </div>
            {unseenEventCount > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {unseenEventCount} tetiklendi
              </span>
            )}
          </div>
          <div className="space-y-2">
            {alertProducts.map(({ alert, product }) => {
              const status = getAlertStatus(
                product.current_price,
                alert.target_price,
                alert.last_triggered_at,
              );
              const cfg = getAlertStatusConfig(status);
              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 rounded-lg bg-white p-2.5"
                >
                  <div className="h-14 w-12 flex-shrink-0 overflow-hidden rounded-md bg-neutral-50">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-300">
                        Yok
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-medium text-neutral-900">{product.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <span className="font-semibold text-neutral-900">
                        {formatPrice(product.current_price)}
                      </span>
                      <span className="text-neutral-400">→ {formatPrice(alert.target_price)}</span>
                    </div>
                    <span className={cn('mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium', cfg.bgColor, cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 flex-shrink-0 cursor-pointer text-neutral-300"
                    onClick={() => navigate(`/product/${product.id}`)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-7 w-7" />}
          title="Henüz favori ürün yok"
          description={
            user
              ? "Beğendiğiniz ürünlerin üzerindeki kalp ikonuna doklayarak favorilerinize ekleyebilirsiniz."
              : "Ürünleri favorilerinize eklemek için kalp ikonuna dokunun. Misafir olarak eklediğiniz favoriler bu cihazda saklanır."
          }
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Ürünleri Keşfet
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <ProductCardWide
              key={product.id}
              product={product}
              isFavorite={favoriteIds.has(product.id)}
              onToggleFavorite={toggleFavorite}
              onClick={(p) => navigate(`/product/${p.id}`)}
            />
          ))}
        </div>
      )}

      {!user && products.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-sm text-neutral-500">
            Misafir olarak favoriler bu cihazda saklanıyor. Hesap oluşturursanız favorileriniz
            cihazlar arası senkronize edilir.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigate('/profile')}
          >
            <LogIn className="mr-2 h-4 w-4" />
            Giriş Yap / Kayıt Ol
          </Button>
        </div>
      )}
    </div>
  );
}
