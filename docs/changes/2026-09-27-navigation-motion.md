# 프리셋·캘린더 탐색 모션

## 변경

- 워크/태스크와 캘린더 일/월/연 탭에 HorizontalNavigation의 단일 실측 밑줄을 연결했다. 선택 변경·너비 변경에 맞춰 460ms 이동한다. PresetWorkspace가 종류 변경에도 헤더와 표시선을 유지하고 HorizontalPage는 순서에 따라 본문을 좌우 56px·560ms로 전환한다. 링크 탐색·모달 배경 유지·검색/등록 동작은 보존한다.
- 사이드 메뉴는 기존 모드 setter로 캘린더 전환 준비를 건너뛰고 있었다. CalendarNavigation ref를 통해 탭과 같은 changeMode를 호출하고 이전 DOM을 캡처한다. 최초 캘린더 진입에는 이전 캘린더가 없으므로 선택 모드로 진입한다.
- 깜빡임에 관여하는 세 경로를 수정했다. 새 범위 조회 때 알려진 막대가 사라지는 현상은 이전 요약의 날짜별 표시를 유지해 개선했다. 로딩 문구가 flex 높이/일간 패널 위치를 바꾸는 현상은 흐름 밖 로딩 표시로 제거했다. outgoing 종료가 incoming 종료보다 먼저 호출되어 마지막 프레임을 취소할 수 있던 경로는 양쪽 종료를 기다린다. 스냅샷은 원본 글자 크기/줄 높이/실측 배율을 보존한다. 중단·언마운트 시 즉시 정리는 유지한다.
- 기존 대규모 미커밋 변경과 병행 저장 표시/다이얼/팝업 작업을 보존했다. 작업 전 사본 및 HEAD diff로 기존 변경과 구분했다. 병행 작업이 일부 공통 파일을 포맷하고 기록에 포함한 사실을 해당 기록에서 확인했다. 백엔드/API/실제 데이터는 이 작업에서 변경하지 않았다.

## 문서

- SPEC에 프리셋 전환 및 사이드 메뉴 모션 계약, STATUS에 캘린더 범위, CODE_MAP에 새 공통 컴포넌트/프리셋 경계, DESIGN_SYSTEM에 수평 레퍼런스를 반영했다. CHANGES에서 연결한다.
- 기존 VerticalTabs·WorkspaceHeader·PresetSwitch·ui.tsx·useCalendarTransition과 CSS/모션 토큰을 읽었다. 브라우저의 settings-controls-reference 상태를 확인한 뒤 공통 HorizontalNavigation/HorizontalPage와 horizontal-navigation-reference를 먼저 등록하고 제품에 적용했다.

## 검증

- 선택 회귀 3개 파일 42개 통과(이후 느린 범위 조회 회귀 추가). 사이드 메뉴 월/연 모션, 표시선 DOM 유지, 양방향 본문, 중단/축소 설정, 두 애니메이션 종료 순서를 확인했다. lint·디자인·구조 검사 통과.
- 중간 실패는 이번 구현의 effect 동기 상태 변경 lint 및 imperative handle 선언 순서 lint였으며 effect 경로 대신 이벤트 기반 ref 연결로 수정했다. 새 통합 테스트가 숨겨진 사이드 메뉴까지 잔상으로 세던 selector를 전환 전용 속성으로 좁히고 통과했다. 첫 포맷 명령의 작업 디렉터리 오류는 frontend에서 재실행했다.
- 브라우저에서 사이드 메뉴 월간→연간 축소 중간 프레임 및 연간→월간 복귀, 완료 후 잔상 0개, 프리셋 태스크 선택과 밑줄 위치를 확인했다. 1280px 문서 너비 1280px 확인. 모바일 및 전체 검사 결과는 최종 검증 후 아래에 기록한다.
- 시작 전 전체 검사는 실행하지 않았으므로 기존 전체 합격을 주장하지 않는다. 병행 작업의 기록 본문 변경으로 중간 check:changes가 실패한 사실을 확인했으며 해당 작업의 검증으로 가장하지 않는다. 실제 터치 기기·OS 모션 설정 전환과 고속 동영상의 모든 프레임 비교는 미실시다.

- 추가 회귀(느린 요약 조회 중 막대 유지·새 응답 교체)를 포함한 전체 프런트 테스트 64개 파일 359개 통과. 독립 전체 검사 단계는 병행 알림 변경의 3개 파일 포맷, reminderInbox의 미연결 모듈, Toast의 Notifications 번역 키 미등록으로 실패했다. 이번 탐색 코드의 테스트 실패는 없지만 전체 check:frontend 성공으로 기록하지 않는다.
- 390px 실제 프리셋 페이지의 문서 폭 390px, 태스크 선택·밑줄 상태를 확인했다. 모바일 레퍼런스는 DOM 실측 폭 348.8px/뷰포트 390px과 연간 선택을 확인했으나 브라우저 캡처가 축소된 전체 화면으로 반환되어 그 화면의 픽셀 단위 시각 판정은 제한적이다. 데스크톱 레퍼런스에서 Enter로 월간 선택 및 disabled 상태를 확인했다. 뷰포트는 원복했다.
- 최초 기록 명령이 병행 작업의 Toast.tsx/toast.css를 자동 수집했다. 두 파일의 diff/본문을 읽고 선택적 재알림 드롭다운(5·10·30·60·180분), usePopupExit 이후 콜백, 아래 80px 퇴장 변수 추가를 확인했다. 이 기능의 구현/완료는 이번 작업의 성과로 포함하지 않는다. 이전 저장 표시 작업의 별도 기록에서도 이 병행 변경을 설명하고 있다.

- 게이트 복구를 위해 추가로 읽은 병행 알림 변경(현재 진행 중): 서버 schedules route/service는 ReminderQuery.include의 최대 200개 UUID로 시작 후 보관 알림을 검증하되 소유자·활성 상태 조건을 유지한다. 프런트 reminders API는 include 목록과 isReminder 응답 검증을 추가했다. reminderInbox는 계정별 localStorage, 수신/확인/재알림 시각, 최대 200개·30일 항목 및 seen/push 병합을 정의한다. NotificationMenu/notifications.css는 미확인 목록·모두 확인·트랙 포함 일정 링크·재알림 시각을 정의하고, AnchoredPopup에 선택적 width, ActionIcon에 notifications 도형, ko/en/ja에 Notifications 번역을 추가했다. 이는 소스를 읽은 사실의 기록이며 제품 연결·동작/백엔드 검증 완료를 뜻하지 않는다.
- 후속 빌드는 위 번역 추가 후 NotificationMenu의 toReversed 타깃 지원과 IconButton ref 타입 오류 등으로 실패했다. 병행 알림 코드 수정은 해당 작업에 남겼다. 탐색 구현의 느린 응답 회귀를 포함한 Calendar 12개 테스트는 통과했다.
- 개발 서버와 최종 캘린더 검증 탭(http://localhost:15173/#/calendar), 수평 탐색 레퍼런스 탭을 유지한다. 이 작업에서 실제 일정·프리셋을 저장하거나 체크하지 않았다.

- 최종 diff를 시작 사본과 비교하고 git diff --check를 통과했다. 기록 재연결 후 npm run check:docs 통과(268개 변경 파일). 재시도한 npm run check:frontend는 문서 게이트 통과 후 병행 알림 작업의 5개 파일 포맷에서 중단됐다. 해당 진행 중 코드를 강제로 포맷/되돌리지 않았다. 전체 완료 검사는 미통과이며 앞서 실행한 359개 테스트 통과와 구분한다.
- 검증 화면을 저장소 밖 visualizations/2026/09/27/01a0e334-526b-7110-ae6a-8e7b86ccd036/navigation-motion.png에 저장하고 임시 뷰포트를 원복했다. 캘린더와 레퍼런스 탭은 유지했다.

- 마지막 기록 명령에 자동 포함된 병행 변경도 본문을 읽었다: Reminders는 계정 키·Web Locks 저장 병합·15초 폴링·storage/push 구독·미확인 메뉴 render prop·Toast 재알림을 연결하고, reminderInbox에 replayed 상태를 추가했으며 IconButton은 ref 전달을 위해 ComponentProps<'button'> 타입을 사용한다. 이 변경은 탐색 기능과 별개의 진행 중 작업이며 위 359개 테스트 실행 뒤 바뀌었으므로 그 검사로 검증됐다고 주장하지 않는다.
