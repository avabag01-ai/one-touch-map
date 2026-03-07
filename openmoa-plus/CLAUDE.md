# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when
working with code in this repository.

## 프로젝트 개요

**OpenMoa**는 삼성 모아키 한국어 키보드를 재구현한 오픈소스 Android IME(입력기)입니다.
자음 키를 누른 채 방향으로 드래그하여 모음을 입력하는 제스처 기반 한글 입력 방식을 사용합니다.

- 패키지: `pe.aioo.openmoa`

## 빌드 및 테스트 명령어

```bash
# 유닛 테스트 실행 (CI에서도 동일하게 사용)
./gradlew testDebugUnitTest

# 기기 연결 테스트 실행
./gradlew connectedAndroidTest

# 디버그 APK 빌드
./gradlew assembleDebug
```

CI는 GitHub Actions에서 JDK 21 + Ubuntu 환경으로 `testDebugUnitTest`를 실행합니다.

## 아키텍처

### 핵심 레이어

**1. IME 서비스 (`OpenMoaIME.kt`)**

- `InputMethodService`를 상속한 메인 서비스
- 10가지 키보드 모드(`IMEMode` enum) 관리: 한국어/영어 × 기본/특수문자/숫자/방향키/전화번호패드
- `KeyboardFrameLayout`에서 올라오는 `BaseKeyMessage`(문자 또는 특수키) 수신 후 InputConnection에 전달
- Koin DI로 `Config` 인스턴스를 주입받음

**2. 한글 조합 엔진 (`hangul/`)**

- `HangulAssembler`: 자음·모음 조합, 복합 자음/모음 처리, 아래아(ㆍ, ᆢ) 사용.
- HangulParser 라이브러리(소스 포함)를 활용해 유효성 검증
- `MoeumGestureProcessor`: 8방향 제스처 시퀀스를 모음으로 변환

**3. 뷰 레이어 (`view/`)**

- `KeyboardFrameLayout`: 키보드 레이아웃 전환 컨테이너
- `keyboardview/`:
   - `OpenMoaView`(한국어 모아키), `QuertyView`(영어),
   - `ArrowView`, `NumberView`, `PhoneView`, `PunctuationView`
- `keytouchlistener/`: 키 유형별 터치 핸들러 (아래 참조)

**4. 터치 리스너 계층**

- `BaseKeyTouchListener` (추상): 모든 리스너의 기반
- `JaumKeyTouchListener`: 자음 키 + 제스처 감지 (`atan2` 각도 계산, 50px 임계값)
- `FunctionalKeyTouchListener`: 상태 변경 키 (shift, 모드 전환)
- `SimpleKeyTouchListener`: 단순 단일 동작 키
- `CrossKeyTouchListener`: 방향키
- `RepeatKeyTouchListener`: 길게 누르면 반복되는 키

### 한글 입력 플로우

1. 사용자가 자음 키 누름 → `JaumKeyTouchListener`가 드래그 방향 감지
2. `MoeumGestureProcessor`가 제스처 시퀀스 → 모음 결정
3. `HangulAssembler`가 자음+모음 조합 → 조합 중 문자 표시
4. 다음 자음 입력 또는 액션 키 → 문자 확정 후 InputConnection 전달

### IMEMode 확장 시 주의사항

`IMEMode`에 새 항목을 추가하면 `OpenMoaIME.kt` 내 모든 exhaustive `when (imeMode)` 분기에
케이스를 추가해야 합니다. 누락 시 컴파일 오류가 발생합니다. 대상 위치:

- `SpecialKey.LANGUAGE`, `HANJA_NUMBER_PUNCTUATION`, `ARROW` 처리
- `onStartInputView()` 내 `TYPE_CLASS_NUMBER`, `TYPE_CLASS_PHONE` 분기
- `returnFromNonStringKeyboard()`

특정 키보드에서만 진입 가능한 모드는 해당 언어 계열 조건과 쉼표(,)로 묶어 처리합니다.

예) `IME_EMOJI`는 한국어 키보드(`OpenMoaView`)에서만 진입 가능하므로,
대부분의 위 분기에서 `IME_KO_*` 조건들과 함께 묶어 별도 분기 없이 처리합니다.

### 메시지 시스템

키 이벤트는 `LocalBroadcastManager`를 통해 전달:

- `StringKeyMessage`: 문자 키 (일반 문자)
- `SpecialKeyMessage`: 특수 동작 (`SpecialKey` enum - 27가지: BACKSPACE,
  ENTER, LANGUAGE, 방향키, COPY/CUT/PASTE 등)

### 설정 (`Config`)

Koin으로 싱글턴 제공:

- `longPressRepeatTime`: 50ms
- `longPressThresholdTime`: 500ms
- `gestureThreshold`: 50px
- `hapticFeedback`: true
- `maxSuggestionCount`: 10

## 주요 파일 위치

| 파일 | 역할 |
|------|------|
| `app/src/main/kotlin/pe/aioo/openmoa/OpenMoaIME.kt` | 메인 IME 서비스 |
| `app/src/main/kotlin/pe/aioo/openmoa/hangul/HangulAssembler.kt` | 한글 자모 조합 엔진 |
| `app/src/main/kotlin/pe/aioo/openmoa/hangul/MoeumGestureProcessor.kt` | 제스처→모음 변환 |
| `app/src/main/kotlin/pe/aioo/openmoa/view/keyboardview/OpenMoaView.kt` | 한국어 키보드 레이아웃 |
| `app/src/main/kotlin/pe/aioo/openmoa/view/keytouchlistener/JaumKeyTouchListener.kt` | 자음+제스처 터치 처리 |
| `app/src/main/kotlin/pe/aioo/openmoa/config/Config.kt` | 설정 데이터 클래스 |
| `app/src/main/res/values/strings.xml` | 모든 UI 문자열 (한국어) |
