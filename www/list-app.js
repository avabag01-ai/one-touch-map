// 배송 리스트 화면

let deliveries = [];
let selectedIds = new Set();
let selectedDate = new Date().toISOString().split('T')[0];
let currentEditingId = null;

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js');
    }
    loadDeliveries();
    renderList();
    setupEventListeners();
    updateDateDisplay();
});

// 배송 데이터 불러오기
function loadDeliveries() {
    const saved = localStorage.getItem('deliveries');
    if (saved) {
        deliveries = JSON.parse(saved);
    }
}

// === 🚀 최단 경로 최적화 (모듈 사용) ===
document.getElementById('optimizeBtn').addEventListener('click', async () => {
    if (deliveries.length < 2) {
        showToast('배송지가 2개 이상이어야 합니다.');
        return;
    }

    if (!confirm('현재 위치에서 출발하는\n최단 경로로 리스트를 정렬할까요?\n(GPS를 켜주세요!)')) {
        return;
    }

    showToast('위치 확인 및 경로 계산 중... 🛰️');

    try {
        // 모듈을 이용해 최적화 수행
        const optimizedList = await RouteOptimizer.optimize(deliveries);

        // 결과 반영
        deliveries = optimizedList;
        localStorage.setItem('deliveries', JSON.stringify(deliveries));
        renderList();

        showToast('최적 코스로 정렬 완료! 🏁');
    } catch (error) {
        console.error(error);
        showToast('실패: ' + error); // 에러 메시지 사용자에게 표시
    }
});

// 리스트 렌더링 (가로 일렬 배치 + 입력창 확장)
function renderList() {
    const container = document.getElementById('deliveryItems');
    container.innerHTML = '';

    // 날짜 필터링 (createdAt이 selectedDate와 일치하는 것만)
    const filteredDeliveries = deliveries.filter(d => {
        if (!d.createdAt) return selectedDate === new Date().toISOString().split('T')[0];
        return d.createdAt === selectedDate;
    });

    if (filteredDeliveries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">등록된 배송지가 없습니다</div>
            </div>
        `;
        document.getElementById('totalCount').textContent = '0';
        return;
    }

    filteredDeliveries.forEach((delivery, index) => {
        const item = document.createElement('div');
        item.className = 'delivery-item';
        if (delivery.priority === 'urgent') item.classList.add('urgent');

        // 용량 표시
        const tonnageStr = delivery.tonnage ? `<span class="tonnage-badge">${delivery.tonnage}t</span>` : '';

        // 주소 표시 (구주소/신주소)
        const addressDisplay = delivery.addressAfter
            ? `${delivery.addressBefore || ''} / ${delivery.addressAfter}`
            : delivery.addressBefore || '';

        // 추가 정보 (전화/메모)
        const phoneText = delivery.phone ? `Tel ${delivery.phone}` : '';
        const memoText = delivery.memo ? `${delivery.memo}` : '';
        const extraInfo = [phoneText, memoText].filter(x => x).join(' • ');

        item.innerHTML = `
            <div class="item-row-top">
                <!-- 체크박스 -->
                <input type="checkbox" class="item-checkbox" data-id="${delivery.id}">

                <!-- 순번 -->
                <span class="index-text ${delivery.priority === 'urgent' ? 'urgent' : ''}">${index + 1}</span>

                <!-- 주소 -->
                <div class="delivery-info" onclick="openInfoModal('${delivery.id}')">
                    <div class="addr-text">${addressDisplay}${extraInfo ? ` <span style="color: #8E8E93; font-size: 11px;">${extraInfo}</span>` : ''}</div>
                </div>

                ${tonnageStr}

                <!-- 카메라 -->
                <button class="icon-btn camera" onclick="handlePhoto('${delivery.id}', event)" style="font-size: 10px; padding: 3px 6px; background: #F0F0F0; border: none; border-radius: 4px; color: #666;">
                    ${delivery.locationPhoto ? 'Cam' : 'Cam'}
                </button>
            </div>
        `;
        container.appendChild(item);
    });

    document.getElementById('totalCount').textContent = filteredDeliveries.length;
}

// 전화번호 자동 저장
window.updatePhone = function (id, value) {
    const delivery = deliveries.find(d => String(d.id) === String(id));
    if (delivery) {
        delivery.phone = value;
        localStorage.setItem('deliveries', JSON.stringify(deliveries));
    }
};

// 특징(메모) 자동 저장
window.updateFeature = function (id, value) {
    const delivery = deliveries.find(d => String(d.id) === String(id));
    if (delivery) {
        delivery.features = value;
        localStorage.setItem('deliveries', JSON.stringify(deliveries));
    }
};

// 메모 열기 (클릭 시 편집 가능)
window.openMemo = function (id, e) {
    e.stopPropagation();
    const delivery = deliveries.find(d => String(d.id) === String(id));
    if (!delivery) return;

    const currentMemo = delivery.memo || '';
    const newMemo = prompt('메모 입력:', currentMemo);
    if (newMemo !== null) {
        delivery.memo = newMemo;
        localStorage.setItem('deliveries', JSON.stringify(deliveries));
        renderList();
    }
};

// 메모 업데이트
window.updateMemo = function (id, value) {
    const delivery = deliveries.find(d => String(d.id) === String(id));
    if (delivery) {
        delivery.memo = value;
        localStorage.setItem('deliveries', JSON.stringify(deliveries));
    }
};

// 전화 버튼 처리
function handleCall(phone, id, e) {
    e.stopPropagation();
    if (phone) {
        location.href = `tel:${phone}`;
    } else {
        const newPhone = prompt('전화번호를 입력하세요 (예: 010-1234-5678)');
        if (newPhone) {
            updateDeliveryInfo(id, { phone: newPhone });
        }
    }
}

// 사진/위치 촬영 처리
function handlePhoto(id, e) {
    e.stopPropagation();
    const delivery = deliveries.find(d => String(d.id) === String(id));

    // 이미 사진이 있으면 크게 보여주기 (간단 구현: 새창 띄우기)
    if (delivery.locationPhoto) {
        if (confirm('저장된 사진을 확인하거나 삭제하시겠습니까?')) {
            const w = window.open("");
            w.document.write(`<img src="${delivery.locationPhoto}" style="max-width:100%">
             <br><button onclick="window.close()" style="font-size:30px;padding:20px;width:100%">닫기</button>`);
        }
        return;
    }

    // 사진 찍기 (input file 트리거)
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // 후면 카메라

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            // 파일을 DataURL로 변환 (용량 줄여서 저장)
            const reader = new FileReader();
            reader.onload = function (e) {
                const photoData = e.target.result;
                updateDeliveryInfo(id, { locationPhoto: photoData });
            };
            reader.readAsDataURL(file);
        }
    };

    input.click();
}

// 정보 업데이트 및 주소록(Master DB) 동기화
function updateDeliveryInfo(id, updates) {
    deliveries = deliveries.map(d => {
        if (String(d.id) === String(id)) {
            const updated = { ...d, ...updates };
            // 변경된 정보를 Master DB에도 저장 (영구 기억)
            saveToAddressBook(updated);
            return updated;
        }
        return d;
    });
    localStorage.setItem('deliveries', JSON.stringify(deliveries));
    renderList();
}

// === ⚓️ 앵커 플로우 (anchor-system.js에서 로드됨) ===
// 여기 있던 중복 코드는 삭제하고, anchor-system.js의 함수를 사용합니다.

// 이벤트 리스너
function setupEventListeners() {
    console.log('===== setupEventListeners 호출됨 =====');

    // 전체 선택
    const selectAllEl = document.getElementById('selectAll');
    if (!selectAllEl) {
        console.error('❌ selectAll 엘리먼트를 찾을 수 없습니다!');
        return;
    }
    selectAllEl.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        if (e.target.checked) {
            selectedIds.clear();
            checkboxes.forEach(cb => {
                cb.checked = true;
                selectedIds.add(cb.dataset.id);
            });
        } else {
            checkboxes.forEach(cb => {
                cb.checked = false;
            });
            selectedIds.clear();
        }
        console.log('전체 선택 후 selectedIds:', Array.from(selectedIds));
    });

    // 개별 체크박스
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('item-checkbox')) {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                selectedIds.add(id);
                console.log(`체크박스 선택: ${id}, 현재 선택 수: ${selectedIds.size}`);
            } else {
                selectedIds.delete(id);
                console.log(`체크박스 해제: ${id}, 현재 선택 수: ${selectedIds.size}`);
            }
        }
    });

    // 삭제 버튼
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteSelected);

    // 긴급 변경 버튼
    const urgentBtn = document.getElementById('urgentBtn');
    if (urgentBtn) urgentBtn.addEventListener('click', toggleUrgent);

    // 이월 버튼
    const carryoverBtn = document.getElementById('carryoverBtn');
    if (carryoverBtn) carryoverBtn.addEventListener('click', carryoverSelected);

    // 날짜 선택 버튼
    const datePicker = document.getElementById('datePicker');
    if (datePicker) {
        datePicker.addEventListener('change', (e) => {
            selectedDate = e.target.value;
            updateDateDisplay();
            renderList();
        });
    }

    // 순서 변경 버튼
    const reorderBtn = document.getElementById('reorderBtn');
    if (reorderBtn) {
        reorderBtn.addEventListener('click', () => {
            alert('순서 변경 기능은 곧 추가됩니다');
        });
    }

    // 레이어 버튼들
    const layerBtns = document.querySelectorAll('.layer-btn');
    console.log(`레이어 버튼 발견: ${layerBtns.length}개`);

    if (layerBtns.length === 0) {
        console.error('❌ 레이어 버튼을 찾을 수 없습니다!');
    }

    layerBtns.forEach((btn, index) => {
        console.log(`레이어 버튼 ${index}: 텍스트="${btn.textContent.trim()}" data-layer="${btn.dataset.layer}"`);

        // 이벤트 리스너 추가
        const clickHandler = (e) => {
            console.log('🔥🔥🔥 레이어 버튼 클릭 이벤트 발생! 🔥🔥🔥');
            e.preventDefault();
            e.stopPropagation();
            const layer = parseInt(btn.dataset.layer);
            console.log('=== 레이어 버튼 클릭 ===');
            console.log('버튼 텍스트:', btn.textContent);
            console.log('data-layer:', btn.dataset.layer);
            console.log('파싱된 layer 값:', layer);
            console.log('선택된 항목 수:', selectedIds.size);
            console.log('선택된 ID들:', Array.from(selectedIds));
            console.log('assignLayer 호출 직전...');
            assignLayer(layer);
            console.log('assignLayer 호출 완료!');
        };

        btn.addEventListener('click', clickHandler);
        console.log(`✅ 레이어 버튼 ${index}에 이벤트 리스너 추가 완료`);
    });

    console.log('===== setupEventListeners 완료 =====');
}

// 지도에서 보기
function viewOnMap(id) {
    localStorage.setItem('selectedDeliveryId', id);
    location.href = 'map.html';
}

// 선택 항목 삭제
function deleteSelected() {
    if (selectedIds.size === 0) {
        alert('삭제할 항목을 선택하세요');
        return;
    }

    deliveries = deliveries.filter(d => !selectedIds.has(String(d.id)));
    localStorage.setItem('deliveries', JSON.stringify(deliveries));

    selectedIds.clear();
    renderList();
}

// 긴급 변경
function toggleUrgent() {
    if (selectedIds.size === 0) {
        alert('변경할 항목을 선택하세요');
        return;
    }

    deliveries = deliveries.map(d => {
        if (selectedIds.has(String(d.id))) {
            return {
                ...d,
                priority: d.priority === 'urgent' ? 'normal' : 'urgent'
            };
        }
        return d;
    });

    localStorage.setItem('deliveries', JSON.stringify(deliveries));
    selectedIds.clear();
    renderList();
}

// 이월
function carryoverSelected() {
    if (selectedIds.size === 0) {
        alert('이월할 항목을 선택하세요');
        return;
    }

    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 1);
    const nextDateStr = current.toISOString().split('T')[0];

    deliveries = deliveries.map(d => {
        if (selectedIds.has(String(d.id))) {
            return {
                ...d,
                createdAt: nextDateStr
            };
        }
        return d;
    });

    localStorage.setItem('deliveries', JSON.stringify(deliveries));
    alert(`${selectedIds.size}개 항목이 ${nextDateStr}로 이월되었습니다`);
    selectedIds.clear();
    renderList();
}

// 날짜 표시 업데이트
function updateDateDisplay() {
    document.getElementById('currentDate').textContent = selectedDate;
    document.getElementById('datePicker').value = selectedDate;
}

// 레이어 할당
function assignLayer(layerNum) {
    console.log('assignLayer 호출됨:', layerNum, '선택된 ID들:', Array.from(selectedIds));

    if (selectedIds.size === 0) {
        alert('레이어에 저장할 항목을 선택하세요');
        return;
    }

    let updatedCount = 0;
    deliveries = deliveries.map(d => {
        if (selectedIds.has(String(d.id))) {
            console.log(`배송지 ${d.id}의 레이어를 ${layerNum}으로 설정`);
            updatedCount++;
            return {
                ...d,
                layer: layerNum
            };
        }
        return d;
    });

    console.log(`${updatedCount}개 항목 업데이트됨`);
    console.log('업데이트된 deliveries:', deliveries.filter(d => d.layer !== undefined));

    localStorage.setItem('deliveries', JSON.stringify(deliveries));

    // 저장 확인
    const saved = JSON.parse(localStorage.getItem('deliveries'));
    console.log('localStorage 저장 확인:', saved.filter(d => d.layer !== undefined));

    const layerNames = {
        0: '해제',
        1: '지금갈곳',
        2: '나중에갈곳',
        3: '전체'
    };
    const layerName = layerNames[layerNum] || `레이어 ${layerNum}`;
    alert(`${selectedIds.size}개 항목이 ${layerName}에 저장되었습니다`);

    selectedIds.clear();
    document.getElementById('selectAll').checked = false;
    renderList();
}

// 정보 입력 모달 열기
function openInfoModal(id) {
    currentEditingId = id;
    const delivery = deliveries.find(d => d.id === parseInt(id));
    if (!delivery) return;

    // 기존 정보 표시
    document.getElementById('modalPhone').value = delivery.phone || '';
    document.getElementById('modalTonnage').value = delivery.tonnage || '';
    document.getElementById('modalMemo').value = delivery.memo || '';

    document.getElementById('infoModal').style.display = 'flex';
}

// 모달 닫기
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cancelInfoBtn').addEventListener('click', () => {
        document.getElementById('infoModal').style.display = 'none';
        currentEditingId = null;
    });

    // 톤수 버튼 클릭
    document.querySelectorAll('.tonnage-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('modalTonnage').value = btn.dataset.value;
        });
    });

    // 저장 버튼
    document.getElementById('saveInfoBtn').addEventListener('click', () => {
        if (!currentEditingId) return;

        const delivery = deliveries.find(d => d.id === parseInt(currentEditingId));
        if (!delivery) return;

        // 정보 저장
        delivery.phone = document.getElementById('modalPhone').value.trim();
        delivery.tonnage = document.getElementById('modalTonnage').value.trim();
        delivery.memo = document.getElementById('modalMemo').value.trim();

        localStorage.setItem('deliveries', JSON.stringify(deliveries));

        document.getElementById('infoModal').style.display = 'none';
        currentEditingId = null;
        renderList();
    });
});
