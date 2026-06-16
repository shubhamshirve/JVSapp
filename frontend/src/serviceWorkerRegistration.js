/* PWA service-worker registration helper */
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL || ''}/service-worker.js`;
      if (isLocalhost) {
        checkValidSW(swUrl, config);
        navigator.serviceWorker.ready.then(() => {
          console.log('[PWA] Service worker ready (development).');
        });
      } else {
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker.register(swUrl).then(registration => {
    registration.onupdatefound = () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.onstatechange = () => {
        if (worker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            console.log('[PWA] Update available — refresh to apply.');
            config?.onUpdate?.(registration);
          } else {
            console.log('[PWA] Cached for offline use.');
            config?.onSuccess?.(registration);
          }
        }
      };
    };
  }).catch(err => console.error('[PWA] Registration failed:', err));
}

function checkValidSW(swUrl, config) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then(res => {
      const ct = res.headers.get('content-type');
      if (res.status === 404 || (ct && !ct.includes('javascript'))) {
        navigator.serviceWorker.ready.then(r => r.unregister()).then(() => window.location.reload());
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => console.log('[PWA] No internet — running offline.'));
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(r => r.unregister())
      .catch(err => console.error(err));
  }
}
