import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface KotonProduct {
  id: string | number;
  name: string;
  unit_price: number;
  unit_sale_price: number;
  currency: string;
  url: string;
  stock: number | boolean;
  product_image_url?: string;
  image_url?: string;
  color?: string | { name?: string };
  size?: string | string[];
  taxonomy?: string[] | { name?: string }[];
  productCode?: string;
  variantCode?: string;
  absolute_url?: string;
}

interface ScanRequest {
  source_id: string;
}

interface ParsedCampaign {
  title: string;
  description: string | null;
  coupon_code: string | null;
  discount_type: string;
  discount_value: number | null;
  minimum_order_amount: number | null;
  maximum_discount_amount: number | null;
  free_shipping: boolean;
  start_date: string | null;
  end_date: string | null;
  terms: string | null;
  source_url: string;
}

interface NormalizedProduct {
  external_product_id: string;
  name: string;
  product_url: string;
  image_url: string | null;
  current_price: number;
  original_price: number | null;
  discount_percentage: number | null;
  currency: string;
  availability_status: string;
  sizes: string[];
  colors: string[];
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; IndirimKesifBot/1.0; +https://indirimkesif.com/bot)";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractProductCode(url: string): string | null {
  const match = url.match(/-(\d+)-(\d+)\//);
  if (match) return `${match[1]}-${match[2]}`;
  const single = url.match(/-(\d+)\/?$/);
  if (single) return single[1];
  return null;
}

function normalizeUrl(url: string, baseUrl: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return new URL(url, baseUrl).href;
  return url;
}

function normalizeColor(color: unknown): string {
  if (typeof color === "string") return color.trim();
  if (color && typeof color === "object" && "name" in color) {
    return String((color as { name?: string }).name ?? "").trim();
  }
  return "";
}

function normalizeSizes(size: unknown): string[] {
  if (typeof size === "string") return size.split(",").map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(size)) return size.map((s) => String(s).trim()).filter(Boolean);
  return [];
}

function normalizeTaxonomy(taxonomy: unknown): string[] {
  if (Array.isArray(taxonomy)) {
    return taxonomy
      .map((t) => {
        if (typeof t === "string") return t.trim();
        if (t && typeof t === "object" && "name" in t) return String((t as { name?: string }).name ?? "").trim();
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

function normalizeProduct(raw: KotonProduct, sourceUrl: string): NormalizedProduct | null {
  if (!raw.id || !raw.name) return null;

  const url = raw.url || raw.absolute_url || "";
  const productUrl = normalizeUrl(url, sourceUrl);
  if (!productUrl) return null;

  const externalId = String(raw.id);
  const unitPrice = Number(raw.unit_price) || 0;
  const salePrice = Number(raw.unit_sale_price) || 0;
  const currentPrice = salePrice > 0 ? salePrice : unitPrice;
  const originalPrice = salePrice > 0 && unitPrice > salePrice ? unitPrice : null;
  const discountPercentage =
    originalPrice !== null
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 10000) / 100
      : null;

  const stockValue = typeof raw.stock === "boolean" ? raw.stock : Number(raw.stock) > 0;
  const availability = stockValue ? "in_stock" : "out_of_stock";

  const imageUrl = raw.product_image_url || raw.image_url || null;
  const normalizedImage = imageUrl ? normalizeUrl(imageUrl, sourceUrl) : null;

  return {
    external_product_id: externalId,
    name: raw.name.trim(),
    product_url: productUrl,
    image_url: normalizedImage,
    current_price: currentPrice,
    original_price: originalPrice,
    discount_percentage: discountPercentage,
    currency: raw.currency === "TRY" ? "TRY" : raw.currency || "TRY",
    availability_status: availability,
    sizes: normalizeSizes(raw.size),
    colors: [normalizeColor(raw.color)].filter(Boolean),
  };
}

function parseJsonLdProducts(html: string, sourceUrl: string): NormalizedProduct[] {
  const products: NormalizedProduct[] = [];
  const ldJsonRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = ldJsonRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());

      const items: unknown[] = [];
      if (data["@type"] === "ItemList" && Array.isArray(data.itemListElement)) {
        items.push(...data.itemListElement);
      } else if (data["@type"] === "Product") {
        items.push(data);
      } else if (Array.isArray(data)) {
        items.push(...data);
      }

      for (const item of items) {
        const node = (item as { item?: unknown }).item ?? item;
        if (!node || typeof node !== "object") continue;
        const p = node as Record<string, unknown>;
        if (p["@type"] && p["@type"] !== "Product") continue;

        const offers = p["offers"] as {
          price?: string | number;
          highPrice?: string | number;
          priceCurrency?: string;
        } | undefined;
        const name = String(p["name"] ?? "");
        const url = String(p["url"] ?? "");
        const image = p["image"] as string | { url?: string } | undefined;
        const imageUrl = typeof image === "string" ? image : image?.url ?? null;

        const price = offers?.price ? Number(offers.price) : 0;
        if (!name || !price) continue;

        const externalId = extractProductCode(url) || String(p["sku"] ?? p["mpn"] ?? "");
        if (!externalId) continue;

        const highPrice = offers?.highPrice ? Number(offers.highPrice) : 0;
        const originalPrice = highPrice > price ? highPrice : null;
        const discountPercentage =
          originalPrice !== null
            ? Math.round(((originalPrice - price) / originalPrice) * 10000) / 100
            : null;

        products.push({
          external_product_id: externalId,
          name,
          product_url: normalizeUrl(url, sourceUrl),
          image_url: imageUrl ? normalizeUrl(imageUrl, sourceUrl) : null,
          current_price: price,
          original_price: originalPrice,
          discount_percentage: discountPercentage,
          currency: offers?.priceCurrency === "TRY" ? "TRY" : "TRY",
          availability_status: "in_stock",
          sizes: [],
          colors: [],
        });
      }
    } catch {
      // Invalid JSON-LD block, skip
    }
  }

  return products;
}

function parseEmbeddedProducts(html: string, sourceUrl: string): NormalizedProduct[] {
  const products: NormalizedProduct[] = [];
  const seen = new Set<string>();

  const patterns = [
    /"id"\s*:\s*["']?(\d+)["']?[^}]*?"name"\s*:\s*"([^"]+)"[^}]*?"unit_price"\s*:\s*([\d.]+)/g,
    /\{\s*"id"\s*:\s*["']?(\d+)["']?\s*,\s*"name"\s*:\s*"([^"]+)"[\s\S]*?"unit_price"\s*:\s*([\d.]+)[\s\S]*?"unit_sale_price"\s*:\s*([\d.]+)[\s\S]*?\}/g,
  ];

  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      const externalId = m[1];
      const name = m[2];
      const unitPrice = Number(m[3]) || 0;
      const context = html.slice(Math.max(0, m.index - 500), m.index + 1500);
      const salePriceMatch = context.match(/"unit_sale_price"\s*:\s*([\d.]+)/);
      const salePrice = Number(m[4] || salePriceMatch?.[1] || 0) || 0;

      if (!externalId || !name || seen.has(externalId)) continue;
      seen.add(externalId);

      const urlMatch = context.match(/"url"\s*:\s*"([^\"]+)"/);
      const imageMatch = context.match(/"(?:product_image_url|image_url)"\s*:\s*"([^\"]+)"/);

      const productUrl = urlMatch ? normalizeUrl(urlMatch[1], sourceUrl) : "";
      if (!productUrl) continue;

      const currentPrice = salePrice > 0 ? salePrice : unitPrice;
      const originalPrice = salePrice > 0 && unitPrice > salePrice ? unitPrice : null;
      const discountPercentage =
        originalPrice !== null
          ? Math.round(((originalPrice - currentPrice) / originalPrice) * 10000) / 100
          : null;

      products.push({
        external_product_id: externalId,
        name: name.trim(),
        product_url: productUrl,
        image_url: imageMatch ? normalizeUrl(imageMatch[1], sourceUrl) : null,
        current_price: currentPrice,
        original_price: originalPrice,
        discount_percentage: discountPercentage,
        currency: "TRY",
        availability_status: "in_stock",
        sizes: [],
        colors: [],
      });
    }
    if (products.length > 0) return products;
  }

  const fullObjectRegex = /\{[^{}]*"id"\s*:\s*["']?\d+["']?[^{}]*"name"\s*:\s*"[^"]+"[^{}]*"unit_(?:sale_)?price"\s*:\s*[\d.]+[^{}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = fullObjectRegex.exec(html)) !== null) {
    try {
      const raw = JSON.parse(m[0]) as KotonProduct;
      const normalized = normalizeProduct(raw, sourceUrl);
      if (normalized && !seen.has(normalized.external_product_id)) {
        seen.add(normalized.external_product_id);
        products.push(normalized);
      }
    } catch {
      // skip unparseable
    }
  }

  return products;
}

function parseHtmlFallback(html: string, sourceUrl: string): NormalizedProduct[] {
  const products: NormalizedProduct[] = [];
  const seen = new Set<string>();

  const linkRegex = /<a[^>]+href=["']([^"']*-\d+-\d+\/)["'][^>]*>/g;
  const productLinks = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    if (!productLinks.has(href)) productLinks.set(href, m[0]);
  }

  for (const [href, anchorTag] of productLinks) {
    const externalId = extractProductCode(href);
    if (!externalId || seen.has(externalId)) continue;
    seen.add(externalId);

    const fullUrl = normalizeUrl(href, sourceUrl);

    const context = html.slice(
      Math.max(0, (linkRegex.lastIndex || 0) - 2000),
      (linkRegex.lastIndex || 0) + 2000
    );

    const nameMatch = anchorTag.match(/title=["']([^"']+)["']/) || context.match(/<a[^>]*>[\s\S]*?<img[^>]*alt=["']([^"']+)["']/);
    const name = nameMatch ? nameMatch[1].trim() : "";

    const priceMatches = context.matchAll(/(\d+[.,]\d{2})\s*₺/g);
    const allPrices: number[] = [];
    for (const pm of priceMatches) {
      allPrices.push(Number(pm[1].replace(",", ".")) || 0);
    }
    const oldPriceMatch = context.match(/<del[^>]*>(\d+[.,]\d{2})/) || context.match(/class=["'][^"']*old[^"']*["'][^>]*>(\d+[.,]\d{2})/);
    const imageMatch = anchorTag.match(/src=["']([^"']+)["']/) || anchorTag.match(/data-src=["']([^"']+)["']/);

    if (!name) continue;

    const currentPrice = allPrices.length > 0 ? Math.min(...allPrices.filter((p) => p > 0)) : 0;
    const originalPriceStr = oldPriceMatch ? (oldPriceMatch[1] || oldPriceMatch[2]) : null;
    const originalPrice = originalPriceStr ? Number(originalPriceStr.replace(",", ".")) : null;
    const discountPercentage =
      originalPrice !== null && originalPrice > currentPrice
        ? Math.round(((originalPrice - currentPrice) / originalPrice) * 10000) / 100
        : null;

    products.push({
      external_product_id: externalId,
      name,
      product_url: fullUrl,
      image_url: imageMatch ? normalizeUrl(imageMatch[1], sourceUrl) : null,
      current_price: currentPrice,
      original_price: originalPrice,
      discount_percentage: discountPercentage,
      currency: "TRY",
      availability_status: "in_stock",
      sizes: [],
      colors: [],
    });
  }

  return products;
}

function parseCampaigns(html: string, sourceUrl: string): ParsedCampaign[] {
  const campaigns: ParsedCampaign[] = [];
  const seen = new Set<string>();

  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  const stripped = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ");

  const campaignPatterns: RegExp[] = [
    /(\d[\d.]*)\s*TL\s*[üu]zer(?:i|ine)[^%]*?(\w+)\s*kodu?\s*(?:ile|yile)\s*[%]?\s*(\d+)\s*[%]?\s*indirim/gi,
    /(\w+)\s*kodu?\s*(?:ile|yile)\s*[%]?\s*(\d+)\s*[%]?\s*indirim[^]*?(\d[\d.]*)\s*TL\s*[üu]zer/gi,
    /kupon\s*kodu[:\s]+(\w+)[^]*?(\d[\d.]*)\s*TL\s*[üu]zer[^]*?[%]?\s*(\d+)\s*[%]?\s*indirim/gi,
  ];

  for (const pattern of campaignPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(stripped)) !== null) {
      let minAmount: number | null = null;
      let couponCode: string | null = null;
      let discountPct: number | null = null;

      const fullMatch = m[0];
      const amtMatch = fullMatch.match(/(\d[\d.]*)\s*TL\s*[üu]zer/i);
      const codeMatch = fullMatch.match(/(\b[A-Z][A-Z0-9]{2,}\b)/);
      const pctMatch = fullMatch.match(/(\d+)\s*%/);

      if (amtMatch) minAmount = Number(amtMatch[1].replace(/\./g, ""));
      if (codeMatch) couponCode = codeMatch[1];
      if (pctMatch) discountPct = Number(pctMatch[1]);

      if (!couponCode && !discountPct) continue;

      const dedupeKey = `${couponCode ?? ""}-${discountPct ?? ""}-${minAmount ?? ""}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const freeShipping = /kargo\s*[üu]cretsiz|[üu]cretsiz\s*kargo/i.test(fullMatch);
      const title = couponCode
        ? `${couponCode} kodu ile %${discountPct ?? ""} indirim`
        : `%${discountPct ?? ""} indirim kampanyası`;

      campaigns.push({
        title: title.trim(),
        description: fullMatch.trim(),
        coupon_code: couponCode,
        discount_type: "percentage",
        discount_value: discountPct,
        minimum_order_amount: minAmount,
        maximum_discount_amount: null,
        free_shipping,
        start_date: null,
        end_date: null,
        terms: fullMatch.trim(),
        source_url: sourceUrl,
      });
    }
  }

  const bannerRegex = /class=["'][^"']*(?:campaign|banner|promo|announcement|kupon|kampanya)[^"']*["'][^>]*>([^<]{10,200})/gi;
  let bm: RegExpExecArray | null;
  while ((bm = bannerRegex.exec(text)) !== null) {
    const bannerText = bm[1].trim();
    const pctMatch = bannerText.match(/(\d+)\s*%/);
    const codeMatch = bannerText.match(/\b([A-Z][A-Z0-9]{2,})\b/);
    if (!pctMatch && !codeMatch) continue;

    const dedupeKey = `banner-${codeMatch?.[1] ?? ""}-${pctMatch?.[1] ?? ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const freeShipping = /kargo\s*[üu]cretsiz|[üu]cretsiz\s*kargo/i.test(bannerText);
    campaigns.push({
      title: bannerText.slice(0, 120),
      description: bannerText,
      coupon_code: codeMatch?.[1] ?? null,
      discount_type: pctMatch ? "percentage" : "other",
      discount_value: pctMatch ? Number(pctMatch[1]) : null,
      minimum_order_amount: null,
      maximum_discount_amount: null,
      free_shipping,
      start_date: null,
      end_date: null,
      terms: null,
      source_url: sourceUrl,
    });
  }

  return campaigns;
}

async function fetchPage(url: string): Promise<{ html: string; status: number; ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      const hint =
        response.status === 403
          ? "Site bot koruması kullanıyor olabilir."
          : response.status === 429
          ? "Çok fazla istek gönderildi, rate limit aktif."
          : response.status >= 500
          ? "Sunucu tarafında geçici bir hata oluştu."
          : "Ağ veya sunucu hatası.";
      return {
        html: "",
        status: response.status,
        ok: false,
        error: `HTTP ${response.status} ${response.statusText}. ${hint}`,
      };
    }

    const html = await response.text();
    return { html, status: response.status, ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen ağ hatası";
    return { html: "", status: 0, ok: false, error: msg };
  }
}

const MAX_PAGES = 20;

function buildPageUrl(baseUrl: string, pageNum: number): string {
  const url = new URL(baseUrl);
  if (pageNum > 1) {
    url.searchParams.set("page", String(pageNum));
  } else {
    url.searchParams.delete("page");
  }
  return url.href;
}

async function scrapeAllPages(
  targetUrl: string,
): Promise<{ products: NormalizedProduct[]; campaigns: ParsedCampaign[]; pagesScanned: number; duplicatesSkipped: number; pageBreakdown: { page: number; count: number }[] }> {
  const allProducts: NormalizedProduct[] = [];
  const allCampaigns: ParsedCampaign[] = [];
  const seenIds = new Set<string>();
  const seenCampaignKeys = new Set<string>();
  const pageBreakdown: { page: number; count: number }[] = [];
  let duplicatesSkipped = 0;

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const pageUrl = buildPageUrl(targetUrl, pageNum);
    const result = await fetchPage(pageUrl);

    if (!result.ok) {
      if (pageNum === 1) {
        throw new Error(`Sayfa alınamadı: ${result.error}`);
      }
      break;
    }

    const html = result.html;
    if (html.length < 500) {
      if (pageNum === 1) {
        throw new Error("Sayfa içeriği çok kısa — bot koruması veya yönlendirme olabilir.");
      }
      break;
    }

    let pageProducts = parseJsonLdProducts(html, targetUrl);
    if (pageProducts.length === 0) {
      pageProducts = parseEmbeddedProducts(html, targetUrl);
    }
    if (pageProducts.length === 0) {
      pageProducts = parseHtmlFallback(html, targetUrl);
    }

    const pageCampaigns = parseCampaigns(html, targetUrl);
    for (const c of pageCampaigns) {
      const key = `${c.coupon_code ?? ""}-${c.discount_value ?? ""}-${c.minimum_order_amount ?? ""}`;
      if (!seenCampaignKeys.has(key)) {
        seenCampaignKeys.add(key);
        allCampaigns.push(c);
      }
    }

    let newOnPage = 0;
    for (const p of pageProducts) {
      if (seenIds.has(p.external_product_id)) {
        duplicatesSkipped++;
        continue;
      }
      seenIds.add(p.external_product_id);
      allProducts.push(p);
      newOnPage++;
    }

    pageBreakdown.push({ page: pageNum, count: pageProducts.length });

    if (pageProducts.length === 0 || newOnPage === 0) {
      break;
    }
  }

  return { products: allProducts, campaigns: allCampaigns, pagesScanned: pageBreakdown.length, duplicatesSkipped, pageBreakdown };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Sadece POST istekleri desteklenir" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: "Sunucu yapılandırması eksik" }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Yetkilendirme gerekli" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(authorization.slice(7));
  if (authError || !authData.user) {
    return jsonResponse({ error: "Geçersiz oturum" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: adminProfile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || adminProfile?.role !== "admin") {
    return jsonResponse({ error: "Bu işlem için yönetici yetkisi gerekli" }, 403);
  }

  let body: ScanRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Geçersiz istek gövdesi" }, 400);
  }

  const { source_id } = body;
  if (!source_id) {
    return jsonResponse({ error: "source_id gerekli" }, 400);
  }

  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("id, name, source_url, brand_id, category_id")
    .eq("id", source_id)
    .maybeSingle();

  if (sourceError || !source) {
    return jsonResponse({ error: "Kaynak bulunamadı" }, 404);
  }

  const targetUrl = source.source_url;
  const startedAt = new Date().toISOString();
  const { data: job, error: jobError } = await supabase
    .from("scraping_jobs")
    .insert({
      source_id: source.id,
      status: "running",
      request_url: targetUrl,
      started_at: startedAt,
    })
    .select("id")
    .maybeSingle();

  if (jobError || !job) {
    return jsonResponse({ error: "Tarama işi oluşturulamadı" }, 500);
  }

  const jobId = job.id;
  const { data: scanLog } = await supabase
    .from("scan_logs")
    .insert({
      source_id: source.id,
      status: "running",
      started_at: startedAt,
    })
    .select("id")
    .maybeSingle();

  const scanLogId = scanLog?.id;

  try {
    const scrapeResult = await scrapeAllPages(targetUrl);
    const products = scrapeResult.products;
    const productsFound = products.length;
    const pagesScanned = scrapeResult.pagesScanned;
    const duplicatesSkipped = scrapeResult.duplicatesSkipped;

    if (productsFound === 0) {
      const completedAt = new Date().toISOString();
      const noProductsMessage = "Ürün verisi bulunamadı. Sayfa yapısı değişmiş veya bot koruması aktif olabilir.";
      await supabase
        .from("scraping_jobs")
        .update({ status: "success", products_found: 0, products_added: 0, products_updated: 0, pages_scanned: pagesScanned, error_message: noProductsMessage, completed_at: completedAt })
        .eq("id", jobId);
      await supabase
        .from("scan_logs")
        .update({ status: "success", products_found: 0, products_added: 0, products_updated: 0, pages_scanned: pagesScanned, error_message: noProductsMessage, completed_at: completedAt })
        .eq("id", scanLogId);

      await supabase
        .from("sources")
        .update({ last_scanned_at: new Date().toISOString() })
        .eq("id", source.id);

      return jsonResponse({
        success: true,
        source_id: source.id,
        products_found: 0,
        products_added: 0,
        products_updated: 0,
        pages_scanned: pagesScanned,
        message: "Tarama tamamlandı ancak ürün bulunamadı. Sayfa yapısı değişmiş olabilir.",
      });
    }

    const externalIds = products.map((p) => p.external_product_id);
    const { data: existingProducts } = await supabase
      .from("products")
      .select("id, external_product_id, current_price, original_price")
      .eq("source_id", source.id)
      .in("external_product_id", externalIds);

    const existingMap = new Map<string, { id: string; current_price: number; original_price: number | null }>();
    for (const p of existingProducts ?? []) {
      existingMap.set(p.external_product_id, {
        id: p.id,
        current_price: Number(p.current_price),
        original_price: p.original_price ? Number(p.original_price) : null,
      });
    }

    let added = 0;
    let updated = 0;
    const now = new Date().toISOString();
    const priceHistoryEntries: { product_id: string; price: number; original_price: number | null; discount_percentage: number | null }[] = [];

    for (const product of products) {
      const existing = existingMap.get(product.external_product_id);

      if (existing) {
        const priceChanged =
          existing.current_price !== product.current_price ||
          existing.original_price !== product.original_price;

        const { error: updateError } = await supabase
          .from("products")
          .update({
            name: product.name,
            image_url: product.image_url,
            current_price: product.current_price,
            original_price: product.original_price,
            discount_percentage: product.discount_percentage,
            availability_status: product.availability_status,
            sizes: product.sizes,
            colors: product.colors,
            last_checked_at: now,
            updated_at: now,
          })
          .eq("id", existing.id);

        if (!updateError) {
          updated++;
          if (priceChanged) {
            priceHistoryEntries.push({
              product_id: existing.id,
              price: product.current_price,
              original_price: product.original_price,
              discount_percentage: product.discount_percentage,
            });
          }
        }
      } else {
        const { data: newProduct, error: insertError } = await supabase
          .from("products")
          .insert({
            source_id: source.id,
            brand_id: source.brand_id,
            category_id: source.category_id,
            external_product_id: product.external_product_id,
            name: product.name,
            image_url: product.image_url,
            product_url: product.product_url,
            current_price: product.current_price,
            original_price: product.original_price,
            discount_percentage: product.discount_percentage,
            currency: product.currency,
            availability_status: product.availability_status,
            product_status: "active",
            sizes: product.sizes,
            colors: product.colors,
            last_checked_at: now,
          })
          .select("id")
          .single();

        if (!insertError && newProduct) {
          added++;
          priceHistoryEntries.push({
            product_id: newProduct.id,
            price: product.current_price,
            original_price: product.original_price,
            discount_percentage: product.discount_percentage,
          });
        }
      }
    }

    if (priceHistoryEntries.length > 0) {
      await supabase.from("price_history").insert(
        priceHistoryEntries.map((entry) => ({
          ...entry,
          recorded_at: now,
        }))
      );
    }

    const campaigns = scrapeResult.campaigns;
    let campaignsAdded = 0;
    let campaignsUpdated = 0;

    for (const campaign of campaigns) {
      const dedupeFilter: Record<string, unknown> = {
        source_id: source.id,
        coupon_code: campaign.coupon_code,
      };
      if (!campaign.coupon_code) {
        dedupeFilter.title = campaign.title;
      }

      const { data: existingCampaign } = await supabase
        .from("campaigns")
        .select("id")
        .match(dedupeFilter)
        .maybeSingle();

      if (existingCampaign) {
        const { error: campUpdateError } = await supabase
          .from("campaigns")
          .update({
            title: campaign.title,
            description: campaign.description,
            discount_type: campaign.discount_type,
            discount_value: campaign.discount_value,
            minimum_order_amount: campaign.minimum_order_amount,
            maximum_discount_amount: campaign.maximum_discount_amount,
            free_shipping: campaign.free_shipping,
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            terms: campaign.terms,
            is_active: true,
            scraped_at: now,
            updated_at: now,
          })
          .eq("id", existingCampaign.id);

        if (!campUpdateError) campaignsUpdated++;
      } else {
        const { error: campInsertError } = await supabase
          .from("campaigns")
          .insert({
            source_id: source.id,
            brand_id: source.brand_id,
            title: campaign.title,
            description: campaign.description,
            coupon_code: campaign.coupon_code,
            discount_type: campaign.discount_type,
            discount_value: campaign.discount_value,
            minimum_order_amount: campaign.minimum_order_amount,
            maximum_discount_amount: campaign.maximum_discount_amount,
            free_shipping: campaign.free_shipping,
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            terms: campaign.terms,
            source_url: campaign.source_url,
            is_active: true,
            scraped_at: now,
          });

        if (!campInsertError) campaignsAdded++;
      }
    }

    await supabase
      .from("scraping_jobs")
      .update({ status: "success", products_found: productsFound, products_added: added, products_updated: updated, pages_scanned: pagesScanned, duplicates_skipped: duplicatesSkipped, completed_at: now })
      .eq("id", jobId);

    await supabase
      .from("scan_logs")
      .update({ status: "success", products_found: productsFound, products_added: added, products_updated: updated, pages_scanned: pagesScanned, duplicates_skipped: duplicatesSkipped, completed_at: now })
      .eq("id", scanLogId);

    await supabase
      .from("sources")
      .update({ last_scanned_at: now })
      .eq("id", source.id);

    const pageSummary = scrapeResult.pageBreakdown.map((p) => `S.${p.page}: ${p.count}`).join(", ");
    const campaignSummary = campaigns.length > 0 ? `, ${campaignsAdded} yeni kampanya, ${campaignsUpdated} kampanya güncellendi` : "";

    return jsonResponse({
      success: true,
      source_id: source.id,
      products_found: productsFound,
      products_added: added,
      products_updated: updated,
      pages_scanned: pagesScanned,
      duplicates_skipped: duplicatesSkipped,
      campaigns_found: campaigns.length,
      campaigns_added: campaignsAdded,
      campaigns_updated: campaignsUpdated,
      page_breakdown: scrapeResult.pageBreakdown,
      message: `Tarama tamamlandı: ${pagesScanned} sayfa, ${productsFound} ürün bulundu, ${added} yeni eklendi, ${updated} güncellendi, ${duplicatesSkipped} tekrarlanan atlandı${campaignSummary}. [${pageSummary}]`,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Bilinmeyen hata";

    const failedAt = new Date().toISOString();
    await supabase
      .from("scraping_jobs")
      .update({ status: "failed", error_message: errorMessage, completed_at: failedAt })
      .eq("id", jobId);

    if (scanLogId) {
      await supabase
        .from("scan_logs")
        .update({ status: "failed", error_message: errorMessage, completed_at: failedAt })
        .eq("id", scanLogId);
    }

    await supabase
      .from("sources")
      .update({ last_scanned_at: new Date().toISOString() })
      .eq("id", source.id);

    return jsonResponse(
      {
        success: false,
        source_id: source.id,
        error: errorMessage,
        message: "Tarama başarısız. Mevcut ürün kayıtları korunuyor.",
      },
      500
    );
  }
});
