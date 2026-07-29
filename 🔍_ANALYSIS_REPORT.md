# 🔍 One-Touch Map 프로젝트 분석 리포트

## 📊 발견된 주요 문제

### 🚨 심각도: 높음

#### 1. APK 파일 Git 저장소 오염 (60MB+)
**문제:**
- 14개의 APK 파일이 Git 저장소에 커밋되어 있음
- 총 용량: 약 60MB
- Git 히스토리를 영구적으로 오염시킴

**영향:**
- 저장소 크기 비대화
- Clone 속도 저하
- Git 성능 저하

**해결책:**
```bash
# .gitignore에 추가
*.apk
*.aab

# 기존 APK 파일 Git 히스토리에서 제거 (선택사항)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch *.apk" \
  --prune-empty --tag-name-filter cat -- --all
```

---

#### 2. 대량 중복 코드 (3중 복사)
**문제:**
- 같은 소스 파일이 3곳에 존재:
  1. 루트 디렉토리 (`/`)
  2. `www/` 디렉토리
  3. `android/app/src/main/assets/public/`

**중복 파일 목록:**
- `main-app.js` (21KB × 3 = 63KB)
- `ocr-app.js` (20KB × 3 = 60KB)
- `list-app.js` (12KB × 3 = 36KB)
- `main-style.css` (22KB × 3 = 66KB)
- `national-regions.js` (15KB × 3 = 45KB)
- `route-optimizer.js` (8KB × 3 = 24KB)
- 기타 다수...

**총 낭비 용량:** 약 500KB+

**해결책:**
```
권장 구조:
src/               ← 원본 소스 (단일 진실의 원천)
├── js/
├── css/
└── html/

빌드 스크립트로 자동 복사:
src/ → www/
src/ → android/app/src/main/assets/public/
```

---

#### 3. 죽은 코드 (Dead Code)
**의심 파일:**
- `app.js` - `main-app.js`로 대체된 것으로 보임
- `test-ocr.js` - 테스트 파일
- `test-ocr-advanced.js` - 테스트 파일
- `test-smart-ocr.js` - 테스트 파일
- `api-test.html` - 테스트 파일
- `gpstest.html` - 테스트 파일
- `debug-geocoding.html` - 디버그 파일

**확인 필요:**
- 실제 사용 여부 확인
- 사용 안 하면 삭제 또는 `tests/` 폴더로 이동

---

### ⚠️ 심각도: 중간

#### 4. 빌드 산출물이 Git에 포함됨
**문제:**
- `android/app/build/` 디렉토리가 Git에 포함됨
- 빌드할 때마다 변경사항 발생

**해결책:**
```bash
# .gitignore에 추가
android/app/build/
android/.gradle/
```

---

#### 5. node_modules가 너무 큼
**문제:**
- `package.json`에 의존성이 적은데 `node_modules`가 있음
- Capacitor만 사용하는 것으로 보임

**확인 필요:**
```bash
# 실제 사용 중인 패키지 확인
npm ls --depth=0
```

---

## 🔧 즉시 수정 가능한 항목

### 1. .gitignore 업데이트
```gitignore
# APK/AAB 파일
*.apk
*.aab

# Android 빌드 산출물
android/app/build/
android/.gradle/
android/local.properties

# Node
node_modules/
npm-debug.log
yarn-error.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# 임시 파일
*.log
*.tmp
```

### 2. 프로젝트 구조 재정리
```
one-touch-map/
├── src/                    ← 원본 소스
│   ├── js/
│   │   ├── main-app.js
│   │   ├── list-app.js
│   │   ├── ocr-app.js
│   │   └── ...
│   ├── css/
│   └── html/
├── tests/                  ← 테스트 파일 분리
│   ├── test-ocr.js
│   └── ...
├── scripts/                ← 빌드 스크립트
│   └── copy-assets.sh
├── www/                    ← 빌드 산출물 (자동 생성)
├── android/
└── package.json
```

### 3. 빌드 스크립트 작성
```bash
#!/bin/bash
# scripts/copy-assets.sh

echo "Copying assets..."

# www로 복사
cp -r src/* www/

# Android로 복사
cp -r src/* android/app/src/main/assets/public/

echo "Done!"
```

---

## 📈 예상 효과

### 즉시 효과:
- **저장소 크기 감소:** 60MB+ (APK 제거)
- **중복 코드 제거:** 500KB+
- **유지보수성 향상:** 단일 진실의 원천

### 장기 효과:
- **버그 감소:** 중복 코드 수정 누락 방지
- **개발 속도 향상:** 한 곳만 수정하면 됨
- **Git 성능 향상:** 불필요한 파일 추적 안 함

---

## 🎯 다음 단계

1. **즉시 실행:**
   - `.gitignore` 업데이트
   - APK 파일 삭제 (Git에서 제거)
   - 빌드 산출물 Git에서 제거

2. **단계적 리팩토링:**
   - `src/` 디렉토리 생성
   - 원본 파일 이동
   - 빌드 스크립트 작성
   - 중복 파일 삭제

3. **테스트:**
   - 빌드 정상 작동 확인
   - 앱 기능 정상 작동 확인

---

## 🐛 추가 분석 필요 항목

### 기능 버그 찾기:
1. JavaScript 에러 확인 (Console 로그)
2. API 호출 실패 확인
3. OCR 기능 작동 여부
4. 경로 최적화 작동 여부

**다음 명령으로 확인:**
```bash
# JavaScript 문법 에러 체크
npx eslint src/**/*.js

# 사용하지 않는 변수/함수 찾기
npx eslint --rule 'no-unused-vars: error' src/**/*.js
```

---

**작성일:** 2026-02-09
**분석 도구:** Omega Engine + Manual Review
