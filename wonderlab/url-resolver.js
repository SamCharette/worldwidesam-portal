const PUBLIC_ROOT = 'https://worldwidesam.net/';

function isPublicHostname(hostname) {
  return hostname === 'worldwidesam.net' || hostname.endsWith('.worldwidesam.net');
}

function localHostname(hostname) {
  const unwrapped = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  if (unwrapped === 'localhost' || unwrapped === '127.0.0.1' || unwrapped === '::1') return '127.0.0.1';
  return unwrapped.includes(':') ? `[${unwrapped}]` : unwrapped;
}

export function linkMode(locationLike) {
  const requested = new URLSearchParams(locationLike.search || '').get('links');
  if (requested === 'public' || requested === 'local') return requested;
  return isPublicHostname(locationLike.hostname) ? 'public' : 'local';
}

export function resolveAppUrl(app, locationLike = window.location) {
  if (app.publicUrl?.startsWith('/')) return new URL(app.publicUrl, locationLike.origin).href;
  if (linkMode(locationLike) === 'public') return app.publicUrl || null;
  if (app.localPort) return `http://${localHostname(locationLike.hostname)}:${app.localPort}/`;
  return app.publicUrl ? new URL(app.publicUrl, locationLike.origin).href : null;
}

export function resolveOrbitUrl(locationLike = window.location) {
  if (linkMode(locationLike) === 'public') return PUBLIC_ROOT;
  return `http://${localHostname(locationLike.hostname)}:4178/`;
}
