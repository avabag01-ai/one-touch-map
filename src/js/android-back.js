
// 뒤로가기 버튼 처리 (안드로이드)
(function () {
    const attachBackButton = () => {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            console.log("Attaching back button listener");
            window.Capacitor.Plugins.App.removeAllListeners(); // 기존 리스너 제거
            window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
                console.log("Back button pressed");
                const path = window.location.pathname;
                const page = path.split('/').pop();

                // 1. 메인 화면(index.html)에서는 앱 종료 확인
                if (page === 'index.html' || page === '') {
                    const confirmExit = confirm('앱을 종료하시겠습니까?');
                    if (confirmExit) {
                        window.Capacitor.Plugins.App.exitApp();
                    }
                }
                // 2. 다른 화면에서는 메인으로 이동
                else {
                    window.location.replace('index.html');
                }
            });
            return true;
        }
        return false;
    };

    // 1. 즉시 시도
    if (!attachBackButton()) {
        // 2. 로드 대기
        const interval = setInterval(() => {
            if (attachBackButton()) {
                clearInterval(interval);
            }
        }, 100);

        // 5초 후 중단
        setTimeout(() => clearInterval(interval), 5000);
    }

    // [추가] History API를 이용한 백업 처리
    if (window.location.href.includes('settings.html') || window.location.href.includes('list.html')) {
        history.pushState({ page: 'current' }, document.title, window.location.href);

        window.addEventListener('popstate', (event) => {
            // 히스토리가 빠지면 메인으로 강제 이동 (replace 사용)
            window.location.replace('index.html');
        });
    }
})();
