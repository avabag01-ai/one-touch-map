#!/bin/bash
# 프로젝트 구조 재정리 스크립트

echo "📁 새로운 프로젝트 구조 생성 중..."

cd /Users/mac/Documents/GitHub/one-touch-map

# src 디렉토리 생성
mkdir -p src/js
mkdir -p src/css
mkdir -p src/html
mkdir -p tests

echo "✅ 디렉토리 생성 완료"
echo ""
echo "📂 생성된 구조:"
echo "  src/"
echo "  ├── js/      (JavaScript 파일)"
echo "  ├── css/     (CSS 파일)"
echo "  └── html/    (HTML 파일)"
echo "  tests/       (테스트 파일)"
echo ""
echo "다음 단계: 파일 이동"
echo "  - 루트의 *.js → src/js/"
echo "  - 루트의 *.css → src/css/"
echo "  - 루트의 *.html → src/html/"
echo "  - test-*.js → tests/"
