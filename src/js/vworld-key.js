// VWorld 인증키 원격 로더
// 키가 만료/교체되면 GitHub Pages의 key.js 한 줄만 수정해서 push → 앱 재빌드/재심사 없이 모든 기기에 반영.
// 동작: 부팅 시 localStorage 캐시(없으면 번들 폴백)로 window.__VW_KEY__를 '즉시' 설정(네트워크 대기 없음)
//       → 원격 key.js를 비차단으로 불러와 최신 키로 갱신 + 캐시. 원격 실패 시 캐시/폴백 그대로.
(function () {
    var FALLBACK = '259F9CF5-8FAE-303B-8D16-A8F8B7B9C46D'; // 번들 최종 폴백(오프라인/원격 다운 대비)
    var cached = null;
    try { cached = localStorage.getItem('vworldKeyCache'); } catch (e) { }
    window.__VW_KEY__ = (cached && cached.length >= 10) ? cached : FALLBACK;

    // 원격 key.js가 호출하는 갱신 함수
    window.__setVworldKey__ = function (k) {
        if (k && typeof k === 'string' && k.length >= 10) {
            window.__VW_KEY__ = k;
            try { localStorage.setItem('vworldKeyCache', k); } catch (e) { }
        }
    };

    // 원격 키 로드 (script 태그 = CORS 무관, 비차단). 실패해도 앱은 캐시/폴백으로 정상 동작.
    try {
        var s = document.createElement('script');
        s.src = 'https://avabag01-ai.github.io/one-touch-map/key.js?t=' + (new Date().getTime());
        s.async = true;
        s.onerror = function () { };
        (document.head || document.documentElement).appendChild(s);
    } catch (e) { }
})();
