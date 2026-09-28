# 전역 UI 점검과 일정 카드 정리

## 변경

- 기존 대규모 미커밋 작업(트랙·스티커·설정·컨텍스트 메뉴·공통 컨트롤·조회 구조)을 보존했다. 이번 작업은 프런트 UI·인접 테스트·문서만 수정하며 API·DB·실제 데이터를 변경하지 않는다.
- 공통 Input/Button/DropdownSelect/MenuSurface/DisclosureSummary와 제품 호출자를 검색했다. 직접 button/select/summary는 공통 ui.tsx에 한정되어 있으며 plain 사용은 캘린더 셀·시간 손잡이·카드 선택·세로 탭 등 구조적 용도다. 시계의 SVG는 도메인 도형이다. StickyWindow의 최소화·리사이즈 SVG 두 개는 ActionIcon 밖에서 정의된 기존 예외로 발견했다. StickyDemo에서 실제 컴포넌트를 재사용하지만 아이콘 정의는 향후 공통화할 후보로 기록한다. 이번에는 도형을 임의로 바꾸지 않았다.
- 원형 체크 상태 예시가 레퍼런스에 없던 누락을 completion-reference에 보완했다. 네모의 체크는 유지하고 원형 task-check는 success색 내부 원을 확대/축소한다. 네이티브 접근성·disabled·모션 선호는 유지한다.
- 토스트의 translateY를 translateX(-48px)로 바꿔 기존 우하단 자리로 왼쪽에서 들어온다.
- 캘린더 축소가 전환 20%에서 사라지던 원인을 수정했다. 축소는 75%까지 보이며 기존 560ms 토큰과 ease-exit으로 마지막까지 이동한다. 확대/좌우 이동·중단 정리·모션 축소는 유지한다.
- 145px 고정 hover 여백을 ScheduleCardActions 실측 너비+24px로 교체했다. ResizeObserver로 언어·너비 변화도 반영한다. 사용자가 메모 표시 원으로 지칭한 요약 우측 원은 실제로 work-state-dot(일정 상태)이며, 메모 버튼의 memo-dot과 별개다.
- Today 하단 중복 수정 링크를 제거하고 우상단만 남겼다. 모바일 접근이 사라지지 않도록 이 카드의 수정 버튼은 모바일에서도 표시한다. Today·일간 카드의 워크명 옆 시간, 일정 메모 한 줄 미리보기를 추가했다. 표시 공백만 정규화하며 원문은 저장하지 않는다.

## 문서

- SPEC·DESIGN_SYSTEM에 카드·완료 표현·토스트·축소 모션 계약을 반영했다. STATUS·PRODUCT_GUIDE에 카드 표시와 모바일 진입점, CODE_MAP에 변경 소유 위치, CHANGES에 이 기록을 연결했다. 기존 기록의 사실과 해시는 이번 수정 범위 외에는 바꾸지 않는다.
- 지정 레퍼런스: design-reference.tsx의 completion-reference, 입력/버튼, Toast 데모. 실제 ui.tsx·design-system.css·Toast/toast.css·ScheduleCardActions·TodayScheduleCard·SavedScheduleCard·useCalendarTransition을 읽고 대조했다.

## 검증

- 선택 테스트: Today, SavedScheduleCard, Calendar, ScheduleCardActions 4개 파일 32개 통과. 공백 정규화·빈 메모·헤더 시각·단일 수정·실측 여백·축소 불투명 유지 및 기존 중단/모션 축소 회귀를 확인했다.
- 브라우저: 레퍼런스의 원형 선택/해제/disabled와 키보드 Space, 네모 체크를 확인했다. 1280px Today에서 상태 원과 툴바의 간격 약 30px, 390px에서 우상단 수정·한 줄 메모·이름 옆 시각과 가로 넘침 없음(scrollWidth 390px)을 확인했다. 사용자 데이터를 저장하지 않았다.
- 전체 프런트 검사와 최종 문서 게이트는 아래 후속 결과에 기록한다. 실제 터치 기기·OS 모션 설정 변경·모든 화면/언어 조합의 시각 전수 검사는 미실시다.

- 첫 전체 검사는 344개 중 App 통합 테스트 1개가 제거한 하단 수정 링크를 찾아 실패했다(이번 변경에 따른 기대값 수정 필요). 실제 남은 우상단 스케줄 수정 링크로 테스트를 갱신하고 저장 실패 초안·재시도·포커스 복귀 검증을 유지했다.
- 두 번째 전체 검사에서 61개 파일 344개 테스트 통과 후 TypeScript가 새 테스트의 미지원 exact 옵션을 발견했다. 문자열 name의 기본 정확 일치를 사용하도록 수정했다.

- 최종 npm run check:frontend 통과: 문서/기록 게이트, 포맷, ESLint·디자인·구조 검사, 61개 파일 344개 테스트, TypeScript와 Vite 빌드. 기존 500kB 초과 번들 경고(현재 약 594kB)는 남는다. 백엔드는 변경하지 않아 재검사하지 않았다.
- 브라우저 월간→연간 전환 완료 화면도 확인했다. 브라우저 도구의 읽기 전용 DOM 환경에서 getAnimations를 지원하지 않아 실행 중 프레임 타이밍을 직접 추출하지는 못했다. 축소 지속·불투명도는 Calendar 애니메이션 회귀 테스트로 검증했으며 동영상 프레임별 시각 검증은 미실시다.
- 최종 git diff --check 및 기록 재연결 후 npm run check:docs 통과.
