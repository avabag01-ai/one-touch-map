#!/bin/bash
# 파일 이동 스크립트 - 루트 파일들을 src/로 정리

echo "📦 파일 이동 시작..."

cd /Users/mac/Documents/GitHub/one-touch-map

# JavaScript 파일 이동
echo "📄 JavaScript 파일 이동 중..."
mv main-app.js src/js/ 2>/dev/null
mv list-app.js src/js/ 2>/dev/null
mv ocr-app.js src/js/ 2>/dev/null
mv app-settings.js src/js/ 2>/dev/null
mv anchor-system.js src/js/ 2>/dev/null
mv android-back.js src/js/ 2>/dev/null
mv route-optimizer.js src/js/ 2>/dev/null
mv national-regions.js src/js/ 2>/dev/null
mv service-worker.js src/js/ 2>/dev/null

# CSS 파일 이동
echo "🎨 CSS 파일 이동 중..."
mv main-style.css src/css/ 2>/dev/null
mv list-style.css src/css/ 2>/dev/null
mv settings-style.css src/css/ 2>/dev/null

# HTML 파일 이동
echo "📝 HTML 파일 이동 중..."
mv index.html src/html/ 2>/dev/null
mv list.html src/html/ 2>/dev/null
mv map.html src/html/ 2>/dev/null
mv settings.html src/html/ 2>/dev/null

# 테스트 파일 이동
echo "🧪 테스트 파일 이동 중..."
mv test-ocr.js tests/ 2>/dev/null
mv test-ocr-advanced.js tests/ 2>/dev/null
mv test-smart-ocr.js tests/ 2>/dev/null
mv api-test.html tests/ 2>/dev/null
mv gpstest.html tests/ 2>/dev/null

# 유틸리티 스크립트 이동
echo "🔧 유틸리티 파일 정리 중..."
mkdir -p scripts
mv analyze_duplicates.py scripts/ 2>/dev/null
mv embed_data.py scripts/ 2>/dev/null
mv fix_map.py scripts/ 2>/dev/null
mv generate_mindmap_json.py scripts/ 2>/dev/null
mv convert-icon.js scripts/ 2>/dev/null

# www 폴더 삭제 (중복이므로)
echo "🗑️  중복 폴더 정리 중..."
rm -rf www/

echo ""
echo "✅ 파일 이동 완료!"
echo ""
echo "📂 새로운 구조:"
echo "  src/"
echo "  ├── js/       (메인 소스 코드)"
echo "  ├── css/      (스타일시트)"
echo "  └── html/     (HTML 페이지)"
echo "  tests/        (테스트 파일)"
echo "  scripts/      (빌드/유틸리티 스크립트)"
echo ""
echo "다음 단계: 빌드 실행"
echo "  ./build.sh"
