// 배송 리스트 화면

let deliveries = [];
let selectedIds = new Set();
let selectedDate = new Date().toISOString().split('T')[0];
let currentFilter = 'all'; // 'all' or 'now'

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
    let filteredDeliveries = deliveries.filter(d => {
        if (!d.createdAt) return selectedDate === new Date().toISOString().split('T')[0];
        return d.createdAt === selectedDate;
    });

    // '지금갈곳' 필터링 (지도와 연동)
    if (currentFilter === 'now') {
        filteredDeliveries = filteredDeliveries.filter(d => d.urgent || (d.layer && d.layer > 0));
    }

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

        item.innerHTML = `
            <div class="item-row-top">
                <!-- 체크박스 -->
                <input type="checkbox" class="item-checkbox" data-id="${delivery.id}">

                <!-- 순번 -->
                <span class="index-text ${delivery.priority === 'urgent' ? 'urgent' : ''}">${index + 1}</span>

                <!-- 주소 -->
                <div class="delivery-info" onclick="viewOnMap('${delivery.id}')">
                    <span class="addr-text"><b>${delivery.dong || ''}</b> ${delivery.addressBefore || ''}</span>
                </div>

                ${tonnageStr}

                <!-- 카메라 -->
                <button class="icon-btn camera" onclick="handlePhoto('${delivery.id}', event)">
                    ${delivery.locationPhoto ? '📸' : '📷'}
                </button>
            </div>

            <div class="item-row-bottom">
                <!-- 전화번호 -->
                <div class="phone-area">
                    ${delivery.phone
                ? `<a href="tel:${delivery.phone}" class="phone-link">📞 ${delivery.phone}</a>`
                : `<input type="tel" class="inline-input tel-input" placeholder="전화번호 입력"
                               value="" onchange="updatePhone('${delivery.id}', this.value)">`
            }
                </div>

                <!-- 메모 -->
                <div class="memo-area" onclick="openMemo('${delivery.id}', event)">
                    ${delivery.memo
                ? `<span class="memo-text">📝 ${delivery.memo}</span>`
                : `<span class="memo-placeholder">📝 메모</span>`
            }
                </div>
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
    // 전체 선택
    document.getElementById('selectAll').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.item-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            if (e.target.checked) {
                selectedIds.add(cb.dataset.id);
            } else {
                selectedIds.clear();
            }
        });
    });

    // 개별 체크박스
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('item-checkbox')) {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                selectedIds.add(id);
            } else {
                selectedIds.delete(id);
            }
        }
    });

    // 삭제 버튼
    document.getElementById('deleteBtn').addEventListener('click', deleteSelected);

    // 날짜 선택 버튼
    document.getElementById('datePicker').addEventListener('change', (e) => {
        selectedDate = e.target.value;
        updateDateDisplay();
        renderList();
    });

    // 순서 변경 버튼
    // 순서 변경 버튼 (아직 없음)
    // document.getElementById('reorderBtn')?.addEventListener('click', ...);

    // 지금갈곳 관리 버튼들
    document.getElementById('saveToNowBtn').addEventListener('click', () => {
        assignNow(1);
    });

    document.getElementById('clearNowBtn').addEventListener('click', () => {
        assignNow(0);
    });

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

// 지금갈곳 할당 (지도 연동 호환)
function assignNow(layerNum) {
    if (selectedIds.size === 0) {
        alert('항목을 선택하세요');
        return;
    }

    deliveries = deliveries.map(d => {
        if (selectedIds.has(String(d.id))) {
            return {
                ...d,
                layer: layerNum
            };
        }
        return d;
    });

    localStorage.setItem('deliveries', JSON.stringify(deliveries));

    const msg = layerNum === 0 ? '지금갈곳에서 해제되었습니다.' : '지금갈곳으로 저장되었습니다.';
    if (typeof showToast === 'function') {
        showToast(msg);
    } else {
        alert(msg);
    }

    selectedIds.clear();
    renderList();
}
