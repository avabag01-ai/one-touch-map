// One-Touch Map - 중앙 설정 파일
const CONFIG = {
    // VWorld API Key (지도 및 검색 서비스)
    VWORLD_API_KEY: '259F9CF5-8FAE-303B-8D16-A8F8B7B9C46D',

    // 앱 기본 설정
    DEFAULT_SETTINGS: {
        userName: '사용자',
        mapSize: 3,
        dongs: ['전국코드'], // 특정 동네 하드코딩 제거
        roads: []
    },

    // UI 설정
    THEME: 'pastel',
    TOAST_DURATION: 2000
};

// 전역 변수로 노출 (HTML에서 바로 쓰기 위해)
window.CONFIG = CONFIG;
