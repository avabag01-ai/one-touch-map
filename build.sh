#!/bin/bash
# 빌드 스크립트 - src에서 배포 폴더로 복사

echo "🚀 빌드 시작..."

cd /Users/mac/Documents/GitHub/one-touch-map

# 기존 빌드 산출물 삭제
echo "🧹 기존 빌드 산출물 정리..."
rm -rf www/*
rm -rf android/app/src/main/assets/public/*

# www 디렉토리 생성
mkdir -p www
mkdir -p android/app/src/main/assets/public

# src에서 www로 복사
echo "📦 src/ → www/ 복사 중..."
cp -r src/js/* www/ 2>/dev/null
cp -r src/css/* www/ 2>/dev/null
cp -r src/html/* www/ 2>/dev/null

# 루트의 필수 파일들도 복사
cp manifest.json www/ 2>/dev/null
cp service-worker.js www/ 2>/dev/null
cp icon-*.png www/ 2>/dev/null

# www에서 Android로 복사
echo "📦 www/ → android/assets/ 복사 중..."
cp -r www/* android/app/src/main/assets/public/

# Capacitor 설정 파일 복사
cp capacitor.config.json android/app/src/main/assets/ 2>/dev/null

echo ""
echo "✅ 빌드 완료!"
echo ""
echo "📂 배포 위치:"
echo "  - www/"
echo "  - android/app/src/main/assets/public/"
echo ""
echo "다음 단계:"
echo "  1. 앱 테스트"
echo "  2. Android 빌드: cd android && ./gradlew assembleDebug"
