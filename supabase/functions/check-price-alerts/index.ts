import { createClient } from "npm:@supabase/supabase-js@2";

/*
# check-price-alerts Edge Function

Checks all active price alerts against current product prices. When a product's
current_price is at or below the alert's target_price, the function:
1. Inserts a record into price_alert_events
2. Updates the alert's last_triggered_at timestamp

Idempotent: an alert that has already triggered at the current price level won't
trigger again until the product price rises above the target and falls back.

Requires admin authentication (Bearer token).
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const { data: authData, error: authError } = await authClient.auth.getUser(
    authorization.slice(7),
  );
  if (authError || !authData.user) {
    return jsonResponse({ error: "Geçersiz oturum" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (adminProfile?.role !== "admin") {
    return jsonResponse({ error: "Bu işlem için yönetici yetkisi gerekli" }, 403);
  }

  try {
    const now = new Date().toISOString();
    let triggeredCount = 0;
    let checkedCount = 0;

    // Fetch all active alerts in batches
    const batchSize = 200;
    let offset = 0;

    while (true) {
      const { data: activeAlerts, error: alertError } = await supabase
        .from("price_alerts")
        .select("id, user_id, product_id, target_price, last_triggered_at")
        .eq("is_active", true)
        .range(offset, offset + batchSize - 1);

      if (alertError || !activeAlerts || activeAlerts.length === 0) break;

      for (const alert of activeAlerts) {
        checkedCount++;

        // Fetch the product's current price
        const { data: product } = await supabase
          .from("products")
          .select("current_price, product_status")
          .eq("id", alert.product_id)
          .maybeSingle();

        if (!product || product.product_status !== "active") continue;

        const currentPrice = Number(product.current_price);
        const targetPrice = Number(alert.target_price);

        if (currentPrice <= targetPrice) {
          // Check if this alert already triggered at this price level
          // (idempotent: don't re-trigger if last_triggered_at exists and price hasn't risen above target since)
          if (alert.last_triggered_at) {
            // Already triggered — skip to avoid duplicate events
            // The alert will be eligible to trigger again only if the price rises above target
            // and then falls back. The scraper updates prices, so this check prevents re-triggering.
            continue;
          }

          // Create a price_alert_events record
          const { error: eventError } = await supabase
            .from("price_alert_events")
            .insert({
              alert_id: alert.id,
              product_id: alert.product_id,
              user_id: alert.user_id,
              current_price: currentPrice,
              target_price: targetPrice,
              triggered_at: now,
              is_seen: false,
            });

          if (!eventError) {
            // Update the alert's last_triggered_at
            await supabase
              .from("price_alerts")
              .update({ last_triggered_at: now, updated_at: now })
              .eq("id", alert.id);
            triggeredCount++;
          }
        } else {
          // Price is above target — reset last_triggered_at so the alert can fire again
          // when the price drops below target next time
          if (alert.last_triggered_at) {
            await supabase
              .from("price_alerts")
              .update({ last_triggered_at: null, updated_at: now })
              .eq("id", alert.id);
          }
        }
      }

      if (activeAlerts.length < batchSize) break;
      offset += batchSize;
    }

    return jsonResponse({
      success: true,
      checked: checkedCount,
      triggered: triggeredCount,
      checked_at: now,
      message: `${checkedCount} alarm kontrol edildi, ${triggeredCount} alarm tetiklendi.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
