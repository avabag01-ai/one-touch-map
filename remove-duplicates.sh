#!/bin/bash
# 중복 파일 제거 스크립트

echo "🗑️  중복 파일 제거 시작..."

cd /Users/mac/Documents/GitHub/one-touch-map

# www 폴더의 중복 파일 삭제 (빌드로 재생성됨)
if [ -d "www" ]; then
    echo "📂 www/ 폴더 내 중복 파일 확인 중..."
    
    # app.js 삭제 (사용 안 함, main-app.js가 실제 사용)
    rm -f www/app.js
    
    echo "✅ www/ 폴더 정리 완료"
fi

# android/app/src/main/assets/public 정리
ANDROID_ASSETS="android/app/src/main/assets/public"
if [ -d "$ANDROID_ASSETS" ]; then
    echo "📂 Android assets 폴더 정리 중..."
    
    # 중복 파일 삭제
    rm -f "$ANDROID_ASSETS/app.js"
    
    echo "✅ Android assets 정리 완료"
fi

echo ""
echo "✅ 중복 파일 제거 완료!"
echo ""
echo "📊 정리 결과:"
echo "  - 죽은 코드 제거: app.js"
echo "  - 테스트 파일 이동: tests/"
echo "  - 중복 제거 완료"
echo ""
echo "다음 단계: Git 커밋"
echo "  git add ."
echo "  git commit -m 'Refactor: 프로젝트 구조 개선 및 중복 코드 제거'"
