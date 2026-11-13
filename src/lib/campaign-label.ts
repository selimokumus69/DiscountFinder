import type { Campaign } from '@/types/database';
import { formatPrice } from '@/lib/format';

/**
 * Generates a short campaign label text suitable for product cards.
 * Examples: "%30 indirim", "KTN30 kodu ile %30", "2.000 TL üzeri %30 indirim"
 */
export function getCampaignLabel(campaign: Campaign): string {
  const pct = campaign.discount_value;
  const code = campaign.coupon_code;
  const minAmount = campaign.minimum_order_amount;

  if (code && pct) {
    if (minAmount) {
      return `${formatPrice(minAmount)} üzeri ${code} ile %${pct}`;
    }
    return `${code} ile %${pct} indirim`;
  }
  if (pct) {
    if (minAmount) {
      return `${formatPrice(minAmount)} üzeri %${pct} indirim`;
    }
    return `%${pct} kampanya indirimi`;
  }
  if (campaign.free_shipping) {
    return 'Ücretsiz Kargo';
  }
  return campaign.title.length > 30 ? campaign.title.slice(0, 28) + '...' : campaign.title;
}

/**
 * Picks the most relevant campaign for a product when multiple are linked.
 * Prioritizes percentage campaigns with coupon codes, then percentage, then others.
 */
export function pickBestCampaign(campaigns: Campaign[]): Campaign | null {
  if (campaigns.length === 0) return null;
  const active = campaigns.filter(
    (c) =>
      c.is_active &&
      (!c.end_date || new Date(c.end_date) >= new Date()) &&
      (!c.start_date || new Date(c.start_date) <= new Date())
  );
  if (active.length === 0) return null;

  const withCodeAndPct = active.filter((c) => c.coupon_code && c.discount_value);
  if (withCodeAndPct.length > 0) {
    return withCodeAndPct.sort((a, b) => (b.discount_value ?? 0) - (a.discount_value ?? 0))[0];
  }

  const withPct = active.filter((c) => c.discount_value);
  if (withPct.length > 0) {
    return withPct.sort((a, b) => (b.discount_value ?? 0) - (a.discount_value ?? 0))[0];
  }

  return active[0];
}
