import type { Dict } from '@/i18n';
import { trackingErrorMessage } from './daily-tracking';

export interface ApiFailure {
  status: number | null;
  code: string | null;
  fieldErrors: Record<string, unknown> | null;
}

/** Reads the nested `{ error: { code, fieldErrors } }` envelope from generated-client ApiErrors. */
export function readApiError(err: unknown): ApiFailure {
  if (!err || typeof err !== 'object') return { status: null, code: null, fieldErrors: null };
  const e = err as { status?: unknown; data?: unknown };
  const status = typeof e.status === 'number' ? e.status : null;
  let code: string | null = null;
  let fieldErrors: Record<string, unknown> | null = null;
  const data = e.data as { error?: { code?: unknown; fieldErrors?: unknown } } | null | undefined;
  if (data && typeof data === 'object' && data.error && typeof data.error === 'object') {
    if (typeof data.error.code === 'string') code = data.error.code;
    if (data.error.fieldErrors && typeof data.error.fieldErrors === 'object') fieldErrors = data.error.fieldErrors as Record<string, unknown>;
  }
  return { status, code, fieldErrors };
}

export function isStatus(err: unknown, status: number) {
  return readApiError(err).status === status;
}

/** Localised message for a failed write. Never echoes server internals. */
export function writeErrorMessage(err: unknown, d: Dict): string {
  const { status, code } = readApiError(err);
  const tracked = trackingErrorMessage(err, d.auth.trackingLocale === 'fi' ? 'fi' : 'en');
  if (tracked) return tracked;
  if (status === 401 || code === 'AUTH_REQUIRED') return d.auth.expired;
  if (status === 403 || code === 'CSRF_INVALID') return d.auth.csrf;
  if (status === 404 || code === 'NOT_FOUND') return d.auth.notFound;
  if (status === 409 || code === 'VERSION_CONFLICT') return d.auth.conflictBody;
  if (status === 422 || code === 'VALIDATION_FAILED') return d.auth.validationServer;
  if (code === 'APP_NOT_CONFIGURED') return d.auth.notConfigured;
  if (status === 503 || code === 'UPSTREAM_UNAVAILABLE') return d.auth.unavailableBody;
  return d.auth.writeFailed;
}
