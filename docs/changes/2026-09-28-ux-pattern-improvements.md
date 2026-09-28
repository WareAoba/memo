# UX·컴포넌트 패턴 재점검 후속 개선

## 변경

[재점검](2026-09-27-ux-pattern-reaudit.md)의 “레퍼런스와 다른 입력”을 제외한 사례와 코드 축소·통합 후보를 개선했다. 기존 작업 트리의 트랙·알림·모달·디자인 변경은 이전 기록의 작업이며 이번 작업은 아래 후속 수정이다.

- 일정 검색은 결과 수와 빈 안내를 하나의 status로 통합하고 워크·태스크 목록은 비어 있을 때 결과 수를 중복 표시하지 않는다.
- 워크·태스크 상세에서 편집기의 태그와 겹치던 하단 태그 배지를 제거했다. 메모의 프리셋 적용 범위 상시 안내를 상세와 PresetMemoButton에서 제거했다. 저장 대상·직렬 저장·오류 복구는 유지한다.
- 알림 설정은 계정 푸시 허용 안내 한 줄, 현재 기기 상태와 필요한 동작으로 정리했다. 미지원·권한 차단·서버 비활성·실패 재시도는 유지한다. 초기화 안내는 보관함·기본 태스크/워크 연결 표현을 제거하고 현재 트랙에서 삭제/유지되는 데이터로 한국어·영어·일본어를 정정했다.
- SettingsProvider/컨텍스트의 미사용 saving 상태와 MemoAutosave의 외부 saved 성공 플래그를 제거했다. 요청 직렬화 running ref, private saved 문자열, dirty/saving·실패 초안·이탈 보호는 유지한다. Picker 검색 힌트는 결과별 한 번 계산한다.
- shared/anchoredPopover.ts로 DropdownSelect·DetailKindInput·AnchoredPopup·CalendarDatePicker의 top layer·위치·화면 경계·resize/scroll 구독을 통합했다. TaskNameInput도 같은 배치와 활성 행 스크롤을 사용한다. 제외 요청에 따라 TaskNameInput의 Button 옵션·aria-selected 표현과 직접 입력/확정 동작은 바꾸지 않았다.
- Today의 태스크 추가는 ScheduleTaskRows의 NewTaskRows를 재사용한다. 첫 행 즉시 열기, 다중 행·그룹 목록·필수 매개변수·실패 재시도를 공유하며 처리할 행이 없어지면 닫는다. 기존 AddTaskPicker 파일은 제거했다. 생성 폼은 일괄 저장 초안이라는 별도 책임을 유지하면서 기존 TaskNameInput·TaskDirectory·매개변수 구현을 공유한다.
- Today 카드의 완료/재개도 toggleScheduleCompletion을 사용한다. 완료 API·스냅샷·원본 격리 계약은 유지한다.

## 문서

SPEC·STATUS·CODE_MAP·DESIGN_SYSTEM·SETTINGS·TASK_CUSTOMIZATION에 변경된 UI 흐름·공통 위치 계산·삭제 안내를 반영하고 CHANGES에 연결한다. 서버 API·DB·migration은 변경하지 않았다.

디자인 기준: /design-reference.html#disclosure-reference의 DropdownSelect/DetailKindInput, #date-time-reference의 CalendarDatePicker/AnchoredPopup, #task-directory-reference의 TaskDirectory, shared/ui.tsx의 MenuSurface·Input·Button. 기존 컴포넌트와 레퍼런스를 확인하고 재사용했으며 새 디자인 패턴은 추가하지 않았다.

## 검증

- 관련 선택 검사: 14개 파일 77개 테스트 통과. Today 매개변수 실패 초안·재시도, 기존 자정 전환, 팝업 화면 경계·스크롤 추적·구독 해제, TaskNameInput 긴 목록 탐색 스크롤·Escape 검증을 포함한다.
- 첫 실행에서 하단 태그 배지를 기대하던 기존 테스트 1건이 실패하여 실제 유지되는 태그 입력값 검증으로 수정했다. Today 연결 중 존재하지 않는 타입 필드를 참조한 오류를 수정했다. 추가 영역 닫힘 effect가 끝나기 전 테스트를 종료한 후속 테스트 실패는 부모의 닫힘 상태까지 기다리도록 수정했다. 모두 이번 작업 중 발견·수정했으며 기존 실패로 분류하지 않는다.
- 프런트 lint·디자인·구조 검사 통과.
- 브라우저: 1280×900 날짜 팝업과 설정 알림/초기화 문구, 390×844 시간 팝업을 확인했다. 실제 데이터 저장·초기화·푸시 권한 변경은 실행하지 않았다.
- 전체 `npm run check:frontend` 통과: 포맷·lint·디자인·구조 검사, 68개 파일 379개 테스트, TypeScript·Vite 빌드 성공. Vite의 500kB 초과 청크 경고는 남아 있다.
- 브라우저의 빈 일정 검색에서 결과 수 중복이 없는 것을 확인했다. 작성 모달의 현재 트랙에는 등록 태스크가 없어 실제 제안 목록의 시각 검증은 하지 못했으며 해당 배치·탐색은 회귀 테스트로 확인했다. 검증 초안은 저장하지 않고 닫았다. 앱과 레퍼런스 탭 및 개발 서버는 유지한다.
- 최종 diff 검토 후 변경 기록 연결 및 `npm run check:docs` 통과: Markdown 69개 경로와 변경 파일 282개 기록을 확인했다. 백엔드 실행 코드를 변경하지 않아 백엔드 검사는 재실행하지 않았다. 전체 모바일 제품 흐름과 OS 모션 축소의 브라우저 검증은 수행하지 않았다.
