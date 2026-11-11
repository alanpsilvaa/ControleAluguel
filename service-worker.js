const CACHE_NAME = 'controle-aluguel-v14';
const APP_SHELL = [
    './',
    './index.html',
    './casas.html',
    './extrato.html',
    './styles.css?v=20261111-3',
    './app.js?v=20261019-4',
    './casas.js?v=20261111-6',
    './extrato.js?v=20261111-10',
    './importar-contas.js?v=20261019-14',
    './supabase.js?v=20261018-8',
    './pwa.js',
    './manifest.webmanifest',
    './app-icon.svg',
    './app-icon-192.png',
    './app-icon-512.png',
    './casa1.jpg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.filter(name => name.startsWith('controle-aluguel-') && name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                try {
                    const response = await fetch(request);
                    if (response.ok || response.type === 'opaque') {
                        await cache.put(request, response.clone());
                    }
                    return response;
                } catch (error) {
                    const cached = await cache.match(request);
                    if (cached) return cached;
                    throw error;
                }
            })
        );
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(async () => {
                    const cachedPage = await caches.match(request);
                    return cachedPage || caches.match('./casas.html');
                })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            const refresh = fetch(request).then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            });
            return cached || refresh;
        })
    );
});
