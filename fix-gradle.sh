# Gradle 설정 수정 스크립트

echo "🔧 Gradle 설정 수정 중..."

cd /Users/mac/Documents/GitHub/one-touch-map/android

# gradle.properties 파일 확인
if [ -f "gradle.properties" ]; then
    echo "📝 gradle.properties 파일 발견"
    
    # GRADLE_LOCAL_JAVA_HOME 관련 라인 주석 처리
    sed -i '' 's/^org.gradle.java.home/#org.gradle.java.home/g' gradle.properties
    
    echo "✅ 설정 수정 완료"
else
    echo "⚠️  gradle.properties 파일이 없습니다."
fi

echo ""
echo "다음 단계:"
echo "  1. Android Studio 재시작"
echo "  2. File → Invalidate Caches / Restart"
echo "  3. Gradle Sync 다시 실행"
