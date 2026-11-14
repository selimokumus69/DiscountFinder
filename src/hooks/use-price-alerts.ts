import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import type { PriceAlert, PriceAlertEvent, Product } from '@/types/database';

export function usePriceAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertProductIds, setAlertProductIds] = useState<Set<string>>(new Set());
  const [unseenEventCount, setUnseenEventCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, [user]);

  async function loadAlerts() {
    if (!user) {
      setAlerts([]);
      setAlertProductIds(new Set());
      setUnseenEventCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('price_alerts')
      .select('*, product:products(*, brand:brands(*), category:categories(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const alertData = (data as PriceAlert[]) ?? [];
    setAlerts(alertData);
    setAlertProductIds(new Set(alertData.filter((a) => a.is_active).map((a) => a.product_id)));

    // Count unseen events
    const { count } = await supabase
      .from('price_alert_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_seen', false);
    setUnseenEventCount(count ?? 0);

    setLoading(false);
  }

  const createAlert = useCallback(
    async (productId: string, targetPrice: number): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Giriş yapmanız gerekli' };

      const { error } = await supabase
        .from('price_alerts')
        .upsert(
          {
            user_id: user.id,
            product_id: productId,
            target_price: targetPrice,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,product_id' },
        );

      if (error) {
        return { error: error.message };
      }

      await loadAlerts();
      return { error: null };
    },
    [user],
  );

  const updateAlert = useCallback(
    async (alertId: string, targetPrice: number): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Giriş yapmanız gerekli' };

      const { error } = await supabase
        .from('price_alerts')
        .update({ target_price: targetPrice, is_active: true, updated_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) return { error: error.message };
      await loadAlerts();
      return { error: null };
    },
    [user],
  );

  const deleteAlert = useCallback(
    async (alertId: string): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Giriş yapmanız gerekli' };

      const { error } = await supabase
        .from('price_alerts')
        .delete()
        .eq('id', alertId);

      if (error) return { error: error.message };
      await loadAlerts();
      return { error: null };
    },
    [user],
  );

  const markEventsSeen = useCallback(async (): Promise<void> => {
    if (!user) return;
    await supabase
      .from('price_alert_events')
      .update({ is_seen: true })
      .eq('user_id', user.id)
      .eq('is_seen', false);
    setUnseenEventCount(0);
  }, [user]);

  const getAlertForProduct = useCallback(
    (productId: string): PriceAlert | null => {
      return alerts.find((a) => a.product_id === productId && a.is_active) ?? null;
    },
    [alerts],
  );

  const loadAlertEvents = useCallback(async (): Promise<PriceAlertEvent[]> => {
    if (!user) return [];
    const { data } = await supabase
      .from('price_alert_events')
      .select('*, product:products(*, brand:brands(*), category:categories(*))')
      .eq('user_id', user.id)
      .order('triggered_at', { ascending: false })
      .limit(20);
    return (data as PriceAlertEvent[]) ?? [];
  }, [user]);

  return {
    alerts,
    alertProductIds,
    unseenEventCount,
    loading,
    createAlert,
    updateAlert,
    deleteAlert,
    markEventsSeen,
    getAlertForProduct,
    loadAlertEvents,
    reload: loadAlerts,
  };
}

export type AlertStatus = 'waiting' | 'approaching' | 'triggered';

export function getAlertStatus(
  currentPrice: number,
  targetPrice: number,
  lastTriggeredAt: string | null,
): AlertStatus {
  if (lastTriggeredAt && currentPrice <= targetPrice) return 'triggered';
  const diff = currentPrice - targetPrice;
  const ratio = diff / currentPrice;
  if (ratio <= 0.05) return 'approaching';
  return 'waiting';
}

export function getAlertStatusConfig(status: AlertStatus): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'triggered':
      return { label: 'Alarm Tetiklendi', color: 'text-red-600', bgColor: 'bg-red-50' };
    case 'approaching':
      return { label: 'Fiyat Yaklaşıyor', color: 'text-amber-600', bgColor: 'bg-amber-50' };
    default:
      return { label: 'Fiyat Bekleniyor', color: 'text-neutral-500', bgColor: 'bg-neutral-50' };
  }
}
