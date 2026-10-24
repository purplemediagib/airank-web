import { useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';

/** URL query state so filters/tabs survive reload, back/forward and locale switches. */
export function useQueryParam(name: string, fallback: string): [string, (v: string) => void] {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const value = new URLSearchParams(search).get(name) ?? fallback;
  const set = useCallback(
    (v: string) => {
      const p = new URLSearchParams(window.location.search);
      if (v === fallback || v === '') p.delete(name);
      else p.set(name, v);
      const qs = p.toString();
      navigate(`${location}${qs ? `?${qs}` : ''}${window.location.hash}`, { replace: name !== 'tab' });
    },
    [name, fallback, location, navigate],
  );
  return [value, set];
}
