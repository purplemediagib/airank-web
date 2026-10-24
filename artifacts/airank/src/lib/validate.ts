import type { Dict } from '@/i18n';

export interface ProjectDraft {
  brand: string;
  domain: string;
  category: string;
  aliases: string;
}
export const emptyDraft: ProjectDraft = { brand: '', domain: '', category: '', aliases: '' };

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*\.[a-z]{2,}$/i;

export function validateDraft(v: ProjectDraft, d: Dict, t: (s: string, vars?: Record<string, string | number>) => string) {
  const e: Partial<Record<keyof ProjectDraft, string>> = {};
  const brand = v.brand.trim();
  if (!brand) e.brand = d.validation.required;
  else if (brand.length < 2) e.brand = t(d.validation.min, { min: 2 });
  else if (brand.length > 100) e.brand = t(d.validation.max, { max: 100 });
  const domain = v.domain.trim().toLowerCase();
  if (!domain) e.domain = d.validation.required;
  else if (!DOMAIN_RE.test(domain)) e.domain = d.validation.domain;
  const cat = v.category.trim();
  if (!cat) e.category = d.validation.required;
  else if (cat.length < 8) e.category = t(d.validation.min, { min: 8 });
  else if (cat.length > 240) e.category = t(d.validation.max, { max: 240 });
  else if (/https?:|www\./i.test(cat) || (brand && cat.toLowerCase().includes(brand.toLowerCase())) || (domain && cat.toLowerCase().includes(domain)))
    e.category = d.validation.categoryBrand;
  const aliases = v.aliases.split(',').map((a) => a.trim()).filter(Boolean);
  if (aliases.length > 8) e.aliases = d.validation.aliasesMax;
  else if (aliases.some((a) => a.length < 2 || a.length > 100)) e.aliases = d.validation.aliasLength;
  return e;
}
