# OpenMoa+ 개선 키보드 구현 플랜

## 프로젝트 개요
OpenMoa (오픈소스 모아키) 포크 → 오타 방지 + 학습 용이성 개선 키보드 제작

**베이스**: https://github.com/AiOO/OpenMoa (MIT 라이선스, Kotlin 94%)

---

## 구현할 기능 5가지

### 기능 1: 방사형 모음 영역 시각화 + 반전 피드백
**파일**: 신규 `RadialVowelOverlay.kt` + `JaumKeyTouchListener.kt` 수정

자음 키 누르면 주변에 8방향 모음 영역이 방사형으로 표시됨.
손가락이 특정 영역에 들어가면 해당 영역이 반전(pressed 효과)되어
지금 어떤 모음이 선택되는지 실시간 확인 가능.

**구현 상세**:
- `RadialVowelOverlay` 커스텀 View 생성 (Canvas로 파이 차트형 영역 그리기)
- 8개 영역: ㅏ(0°), ㅣR(45°), ㅗ(90°), ㅣL(135°), ㅓ(180°), ㅡL(225°), ㅜ(270°), ㅡR(315°)
- `JaumKeyTouchListener.ACTION_DOWN` → 오버레이 표시 (누른 키 위치 기준)
- `JaumKeyTouchListener.ACTION_MOVE` → 현재 각도에 해당하는 영역 반전
- `JaumKeyTouchListener.ACTION_UP` → 오버레이 숨기기
- `OpenMoaView`에 오버레이를 FrameLayout으로 추가

**수정 파일**:
- 신규: `app/src/main/kotlin/pe/aioo/openmoa/view/RadialVowelOverlay.kt`
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/view/keytouchlistener/JaumKeyTouchListener.kt`
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/view/keyboardview/OpenMoaView.kt`
- 수정: `app/src/main/res/layout/open_moa_view.xml` (FrameLayout 래퍼 추가)

---

### 기능 2: 계층적 힌트 시스템 (초보 모드)
**파일**: 신규 `HierarchicalHintView.kt` + 신규 `HangulHintData.kt`

자음 누르면 1획으로 만들 수 있는 글자들을 방사형 영역에 표시.
예: ㄱ 누르면 → 가(→), 거(←), 고(↑), 구(↓) 등이 각 방향에 표시됨.

1획 후 (예: "가" 상태) → 다음 획으로 만들 수 있는 글자 갱신.
예: 가 → 개(←), 갸(→↓) 등

**구현 상세**:
- `HangulHintData`: 자음별 → 방향별 → 완성 글자 매핑 데이터
  - 자음 19개 × 모음 방향 8개 = 기본 매핑 테이블
  - 2획차, 3획차 매핑 테이블 (MoeumGestureProcessor 로직 기반으로 자동 생성)
- `HierarchicalHintView`: RadialVowelOverlay 위에 글자 텍스트 오버레이
  - 1획차: 방사형 영역 안에 "가", "거", "고", "구" 등 표시
  - 2획차: 현재 모음 resolve 후 다음 가능한 글자 업데이트
- MoeumGestureProcessor에 `peekResolve()` 메서드 추가 (현재 상태에서 어떤 모음이 나올지 미리보기)
- 설정에서 ON/OFF 가능 (Config에 `showHint: Boolean` 추가)

**수정 파일**:
- 신규: `app/src/main/kotlin/pe/aioo/openmoa/view/HierarchicalHintView.kt`
- 신규: `app/src/main/kotlin/pe/aioo/openmoa/hangul/HangulHintData.kt`
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/hangul/MoeumGestureProcessor.kt` (peekResolve 추가)
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/view/keytouchlistener/JaumKeyTouchListener.kt`

---

### 기능 3: 완성 글자 프리뷰 (키보드 상단)
**파일**: `open_moa_ime.xml` 수정 + `OpenMoaIME.kt` 수정

획을 긋는 도중 현재까지 조합된 글자를 키보드 상단 바에 크게 표시.
손가락에 안 가리는 위치. suggestion strip 영역 활용.

**구현 상세**:
- `open_moa_ime.xml`에 프리뷰 TextView 추가 (suggestion strip 위)
  - 높이 36dp, 큰 폰트 (24sp), 중앙 정렬
- `JaumKeyTouchListener`에서 ACTION_MOVE마다 현재 모음 resolve → broadcast로 전달
- `OpenMoaIME`에서 broadcast 수신 → 자음 + 현재모음 조합해서 프리뷰 표시
- ACTION_UP에서 프리뷰 숨김
- 새 broadcast action: `"gesturePreview"` (기존 `"keyInput"`과 분리)

**수정 파일**:
- 수정: `app/src/main/res/layout/open_moa_ime.xml`
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/OpenMoaIME.kt`
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/view/keytouchlistener/JaumKeyTouchListener.kt`
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/hangul/MoeumGestureProcessor.kt`

---

### 기능 4: 텍스트창 실시간 반영
**파일**: `OpenMoaIME.kt` 수정

현재는 ACTION_UP에서만 텍스트 전송.
획 긋는 도중에도 setComposingText로 실시간 업데이트.

**구현 상세**:
- `JaumKeyTouchListener`에서 ACTION_MOVE마다 현재 조합 상태를 broadcast
- `OpenMoaIME`에서 수신 → `currentInputConnection.setComposingText()` 호출
- ACTION_UP에서 최종 확정 (기존 로직 유지)
- 주의: 성능 이슈 방지를 위해 이전 모음과 동일하면 broadcast 스킵

**수정 파일**:
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/OpenMoaIME.kt`
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/view/keytouchlistener/JaumKeyTouchListener.kt`

---

### 기능 5: 자음 더블탭 삭제
**파일**: `JaumKeyTouchListener.kt` 수정

같은 자음 키를 빠르게 두 번 탭하면 마지막 글자 삭제.
백스페이스까지 손가락 이동 안 해도 됨.

**구현 상세**:
- `JaumKeyTouchListener`에 `lastTapTime`, `lastTapKey` 변수 추가
- ACTION_DOWN에서 현재 시간 체크
- 같은 키 + 300ms 이내 → BACKSPACE 이벤트 전송, 모음 처리 스킵
- 300ms 이상 → 정상 자음 입력 진행
- Config에 `doubleTapDeleteTime: Long = 300L` 추가

**수정 파일**:
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/view/keytouchlistener/JaumKeyTouchListener.kt`
- 수정: `app/src/main/kotlin/pe/aioo/openmoa/config/Config.kt`

---

## 구현 순서

1. **프로젝트 셋업** - OpenMoa 코드를 현재 레포에 복사, 빌드 확인
2. **기능 5: 더블탭 삭제** - 가장 단순, 독립적
3. **기능 1: 방사형 모음 시각화** - 핵심 기능, UI 기반
4. **기능 3: 상단 프리뷰** - 기능 1과 연동
5. **기능 4: 실시간 텍스트** - 기능 3과 연동
6. **기능 2: 계층적 힌트** - 기능 1 위에 구축, 가장 복잡

---

## 설정 (Config.kt 추가 항목)

```kotlin
data class Config(
    // 기존
    val longPressRepeatTime: Long = 50L,
    val longPressThresholdTime: Long = 500L,
    val gestureThreshold: Float = 50f,
    val hapticFeedback: Boolean = true,
    val maxSuggestionCount: Int = 10,
    // 신규
    val showRadialOverlay: Boolean = true,     // 방사형 오버레이 표시
    val showHint: Boolean = true,              // 계층적 힌트 (초보모드)
    val showTopPreview: Boolean = true,        // 상단 프리뷰
    val realtimeComposing: Boolean = true,     // 실시간 텍스트 반영
    val doubleTapDeleteTime: Long = 300L,      // 더블탭 삭제 시간(ms)
)
```
