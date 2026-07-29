// 배송지도 V7 - 주소 등록 및 배송 관리 시스템

let map;
let userMarker;
let currentPosition = null;
let deliveries = [];
let markers = [];
let addressType = 'dong'; // 'dong' or 'road'
let currentInput = '';
let dongList = [];
let roadList = [];
let currentFilter = 'all';
let selectedDeliveryId = null;

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadAllSettings();
    loadDeliveries();
    setupEventListeners();
    updateDeliveryCount();
    updateQuickDong();
});

// 지도 초기화
function initMap() {
    const defaultLocation = [37.5665, 126.9780];

    map = L.map('map', {
        center: defaultLocation,
        zoom: 13,
        zoomControl: false,
        attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    getUserLocation();
}

// 사용자 위치
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentPosition = [position.coords.latitude, position.coords.longitude];
                map.setView(currentPosition, 15);

                if (userMarker) {
                    map.removeLayer(userMarker);
                }

                userMarker = L.circleMarker(currentPosition, {
                    radius: 8,
                    fillColor: '#007AFF',
                    color: '#FFFFFF',
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map);
            },
            (error) => {
                console.error('위치 정보를 가져올 수 없습니다:', error);
            }
        );
    }
}

// 이벤트 리스너
function setupEventListeners() {
    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            addressType = btn.dataset.type;
            currentInput = '';
            updateAddressInput();
            updateSuggestions();
        });
    });

    // 키패드
    document.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            const action = btn.dataset.action;

            if (key) {
                currentInput += key;
                updateAddressInput();
                updateSuggestions();
            } else if (action) {
                handleAction(action);
            }
        });
    });

    // 입력 초기화
    document.getElementById('clearInput').addEventListener('click', () => {
        currentInput = '';
        updateAddressInput();
        updateSuggestions();
    });

    // 모달
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('listBtn').addEventListener('click', openListModal);
    document.getElementById('cameraBtn').addEventListener('click', openCamera);

    document.getElementById('closeListModal').addEventListener('click', closeListModal);
    document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal);
    document.getElementById('closeSettingsModal').addEventListener('click', closeSettingsModal);
    document.getElementById('closeNaviModal').addEventListener('click', closeNaviModal);

    // 설정
    document.getElementById('saveSettings').addEventListener('click', saveAllSettings);

    // 지도크기 선택
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // 배송 관리
    document.getElementById('deleteDelivery').addEventListener('click', deleteDelivery);
    document.getElementById('completeDelivery').addEventListener('click', completeDelivery);
    document.getElementById('navigateDelivery').addEventListener('click', openNaviModal);
    document.getElementById('optimizeRoute').addEventListener('click', optimizeRoute);

    // 필터
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            updateDeliveryList();
        });
    });

    // 네비 선택
    document.querySelectorAll('.navi-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const navi = btn.dataset.navi;
            openNavigation(navi);
        });
    });
}

// 키패드 액션
function handleAction(action) {
    switch (action) {
        case 'backspace':
            currentInput = currentInput.slice(0, -1);
            updateAddressInput();
            updateSuggestions();
            break;
        case 'space':
            currentInput += ' ';
            updateAddressInput();
            updateSuggestions();
            break;
        case 'dash':
            currentInput += '-';
            updateAddressInput();
            updateSuggestions();
            break;
        case 'comma':
            currentInput += ',';
            updateAddressInput();
            updateSuggestions();
            break;
        case 'red':
            registerDelivery('red');
            break;
        case 'blue':
            registerDelivery('blue');
            break;
    }
}

// 주소 입력 업데이트
function updateAddressInput() {
    document.getElementById('addressInput').value = currentInput;
}

// 자동완성
function updateSuggestions() {
    const suggestions = document.getElementById('addressSuggestions');
    const list = addressType === 'dong' ? dongList : roadList;

    if (currentInput.length === 0) {
        suggestions.classList.remove('active');
        return;
    }

    const filtered = list.filter(item =>
        item.toLowerCase().includes(currentInput.toLowerCase())
    );

    if (filtered.length === 0) {
        suggestions.classList.remove('active');
        return;
    }

    suggestions.innerHTML = filtered.map(item => `
        <div class="suggestion-item" data-address="${item}">${item}</div>
    `).join('');

    suggestions.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            currentInput = item.dataset.address;
            updateAddressInput();
            suggestions.classList.remove('active');
        });
    });

    suggestions.classList.add('active');
}

// 배송지 등록
async function registerDelivery(category) {
    if (!currentInput.trim()) {
        showToast('주소를 입력하세요');
        return;
    }

    showToast('주소를 지오코딩 중...');

    // 주소 → 좌표 변환 (Nominatim API)
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(currentInput + ', 서울, 대한민국')}&limit=1`
        );
        const data = await response.json();

        if (data.length === 0) {
            showToast('주소를 찾을 수 없습니다');
            return;
        }

        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        const delivery = {
            id: Date.now(),
            address: currentInput,
            category: category,
            lat: lat,
            lng: lng,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        deliveries.push(delivery);
        saveDeliveries();
        addMarkerToMap(delivery);

        currentInput = '';
        updateAddressInput();
        document.getElementById('addressSuggestions').classList.remove('active');

        showToast(`${category === 'red' ? '빨강' : '파랑'} 배송지 등록 완료`);
        updateDeliveryCount();

        // 지도 이동
        map.setView([lat, lng], 16);

    } catch (error) {
        console.error('지오코딩 오류:', error);
        showToast('주소 변환 실패');
    }
}

// 마커 추가
function addMarkerToMap(delivery) {
    const iconHtml = `
        <div class="delivery-marker ${delivery.category} ${delivery.status === 'completed' ? 'completed' : ''}">
            ${deliveries.filter(d => d.status === 'pending').indexOf(delivery) + 1}
        </div>
    `;

    const marker = L.marker([delivery.lat, delivery.lng], {
        icon: L.divIcon({
            html: iconHtml,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        })
    }).addTo(map);

    marker.deliveryId = delivery.id;

    marker.bindPopup(`
        <div style="font-weight: 600; margin-bottom: 4px;">${delivery.address}</div>
        <div style="font-size: 12px; color: #666;">${delivery.category === 'red' ? '빨강' : '파랑'} 배송</div>
    `);

    marker.on('click', () => {
        openDetailModal(delivery.id);
    });

    markers.push(marker);
}

// 모든 마커 표시
function displayAllMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    deliveries.forEach(delivery => addMarkerToMap(delivery));
}

// 배송 목록 열기
function openListModal() {
    updateDeliveryList();
    document.getElementById('listModal').classList.add('active');
}

function closeListModal() {
    document.getElementById('listModal').classList.remove('active');
}

// 배송 목록 업데이트
function updateDeliveryList() {
    const list = document.getElementById('deliveryList');
    const emptyState = document.getElementById('emptyState');

    let filtered = deliveries;
    if (currentFilter !== 'all') {
        filtered = deliveries.filter(d => d.category === currentFilter);
    }

    // 카운트 업데이트
    document.getElementById('countAll').textContent = deliveries.length;
    document.getElementById('countRed').textContent = deliveries.filter(d => d.category === 'red').length;
    document.getElementById('countBlue').textContent = deliveries.filter(d => d.category === 'blue').length;

    if (filtered.length === 0) {
        list.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        list.style.display = 'block';
        emptyState.style.display = 'none';

        list.innerHTML = filtered.map((delivery, index) => `
            <div class="delivery-item ${delivery.category} ${delivery.status}" data-id="${delivery.id}">
                <div class="delivery-header">
                    <div class="delivery-address">${index + 1}. ${delivery.address}</div>
                    <div class="delivery-status ${delivery.status}">
                        ${delivery.status === 'completed' ? '완료' : '대기'}
                    </div>
                </div>
                <div class="delivery-info">
                    ${delivery.category === 'red' ? '빨강' : '파랑'} 배송 • ${new Date(delivery.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        `).join('');

        list.querySelectorAll('.delivery-item').forEach(item => {
            item.addEventListener('click', () => {
                openDetailModal(parseInt(item.dataset.id));
            });
        });
    }
}

// 상세 모달
function openDetailModal(id) {
    const delivery = deliveries.find(d => d.id === id);
    if (!delivery) return;

    selectedDeliveryId = id;

    document.getElementById('detailAddress').textContent = delivery.address;
    document.getElementById('detailCategory').innerHTML = `
        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${delivery.category === 'red' ? '#FF3B30' : '#007AFF'}; margin-right: 8px;"></span>
        ${delivery.category === 'red' ? '빨강' : '파랑'} 배송
    `;
    document.getElementById('detailCoords').textContent = `${delivery.lat.toFixed(6)}, ${delivery.lng.toFixed(6)}`;
    document.getElementById('detailTime').textContent = new Date(delivery.createdAt).toLocaleString('ko-KR');
    document.getElementById('detailStatus').textContent = delivery.status === 'completed' ? '배송 완료' : '배송 대기';

    document.getElementById('detailModal').classList.add('active');
    closeListModal();
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
}

// 배송 삭제
function deleteDelivery() {
    if (confirm('이 배송지를 삭제하시겠습니까?')) {
        deliveries = deliveries.filter(d => d.id !== selectedDeliveryId);
        saveDeliveries();
        displayAllMarkers();
        closeDetailModal();
        showToast('배송지가 삭제되었습니다');
        updateDeliveryCount();
    }
}

// 배송 완료
function completeDelivery() {
    const delivery = deliveries.find(d => d.id === selectedDeliveryId);
    if (delivery) {
        delivery.status = 'completed';
        saveDeliveries();
        displayAllMarkers();
        closeDetailModal();
        showToast('배송이 완료되었습니다');
    }
}

// 네비 모달
function openNaviModal() {
    document.getElementById('naviModal').classList.add('active');
}

function closeNaviModal() {
    document.getElementById('naviModal').classList.remove('active');
}

// 네비게이션 열기
function openNavigation(navi) {
    const delivery = deliveries.find(d => d.id === selectedDeliveryId);
    if (!delivery) return;

    const lat = delivery.lat;
    const lng = delivery.lng;
    const address = encodeURIComponent(delivery.address);

    let url;
    switch (navi) {
        case 'kakao':
            url = `kakaomap://route?ep=${lat},${lng}&by=CAR`;
            break;
        case 'naver':
            url = `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${address}`;
            break;
        case 'google':
            url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            break;
        case 'tmap':
            url = `tmap://route?goalx=${lng}&goaly=${lat}&goalname=${address}`;
            break;
    }

    window.location.href = url;
    closeNaviModal();
}

// 최적 경로
function optimizeRoute() {
    const pending = deliveries.filter(d => d.status === 'pending');
    if (pending.length === 0) {
        showToast('배송 대기 중인 항목이 없습니다');
        return;
    }

    if (!currentPosition) {
        showToast('현재 위치를 찾을 수 없습니다');
        return;
    }

    // 간단한 최근접 이웃 알고리즘
    const sorted = [];
    let current = currentPosition;
    let remaining = [...pending];

    while (remaining.length > 0) {
        let nearest = null;
        let minDist = Infinity;

        remaining.forEach(delivery => {
            const dist = getDistance(current, [delivery.lat, delivery.lng]);
            if (dist < minDist) {
                minDist = dist;
                nearest = delivery;
            }
        });

        sorted.push(nearest);
        current = [nearest.lat, nearest.lng];
        remaining = remaining.filter(d => d.id !== nearest.id);
    }

    // 순서 재정렬
    const otherDeliveries = deliveries.filter(d => d.status === 'completed');
    deliveries = [...sorted, ...otherDeliveries];
    saveDeliveries();
    displayAllMarkers();
    updateDeliveryList();

    showToast('최적 경로로 정렬되었습니다');
}

// 거리 계산
function getDistance(pos1, pos2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (pos2[0] - pos1[0]) * Math.PI / 180;
    const dLon = (pos2[1] - pos1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(pos1[0] * Math.PI / 180) * Math.cos(pos2[0] * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 설정 모달
function openSettingsModal() {
    loadAllSettings();
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

// 모든 설정 저장
function saveAllSettings() {
    const settings = {
        userName: document.getElementById('userName').value,
        mapSize: document.querySelector('.size-btn.active').dataset.size,
        dongs: [],
        roads: []
    };

    // 설정동 1-10 저장
    for (let i = 1; i <= 10; i++) {
        const value = document.getElementById(`dong${i}`).value.trim();
        if (value) {
            settings.dongs.push(value);
        }
    }

    // 길종류 1-5 저장
    for (let i = 1; i <= 5; i++) {
        const value = document.getElementById(`road${i}`).value.trim();
        if (value) {
            settings.roads.push(value);
        }
    }

    localStorage.setItem('appSettings', JSON.stringify(settings));

    // dongList와 roadList 업데이트
    dongList = settings.dongs;
    roadList = settings.roads;

    updateQuickDong();
    closeSettingsModal();
    showToast('설정이 저장되었습니다');
}

// 모든 설정 불러오기
function loadAllSettings() {
    const saved = localStorage.getItem('appSettings');
    let settings;

    if (saved) {
        settings = JSON.parse(saved);
    } else {
        // 기본값
        settings = {
            userName: '',
            mapSize: '3',
            dongs: ['중화동', '묵동', '망우동', '신내동', '상봉동'],
            roads: ['안길', '번길', '가길', '나길', '다길']
        };
    }

    // 사용자명
    document.getElementById('userName').value = settings.userName || '';

    // 지도크기
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.size === settings.mapSize) {
            btn.classList.add('active');
        }
    });

    // 설정동 1-10
    for (let i = 1; i <= 10; i++) {
        document.getElementById(`dong${i}`).value = settings.dongs[i - 1] || '';
    }

    // 길종류 1-5
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`road${i}`).value = settings.roads[i - 1] || '';
    }

    // dongList와 roadList 업데이트
    dongList = settings.dongs;
    roadList = settings.roads;
}

// 빠른 동 선택 업데이트
function updateQuickDong() {
    const list = document.getElementById('quickDongList');
    list.innerHTML = dongList.map(dong => `
        <button class="quick-item" data-dong="${dong}">${dong}</button>
    `).join('');

    list.querySelectorAll('.quick-item').forEach(btn => {
        btn.addEventListener('click', () => {
            currentInput = btn.dataset.dong;
            updateAddressInput();
            updateSuggestions();
        });
    });
}

// 카메라 (OCR 준비)
function openCamera() {
    showToast('카메라 기능은 곧 추가됩니다');
    // TODO: 카메라로 주소 촬영 → OCR → 자동 등록
}

// 배송 개수 업데이트
function updateDeliveryCount() {
    document.getElementById('deliveryCount').textContent = deliveries.length;
}

// 저장/불러오기
function saveDeliveries() {
    localStorage.setItem('deliveries', JSON.stringify(deliveries));
}

function loadDeliveries() {
    const saved = localStorage.getItem('deliveries');
    if (saved) {
        deliveries = JSON.parse(saved);
        displayAllMarkers();
    }
}

// 토스트
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}
