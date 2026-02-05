// 배송지도 V7 - 설정 페이지

let settings = {
    userName: '도도',
    password: '0000',
    mapSize: 3,
    approvalNum: '미승인',
    dongs: ['전국코드', '중화동\n서울특별시\n중랑구', '묵동', '망우동', '신내동', '', '', '', '', ''],
    roads: ['ex : 안길', '번길', '가길', '나길', '다길'],
    mapLine: 'notuse',
    arrivalSound: 'notuse',
    keyboardSound: 'notuse'
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupEventListeners();
});

// 이벤트 리스너
function setupEventListeners() {
    // 탭 전환
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    document.querySelectorAll('.sub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // 저장 버튼
    document.getElementById('saveBtn').addEventListener('click', saveSettings);

    // 하단 '지도보기' 버튼 삭제됨
}

// 설정 불러오기
function loadSettings() {
    const saved = localStorage.getItem('deliverySettings');
    if (saved) {
        settings = JSON.parse(saved);
    }

    // 폼에 값 설정
    document.getElementById('userName').value = settings.userName;
    document.getElementById('password').value = settings.password;
    document.getElementById('mapSize').value = settings.mapSize;
    document.getElementById('approvalNum').value = settings.approvalNum;

    // 설정동 1-10
    for (let i = 1; i <= 10; i++) {
        document.getElementById(`dong${i}`).value = settings.dongs[i - 1] || '';
    }

    // 길종류 1-5
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`road${i}`).value = settings.roads[i - 1] || '';
    }

    // 라디오 버튼
    document.querySelector(`input[name="mapLine"][value="${settings.mapLine}"]`).checked = true;
    document.querySelector(`input[name="arrivalSound"][value="${settings.arrivalSound}"]`).checked = true;
    document.querySelector(`input[name="keyboardSound"][value="${settings.keyboardSound}"]`).checked = true;

    // 배송 개수 표시
    updateDeliveryCount();
}

// 설정 저장
function saveSettings() {
    settings.userName = document.getElementById('userName').value;
    settings.password = document.getElementById('password').value;
    settings.mapSize = parseInt(document.getElementById('mapSize').value);

    // 설정동 1-10
    settings.dongs = [];
    for (let i = 1; i <= 10; i++) {
        settings.dongs.push(document.getElementById(`dong${i}`).value);
    }

    // 길종류 1-5
    settings.roads = [];
    for (let i = 1; i <= 5; i++) {
        settings.roads.push(document.getElementById(`road${i}`).value);
    }

    // 라디오 버튼
    settings.mapLine = document.querySelector('input[name="mapLine"]:checked').value;
    settings.arrivalSound = document.querySelector('input[name="arrivalSound"]:checked').value;
    alert('설정이 저장되었습니다! \n(입력된 동네만 리스트에 표시됩니다)');
    // 저장 후 메인으로 자동 이동 (편의성)
    window.location.href = 'index.html';
}

// 배송 개수 업데이트
function updateDeliveryCount() {
    const deliveries = JSON.parse(localStorage.getItem('deliveries') || '[]');
    document.getElementById('deliveryCount').textContent = deliveries.length;
}

// 테마 선택
function selectTheme(theme, el) {
    // 저장
    if (theme === 'lavender') {
        localStorage.removeItem('appTheme');
        document.documentElement.removeAttribute('data-theme');
    } else {
        localStorage.setItem('appTheme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }
    // UI 활성화 표시
    document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
}

// 테마 로드 (설정 페이지 진입 시)
function loadThemeUI() {
    const saved = localStorage.getItem('appTheme') || 'lavender';
    const el = document.querySelector(`.theme-option[data-theme="${saved}"]`);
    if (el) {
        document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
        el.classList.add('active');
    }
}

// 기존 DOMContentLoaded에 테마 로드 추가
document.addEventListener('DOMContentLoaded', loadThemeUI);
