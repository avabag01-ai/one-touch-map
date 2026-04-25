# 원터치맵 빌드 가이드

## 🚀 빠른 시작

```bash
# 한 줄로 끝!
./build-android.sh
```

## 📋 빌드 스크립트가 하는 일

1. **파일 복사**: HTML/CSS/JS → www 폴더
2. **Assets 삭제**: `android/app/src/main/assets/public` 완전 제거 ⚠️ 중요!
3. **동기화**: `npx cap sync android`
4. **클린 빌드**: `./gradlew clean assembleDebug`
5. **결과 출력**: APK 위치 & 크기

## ⚠️ 왜 Assets 폴더를 삭제해야 하나?

**문제:**
- Capacitor는 **덮어쓰기만** 하고 완전 갱신을 안 함
- 옛날 파일이 남아서 **변경사항 반영 안 됨**

**해결:**
- Assets 폴더 삭제 후 재빌드 → 즉시 반영!

## 🔧 수동 빌드 (스크립트 안 쓸 때)

```bash
# 1. HTML 파일 www로 복사
cp index.html map.html list.html settings.html www/

# 2. Assets 폴더 삭제 (필수!)
rm -rf android/app/src/main/assets/public

# 3. Capacitor 동기화
npx cap sync android

# 4. 클린 빌드
cd android && ./gradlew clean assembleDebug
```

## 📦 GitHub Release 업로드

```bash
# 빌드 후
gh release create v2.0-xxx \
  android/app/build/outputs/apk/debug/app-debug.apk \
  --title "v2.0 제목" \
  --notes "변경사항 설명"
```

## 🐛 문제 해결

### Q: 변경사항이 APK에 반영 안 돼요
**A:** Assets 폴더 삭제 후 재빌드
```bash
rm -rf android/app/src/main/assets/public
npx cap sync android
cd android && ./gradlew clean assembleDebug
```

### Q: 앱 설치 후에도 옛날 버전이에요
**A:** 앱 완전 삭제 후 재설치
- 설정 → 앱 → 원터치맵 → 삭제
- APK 재설치

### Q: 빌드는 성공했는데 실행 안 돼요
**A:** Gradle 캐시 삭제
```bash
cd android
./gradlew clean
./gradlew --stop
cd ..
rm -rf android/.gradle
./build-android.sh
```

## 📝 체크리스트

빌드 전:
- [ ] HTML/CSS/JS 수정 완료
- [ ] 코드 테스트 완료
- [ ] Git 커밋 & 푸시

빌드:
- [ ] `./build-android.sh` 실행
- [ ] APK 파일 생성 확인
- [ ] APK 테스트 (실제 기기)

배포:
- [ ] GitHub Release 생성
- [ ] APK 업로드
- [ ] Release Notes 작성

## 💡 팁

- **항상 클린 빌드 사용** - 캐시 문제 방지
- **빌드 전 Git 커밋** - 롤백 가능
- **APK 테스트 필수** - 릴리스 전에 실제 기기에서 테스트
- **버전 관리** - v2.0-backspace-fix 같은 명확한 이름 사용
