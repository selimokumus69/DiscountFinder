import { createClient } from "npm:@supabase/supabase-js@2";

/*
# recalculate-deal-scores Edge Function

Triggers the recalculate_deal_scores() Postgres RPC which computes deal scores
for all active products in a single database operation. This approach avoids
per-product update latency and completes in seconds.

Requires admin authentication (Bearer token).
Idempotent: safe to run multiple times.
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
    const { data, error } = await supabase.rpc("recalculate_deal_scores");

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    const result = Array.isArray(data) && data.length > 0 ? data[0] : data as Record<string, number> | null;

    return jsonResponse({
      success: true,
      processed: result?.processed ?? 0,
      ratings: {
        legendary: result?.legendary ?? 0,
        excellent: result?.excellent ?? 0,
        good: result?.good_rating ?? 0,
        average: result?.average_rating ?? 0,
        bad: result?.bad_rating ?? 0,
      },
      calculated_at: new Date().toISOString(),
      message: `${result?.processed ?? 0} ürünün fırsat skoru hesaplandı.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
