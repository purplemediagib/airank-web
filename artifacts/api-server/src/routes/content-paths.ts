/** Exact Content Studio routes from the deployed 0.22.0 contract.
 * Keep this isolated from the unrelated application's 64 KiB request limit.
 */
const id = '[a-zA-Z0-9-]{1,80}';
const base = `/v1/projects/${id}/content`;
const rules = [
  ['GET', '/v1/app/content-projects'],
  ['GET', base],
  ['GET', `${base}/documents(?:/${id}(?:/(?:revisions|export))?)?`],
  ['POST', `${base}/documents(?:/${id}/(?:restore|review|apply|published))?`],
  ['PATCH', `${base}/documents/${id}`],
  ['GET', `${base}/(?:brand|settings|access|cms|usage|events)`],
  ['PUT', `${base}/(?:brand|settings|access|cms)`],
  ['GET', `${base}/cms/items`],
  ['GET', `${base}/jobs(?:/${id})?`],
  ['POST', `${base}/jobs(?:/${id}/(?:cancel|retry))?`],
  ['POST', `${base}/bulk`],
  ['GET', `${base}/comments`],
  ['POST', `${base}/comments`],
  ['PATCH', `${base}/comments/${id}`],
  ['GET', `${base}/(?:sources|opportunities|publications|assessments)(?:/${id})?`],
  ['PATCH', `${base}/opportunities/${id}`],
  ['POST', `${base}/publications/${id}/reconcile`],
].map(([method, path]) => [method, new RegExp(`^${path}$`)] as const);

export function isContentRoute(method: string, path: string) {
  return rules.some(([verb, pattern]) => method === verb && pattern.test(path));
}
export function contentQueryKeys(path: string): string[] {
  if (new RegExp(`^${base}/cms/items$`).test(path)) return ['page', 'search', 'type'];
  if (new RegExp(`^${base}/comments$`).test(path)) return ['documentId'];
  return [];
}
