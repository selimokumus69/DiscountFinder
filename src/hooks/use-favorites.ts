import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import type { Product } from '@/types/database';

const GUEST_FAVORS_KEY = 'guest_favorites';

export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [user]);

  async function loadFavorites() {
    setLoading(true);
    if (user) {
      const { data } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', user.id);
      setFavoriteIds(new Set((data ?? []).map((f: { product_id: string }) => f.product_id)));
    } else {
      const stored = localStorage.getItem(GUEST_FAVORS_KEY);
      setFavoriteIds(new Set(stored ? JSON.parse(stored) : []));
    }
    setLoading(false);
  }

  const toggleFavorite = useCallback(
    async (product: Product) => {
      if (user) {
        const wasFavorite = favoriteIds.has(product.id);
        // Optimistic update
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) {
            next.delete(product.id);
          } else {
            next.add(product.id);
          }
          return next;
        });

        // Server sync with rollback on error
        const { error } = wasFavorite
          ? await supabase
              .from('favorites')
              .delete()
              .eq('user_id', user.id)
              .eq('product_id', product.id)
          : await supabase
              .from('favorites')
              .insert({ user_id: user.id, product_id: product.id });

        if (error) {
          // Rollback on failure
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            if (wasFavorite) {
              next.add(product.id);
            } else {
              next.delete(product.id);
            }
            return next;
          });
        }
      } else {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (next.has(product.id)) {
            next.delete(product.id);
          } else {
            next.add(product.id);
          }
          localStorage.setItem(GUEST_FAVORS_KEY, JSON.stringify([...next]));
          return next;
        });
      }
    },
    [user, favoriteIds]
  );

  return { favoriteIds, toggleFavorite, loading };
}
