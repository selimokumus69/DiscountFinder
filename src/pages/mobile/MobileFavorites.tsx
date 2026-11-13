import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import type { Product } from '@/types/database';
import { ProductCardWide } from '@/components/mobile/ProductCard';
import { useFavorites } from '@/hooks/use-favorites';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';

export function MobileFavorites() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favoriteIds, toggleFavorite, loading: favLoading } = useFavorites();
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

  return (
    <div className="min-h-screen px-4 py-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight text-neutral-900">Favorilerim</h1>

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
