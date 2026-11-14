import { Heart, ExternalLink, Tag, Flame, Bell } from 'lucide-react';
import type { Product } from '@/types/database';
import { formatPrice, formatDiscount } from '@/lib/format';
import { getDealRatingConfig } from '@/lib/deal-score';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  isFavorite: boolean;
  onToggleFavorite: (product: Product) => void;
  onClick: (product: Product) => void;
  campaignLabel?: string | null;
  hasAlert?: boolean;
}

export function ProductCard({ product, isFavorite, onToggleFavorite, onClick, campaignLabel, hasAlert }: ProductCardProps) {
  const hasDiscount =
    product.discount_percentage != null &&
    product.discount_percentage > 0 &&
    product.original_price != null &&
    product.original_price > product.current_price;

  return (
    <div
      onClick={() => onClick(product)}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-neutral-50">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-xs text-neutral-300">Görsel yok</span>
          </div>
        )}

        {hasDiscount && (
          <span className="absolute left-2 top-2 rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white">
            {formatDiscount(product.discount_percentage)}
          </span>
        )}

        {product.deal_rating && product.deal_rating !== 'unknown' && product.deal_rating !== 'bad' && (
          <span className={cn(
            'absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm',
            getDealRatingConfig(product.deal_rating).bgColor,
          )}>
            {product.deal_rating === 'legendary' && <Flame className="h-2.5 w-2.5" />}
            {getDealRatingConfig(product.deal_rating).shortLabel}
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product);
          }}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
          aria-label="Favori"
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-colors',
              isFavorite ? 'fill-red-500 text-red-500' : 'text-neutral-400'
            )}
          />
        </button>

        {hasAlert && (
          <span className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 shadow-sm">
            <Bell className="h-3 w-3 fill-white text-white" />
          </span>
        )}
      </div>

      <div className="p-3">
        {campaignLabel && (
          <span className="mb-1 inline-flex max-w-full items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
            <Tag className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{campaignLabel}</span>
          </span>
        )}
        {product.brand && (
          <p className="mb-0.5 text-xs font-medium text-neutral-400">{product.brand.name}</p>
        )}
        <p className="line-clamp-2 text-sm font-medium leading-snug text-neutral-900">
          {product.name}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            {formatPrice(product.current_price)}
          </span>
          {hasDiscount && product.original_price && (
            <span className="text-xs text-neutral-400 line-through">
              {formatPrice(product.original_price)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductCardWide({ product, isFavorite, onToggleFavorite, campaignLabel }: ProductCardProps) {
  const hasDiscount =
    product.discount_percentage != null &&
    product.discount_percentage > 0 &&
    product.original_price != null &&
    product.original_price > product.current_price;

  return (
    <div className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="relative h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-50">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-300">
            Yok
          </div>
        )}
        {hasDiscount && (
          <span className="absolute left-1 top-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {formatDiscount(product.discount_percentage)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {campaignLabel && (
          <span className="mb-1 inline-flex max-w-full items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
            <Tag className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{campaignLabel}</span>
          </span>
        )}
        {product.brand && (
          <p className="text-xs font-medium text-neutral-400">{product.brand.name}</p>
        )}
        <p className="line-clamp-2 text-sm font-medium text-neutral-900">{product.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            {formatPrice(product.current_price)}
          </span>
          {hasDiscount && product.original_price && (
            <span className="text-xs text-neutral-400 line-through">
              {formatPrice(product.original_price)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
          >
            Mağazada Gör
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => onToggleFavorite(product)}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-neutral-50"
          >
            <Heart
              className={cn(
                'h-3.5 w-3.5',
                isFavorite ? 'fill-red-500 text-red-500' : 'text-neutral-400'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
