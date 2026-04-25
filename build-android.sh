#!/bin/bash
# 원터치맵 Android APK 빌드 자동화 스크립트
# 사용법: ./build-android.sh

set -e  # 에러 발생 시 즉시 중단

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 원터치맵 Android APK 빌드 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. HTML/CSS/JS 파일 www 폴더로 복사
echo "📋 Step 1: HTML/CSS/JS 파일 www 폴더로 복사..."
cp -v index.html www/index.html
cp -v map.html www/map.html
cp -v list.html www/list.html
cp -v settings.html www/settings.html
echo "✅ 파일 복사 완료"
echo ""

# 2. 기존 assets 폴더 완전 삭제 (핵심!)
echo "🗑️  Step 2: 기존 Android assets 폴더 삭제..."
if [ -d "android/app/src/main/assets/public" ]; then
    rm -rf android/app/src/main/assets/public
    echo "✅ assets 폴더 삭제 완료"
else
    echo "⚠️  assets 폴더 없음 (처음 빌드)"
fi
echo ""

# 3. Capacitor 동기화 (www → Android)
echo "📦 Step 3: Capacitor 동기화 (www → Android)..."
npx cap sync android
echo "✅ 동기화 완료"
echo ""

# 4. 클린 빌드
echo "🔨 Step 4: Android 클린 빌드..."
cd android
./gradlew clean assembleDebug
cd ..
echo "✅ 빌드 완료"
echo ""

# 5. APK 파일 위치 출력
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 빌드 성공!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 APK 파일: $APK_PATH"
    echo "📊 파일 크기: $APK_SIZE"
    echo ""
    echo "💡 다음 단계:"
    echo "   1. APK 파일 테스트"
    echo "   2. GitHub Release 업로드:"
    echo "      gh release create v2.0-xxx $APK_PATH"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "❌ 빌드 실패: APK 파일을 찾을 수 없습니다"
    exit 1
fi
