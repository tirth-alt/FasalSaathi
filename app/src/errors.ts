import { ApiError } from './api/client';
import { translate } from './i18n';
import type { Lang } from './i18n';

/** Map any thrown error to a friendly, localized message for the UI. */
export function errText(e: unknown, lang: Lang): string {
  if (e instanceof ApiError) {
    if (e.code === 'network_error') return translate('cantReachServer', lang);
    if (e.code === 'invalid_credentials') return translate('errBadLogin', lang);
    if (e.code === 'email_taken') return translate('errPhoneTaken', lang);
    if (e.status > 0 && e.message) return e.message;
  }
  return translate('somethingWrong', lang);
}
