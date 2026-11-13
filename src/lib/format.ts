const TRY_CURRENCY = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TR_DATE = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const TR_DATE_SHORT = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const TR_DATE_TIME = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '-';
  return TRY_CURRENCY.format(value);
}

export function formatDiscount(value: number | null | undefined): string {
  if (value == null) return '';
  return `%${Math.round(value)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return TR_DATE.format(new Date(value));
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '-';
  return TR_DATE_SHORT.format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return TR_DATE_TIME.format(new Date(value));
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return '-';

  const now = new Date();
  const past = new Date(value);
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (seconds < 60) return 'az önce';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dakika önce`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat önce`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} gün önce`;
  return formatDate(value);
}

export function slugify(text: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g',
    ı: 'i', İ: 'i', ö: 'o', Ö: 'o',
    ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return text
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => map[char] || char)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
