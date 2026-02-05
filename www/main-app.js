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

// 전국 시/도 목록
const nationwideRegions = [
    '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시',
    '울산광역시', '세종특별자치시', '경기도', '강원도', '충청북도', '충청남도',
    '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
];

// 전국모드 데이터
const regionData = {
    '서울': {
        '강남구': ['역삼동', '개포동', '청담동', '삼성동', '대치동'],
        '강동구': ['천호동', '성내동', '길동', '둔촌동', '암사동'],
        '강북구': ['미아동', '번동', '수유동'],
        '강서구': ['염창동', '등촌동', '화곡동', '가양동', '마곡동'],
        '관악구': ['봉천동', '신림동'],
        '광진구': ['중곡동', '능동', '구의동', '광장동'],
        '구로구': ['구로동', '신도림동', '개봉동', '오류동', '고척동'],
        '금천구': ['가산동', '독산동', '시흥동'],
        '노원구': ['월계동', '공릉동', '하계동', '상계동', '중계동'],
        '도봉구': ['쌍문동', '방학동', '도봉동', '창동'],
        '동대문구': ['용두동', '제기동', '전농동', '답십리동', '장안동', '이문동', '회기동', '휘경동'],
        '동작구': ['노량진동', '상도동', '흑석동', '사당동', '대방동'],
        '마포구': ['아현동', '공덕동', '도화동', '용강동', '대흥동', '염리동', '신수동', '서강동', '서교동', '합정동', '망원동', '연남동', '성산동', '상암동'],
        '서대문구': ['충정로', '천연동', '신촌동', '연희동', '홍제동', '홍은동', '북아현동', '북가좌동', '남가좌동'],
        '서초구': ['서초동', '잠원동', '반포동', '방배동', '양재동', '우면동', '내곡동'],
        '성동구': ['왕십리', '마장동', '사근동', '행당동', '응봉동', '금호동', '옥수동', '성수동', '송정동', '용답동'],
        '성북구': ['성북동', '삼선동', '동선동', '돈암동', '안암동', '보문동', '정릉동', '길음동', '종암동', '하월곡동', '상월곡동', '장위동', '석관동'],
        '송파구': ['풍납동', '거여동', '마천동', '방이동', '오금동', '송파동', '석촌동', '삼전동', '가락동', '문정동', '장지동'],
        '양천구': ['신정동', '목동', '신월동'],
        '영등포구': ['영등포동', '여의도동', '당산동', '도림동', '문래동', '양평동', '신길동', '대림동'],
        '용산구': ['후암동', '용산동', '남영동', '청파동', '원효로', '효창동', '도원동', '서빙고동', '한남동', '이촌동', '이태원동', '보광동'],
        '은평구': ['수색동', '녹번동', '불광동', '갈현동', '구산동', '대조동', '응암동', '역촌동', '신사동', '증산동'],
        '종로구': ['청운효자동', '사직동', '삼청동', '부암동', '평창동', '무악동', '교남동', '가회동', '종로1.2.3.4가동', '종로5.6가동', '이화동', '혜화동', '창신동', '숭인동'],
        '중구': ['소공동', '회현동', '명동', '필동', '장충동', '광희동', '을지로동', '신당동', '다산동', '약수동', '청구동', '황학동', '중림동'],
        '중랑구': ['면목동', '상봉동', '중화동', '묵동', '망우동', '신내동']
    },
    '경기': {
        '수원시': ['장안구', '권선구', '팔달구', '영통구'],
        '고양시': ['덕양구', '일산동구', '일산서구'],
        '용인시': ['처인구', '기흥구', '수지구']
    }
};

// 동 라디오 버튼 렌더링
function renderDongRadios() {
    const container = document.getElementById('dongRadios');
    container.innerHTML = '';

    if (!settings.dongs || settings.dongs.length === 0) return;

    settings.dongs.forEach((dong, index) => {
        if (!dong) return;

        // 전국코드인 경우 전국모드 버튼으로 표시
        if (dong === '전국코드') {
            const btn = document.createElement('button');
            btn.className = 'dong-radio region-mode-btn';
            btn.textContent = '전국모드';
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            btn.style.fontWeight = 'bold';
            btn.style.border = 'none';
            btn.style.borderRadius = '6px';
            btn.style.padding = '8px 12px';
            btn.style.cursor = 'pointer';

            btn.addEventListener('click', () => {
                openRegionSelector();
            });

            container.appendChild(btn);
            return;
        }

        const label = document.createElement('label');
        label.className = 'dong-radio';
        if (dong === selectedDong) label.classList.add('selected');

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'dong';
        radio.value = dong;
        radio.checked = dong === selectedDong;

        radio.addEventListener('change', () => {
            // 같은 동 다시 클릭하면 전국코드로 초기화
            if (selectedDong === dong && dong !== '전국코드') {
                selectedDong = '전국코드';
                addressBefore = '';
                addressAfter = '';
                updateDongDisplay('');
            } else {
                selectedDong = dong;

                // 동 이름 표시 및 주소전에 동 이름 자동 입력
                if (dong !== '전국코드') {
                    updateDongDisplay(dong);
                    addressBefore = dong;
                } else {
                    updateDongDisplay('');
                    addressBefore = '';
                }
                addressAfter = '';
            }

            currentField = 'before';
            updateFieldFocus();
            updateDisplay();
            renderDongRadios();
            updateQuickSelect();
        });

        const span = document.createElement('span');
        span.textContent = dong;

        label.appendChild(radio);
        label.appendChild(span);
        container.appendChild(label);
    });
}

// 전국 지역 선택기 열기
function openRegionSelector() {
    const modal = document.getElementById('regionModal');
    const regionList = document.getElementById('regionList');

    // 1단계: 시/도 선택
    regionList.innerHTML = '<h4 style="margin: 10px 0;">시/도를 선택하세요</h4>';

    nationwideRegions.forEach(region => {
        const btn = document.createElement('button');
        btn.textContent = region;
        btn.style.cssText = 'width: 100%; padding: 15px; margin: 5px 0; font-size: 16px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer;';

        btn.addEventListener('click', () => {
            // 간단한 시/도는 바로 선택
            if (region.includes('세종') || region.includes('제주')) {
                selectedDong = region;
                updateDongDisplay(region);
                addressBefore = '';
                addressAfter = '';
                updateDisplay();
                modal.style.display = 'none';
                showToast(`${region} 선택됨`);
                return;
            }

            // 서울/경기는 2단계로
            const shortName = region.replace('특별시', '').replace('광역시', '').replace('도', '').replace('특별자치시', '').replace('특별자치도', '');
            if (regionData[shortName]) {
                showDistrictSelector(shortName, region);
            } else {
                selectedDong = region;
                updateDongDisplay(region);
                addressBefore = '';
                addressAfter = '';
                updateDisplay();
                modal.style.display = 'none';
                showToast(`${region} 선택됨`);
            }
        });

        regionList.appendChild(btn);
    });

    modal.style.display = 'flex';
}

// 2단계: 시/군/구 선택
function showDistrictSelector(city, fullName) {
    const regionList = document.getElementById('regionList');
    const districts = Object.keys(regionData[city]);

    regionList.innerHTML = `<h4 style="margin: 10px 0;">${fullName} - 구/시를 선택하세요</h4>`;

    const backBtn = document.createElement('button');
    backBtn.textContent = '← 뒤로';
    backBtn.style.cssText = 'width: 100%; padding: 10px; margin: 5px 0; background: #666; color: white; border: none; border-radius: 8px;';
    backBtn.addEventListener('click', openRegionSelector);
    regionList.appendChild(backBtn);

    districts.forEach(district => {
        const btn = document.createElement('button');
        btn.textContent = district;
        btn.style.cssText = 'width: 100%; padding: 15px; margin: 5px 0; font-size: 16px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer;';

        btn.addEventListener('click', () => {
            // 선택된 구의 동 목록을 settings.dongs에 저장
            const dongs = regionData[city][district];
            settings.dongs = ['전국코드', ...dongs];
            localStorage.setItem('deliverySettings', JSON.stringify(settings));

            // 첫 번째 동 선택
            selectedDong = dongs[0];
            updateDongDisplay(`${district} ${dongs[0]}`);

            // 주소전에 동 이름 자동 입력
            addressBefore = dongs[0];
            addressAfter = '';

            // 동 라디오 버튼 다시 렌더링
            renderDongRadios();
            updateQuickSelect();

            // 모달 닫기
            document.getElementById('regionModal').style.display = 'none';
            showToast(`${district} 설정 완료 - ${dongs.length}개 동`);

            updateDisplay();
        });

        regionList.appendChild(btn);
    });
}

// 모달 닫기
// 모달 닫기 이벤트 리스너 등록
if (document.getElementById('closeRegionModal')) {
    document.getElementById('closeRegionModal').addEventListener('click', () => {
        document.getElementById('regionModal').style.display = 'none';
    });
}

// 동 이름 헤더에 표시
function updateDongDisplay(dongName) {
    const header = document.querySelector('.header-title');
    if (!header) return;

    let dongSpan = header.querySelector('.dong-display');
    if (!dongSpan) {
        dongSpan = document.createElement('span');
        dongSpan.className = 'dong-display';
        dongSpan.style.marginLeft = '8px';
        dongSpan.style.color = '#2196F3';
        dongSpan.style.fontWeight = 'bold';
        header.appendChild(dongSpan);
    }

    if (dongName) {
        dongSpan.textContent = `[${dongName}]`;
        dongSpan.style.display = 'inline';
    } else {
        dongSpan.style.display = 'none';
    }
}

// 빠른 선택 (도로명) 업데이트
function updateQuickSelect() {
    const container = document.getElementById('quickSelect');
    container.innerHTML = '';

    // 선택된 동 이름도 버튼으로 추가
    if (selectedDong && selectedDong !== '전국코드') {
        const dongBtn = document.createElement('button');
        dongBtn.className = 'quick-btn';
        dongBtn.textContent = selectedDong;
        dongBtn.addEventListener('click', () => {
            addressBefore = selectedDong;
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

    const roads = roadsByDong[selectedDong] || [];

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
    if (!isRoad && selectedDong !== '전국코드' && !queryAddress.startsWith(selectedDong)) {
        queryAddress = `${selectedDong} ${queryAddress}`;
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
