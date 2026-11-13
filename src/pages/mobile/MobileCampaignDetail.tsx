import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Megaphone,
  Tag,
  Truck,
  Percent,
  Calendar,
  Info,
  Copy,
  Check,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Campaign, Product, Brand } from '@/types/database';
import { useFavorites } from '@/hooks/use-favorites';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProductCard } from '@/components/mobile/ProductCard';
import { formatPrice, formatDate } from '@/lib/format';

export function MobileCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadCampaign();
  }, [id]);

  async function loadCampaign() {
    if (!id) return;
    setLoading(true);
    setLoadError(false);

    const { data: campData, error } = await supabase
      .from('campaigns')
      .select('*, brand:brands(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !campData) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    const camp = campData as Campaign;
    setCampaign(camp);
    setBrand(camp.brand ?? null);

    // Fetch linked products via campaign_products join
    const { data: cpData } = await supabase
      .from('campaign_products')
      .select('product:products(*, brand:brands(*), category:categories(*))')
      .eq('campaign_id', id);

    if (cpData) {
      const linkedProducts = cpData
        .map((row) => row.product as unknown as Product | null)
        .filter((p): p is Product => p !== null && p.product_status === 'active');
      setProducts(linkedProducts);
    }

    setLoading(false);
  }

  function copyCouponCode() {
    if (!campaign?.coupon_code) return;
    navigator.clipboard.writeText(campaign.coupon_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <LoadingSpinner message="Kampanya yükleniyor..." />;
  }

  if (loadError || !campaign) {
    return (
      <div className="min-h-screen bg-white px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-sm text-neutral-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Geri
        </button>
        <EmptyState
          icon={<Info className="h-7 w-7" />}
          title="Kampanya bulunamadı"
          description="Bu kampanya silinmiş veya yayından kaldırılmış olabilir."
        />
      </div>
    );
  }

  const isExpired =
    campaign.end_date !== null && new Date(campaign.end_date) < new Date();
  const hasPct = campaign.discount_type === 'percentage' && campaign.discount_value != null;

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
        <span className="text-sm font-medium text-neutral-500">Kampanya Detayı</span>
        <div className="w-9" />
      </div>

      {/* Campaign header */}
      <div className="px-4 py-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-red-50">
            <Megaphone className="h-5 w-5 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-snug text-neutral-900">
              {campaign.title}
            </h1>
            {brand && (
              <p className="mt-0.5 text-sm text-neutral-500">{brand.name}</p>
            )}
          </div>
          {hasPct && (
            <span className="flex flex-shrink-0 items-center gap-0.5 rounded-full bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-600">
              <Percent className="h-3.5 w-3.5" />
              {campaign.discount_value}
            </span>
          )}
        </div>

        {/* Status badge */}
        {isExpired && (
          <div className="mb-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-500">
            Bu kampanyanın süresi dolmuş.
          </div>
        )}
        {!isExpired && !campaign.is_active && (
          <div className="mb-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-500">
            Bu kampanya şu anda aktif değil.
          </div>
        )}

        {/* Description */}
        {campaign.description && (
          <p className="mb-4 text-sm leading-relaxed text-neutral-600">
            {campaign.description}
          </p>
        )}

        {/* Campaign details grid */}
        <div className="grid grid-cols-2 gap-3">
          {campaign.coupon_code && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-1 text-xs text-neutral-400">Kupon Kodu</p>
              <button
                onClick={copyCouponCode}
                className="flex items-center gap-1.5 font-mono text-sm font-semibold text-neutral-900"
              >
                {campaign.coupon_code}
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-neutral-400" />
                )}
              </button>
            </div>
          )}

          {campaign.discount_value != null && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-1 text-xs text-neutral-400">İndirim Oranı</p>
              <p className="text-sm font-semibold text-neutral-900">
                %{campaign.discount_value}
              </p>
            </div>
          )}

          {campaign.minimum_order_amount != null && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-1 text-xs text-neutral-400">Min. Sepet Tutarı</p>
              <p className="text-sm font-semibold text-neutral-900">
                {formatPrice(campaign.minimum_order_amount)}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-1 text-xs text-neutral-400">Ücretsiz Kargo</p>
            <p className="flex items-center gap-1 text-sm font-semibold">
              {campaign.free_shipping ? (
                <>
                  <Truck className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-green-600">Evet</span>
                </>
              ) : (
                <span className="text-neutral-400">Hayır</span>
              )}
            </p>
          </div>

          {campaign.start_date && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-1 flex items-center gap-1 text-xs text-neutral-400">
                <Calendar className="h-3 w-3" />
                Başlangıç
              </p>
              <p className="text-sm font-semibold text-neutral-900">
                {formatDate(campaign.start_date)}
              </p>
            </div>
          )}

          {campaign.end_date && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="mb-1 flex items-center gap-1 text-xs text-neutral-400">
                <Calendar className="h-3 w-3" />
                Bitiş
              </p>
              <p className="text-sm font-semibold text-neutral-900">
                {formatDate(campaign.end_date)}
              </p>
            </div>
          )}
        </div>

        {/* Coupon code copy hint */}
        {campaign.coupon_code && copied && (
          <p className="mt-2 text-xs text-green-600">Kupon kodu kopyalandı!</p>
        )}

        {/* Terms */}
        {campaign.terms && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-sm font-medium text-neutral-900">Kampanya Şartları</h3>
            <p className="text-sm leading-relaxed text-neutral-500">{campaign.terms}</p>
          </div>
        )}

        {/* Source link */}
        {campaign.source_url && (
          <a
            href={campaign.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Kampanya sayfasına git
          </a>
        )}
      </div>

      {/* Linked products */}
      <div className="border-t border-neutral-100 px-4 py-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-900">
          <ShoppingBag className="h-4 w-4 text-neutral-400" />
          Kampanyaya Dahil Ürünler
        </h2>

        {products.length > 0 ? (
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
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center">
            <Info className="mx-auto mb-2 h-5 w-5 text-neutral-300" />
            <p className="text-sm text-neutral-400">
              Bu kampanyaya dahil edilen ürünler burada görünecek. Kampanya site geneli
              olabilir; ürün eşleştirmesi henüz yapılmamış olabilir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
