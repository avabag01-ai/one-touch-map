// 주소빨리찾기V2 - 메인 화면
let addressBefore = '';
let selectedDate = new Date().toISOString().split('T')[0];
let addressAfter = '';
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
    setupScanFeature();
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
            dongs: ['전국코드', '중화동', '묵동', '망우동', '신내동', '상봉동', '면목동'],
            roads: []
        };
    }

    // 첫 번째 동 선택
    if (settings.dongs && settings.dongs.length > 0) {
        selectedDong = settings.dongs[0];
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

    // 키패드 숫자/특수문자
    document.querySelectorAll('.key-num, .key-special').forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            handleKeyInput(value);
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

    // 찾기 버튼 (지번 → 도로명 변환)
    document.querySelector('.btn-find').addEventListener('click', searchAddress);
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
    container.innerHTML = '';

    if (!settings.dongs || settings.dongs.length === 0) return;

    settings.dongs.forEach((dong, index) => {
        if (!dong) return;

        const label = document.createElement('label');
        label.className = 'dong-radio';
        if (dong === selectedDong) label.classList.add('selected');

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'dong';
        radio.value = dong;
        radio.checked = dong === selectedDong;

        radio.addEventListener('change', () => {
            selectedDong = dong;
            // 동이 바뀌면 주소 초기화
            addressBefore = '';
            addressAfter = '';
            // 입력 포커스를 주소전으로
            currentField = 'before';
            updateFieldFocus();
            updateDisplay();
            renderDongRadios();
            updateQuickSelect();
        });

        const span = document.createElement('span');
        // 동 이름에서 \n 이후 제거 (예: "중화동\n서울특별시\n중랑구" -> "중화동")
        const dongName = dong.split('\n')[0];
        span.textContent = dongName;

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

// 빠른 선택 (도로명) 업데이트
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
            addressBefore = dongName;
            currentField = 'before';
            updateDisplay();
        });
        container.appendChild(dongBtn);
    }

    // 도로명 버튼들
    const roadsByDong = {
        '전국코드': [],
        '중화동': ['중랑역로', '중랑천로', '봉화산로', '망우로'],
        '묵동': ['공릉로', '동일로', '봉화산로', '숙선옹주로', '신내로', '중랑역로', '중랑천로'],
        '망우동': ['용마산로', '망우로', '상봉로', '동일로', '중랑천로', '용마공원로'],
        '신내동': ['신내로', '봉화산로', '용마산로', '상봉로', '중랑천로', '동일로'],
        '상봉동': ['망우로', '상봉로', '동일로', '용마산로'],
        '면목동': ['동일로', '용마산로', '면목로', '겸재로', '사가정로']
    };

    let roads = roadsByDong[dongName] || [];
    
    // 등록된 동인데 도로명이 없는 경우, 동적으로 기본 도로명 생성
    if (roads.length === 0 && dongName && dongName !== '전국코드') {
        roads = generateDefaultRoads(dongName);
    }

    roads.forEach(road => {
        const btn = document.createElement('button');
        btn.className = 'quick-btn';
        btn.textContent = road;
        btn.addEventListener('click', () => {
            // 도로명 클릭 시 주소전(위 필드)에 입력
            addressBefore = road;
            currentField = 'before';
            updateFieldFocus();
            updateDisplay();
        });
        container.appendChild(btn);
    });
}

// 동적으로 기본 도로명 생성하는 함수
function generateDefaultRoads(dongName) {
    // 동 이름에서 숫자를 제거한 부분 추출
    const baseName = dongName.replace(/[0-9]/g, '').replace('동', '');
    
    // 기본 도로명 패턴 생성
    const defaultRoads = [
        `${baseName}로`,
        `${baseName}길`,
        `${baseName}로1길`,
        `${baseName}로2길`,
        `${baseName}중앙로`,
        `${baseName}서길`,
        `${baseName}동길`,
        `${baseName}남길`
    ];
    
    return defaultRoads;
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

// 주소 검색 (주소전 → 주소후 변환) - JSONP 방식
// 주소전에 입력된 값을 자동 판별 (도로명/지번) 후 반대를 주소후에 표시
function searchAddress() {
    const input = addressBefore.trim();
    if (!input) {
        showToast('주소를 입력하세요');
        return;
    }

    // 도로명인지 지번인지 자동 판별
    // 도로명: ~로, ~길, ~대로 포함
    // 지번: 숫자만 또는 동+숫자
    const isRoad = /[로길](\s|\d|$)/.test(input) || /대로/.test(input);

    let queryAddress = input;
    let searchCategory = isRoad ? 'ROAD' : 'PARCEL';

    // 지번 검색일 때 동 이름 붙이기
    const dongName = extractDongName(selectedDong);
    if (!isRoad && dongName !== '전국코드' && !queryAddress.startsWith(dongName)) {
        queryAddress = `${dongName} ${queryAddress}`;
    }

    showToast('주소 검색 중...');

    // JSONP 콜백 함수명 생성
    const callbackName = 'vworldCallback_' + Date.now();

    // 전역 콜백 함수 등록
    window[callbackName] = function(data) {
        console.log('VWorld API 응답:', data);

        if (data.response && data.response.status === 'OK' && data.response.result) {
            const items = data.response.result.items;

            if (items && items.length > 0) {
                const item = items[0];

                if (isRoad) {
                    // 도로명 입력 → 지번(구주소) 결과를 주소후에
                    if (item.address && item.address.parcel) {
                        addressAfter = item.address.parcel;
                        updateDisplay();
                        showToast('변환 완료 (구주소)');
                    } else if (item.address && item.address.jibun) {
                        addressAfter = item.address.jibun;
                        updateDisplay();
                        showToast('변환 완료 (구주소)');
                    } else {
                        showToast('⚠ 없는 주소입니다');
                    }
                } else {
                    // 지번 입력 → 도로명(신주소) 결과를 주소후에
                    if (item.address && item.address.road) {
                        addressAfter = item.address.road;
                        updateDisplay();
                        showToast('변환 완료 (신주소)');
                    } else {
                        showToast('⚠ 없는 주소입니다');
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

    // VWorld Search API 사용
    const script = document.createElement('script');
    const VWORLD_API_KEY = 'EEB68327-5D04-3BE3-9072-D3ECFCCC26A2';
    script.src = `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=epsg:4326&query=${encodeURIComponent(queryAddress)}&type=ADDRESS&category=${searchCategory}&format=json&errorformat=json&key=${VWORLD_API_KEY}&callback=${callbackName}`;

    // 에러 처리
    script.onerror = function() {
        showToast('⚠ 네트워크 오류');
        delete window[callbackName];
        if (script.parentNode) {
            document.body.removeChild(script);
        }
    };

    // 타임아웃 처리 (5초)
    setTimeout(function() {
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

// 배송 등록
function registerDelivery() {
    if (!addressBefore && !addressAfter) {
        showToast('주소를 입력하세요');
        return;
    }

    // localStorage 불러오기
    let deliveries = JSON.parse(localStorage.getItem('deliveries') || '[]');

    // 중복 확인 (같은 지번 주소가 있는지)
    const existingIndex = deliveries.findIndex(d => d.addressBefore === addressBefore);

    if (existingIndex !== -1) {
        // 이미 존재하는 주소라면 업데이트
        deliveries[existingIndex].addressAfter = addressAfter || deliveries[existingIndex].addressAfter;
        deliveries[existingIndex].fullAddress = addressAfter ? `${addressAfter}/${addressBefore}` : addressBefore;
        deliveries[existingIndex].dong = selectedDong;
        deliveries[existingIndex].priority = isUrgent ? 'urgent' : 'normal';
        localStorage.setItem('deliveries', JSON.stringify(deliveries));
        showToast('기존 배송지가 업데이트되었습니다');
    } else {
        // 새로운 배송지 등록
        const delivery = {
            id: Date.now(),
            addressBefore: addressBefore,
            addressAfter: addressAfter,
            fullAddress: addressAfter ? `${addressAfter}/${addressBefore}` : addressBefore,
            dong: selectedDong,
            priority: isUrgent ? 'urgent' : 'normal',
            status: 'pending',
            layer: 0,
            createdAt: selectedDate
        };

        deliveries.push(delivery);
        localStorage.setItem('deliveries', JSON.stringify(deliveries));

        const orderNum = deliveries.length;
        showToast(`${settings.userName} 등록번호${orderNum}`);
    }

    // 입력 초기화
    addressBefore = '';
    addressAfter = '';
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

// 스캔 기능 (OCR)
function setupScanFeature() {
    // 이 부분은 기존 코드에 있다면 유지
}
