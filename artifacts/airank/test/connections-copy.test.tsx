import { describe, expect, it } from 'vitest';
import { connectionsCopy, googleImportDiagnostic, googleImportError } from '../src/lib/connections-copy';

describe('Google import diagnostics', () => {
  it('preserves safe category codes and structured details with localized guidance', () => {
    const diagnostics = [
      ['GOOGLE_IMPORT_FAILED category=api_disabled http=403 status=PERMISSION_DENIED reason=SERVICE_DISABLED', 'GOOGLE_API_DISABLED'],
      ['GOOGLE_IMPORT_FAILED category=authentication http=400 reason=invalid_grant', 'GOOGLE_RECONNECT_REQUIRED'],
      ['GOOGLE_IMPORT_FAILED category=permission http=403', 'GOOGLE_ACCESS_DENIED'],
      ['GOOGLE_IMPORT_FAILED category=quota http=429 status=RESOURCE_EXHAUSTED reason=quotaExceeded', 'GOOGLE_QUOTA_LIMIT'],
      ['GOOGLE_IMPORT_FAILED category=invalid_request http=400 status=INVALID_ARGUMENT', 'GOOGLE_REPORT_INVALID'],
      ['GOOGLE_IMPORT_FAILED category=report_incompatible reason=METRIC_DIMENSION_INCOMPATIBLE', 'GOOGLE_REPORT_INVALID'],
      ['GOOGLE_IMPORT_FAILED category=unavailable http=503', 'GOOGLE_TEMPORARILY_UNAVAILABLE'],
    ];
    for (const [diagnostic, code] of diagnostics) {
      expect(googleImportDiagnostic(diagnostic)).toBe(diagnostic);
      expect(googleImportDiagnostic(code)).toBe(code);
      for (const locale of ['en', 'fi'] as const) {
        expect(googleImportError(diagnostic, locale)).toBe(googleImportError(code, locale));
        expect(googleImportError(diagnostic, locale)).not.toContain('category=');
      }
    }
  });

  it('never exposes arbitrary text, prefix lookalikes, prototype keys or diagnostic suffixes', () => {
    for (const value of [
      'Bearer secret', 'GOOGLE_API_DISABLED token=secret', 'toString', '__proto__',
      'GOOGLE_IMPORT_FAILED category=secret',
      'GOOGLE_IMPORT_FAILED category=permission http=200',
      'GOOGLE_IMPORT_FAILED category=permission status=SECRET',
      'GOOGLE_IMPORT_FAILED category=permission reason=ACCESS_TOKEN_secret',
      'GOOGLE_IMPORT_FAILED category=permission message=secret',
      'GOOGLE_IMPORT_FAILED category=permission\nBearer secret',
      'GOOGLE_IMPORT_FAILED category=permission\n',
      'x'.repeat(10000),
    ]) {
      expect(googleImportDiagnostic(value)).toBeNull();
      for (const locale of ['en', 'fi'] as const) {
        expect(googleImportError(value, locale)).toBe(googleImportError('GOOGLE_IMPORT_FAILED', locale));
      }
    }
    for (const value of [null, undefined, true, 42, { access_token: 'secret' }]) {
      expect(googleImportDiagnostic(value)).toBeNull();
    }
  });

  it('keeps transport and parser failures actionable in both languages without inventing permissions', () => {
    for (const category of ['transport', 'invalid_response']) {
      for (const locale of ['en', 'fi'] as const) {
        const message = googleImportError(`GOOGLE_IMPORT_FAILED category=${category}`, locale);
        expect(message).not.toBe(googleImportError('GOOGLE_IMPORT_FAILED', locale));
        expect(message).not.toContain('category=');
      }
    }
    for (const key of ['authorizedNoProperty', 'propertyNoImport', 'authorizedNoImport', 'authorizedImportFailed', 'importedReady'] as const) {
      expect(connectionsCopy.en[key]).not.toBe(connectionsCopy.fi[key]);
    }
  });
});
