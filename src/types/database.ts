export type UserRole = 'admin' | 'user';

export type ProductStatus = 'active' | 'inactive';
export type AvailabilityStatus = 'in_stock' | 'out_of_stock' | 'unknown';
export type ScrapingMethod = 'html' | 'api' | 'playwright' | 'rss';
export type ScanStatus = 'running' | 'success' | 'failed' | 'pending';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Source {
  id: string;
  name: string;
  brand_id: string | null;
  category_id: string | null;
  source_url: string;
  scraping_method: ScrapingMethod;
  scraping_config: Record<string, unknown>;
  scan_interval_hours: number;
  is_active: boolean;
  last_scanned_at: string | null;
  created_at: string;
  brand?: Brand | null;
  category?: Category | null;
}

export interface Product {
  id: string;
  source_id: string | null;
  brand_id: string | null;
  category_id: string | null;
  external_product_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  product_url: string;
  current_price: number;
  original_price: number | null;
  discount_percentage: number | null;
  currency: string;
  availability_status: AvailabilityStatus;
  product_status: ProductStatus;
  sizes: string[];
  colors: string[];
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
  brand?: Brand | null;
  category?: Category | null;
}

export interface PriceHistoryEntry {
  id: string;
  product_id: string;
  price: number;
  original_price: number | null;
  discount_percentage: number | null;
  recorded_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
}

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface ScrapingJob {
  id: string;
  source_id: string | null;
  status: ScanStatus;
  request_url: string;
  products_found: number;
  products_added: number;
  products_updated: number;
  pages_scanned: number;
  duplicates_skipped: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  source?: Source | null;
}

export interface ScanLog {
  id: string;
  source_id: string | null;
  status: ScanStatus;
  products_found: number;
  products_added: number;
  products_updated: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  source?: Source | null;
}

export interface DashboardStats {
  total_products: number;
  active_discounted_products: number;
  total_sources: number;
  total_brands: number;
  today_scan_count: number;
  failed_scan_count: number;
}
