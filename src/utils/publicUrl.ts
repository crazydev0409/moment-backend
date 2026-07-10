import { Request } from 'express';

/**
 * OAuth redirect URIs must exactly match what's registered with Google/
 * Microsoft's developer console, so calendar OAuth callbacks always need
 * the real production URL — even when testing locally, since only that
 * one is actually registered. OAUTH_REDIRECT_BASE_URL exists for that
 * narrow reason and is deliberately set to the production host in every
 * environment's .env, local dev included.
 */
export function buildOAuthRedirectBaseUrl(req: Request): string {
  if (process.env.OAUTH_REDIRECT_BASE_URL) {
    return process.env.OAUTH_REDIRECT_BASE_URL.replace(/\/+$/, '');
  }
  return requestDerivedBaseUrl(req);
}

/**
 * The base URL of *this actual running instance* — for links that must
 * point at wherever the request was really handled (e.g. an uploaded
 * file's URL), which is the opposite requirement from the OAuth case
 * above: it must resolve to the local server during local dev, not
 * always production, since that's genuinely where the file lives.
 */
export function buildInstanceBaseUrl(req: Request): string {
  return requestDerivedBaseUrl(req);
}

function requestDerivedBaseUrl(req: Request): string {
  // Reads the header directly rather than relying solely on Express's
  // `trust proxy` setting, so this is correct regardless of that config —
  // Azure App Service's reverse proxy forwards the original scheme here
  // even though the container itself only ever sees a plain http:// hop.
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0] : req.protocol;
  return `${protocol}://${req.get('host')}`;
}
