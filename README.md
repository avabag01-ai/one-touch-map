# 📦 One-Touch Map (원터치 지도)

배송 관리를 위한 OCR 주소 인식 및 최적 경로 앱

## 🚀 빠른 시작

### 1. 프로젝트 구조 설정
```bash
npm run setup    # src/ 디렉토리 생성
npm run move     # 파일 정리
```

### 2. 빌드
```bash
npm run build    # src/ → www/ 및 Android assets 복사
```

### 3. Android 앱 실행
```bash
npm run android  # Android Studio 열기
```

---

## 📂 프로젝트 구조

```
one-touch-map/
├── src/                    # 원본 소스 코드 (단일 진실의 원천)
│   ├── js/                 # JavaScript 파일
│   │   ├── main-app.js     # 메인 앱 로직
│   │   ├── list-app.js     # 배송 목록
│   │   ├── ocr-app.js      # OCR 처리
│   │   └── ...
│   ├── css/                # 스타일시트
│   └── html/               # HTML 페이지
├── tests/                  # 테스트 파일
├── scripts/                # 빌드/유틸리티 스크립트
├── www/                    # 빌드 산출물 (자동 생성)
├── android/                # Android 프로젝트
└── package.json

```

---

## 🛠️ 개발 워크플로우

### 코드 수정 시:
1. `src/` 디렉토리의 파일 수정
2. `npm run build` 실행
3. 앱 테스트

### 새 기능 추가 시:
1. `src/js/`에 새 파일 생성
2. `build.sh`에 복사 명령 추가 (필요시)
3. `npm run build` 실행

---

## 📋 주요 기능

- ✅ **OCR 주소 인식** - Tesseract.js 사용
- ✅ **지도 표시** - Leaflet + VWorld API
- ✅ **경로 최적화** - 최단 거리 알고리즘
- ✅ **앵커 시스템** - 데이터 최적화
- ✅ **전국 행정구역** - 시/도/구/군 데이터

---

## 🔧 유용한 명령어

```bash
npm run build     # 빌드
npm run clean     # 빌드 산출물 정리
npm run sync      # Capacitor 동기화
npm run android   # Android Studio 열기
```

---

## 📝 Git 사용 시 주의사항

### ⚠️ 절대 커밋하지 말 것:
- `*.apk` - APK 파일
- `www/` - 빌드 산출물
- `android/app/build/` - Android 빌드 폴더
- `node_modules/` - NPM 패키지

이미 `.gitignore`에 설정되어 있습니다.

---

## 🐛 문제 해결

### 빌드가 안 될 때:
```bash
npm run clean
npm run build
```

### Android 앱이 안 열릴 때:
```bash
npm run sync
npm run android
```

### 파일이 없다고 나올 때:
```bash
npm run setup
npm run move
npm run build
```

---

## 📄 라이선스

MIT License

---

**개발자:** 사장님  
**버전:** 1.0.0  
**최종 업데이트:** 2026-02-09
