#!/bin/bash
# 빌드 산출물 정리 스크립트

echo "🧹 빌드 산출물 정리 중..."

cd /Users/mac/Documents/GitHub/one-touch-map

# Android 빌드 폴더 삭제
if [ -d "android/app/build" ]; then
    echo "📂 android/app/build/ 삭제 중..."
    rm -rf android/app/build/
    echo "✅ 삭제 완료"
fi

if [ -d "android/.gradle" ]; then
    echo "📂 android/.gradle/ 삭제 중..."
    rm -rf android/.gradle/
    echo "✅ 삭제 완료"
fi

# www 폴더 (빌드 산출물)
if [ -d "www" ]; then
    echo "📂 www/ 폴더 확인 중..."
    echo "⚠️  www/ 폴더는 Capacitor 빌드 산출물입니다."
    echo "   나중에 src/에서 자동 복사하도록 변경할 예정입니다."
fi

echo ""
echo "✅ 빌드 산출물 정리 완료!"
echo ""
echo "Git에서 제거하려면:"
echo "  git rm -r --cached android/app/build/"
echo "  git rm -r --cached android/.gradle/"
echo "  git commit -m 'Remove build artifacts from repository'"
