import { useEffect, useState } from 'react';

function faviconUrl(domain: string) {
  try {
    const input = domain.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) return null;
    return `https://${hostname}/favicon.ico`;
  } catch {
    return null;
  }
}

/** Loads only the selected public website's standard favicon; failures fall back to the brand initial. */
export function WebsiteFavicon({ domain, brand, className = 'size-9' }: { domain?: string; brand: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = domain ? faviconUrl(domain) : null;
  const initial = [...(brand.trim() || '?')][0].toLocaleUpperCase();
  useEffect(() => setFailed(false), [src]);

  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white font-semibold text-navy ${className}`}>
      {src && !failed
        ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-contain p-1" onError={() => setFailed(true)} />
        : <span>{initial}</span>}
    </span>
  );
}
