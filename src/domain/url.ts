export interface InspectedUrl {
  url: string;
  sensitive: boolean;
  safeUrl: string;
  removedTracking: boolean;
}

const trackingKeys = /^(utm_.+|fbclid|gclid|dclid|msclkid|gbraid|wbraid|mc_cid|mc_eid|_ga|_gl)$/i;
const sensitiveKeys =
  /^(access[_-]?token|refresh[_-]?token|id[_-]?token|token|auth|authorization|auth[_-]?token|auth[_-]?code|code|api[_-]?key|secret|client[_-]?secret|password|passwd|signature|sig|session[_-]?id|session|jwt|x-amz-signature|x-amz-credential|x-amz-security-token|x-goog-signature|x-goog-credential)$/i;
const jwtValue = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function removeSecrets(params: URLSearchParams): boolean {
  let found = false;
  for (const [key, value] of Array.from(params.entries())) {
    if (sensitiveKeys.test(key) || jwtValue.test(value)) {
      params.delete(key);
      found = true;
    }
  }
  return found;
}

/** Deliberately preserve ordinary query parameters, their order, and anchors. */
export function inspectUrl(raw: string): InspectedUrl {
  if (typeof raw !== 'string' || raw.length > 8192 || !raw.trim()) {
    throw new Error('INVALID_URL');
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error('INVALID_URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('UNSUPPORTED_URL');
  }
  parsed.username = '';
  parsed.password = '';
  let removedTracking = false;
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (trackingKeys.test(key)) {
      parsed.searchParams.delete(key);
      removedTracking = true;
    }
  }
  const url = parsed.href;
  const safe = new URL(url);
  let sensitive = removeSecrets(safe.searchParams);
  const hash = safe.hash.slice(1);
  const question = hash.indexOf('?');
  const hashParams = question >= 0 ? hash.slice(question + 1) : hash;
  if (hashParams.includes('=')) {
    const params = new URLSearchParams(hashParams);
    if (removeSecrets(params)) {
      sensitive = true;
      const remainder = params.toString();
      safe.hash = question >= 0 ? hash.slice(0, question) + (remainder ? `?${remainder}` : '') : remainder;
    }
  }
  return { url, safeUrl: sensitive ? safe.href : url, sensitive, removedTracking };
}
