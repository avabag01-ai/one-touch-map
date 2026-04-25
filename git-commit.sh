#!/bin/bash
# Git 커밋 스크립트

echo "📝 Git 커밋 준비 중..."

cd /Users/mac/Documents/GitHub/one-touch-map

echo ""
echo "1️⃣ Git 상태 확인"
git status

echo ""
echo "2️⃣ 새 파일 추가"
git add .gitignore
git add src/
git add tests/
git add scripts/
git add *.sh
git add package.json
git add README.md
git add 🔍_ANALYSIS_REPORT.md
git add ✅_CHECKLIST.md
git add 📘_PROJECT_MAP.md

echo ""
echo "3️⃣ APK 파일 Git에서 제거"
git rm --cached *.apk 2>/dev/null || echo "  (APK 파일 이미 제거됨)"

echo ""
echo "4️⃣ 빌드 산출물 Git에서 제거"
git rm -r --cached www/ 2>/dev/null || echo "  (www/ 이미 제거됨)"
git rm -r --cached android/app/build/ 2>/dev/null || echo "  (build/ 이미 제거됨)"
git rm -r --cached android/.gradle/ 2>/dev/null || echo "  (.gradle/ 이미 제거됨)"

echo ""
echo "5️⃣ 변경사항 확인"
git status

echo ""
echo "✅ 준비 완료!"
echo ""
echo "다음 명령으로 커밋하세요:"
echo "  git commit -m 'Refactor: 프로젝트 구조 개선 및 중복 코드 제거'"
echo ""
echo "또는 상세 메시지:"
cat << 'EOF'

git commit -m "Refactor: 프로젝트 구조 개선

- 중복 코드 제거 (500KB+)
- APK 파일 Git에서 제거 (60MB+)
- src/ 디렉토리 구조 도입
- 빌드 자동화 스크립트 추가
- .gitignore 설정
- README.md 작성
- 분석 리포트 및 체크리스트 추가"

EOF
