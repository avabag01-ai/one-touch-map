// 주소빨리찾기V2 - 메인 화면
let addressBefore = '';
let selectedDate = new Date().toISOString().split('T')[0];
let addressAfter = '';
// 최근 주소 변환에서 받은 실좌표 (등록 시 저장해 지도 재지오코딩 오류 방지)
let lastGeoPoint = null;
let currentField = 'before'; // 'before' or 'after'
let selectedDong = '';
let isUrgent = false;
let settings = {};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    // PWA 서비스 워커 등록
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then((reg) => console.log('서비스 워커 등록 완료:', reg.scope))
            .catch((err) => console.log('서비스 워커 등록 실패:', err));
    }

    loadSettings();
    setupEventListeners();
    renderDongRadios();
    updateQuickSelect();
    updateRoadTypeSelect();
    if (typeof setupScanFeature === 'function') setupScanFeature();
});

// 설정 불러오기
function loadSettings() {
    const saved = localStorage.getItem('deliverySettings');
    if (saved) {
        settings = JSON.parse(saved);
    } else {
        // 기본값
        settings = {
            userName: '도도',
            mapSize: 3,
            dongs: ['전국코드', '중화동\n서울특별시\n중랑구', '묵동\n서울특별시\n중랑구', '망우동\n서울특별시\n중랑구', '신내동\n서울특별시\n중랑구', '상봉동\n서울특별시\n중랑구', '면목동\n서울특별시\n중랑구'],
            roads: []
        };
    }

    // '전국코드'가 아닌 첫 번째 동을 찾아서 선택
    if (settings.dongs && settings.dongs.length > 0) {
        // '전국코드'가 아닌 첫 번째 요소를 찾음
        const firstRealDong = settings.dongs.find(d => d !== '전국코드');

        if (firstRealDong) {
            selectedDong = firstRealDong;
        } else {
            // 만약 '전국코드' 밖에 없으면 어쩔 수 없이 첫 번째 선택
            selectedDong = settings.dongs[0];
        }
    }
}

// 이벤트 리스너
function setupEventListeners() {
    // 헤더 타이틀 클릭 시 날짜 선택 (오늘 날짜 기준 등록을 위해)
    const title = document.querySelector('.header-title');
    if (title) {
        title.style.cursor = 'pointer';
        title.addEventListener('click', () => {
            const picker = document.createElement('input');
            picker.type = 'date';
            picker.value = selectedDate;
            picker.onchange = (e) => {
                selectedDate = e.target.value;
                showToast(`등록 날짜가 ${selectedDate}로 설정되었습니다.`);
            };
            picker.showPicker();
        });
    }

    // 키패드 숫자/특수문자 - touchstart로 즉시 반응 (전화 키패드 수준)
    document.querySelectorAll('.key-num, .key-special').forEach(btn => {
        // 모바일: touchstart로 즉시 반응 (click의 300ms 지연 제거)
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // click 이벤트 중복 방지 + 300ms 지연 제거
            const value = btn.dataset.value;
            if (value !== undefined) handleKeyInput(value);
        }, { passive: false });
        // PC 폴백: click
        btn.addEventListener('click', (e) => {
            // touchstart가 이미 처리했으면 무시
            if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
            const value = btn.dataset.value;
            if (value !== undefined) handleKeyInput(value);
        });
    });

    // 배송 등록
    document.getElementById('registerBtn').addEventListener('click', registerDelivery);

    // 긴급 모드
    document.getElementById('urgentMode').addEventListener('change', (e) => {
        isUrgent = e.target.checked;
    });

    // 주소 입력 필드 클릭 (포커스 전환)
    document.getElementById('addressBefore').addEventListener('click', () => {
        currentField = 'before';
        updateFieldFocus();
    });

    document.getElementById('addressAfter').addEventListener('click', () => {
        currentField = 'after';
        updateFieldFocus();
    });

    // 찾기 버튼 (지번 → 도로명 변환) - 액션바 + 키패드 사이드 둘 다
    document.querySelectorAll('.btn-find, .btn-find-side').forEach(btn => {
        btn.addEventListener('click', searchAddress);
    });
}

// 키 입력 처리 - 항상 주소전(위 필드)에만 입력
function handleKeyInput(value) {
    if (value === '←') {
        addressBefore = addressBefore.slice(0, -1);
    } else {
        addressBefore += value;
    }
    currentField = 'before';
    updateDisplay();
}

// 화면 업데이트
function updateDisplay() {
    document.getElementById('addressBefore').value = addressBefore;
    document.getElementById('addressAfter').value = addressAfter;
}

// 필드 포커스 표시
function updateFieldFocus() {
    const beforeInput = document.getElementById('addressBefore');
    const afterInput = document.getElementById('addressAfter');

    if (currentField === 'before') {
        beforeInput.style.borderColor = '#2196F3';
        beforeInput.style.borderWidth = '2px';
        afterInput.style.borderColor = '#999';
        afterInput.style.borderWidth = '1px';
    } else {
        afterInput.style.borderColor = '#2196F3';
        afterInput.style.borderWidth = '2px';
        beforeInput.style.borderColor = '#999';
        beforeInput.style.borderWidth = '1px';
    }
}

// 동 라디오 버튼 렌더링
function renderDongRadios() {
    const container = document.getElementById('dongRadios');
    if (!container) return;
    container.innerHTML = '';

    // 1. 전국코드 버튼 생성 (맨 앞 고정)
    const nationalBtn = document.createElement('button');
    nationalBtn.className = 'national-btn';
    nationalBtn.textContent = '전국코드';
    nationalBtn.addEventListener('click', () => {
        showNationalRegionModal();
    });
    container.appendChild(nationalBtn);

    if (!settings.dongs || settings.dongs.length === 0) return;

    // 2. 동 버튼들 생성 (딱 동 이름만 표시)
    settings.dongs.forEach((dong) => {
        if (!dong || dong === '전국코드') return;

        const label = document.createElement('label');
        label.className = 'dong-radio';
        if (dong === selectedDong) label.classList.add('selected');

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'dong';
        radio.value = dong;
        radio.checked = dong === selectedDong;

        // 동 선택 시 즉시 주소 입력창에 반영
        const clickHandler = (e) => {
            selectedDong = dong;
            radio.checked = true;

            const dongName = extractDongName(dong);
            if (dongName && dongName !== '전국코드') {
                addressBefore = dongName + " ";
            } else {
                addressBefore = '';
            }
            addressAfter = '';
            lastGeoPoint = null;

            currentField = 'before';
            updateFieldFocus();
            updateDisplay();
            renderDongRadios();
            updateQuickSelect();
        };

        radio.addEventListener('click', clickHandler);

        const span = document.createElement('span');
        const dongLabel = dong.split('\n')[0]; // 다른 지역 정보 떼고 동 이름만
        span.textContent = dongLabel;

        label.appendChild(radio);
        label.appendChild(span);
        container.appendChild(label);
    });
}

// 동 이름 추출 함수 (개행문자 제거)
function extractDongName(dongString) {
    if (!dongString) return '';
    return dongString.split('\n')[0];
}

// 동별 도로명 캐시 (localStorage 영속 — 같은 동 재선택 시 API 재호출 안 함)
const ROAD_CACHE_KEY = 'onetouchmap_roadcache_v1';
let roadCache = {};
try { roadCache = JSON.parse(localStorage.getItem(ROAD_CACHE_KEY) || '{}'); } catch (e) { roadCache = {}; }

function saveRoadCache() {
    try { localStorage.setItem(ROAD_CACHE_KEY, JSON.stringify(roadCache)); } catch (e) { /* 용량 초과 등 무시 */ }
}

// 선택된 동의 시/도·구/군 컨텍스트 확보 (VWorld 조회 스코프용)
function resolveDongRegion(selected) {
    if (!selected) return null;
    const parts = selected.split('\n').map(s => s.trim()).filter(Boolean);
    const dong = parts[0];
    if (!dong || dong === '전국코드') return null;
    // selectedDong에 지역정보가 실려 있으면(예: '망우동\n서울특별시\n중랑구') 그대로 사용
    if (parts.length >= 3) return { sido: parts[1], gugun: parts[2], dong };
    // 없으면 전국 DB에서 동 이름으로 역검색
    if (typeof findRegionByDong === 'function') {
        const r = findRegionByDong(dong);
        if (r) return r;
    }
    return { sido: '', gugun: '', dong };
}

// VWorld로 해당 동의 도로명 목록을 긁어와 '대표 도로'만 빈도순으로 반환 (JSONP 페이징)
// 숫자 가지길(예: 망우로73길, 용마산로96길)은 제외 → 큰 도로 + 송림길 같은 대표 길만 남김
// ⚠ VWorld는 결과를 도로 코드순 뭉텅이로 주므로(송림길 등이 뒤쪽 페이지에 몰림) 끝까지 페이징해야 완전함
let _roadCbSeq = 0;
function fetchDongRoads(region, onDone) {
    const query = [region.sido, region.gugun, region.dong].filter(Boolean).join(' ');
    const apiKey = window.__VW_KEY__ || '259F9CF5-8FAE-303B-8D16-A8F8B7B9C46D';
    const MAX_PAGES = 12;                            // 폭주 방지 상한 (한 동당 최대 12,000건)
    const branchRe = /[0-9]+(가|나|다|라|마)?길$/;    // 숫자 가지길 판별
    const roadRe = /(\S+[로길])\s/;                  // 주소 문자열에서 도로명 토큰 추출
    const counter = {};

    const aggregate = (data) => {
        const items = (data && data.response && data.response.result && data.response.result.items) || [];
        items.forEach(it => {
            const road = it.address && it.address.road;
            // 그 동에 속한 주소만 집계 (다른 동 도로 배제)
            if (!road || road.indexOf(region.dong) === -1) return;
            const m = road.match(roadRe);
            if (m) counter[m[1]] = (counter[m[1]] || 0) + 1;
        });
    };
    const finish = () => {
        const roads = Object.keys(counter)
            .filter(n => !branchRe.test(n))
            .sort((a, b) => counter[b] - counter[a]);
        onDone(roads);
    };
    const loadPage = (page, onPageDone) => {
        const cb = 'roadListCb_' + (++_roadCbSeq);
        const script = document.createElement('script');
        window[cb] = function (data) {
            let total = 0;
            try {
                aggregate(data);
                total = parseInt(data && data.response && data.response.record && data.response.record.total, 10) || 0;
            } catch (e) { /* 파싱 실패 무시 */ }
            delete window[cb];
            if (script.parentNode) script.parentNode.removeChild(script);
            onPageDone(total);
        };
        script.onerror = function () {
            delete window[cb];
            if (script.parentNode) script.parentNode.removeChild(script);
            onPageDone(0);
        };
        script.src = `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=epsg:4326` +
            `&query=${encodeURIComponent(query)}&type=ADDRESS&category=ROAD&format=json&size=1000&page=${page}` +
            `&key=${apiKey}&callback=${cb}`;
        document.body.appendChild(script);
    };

    // 1페이지 먼저 조회해 전체 건수 파악 → 나머지 페이지 병렬 요청
    loadPage(1, (total) => {
        const pages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(total / 1000)));
        if (pages <= 1) { finish(); return; }
        let pending = pages - 1;
        for (let p = 2; p <= pages; p++) {
            loadPage(p, () => { if (--pending === 0) finish(); });
        }
    });
}

// 빠른 선택 (도로명) 업데이트 — 선택한 동의 실제 도로명을 VWorld에서 동적 로드
function updateQuickSelect() {
    const container = document.getElementById('quickSelect');
    container.innerHTML = '';

    const dongName = extractDongName(selectedDong);

    // 선택된 동 이름도 버튼으로 추가
    if (dongName && dongName !== '전국코드') {
        const dongBtn = document.createElement('button');
        dongBtn.className = 'quick-btn';
        dongBtn.textContent = dongName;
        dongBtn.addEventListener('click', () => {
            addressBefore = dongName + ' ';
            currentField = 'before';
            updateFieldFocus();
            updateDisplay();
        });
        container.appendChild(dongBtn);
    }

    const region = resolveDongRegion(selectedDong);
    if (!region) return;   // 전국코드 등 특정 동이 아니면 도로명 버튼 없음

    const cacheKey = [region.sido, region.gugun, region.dong].filter(Boolean).join(' ');

    // 도로명 클릭 → '동 도로명 ' 형태로 채워 검색 스코프를 그 동에 고정
    const renderRoads = (roads) => {
        roads.forEach(road => {
            const btn = document.createElement('button');
            btn.className = 'quick-btn';
            btn.textContent = road;
            btn.addEventListener('click', () => {
                addressBefore = region.dong + ' ' + road + ' ';
                currentField = 'before';
                updateFieldFocus();
                updateDisplay();
            });
            container.appendChild(btn);
        });
    };

    // 캐시 있으면 즉시 렌더
    if (roadCache[cacheKey]) {
        renderRoads(roadCache[cacheKey]);
        return;
    }

    // 없으면 로딩 표시 후 VWorld 조회
    const loading = document.createElement('span');
    loading.className = 'quick-loading';
    loading.textContent = '도로명 불러오는 중…';
    loading.style.cssText = 'font-size:13px;color:#999;padding:6px;';
    container.appendChild(loading);

    const reqDong = selectedDong;  // 응답 도착 전 동이 바뀌면 무시하기 위한 스냅샷
    fetchDongRoads(region, (roads) => {
        roadCache[cacheKey] = roads;
        saveRoadCache();
        if (selectedDong === reqDong) {   // 그새 다른 동으로 안 바꿨을 때만 반영
            if (loading.parentNode) loading.remove();
            renderRoads(roads);
        }
    });
}

// 길종류 빠른 선택 업데이트 (키패드 내부 동적 버튼)
function updateRoadTypeSelect() {
    // 설정에서 등록된 길종류 불러오기 (기본값 제외하고 동적으로 추가된 것들)
    // 기본: 로, 길, 안길 (이미 HTML에 하드코딩됨)
    // 추가: 가길, 나길, 다길, 번길 등 설정값
    const roadTypes = settings.roads || ['가길', '나길', '다길', '번길'];

    // 키패드의 동적 슬롯 4개 (roadLink1 ~ roadLink4)
    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`roadLink${i}`);
        if (!btn) continue;

        const roadType = roadTypes[i - 1];
        if (roadType) {
            btn.textContent = roadType;
            btn.style.visibility = 'visible';

            // 기존 리스너 제거가 어려우므로 복제 후 교체 (또는 onclick 속성 사용)
            const newBtn = btn.cloneNode(true);
            newBtn.addEventListener('click', () => {
                if (currentField === 'before') {
                    addressBefore += roadType;
                } else {
                    addressAfter += roadType;
                }
                updateDisplay();
            });
            btn.parentNode.replaceChild(newBtn, btn);
        } else {
            btn.style.visibility = 'hidden'; // 데이터 없으면 숨김
        }
    }
}

// 지번 번지 추출 (문자열 끝의 "숫자" 또는 "숫자-숫자")
function extractJibunNum(s) {
    const m = String(s || '').trim().match(/(\d+(?:-\d+)?)\s*$/);
    return m ? m[1] : '';
}

// 주소후 입력칸 경고 표시 토글 (역검증 불일치 시)
function setAddrWarn(on) {
    const el = document.getElementById('addressAfter');
    if (el) el.classList.toggle('addr-warn', !!on);
}

// 역검증: 지번→도로명 결과의 도로명을 다시 지번으로 역조회 → 기대 지번이 그 도로명에
// 매핑된 지번 목록에 있는지 확인. onDone(true=일치 / false=불일치 / null=판단보류)
// (한 지번이 다른 건물의 관련지번으로 얽혀 엉뚱한 도로명이 나오는 케이스를 잡는 안전망)
// ⚠ 이 방향(지번→도로명)만 검증. 도로명→지번은 신뢰 가능하므로 검증 안 함(거짓 경보 방지)
// ⚠ 도로명 1개에 지번 여러 개(아파트 등)면 목록 포함 여부로 판정 → 오탐 방지
function verifyRoadBackToJibun(roadValue, region, expectJibunNum, onDone) {
    if (!roadValue || !expectJibunNum) { onDone(null); return; }
    let q = roadValue;
    if (region) {
        const miss = [region.sido, region.gugun].filter(p => p && q.indexOf(p) === -1);
        if (miss.length) q = miss.join(' ') + ' ' + q;
    }
    const cbName = 'vwVerifyCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    const apiKey = window.__VW_KEY__ || '259F9CF5-8FAE-303B-8D16-A8F8B7B9C46D';
    const script = document.createElement('script');
    let done = false;
    const finish = (val) => {
        if (done) return; done = true;
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        onDone(val);
    };
    window[cbName] = function (data) {
        try {
            const items = ((((data || {}).response || {}).result) || {}).items || [];
            // 이 도로명이 매핑되는 모든 지번 수집 (아파트·대형필지는 도로명 1개에 지번 여러 개)
            // ⚠ ROAD 검색의 parcel은 시/도 접두어 없이 "중화동 178-27" 형태 → 동 이름으로 필터
            const nums = items
                .filter(x => !(region && region.dong) || (((x.address || {}).parcel) || '').indexOf(region.dong) !== -1)
                .map(x => extractJibunNum(((x.address || {}).parcel) || ''))
                .filter(Boolean);
            if (!nums.length) { finish(null); return; }       // 역조회 실패 → 판단 보류
            finish(nums.indexOf(expectJibunNum) !== -1);        // 기대 지번이 목록에 있으면 일치(true)
        } catch (e) { finish(null); }
    };
    script.onerror = () => finish(null);
    setTimeout(() => finish(null), 5000);
    // size=100: 도로명 하나에 걸린 지번을 최대한 다 받아 오탐 방지
    script.src = `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=epsg:4326&query=${encodeURIComponent(q)}&type=ADDRESS&category=ROAD&format=json&errorformat=json&size=100&key=${apiKey}&callback=${cbName}`;
    document.body.appendChild(script);
}

// 주소 검색 (주소전 → 주소후 변환) - JSONP 방식
// 주소전에 입력된 값을 자동 판별 (도로명/지번) 후 반대를 주소후에 표시
function searchAddress() {
    const input = addressBefore.trim();
    if (!input) {
        showToast('주소를 입력하세요');
        return;
    }
    setAddrWarn(false);   // 새 검색 시작 시 이전 경고 해제

    // 도로명인지 지번인지 자동 판별
    // 도로명: ~로, ~길, ~대로 포함
    // 지번: 숫자만 또는 동+숫자
    const isRoad = /[로길](\s|\d|$)/.test(input) || /대로/.test(input);

    let queryAddress = input;
    let searchCategory = isRoad ? 'ROAD' : 'PARCEL';

    // 검색 지역 스코프 확보 — 도로명/지번 모두 적용 (엉뚱한 지역 매칭 방지)
    // 도로명 검색도 시/구/동 접두어를 붙여야 "송림로" 같은 게 전국(예: 화성시)으로 안 튐
    const searchRegion = resolveDongRegion(selectedDong);
    if (searchRegion) {
        // "시도 구군 동" 중 쿼리에 아직 없는 조각만 앞에 부여 (중복 방지)
        const missing = [searchRegion.sido, searchRegion.gugun, searchRegion.dong]
            .filter(p => p && queryAddress.indexOf(p) === -1);
        if (missing.length) {
            queryAddress = `${missing.join(' ')} ${queryAddress}`;
        }
    }

    showToast('주소 검색 중...');

    // JSONP 콜백 함수명 생성
    const callbackName = 'vworldCallback_' + Date.now();

    // 전역 콜백 함수 등록
    window[callbackName] = function (data) {
        console.log('VWorld API 응답:', data);

        if (data.response && data.response.status === 'OK' && data.response.result) {
            const items = data.response.result.items;

            if (items && items.length > 0) {
                // 선택 지역으로 결과 스코프: 구/군 일치 우선 → 시/도 일치 → 그 외 거절
                // (VWorld 도로명 검색이 지역 토큰을 무시하고 전국 매칭하므로 결과 필터가 필수)
                let scoped;
                if (searchRegion && searchRegion.sido) {
                    const hay = (it) => {
                        const a = it.address || {};
                        return (a.road || '') + ' ' + (a.parcel || '');
                    };
                    scoped = searchRegion.gugun
                        ? items.filter(it => hay(it).indexOf(searchRegion.sido) !== -1 && hay(it).indexOf(searchRegion.gugun) !== -1)
                        : [];
                    if (!scoped.length) scoped = items.filter(it => hay(it).indexOf(searchRegion.sido) !== -1);
                    // 시/도 밖 결과뿐이면 거절 (엉뚱한 지역 방지)
                } else {
                    scoped = items;   // 전국코드 모드: 스코프 없음
                }

                if (!scoped.length) {
                    showToast(`⚠ ${searchRegion.gugun || searchRegion.sido}에서 못 찾음 (도로명 확인)`);
                } else {
                    // 변환 대상 필드 추출 (도로명 입력→지번, 지번 입력→도로명)
                    const pickValue = (it) => {
                        const a = it.address || {};
                        return isRoad ? (a.parcel || a.jibun || '') : (a.road || '');
                    };
                    const pickNote = (it) => {
                        const a = it.address || {};
                        let n = isRoad ? (a.road || '') : (a.parcel || a.jibun || '');
                        // 시/도·구/군 접두어 제거해 짧게 (동 이름은 남김)
                        if (searchRegion) {
                            [searchRegion.sido, searchRegion.gugun].forEach(tk => { if (tk) n = n.split(tk).join(''); });
                        }
                        return n.replace(/\s+/g, ' ').trim();
                    };
                    // 같은 값은 하나로 (예: 아파트 단지 — 여러 필지가 같은 도로명)
                    const seen = {};
                    const cands = [];
                    scoped.forEach(it => {
                        const v = pickValue(it);
                        if (v && !seen[v]) {
                            seen[v] = 1;
                            const pt = it.point || {};
                            // srcJibun: 이 결과가 매칭됐다고 주장하는 지번 (역검증 기준값)
                            // → 원본 입력이 아니라 결과 자신의 지번으로 검증해 본번검색 오탐 방지
                            const srcJibun = extractJibunNum((it.address || {}).parcel || (it.address || {}).jibun || '');
                            cands.push({ value: v, note: pickNote(it), srcJibun: srcJibun, lat: parseFloat(pt.y), lng: parseFloat(pt.x) });
                        }
                    });

                    const applyResult = (c) => {
                        addressAfter = c.value;
                        updateDisplay();
                        // 검색이 준 실좌표 저장 → 등록 시 함께 저장 (지도 마커가 문자열 재지오코딩 없이 정확히 꽂힘)
                        if (c.lat && c.lng) {
                            lastGeoPoint = { lat: c.lat, lng: c.lng, before: addressBefore, after: addressAfter };
                        } else {
                            lastGeoPoint = null;
                        }
                        showToast(isRoad ? '변환 완료 (구주소)' : '변환 완료 (신주소)');
                        // 지번→도로명 방향만 역검증 (신주소→구주소는 신뢰 가능하므로 생략)
                        setAddrWarn(false);
                        if (!isRoad) {
                            // 결과 자신의 지번을 기준으로 검증 (본번만 검색 시 오탐 방지). 없으면 입력값으로 폴백
                            const expect = c.srcJibun || extractJibunNum(input);
                            verifyRoadBackToJibun(c.value, searchRegion, expect, (matched) => {
                                // 응답 도착 전 사용자가 값을 바꿨으면 무시
                                if (addressAfter !== c.value) return;
                                if (matched === false) {   // 명확한 불일치만 경고 (null=판단보류는 무시)
                                    setAddrWarn(true);
                                    showToast('⚠ 역검증 불일치 — 주소 확인 필요');
                                }
                            });
                        }
                    };

                    if (!cands.length) {
                        showToast('⚠ 없는 주소입니다');
                    } else if (cands.length === 1) {
                        applyResult(cands[0]);
                    } else {
                        // 한 지번에 신주소가 여러 개(또는 부분 일치 다수) → 번호 선택창
                        showAddressChoiceModal(cands, applyResult);
                    }
                }
            } else {
                showToast('⚠ 없는 주소입니다');
            }
        } else {
            showToast('⚠ 없는 주소입니다');
        }

        // 정리
        delete window[callbackName];
        document.body.removeChild(script);
    };

    // VWorld Search API 사용 (API 키는 config.js에서 관리)
    const script = document.createElement('script');
    const apiKey = window.__VW_KEY__ || '259F9CF5-8FAE-303B-8D16-A8F8B7B9C46D';
    script.src = `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=epsg:4326&query=${encodeURIComponent(queryAddress)}&type=ADDRESS&category=${searchCategory}&format=json&errorformat=json&size=100&key=${apiKey}&callback=${callbackName}`;

    // 에러 처리
    script.onerror = function () {
        showToast('⚠ 네트워크 오류');
        delete window[callbackName];
        if (script.parentNode) {
            document.body.removeChild(script);
        }
    };

    // 타임아웃 처리 (5초)
    setTimeout(function () {
        if (window[callbackName]) {
            showToast('⚠ 없는 주소이거나 응답 시간 초과');
            delete window[callbackName];
            if (script.parentNode) {
                document.body.removeChild(script);
            }
        }
    }, 5000);

    document.body.appendChild(script);
}

// 주소 후보가 여러 개일 때 번호로 선택하는 창
// (한 지번에 신주소가 여러 개 등록된 경우, 부분 입력으로 후보 다수인 경우)
function showAddressChoiceModal(cands, onPick) {
    let modal = document.getElementById('addrChoiceModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'addrChoiceModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content addr-choice-modal">
                <div class="modal-header">
                    <h3 id="addrChoiceTitle">주소 선택</h3>
                    <button id="addrChoiceCloseBtn" class="btn-close">✕</button>
                </div>
                <div id="addrChoiceBody" class="addr-choice-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#addrChoiceCloseBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        // 바깥 영역 탭으로도 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    modal.querySelector('#addrChoiceTitle').textContent = `주소 선택 (${cands.length}건)`;
    const body = modal.querySelector('#addrChoiceBody');
    body.innerHTML = '';
    cands.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'addr-choice-btn';
        btn.innerHTML = `<span class="addr-choice-num">${i + 1}</span>` +
            `<span class="addr-choice-text">${c.value}` +
            (c.note ? `<small class="addr-choice-note">${c.note}</small>` : '') +
            `</span>`;
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
            onPick(c);
        });
        body.appendChild(btn);
    });

    modal.style.display = 'flex';
    body.scrollTop = 0;
}

// 동 이름에 시/구 정보 보장 (없으면 national-regions에서 자동 검색하여 붙임)
function ensureDongRegion(dongValue) {
    if (!dongValue || dongValue === '전국코드') return dongValue;
    const parts = dongValue.split('\n');
    if (parts.length >= 3) return dongValue; // 이미 시/구 정보 있음
    // 동 이름만 있는 경우 → 역검색
    const dongName = parts[0].trim();
    if (typeof findRegionByDong === 'function') {
        const region = findRegionByDong(dongName);
        if (region) {
            return `${dongName}\n${region.sido}\n${region.gugun}`;
        }
    }
    return dongValue;
}

// 배송 등록
function registerDelivery() {
    if (!addressBefore && !addressAfter) {
        showToast('주소를 입력하세요');
        return;
    }

    // 동에 시/구 정보 보장 (지오코딩 시 지방 매칭 방지)
    const dongWithRegion = ensureDongRegion(selectedDong);

    // addressBefore에 동 이름이 없으면 자동 포함 (숫자만 입력한 경우)
    const dongName = extractDongName(selectedDong);
    let finalAddressBefore = addressBefore;
    if (dongName && dongName !== '전국코드' && addressBefore && !addressBefore.includes(dongName)) {
        finalAddressBefore = dongName + ' ' + addressBefore;
    }

    // fullAddress 생성 시 지역 컨텍스트 포함 (지방 매칭 방지)
    let fullAddress;
    if (addressAfter) {
        fullAddress = `${addressAfter}/${finalAddressBefore}`;
    } else {
        // 도로명 없을 때: 시/구/동 + 지번으로 완전한 주소 구성
        const dongParts = dongWithRegion.split('\n');
        if (dongParts.length >= 3) {
            fullAddress = `${dongParts[1]} ${dongParts[2]} ${finalAddressBefore}`;
        } else {
            fullAddress = finalAddressBefore;
        }
    }

    // localStorage 불러오기
    let deliveries = JSON.parse(localStorage.getItem('deliveries') || '[]');

    // 변환 때 받아둔 실좌표가 아직 이 주소쌍의 것인지 확인 (변환 후 주소를 고쳤으면 폐기)
    const geo = (lastGeoPoint && lastGeoPoint.before === addressBefore && lastGeoPoint.after === addressAfter)
        ? lastGeoPoint : null;

    // 중복 확인 (같은 지번 주소가 있는지)
    const existingIndex = deliveries.findIndex(d => d.addressBefore === finalAddressBefore);

    if (existingIndex !== -1) {
        // 이미 존재하는 주소라면 업데이트
        deliveries[existingIndex].addressAfter = addressAfter || deliveries[existingIndex].addressAfter;
        deliveries[existingIndex].fullAddress = fullAddress;
        deliveries[existingIndex].dong = dongWithRegion;
        deliveries[existingIndex].priority = isUrgent ? 'urgent' : 'normal';
        if (geo) {
            deliveries[existingIndex].lat = geo.lat;
            deliveries[existingIndex].lng = geo.lng;
        }
        localStorage.setItem('deliveries', JSON.stringify(deliveries));
        showToast('기존 배송지가 업데이트되었습니다');
    } else {
        // 새로운 배송지 등록
        const delivery = {
            id: Date.now(),
            addressBefore: finalAddressBefore,
            addressAfter: addressAfter,
            fullAddress: fullAddress,
            dong: dongWithRegion,
            priority: isUrgent ? 'urgent' : 'normal',
            status: 'pending',
            layer: 0,
            createdAt: selectedDate
        };
        if (geo) {
            delivery.lat = geo.lat;   // 변환 검색의 실좌표 → 지도가 재지오코딩 없이 정확히 표시
            delivery.lng = geo.lng;
        }

        deliveries.push(delivery);
        localStorage.setItem('deliveries', JSON.stringify(deliveries));

        const orderNum = deliveries.length;
        showToast(`${settings.userName} 등록번호${orderNum}`);
    }

    // 입력 초기화
    addressBefore = '';
    addressAfter = '';
    lastGeoPoint = null;
    updateDisplay();
}

// 토스트 메시지
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}



// === 전국모드 기능 ===
let nationalModalStep = 'sido'; // 'sido', 'gugun', 'dong'
let selectedSido = '';
let selectedGugun = '';

function showNationalRegionModal() {
    // 모달이 없으면 생성
    let modal = document.getElementById('nationalModal');
    if (!modal) {
        modal = createNationalModal();
    }

    // 초기화
    nationalModalStep = 'sido';
    selectedSido = '';
    selectedGugun = '';

    // 시/도 목록 표시
    showSidoList();
    modal.style.display = 'flex';
}

function createNationalModal() {
    const modal = document.createElement('div');
    modal.id = 'nationalModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content national-modal">
            <div class="modal-header">
                <button id="nationalBackBtn" class="btn-back" style="display:none;">← 뒤로</button>
                <h3 id="nationalModalTitle">지역 선택</h3>
                <button id="nationalCloseBtn" class="btn-close">✕</button>
            </div>
            <div id="nationalModalBody" class="national-modal-body">
                <!-- 동적으로 채워짐 -->
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 닫기 버튼
    modal.querySelector('#nationalCloseBtn').addEventListener('click', () => {
        modal.style.display = 'none';
        // 전국코드 선택 해제
        selectedDong = settings.dongs[1] || '중화동';
        renderDongRadios();
    });

    // 뒤로 버튼
    modal.querySelector('#nationalBackBtn').addEventListener('click', () => {
        if (nationalModalStep === 'gugun') {
            nationalModalStep = 'sido';
            selectedSido = '';
            showSidoList();
        }
    });

    return modal;
}

function showSidoList() {
    const modal = document.getElementById('nationalModal');
    const title = modal.querySelector('#nationalModalTitle');
    const body = modal.querySelector('#nationalModalBody');
    const backBtn = modal.querySelector('#nationalBackBtn');

    title.textContent = '시/도 선택';
    backBtn.style.display = 'none';

    const sidoList = getSidoList();
    body.innerHTML = sidoList.map(sido => `
        <button class="region-btn" onclick="selectSido('${sido}')">${sido}</button>
    `).join('');
}

function selectSido(sido) {
    selectedSido = sido;
    nationalModalStep = 'gugun';
    showGugunList(sido);
}

function showGugunList(sido) {
    const modal = document.getElementById('nationalModal');
    const title = modal.querySelector('#nationalModalTitle');
    const body = modal.querySelector('#nationalModalBody');
    const backBtn = modal.querySelector('#nationalBackBtn');

    title.textContent = `${sido} > 구/군 선택`;
    backBtn.style.display = 'inline-block';

    const gugunList = getGugunList(sido);
    body.innerHTML = gugunList.map(gugun => `
        <button class="region-btn" onclick="selectGugun('${gugun}')">${gugun}</button>
    `).join('');
}

function selectGugun(gugun) {
    selectedGugun = gugun;

    // 모달 닫기
    document.getElementById('nationalModal').style.display = 'none';

    // 해당 지역의 동 목록을 가져와서 설정에 임시 저장
    const dongList = getDongList(selectedSido, gugun);

    // 전국코드 유지 + 선택한 지역 동들 추가
    const originalFirstDong = settings.dongs[0];
    settings.dongs = [originalFirstDong, ...dongList.map(dong => `${dong}\n${selectedSido}\n${gugun}`)];

    // 첫 번째 동 자동 선택
    if (dongList.length > 0) {
        selectedDong = settings.dongs[1];
    }

    // 주소 초기화
    addressBefore = '';
    addressAfter = '';
    lastGeoPoint = null;
    currentField = 'before';

    // UI 업데이트
    updateFieldFocus();
    updateDisplay();
    renderDongRadios();
    updateQuickSelect();

    showToast(`${selectedSido} ${gugun} 동 목록 표시됨`);
}
