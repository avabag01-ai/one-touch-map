const CACHE_NAME = 'one-touch-map-v1';
const DATA_CACHE_NAME = 'one-touch-map-data-v1';

// 캐시할 파일 목록 (앱 실행에 필수)
const FILES_TO_CACHE = [
    './',
    './index.html',
    './list.html',
    './map.html',
    './settings.html',
    './main-style.css',
    './list-style.css',
    './main-app.js',
    './ocr-app.js',
    './list-app.js',
    './map-app.js',
    './anchor-system.js',
    './route-optimizer.js',
    './icon-192.png',
    './icon-512.png',
    './manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/tesseract.js@v2.1.0/dist/tesseract.min.js',
    'https://unpkg.com/tesseract.js@v2.1.0/dist/worker.min.js'
];

self.addEventListener('install', (evt) => {
    console.log('[ServiceWorker] 설치 중...');
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] 앱 기본 파일 캐싱 완료');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
    console.log('[ServiceWorker] 활성화');
    evt.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                    console.log('[ServiceWorker] 구형 캐시 삭제:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
    const url = new URL(evt.request.url);

    // 1. 지도 이미지 (Tiles) 캐싱
    if (url.href.includes('api.vworld.kr') || url.href.includes('google.com/vt') || url.href.includes('mt0.google.com') || url.href.includes('openstreetmap.org') || url.href.includes('.png') || url.href.includes('.jpeg')) {
        evt.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(evt.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    return fetch(evt.request).then((networkResponse) => {
                        cache.put(evt.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => {
                        // 네트워크 실패 시 (오프라인) 조용히 빈 응답 반환 (오류 메시지 억제)
                        return new Response('', { status: 200, statusText: 'Offline' });
                    });
                });
            })
        );
        return;
    }

    // 2. 일반 앱 파일 (HTML, JS 등)
    evt.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(evt.request).then((response) => {
                return response || fetch(evt.request).catch(() => {
                    // 오프라인이면서 캐시에도 없는 경우 index.html 반환 (SPA 지원)
                    if (evt.request.mode === 'navigate') {
                        return cache.match('./index.html');
                    }
                });
            });
        })
    );
});