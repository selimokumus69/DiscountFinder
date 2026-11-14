/*
# Create Price Alerts System

## Purpose
Adds a price alert system so users can be notified when a product's price drops
to or below a target they set. Two new tables: `price_alerts` (user settings)
and `price_alert_events` (trigger history for future push/email/Telegram integration).

## New Tables

### 1. price_alerts
- `id` (uuid, primary key)
- `user_id` (uuid, not null, references auth.users, ON DELETE CASCADE)
- `product_id` (uuid, not null, references products, ON DELETE CASCADE)
- `target_price` (numeric, not null) — price the user wants to be notified at
- `is_active` (boolean, not null, default true)
- `last_triggered_at` (timestamptz, nullable) — when the alert last fired
- `created_at` (timestamptz, not null, default now())
- `updated_at` (timestamptz, not null, default now())

Unique constraint: (user_id, product_id) — one active alert per user per product.

### 2. price_alert_events
- `id` (uuid, primary key)
- `alert_id` (uuid, not null, references price_alerts, ON DELETE CASCADE)
- `product_id` (uuid, not null, references products, ON DELETE CASCADE)
- `user_id` (uuid, not null, references auth.users, ON DELETE CASCADE)
- `current_price` (numeric, not null) — price at time of trigger
- `target_price` (numeric, not null) — the alert's target
- `triggered_at` (timestamptz, not null, default now())
- `is_seen` (boolean, not null, default false) — user has seen this event

## Security
- Both tables have RLS enabled.
- Both tables grant CRUD to `authenticated` only (the app requires sign-in for alerts).
- `service_role` gets CRUD on both tables for the edge function.
- price_alerts: owner-scoped CRUD — auth.uid() = user_id for all verbs.
- price_alert_events: users can SELECT and UPDATE (is_seen) their own events;
  INSERT is granted to authenticated but the edge function (service_role) does the inserting.
  Users cannot DELETE or INSERT events directly — only the system creates events.

## Important Notes
1. The `user_id` column on price_alerts defaults to auth.uid() so frontend inserts
   that omit user_id still work.
2. An index on (user_id, is_active) enables efficient "my active alerts" queries.
3. An index on (is_active) on price_alerts enables the edge function to scan all
   active alerts efficiently.
4. The check-price-alerts edge function inserts into price_alert_events using the
   service role key, bypassing RLS.
*/
CREATE TABLE IF NOT EXISTS price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS price_alerts_user_product_unique
  ON price_alerts (user_id, product_id);
CREATE INDEX IF NOT EXISTS price_alerts_user_active_idx
  ON price_alerts (user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS price_alerts_active_idx
  ON price_alerts (is_active) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON price_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON price_alerts TO service_role;

DROP POLICY IF EXISTS "select_own_alerts" ON price_alerts;
CREATE POLICY "select_own_alerts"
ON price_alerts FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_alerts" ON price_alerts;
CREATE POLICY "insert_own_alerts"
ON price_alerts FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_alerts" ON price_alerts;
CREATE POLICY "update_own_alerts"
ON price_alerts FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_alerts" ON price_alerts;
CREATE POLICY "delete_own_alerts"
ON price_alerts FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- price_alert_events
CREATE TABLE IF NOT EXISTS price_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES price_alerts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_price numeric NOT NULL,
  target_price numeric NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  is_seen boolean NOT NULL DEFAULT false
);

ALTER TABLE price_alert_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS price_alert_events_user_idx
  ON price_alert_events (user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS price_alert_events_unseen_idx
  ON price_alert_events (user_id) WHERE is_seen = false;

GRANT SELECT, UPDATE ON price_alert_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON price_alert_events TO service_role;

DROP POLICY IF EXISTS "select_own_events" ON price_alert_events;
CREATE POLICY "select_own_events"
ON price_alert_events FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_events" ON price_alert_events;
CREATE POLICY "update_own_events"
ON price_alert_events FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
