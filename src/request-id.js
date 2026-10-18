let sequence = 0;

// Correlation IDs, not credentials. randomUUID requires a secure context;
// getRandomValues also works on HTTP LAN installations of Lumiverse.
export function createRequestId(cryptoApi = globalThis.crypto) {
  try {
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  } catch { /* Some embedded browsers expose but restrict the method. */ }
  try {
    if (typeof cryptoApi?.getRandomValues === 'function') {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
      return `bw-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
    }
  } catch { /* Keep requests usable even without Web Crypto. */ }
  return `bw-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
