import { useState, useEffect, useCallback } from 'react';
import { apiMyFavorites, apiAddFavorite, apiRemoveFavorite } from '../services/api';
import { useAuth } from './useAuth';

export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setFavoriteIds(new Set()); return; }
    setLoading(true);
    apiMyFavorites()
      .then(ids => setFavoriteIds(new Set(ids)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const toggle = useCallback(async (eventId, currentCount, setCount) => {
    if (!user) return false; // signal: need login
    const isFav = favoriteIds.has(eventId);
    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(eventId); else next.add(eventId);
      return next;
    });
    if (setCount) setCount(c => isFav ? c - 1 : c + 1);
    try {
      if (isFav) await apiRemoveFavorite(eventId);
      else await apiAddFavorite(eventId);
    } catch {
      // Revert on error
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (isFav) next.add(eventId); else next.delete(eventId);
        return next;
      });
      if (setCount) setCount(c => isFav ? c + 1 : c - 1);
    }
    return true;
  }, [user, favoriteIds]);

  return { favoriteIds, toggle, loading };
}
