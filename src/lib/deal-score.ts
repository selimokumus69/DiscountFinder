import type { DealRating, Campaign } from '@/types/database';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DealScoreInput {
  currentPrice: number;
  lowestPrice90d: number | null;
  lowestPrice30d: number | null;
  avgPrice90d: number | null;
  discountPercentage: number | null;
  lastPriceDropAt: string | null;
  campaigns: Campaign[];
  favoriteCount: number;
}

export interface DealScoreBreakdown {
  historical: number;
  discount: number;
  velocity: number;
  campaign: number;
  popularity: number;
  total: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ── Scoring Components ─────────────────────────────────────────────────────

/**
 * Historical price score (0-50).
 * Uses the 90-day lowest price as the benchmark. If the current price equals
 * the 90-day low, the product gets the full 50 points. As the current price
 * rises relative to the low, the score decreases linearly.
 */
export function historicalScore(
  currentPrice: number,
  lowestPrice90d: number | null,
  avgPrice90d: number | null,
): number {
  if (!lowestPrice90d || lowestPrice90d <= 0) return 0;
  if (currentPrice <= lowestPrice90d) return 50;

  const range = avgPrice90d && avgPrice90d > lowestPrice90d
    ? avgPrice90d - lowestPrice90d
    : lowestPrice90d * 0.5;

  if (range <= 0) return 25;

  const deviation = currentPrice - lowestPrice90d;
  const ratio = clamp(deviation / range, 0, 1);
  return Math.round(50 * (1 - ratio));
}

/**
 * Discount percentage score (0-20).
 * 50%+ discount = 20 points, scaling linearly down to 0% = 0 points.
 */
export function discountScore(discountPercentage: number | null): number {
  if (discountPercentage == null || discountPercentage <= 0) return 0;
  return clamp(Math.round((discountPercentage / 50) * 20), 0, 20);
}

/**
 * Price drop velocity score (0-15).
 * Rewards recent price drops more heavily.
 * - Within 24h: 15 points
 * - Within 3 days: 12 points
 * - Within 7 days: 8 points
 * - Within 30 days: 4 points
 * - Older or unknown: 0 points
 */
export function velocityScore(lastPriceDropAt: string | null): number {
  if (!lastPriceDropAt) return 0;

  const dropTime = new Date(lastPriceDropAt).getTime();
  if (Number.isNaN(dropTime)) return 0;

  const hoursAgo = (Date.now() - dropTime) / (1000 * 60 * 60);

  if (hoursAgo <= 24) return 15;
  if (hoursAgo <= 72) return 12;
  if (hoursAgo <= 168) return 8;
  if (hoursAgo <= 720) return 4;
  return 0;
}

/**
 * Campaign bonus score (0-10).
 * Awards points for active campaigns linked to the product:
 * - Has coupon code: +4
 * - Has free shipping: +2
 * - Additional active campaigns: up to +4 more
 */
export function campaignScore(campaigns: Campaign[]): number {
  const active = campaigns.filter(
    (c) =>
      c.is_active &&
      (!c.end_date || new Date(c.end_date) >= new Date()) &&
      (!c.start_date || new Date(c.start_date) <= new Date()),
  );
  if (active.length === 0) return 0;

  let score = 0;
  const hasCoupon = active.some((c) => c.coupon_code);
  if (hasCoupon) score += 4;

  const hasFreeShipping = active.some((c) => c.free_shipping);
  if (hasFreeShipping) score += 2;

  const extraCampaigns = active.length - 1;
  score += Math.min(extraCampaigns * 2, 4);

  return clamp(score, 0, 10);
}

/**
 * Popularity score (0-5) based on favorite count.
 * - 200+ favorites: 5 points
 * - 100+: 4 points
 * - 50+: 3 points
 * - 25+: 2 points
 * - 10+: 1 point
 * - Below 10: 0 points
 */
export function popularityScore(favoriteCount: number): number {
  if (favoriteCount >= 200) return 5;
  if (favoriteCount >= 100) return 4;
  if (favoriteCount >= 50) return 3;
  if (favoriteCount >= 25) return 2;
  if (favoriteCount >= 10) return 1;
  return 0;
}

// ── Aggregate ───────────────────────────────────────────────────────────────

/**
 * Calculates the full deal score (0-100) and returns a breakdown of each
 * component for UI display.
 */
export function calculateDealScore(input: DealScoreInput): DealScoreBreakdown {
  const historical = historicalScore(
    input.currentPrice,
    input.lowestPrice90d,
    input.avgPrice90d,
  );
  const discount = discountScore(input.discountPercentage);
  const velocity = velocityScore(input.lastPriceDropAt);
  const campaign = campaignScore(input.campaigns);
  const popularity = popularityScore(input.favoriteCount);

  const total = clamp(historical + discount + velocity + campaign + popularity, 0, 100);

  return { historical, discount, velocity, campaign, popularity, total };
}

/**
 * Maps a 0-100 score to a categorical rating.
 * - 90-100: legendary
 * - 75-89:  excellent
 * - 60-74:  good
 * - 40-59:  average
 * - 0-39:   bad
 */
export function getDealRating(score: number): DealRating {
  if (score >= 90) return 'legendary';
  if (score >= 75) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'average';
  return 'bad';
}

// ── UI Helpers ──────────────────────────────────────────────────────────────

export interface DealRatingConfig {
  label: string;
  shortLabel: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
}

const ratingConfigs: Record<DealRating, DealRatingConfig> = {
  legendary: {
    label: 'Efsane Fırsat',
    shortLabel: 'Efsane',
    bgColor: 'bg-red-500',
    textColor: 'text-red-600',
    borderColor: 'border-red-500',
    icon: 'flame',
  },
  excellent: {
    label: 'Çok İyi Fırsat',
    shortLabel: 'Çok İyi',
    bgColor: 'bg-green-500',
    textColor: 'text-green-600',
    borderColor: 'border-green-500',
    icon: 'trending-down',
  },
  good: {
    label: 'İyi Fırsat',
    shortLabel: 'İyi',
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500',
    icon: 'thumbs-up',
  },
  average: {
    label: 'Ortalama',
    shortLabel: 'Ortalama',
    bgColor: 'bg-amber-400',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-400',
    icon: 'minus',
  },
  bad: {
    label: 'Beklenebilir',
    shortLabel: 'Beklenebilir',
    bgColor: 'bg-neutral-400',
    textColor: 'text-neutral-500',
    borderColor: 'border-neutral-300',
    icon: 'clock',
  },
  unknown: {
    label: 'Puansız',
    shortLabel: 'Puansız',
    bgColor: 'bg-neutral-300',
    textColor: 'text-neutral-400',
    borderColor: 'border-neutral-200',
    icon: 'help-circle',
  },
};

export function getDealRatingConfig(rating: DealRating): DealRatingConfig {
  return ratingConfigs[rating];
}

/**
 * Returns a human-readable explanation of why the product received its score.
 */
export function getDealScoreExplanation(
  rating: DealRating,
  breakdown: DealScoreBreakdown,
  lowestPrice90d: number | null,
  currentPrice: number,
): string {
  switch (rating) {
    case 'legendary':
      if (lowestPrice90d && currentPrice <= lowestPrice90d) {
        return 'Son 90 günün en düşük fiyatında! Şimdi almak için en iyi zaman.';
      }
      return 'Mükemmel bir fırsat — fiyat tarihsel olarak çok düşük seviyede.';
    case 'excellent':
      return 'Fiyat son 90 günün en düşük seviyelerine yakın, kaçırılmayacak bir fırsat.';
    case 'good':
      return 'Fiyat ortalamanın altında, iyi bir alışveriş zamanı.';
    case 'average':
      return 'Fiyat normal seviyede. Acil değilseniz daha iyi bir fırsat bekleyebilirsiniz.';
    case 'bad':
      return 'Fiyat yüksek seviyede. Daha uygun fiyat için beklemeniz önerilir.';
    default:
      return 'Bu ürün için henüz yeterli fiyat geçmişi yok, puan hesaplanamadı.';
  }
}
