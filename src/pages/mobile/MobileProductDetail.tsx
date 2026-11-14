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
  Megaphone,
  Copy,
  Check,
  Truck,
  Flame,
  BarChart3,
  Bell,
  BellRing,
  Pencil,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, PriceHistoryEntry, Campaign } from '@/types/database';
import { useFavorites } from '@/hooks/use-favorites';
import { useAuth } from '@/hooks/use-auth';
import { usePriceAlerts, getAlertStatus, getAlertStatusConfig } from '@/hooks/use-price-alerts';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatPrice, formatDiscount, timeAgo } from '@/lib/format';
import { getCampaignLabel, pickBestCampaign } from '@/lib/campaign-label';
import {
  getDealRatingConfig,
  getDealScoreExplanation,
  type DealScoreBreakdown,
} from '@/lib/deal-score';
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
import { toast } from 'sonner';

export function MobileProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const { user } = useAuth();
  const { getAlertForProduct, createAlert, updateAlert, deleteAlert, alertProductIds } = usePriceAlerts();
  const [product, setProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [productCampaigns, setProductCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alertPriceInput, setAlertPriceInput] = useState('');
  const [alertEditing, setAlertEditing] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [id]);

  async function loadProduct() {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    setCopied(false);
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

    const [historyRes, campaignRes] = await Promise.all([
      supabase
        .from('price_history')
        .select('*')
        .eq('product_id', id)
        .order('recorded_at', { ascending: true }),
      supabase
        .from('campaign_products')
        .select('campaign:campaigns(*)')
        .eq('product_id', id),
    ]);

    setPriceHistory((historyRes.data as PriceHistoryEntry[]) ?? []);

    if (campaignRes.data) {
      const camps = campaignRes.data
        .map((row) => row.campaign as unknown as Campaign | null)
        .filter((c): c is Campaign => c !== null && c.is_active);
      setProductCampaigns(camps);
    }

    setLoading(false);
  }

  function copyCouponCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCreateAlert() {
    const target = Number(alertPriceInput);
    if (!target || target <= 0) {
      toast.error('Geçerli bir fiyat girin');
      return;
    }
    if (target >= product!.current_price) {
      toast.error('Alarm fiyatı şu anki fiyattan düşük olmalı');
      return;
    }
    const { error } = await createAlert(product!.id, target);
    if (error) {
      toast.error('Alarm kurulamadı', { description: error });
    } else {
      toast.success('Fiyat alarmı oluşturuldu', {
        description: `${formatPrice(target)} fiyatına düştüğünde haber verilecek`,
      });
      setAlertPriceInput('');
      setAlertEditing(false);
    }
  }

  async function handleUpdateAlert() {
    if (!existingAlert) return;
    const target = Number(alertPriceInput);
    if (!target || target <= 0) {
      toast.error('Geçerli bir fiyat girin');
      return;
    }
    const { error } = await updateAlert(existingAlert.id, target);
    if (error) {
      toast.error('Alarm güncellenemedi', { description: error });
    } else {
      toast.success('Fiyat alarmı güncellendi');
      setAlertPriceInput('');
      setAlertEditing(false);
    }
  }

  async function handleDeleteAlert() {
    if (!existingAlert) return;
    const { error } = await deleteAlert(existingAlert.id);
    if (error) {
      toast.error('Alarm silinemedi', { description: error });
    } else {
      toast.success('Fiyat alarmı kaldırıldı');
      setAlertEditing(false);
    }
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
  const bestCampaign = pickBestCampaign(productCampaigns);
  const existingAlert = getAlertForProduct(product.id);
  const hasAlert = alertProductIds.has(product.id);

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

        {/* Campaign info */}
        {bestCampaign && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="flex items-start gap-2">
              <Megaphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-900">
                  {product.brand?.name ?? 'Marka'} – {getCampaignLabel(bestCampaign)}
                </p>
                {bestCampaign.description && (
                  <p className="mt-1 text-xs text-red-700">{bestCampaign.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {bestCampaign.coupon_code && (
                    <button
                      onClick={() => copyCouponCode(bestCampaign.coupon_code!)}
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-red-300 bg-white px-2 py-1 font-mono text-xs font-semibold text-red-700"
                    >
                      {bestCampaign.coupon_code}
                      {copied ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-red-400" />
                      )}
                    </button>
                  )}
                  {bestCampaign.minimum_order_amount != null && (
                    <span className="text-xs text-red-600">
                      Min. {formatPrice(bestCampaign.minimum_order_amount)}
                    </span>
                  )}
                  {bestCampaign.free_shipping && (
                    <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
                      <Truck className="h-3 w-3" />
                      Ücretsiz Kargo
                    </span>
                  )}
                </div>
                {copied && (
                  <p className="mt-1 text-xs text-green-600">Kupon kodu kopyalandı!</p>
                )}
                <button
                  onClick={() => navigate(`/campaign/${bestCampaign.id}`)}
                  className="mt-2 text-xs font-medium text-red-600 hover:text-red-800"
                >
                  Kampanya detayını gör →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deal Analysis */}
        {product.deal_rating && product.deal_rating !== 'unknown' && (() => {
          const config = getDealRatingConfig(product.deal_rating);
          const isLowest90d = product.lowest_price_90d != null && product.current_price <= product.lowest_price_90d;
          const explanation = getDealScoreExplanation(
            product.deal_rating,
            { historical: 0, discount: 0, velocity: 0, campaign: 0, popularity: 0, total: product.deal_score } as DealScoreBreakdown,
            product.lowest_price_90d,
            product.current_price,
          );
          return (
            <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center gap-2">
                {product.deal_rating === 'legendary' ? (
                  <Flame className="h-5 w-5 text-red-500" />
                ) : (
                  <BarChart3 className={cn('h-5 w-5', config.textColor)} />
                )}
                <h3 className="text-sm font-semibold text-neutral-900">Fırsat Analizi</h3>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className={cn('rounded-lg px-3 py-1.5 text-sm font-bold text-white', config.bgColor)}>
                  {config.label}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-neutral-900">{product.deal_score}</span>
                  <span className="text-sm text-neutral-400">/100</span>
                </div>
              </div>

              {/* Score bar */}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={cn('h-full rounded-full transition-all', config.bgColor)}
                  style={{ width: `${product.deal_score}%` }}
                />
              </div>

              <p className="mt-3 text-sm leading-relaxed text-neutral-600">{explanation}</p>

              {/* Price stats grid */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {product.lowest_price_90d != null && (
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <p className="mb-1 text-xs text-neutral-400">90 Günlük En Düşük</p>
                    <p className={cn('text-sm font-semibold', isLowest90d ? 'text-red-600' : 'text-neutral-900')}>
                      {formatPrice(product.lowest_price_90d)}
                    </p>
                  </div>
                )}
                {product.avg_price_90d != null && (
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <p className="mb-1 text-xs text-neutral-400">90 Günlük Ortalama</p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {formatPrice(product.avg_price_90d)}
                    </p>
                  </div>
                )}
                {product.lowest_price_30d != null && (
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <p className="mb-1 text-xs text-neutral-400">30 Günlük En Düşük</p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {formatPrice(product.lowest_price_30d)}
                    </p>
                  </div>
                )}
                <div className="rounded-xl border border-neutral-200 bg-white p-3">
                  <p className="mb-1 text-xs text-neutral-400">Şu Anki Fiyat</p>
                  <p className={cn('text-sm font-semibold', isLowest90d ? 'text-red-600' : 'text-neutral-900')}>
                    {formatPrice(product.current_price)}
                  </p>
                </div>
              </div>

              {product.favorite_count > 0 && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400">
                  <Heart className="h-3 w-3" />
                  <span>{product.favorite_count} kullanıcı favoriledi</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Price Alert */}
        {user && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <BellRing className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-900">Fiyat Alarmı</h3>
            </div>

            {existingAlert && !alertEditing ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-white p-3">
                  <div className="text-sm">
                    <p className="text-neutral-500">Hedef fiyat</p>
                    <p className="text-lg font-bold text-neutral-900">
                      {formatPrice(existingAlert.target_price)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-neutral-500">Şu anki</p>
                    <p className="font-semibold text-neutral-900">
                      {formatPrice(product.current_price)}
                    </p>
                  </div>
                </div>
                {(() => {
                  const status = getAlertStatus(product.current_price, existingAlert.target_price, existingAlert.last_triggered_at);
                  const cfg = getAlertStatusConfig(status);
                  return (
                    <div
                      className={cn('rounded-lg px-3 py-2 text-center text-sm font-medium', cfg.bgColor, cfg.color)}
                    >
                      {cfg.label}
                    </div>
                  );
                })()}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => {
                      setAlertPriceInput(String(existingAlert.target_price));
                      setAlertEditing(true);
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Düzenle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={handleDeleteAlert}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Sil
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-amber-700">
                  İstediğin fiyata düşünce haber vereceğiz. Şu anki fiyat:{' '}
                  <span className="font-semibold">{formatPrice(product.current_price)}</span>
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="örn. 1500"
                    value={alertPriceInput}
                    onChange={(e) => setAlertPriceInput(e.target.value)}
                    className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={alertEditing ? handleUpdateAlert : handleCreateAlert}
                  >
                    <Bell className="mr-1 h-3.5 w-3.5" />
                    {alertEditing ? 'Güncelle' : 'Alarm Kur'}
                  </Button>
                </div>
                {alertEditing && (
                  <button
                    onClick={() => {
                      setAlertEditing(false);
                      setAlertPriceInput('');
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-700"
                  >
                    İptal
                  </button>
                )}
              </div>
            )}
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
