# 기능별 파일 지도

- 진행 중 알림 목록: `frontend/src/features/schedules/NotificationMenu.tsx`, `notifications.css`, `reminderInbox.ts`(같은 폴더), `frontend/src/api/reminders.ts`. 통합·검증 완료 여부는 [복구 기록](changes/2026-09-27-reminder-concurrent-review.md)을 참고한다.

- 비모달 시간 휠 드롭다운: `frontend/src/features/shared/AnchoredPopup.tsx`와 DateTimePicker. MenuSurface/usePopupState 모션과 모달 내부 portal을 사용한다.
- 로컬 확인용 프리셋 생성: `scripts/seed-demo-presets.mjs`, `scripts/seed-demo-presets.test.mjs`. 명시한 트랙에 더미 워크 30개·태스크 120개를 API로 추가하며 재실행 시 기존 항목을 보존한다.
- 기존 리마인드 7일 제한 이관: `backend/migrations/202609270002_reminder_seven_days.sql`; 서비스 검증과 회귀는 `backend/src/services/schedules.rs`, `backend/tests/schedules.rs`.

- 날짜·시/분 휠 공통 선택기: `frontend/src/features/shared/DateTimePicker.tsx`와 인접 테스트. CalendarDatePicker를 재사용하고 design-reference.tsx의 date-time-reference에 등록한다.
- 순차 시간 입력·날짜 범위: `frontend/src/features/schedules/TimeEndpoint.tsx`, `ScheduleDateRange.tsx`, `ScheduleTimeText.tsx`(같은 폴더). TimeDial과 date-time-reference에서 공통 조절 박스를 사용하고 목록에는 시간 미지정/시작만 표현을 공유한다.
- 선택적 일정 시각 DB 이관: `backend/migrations/202609280001_optional_schedule_times.sql`, 검증·회귀는 schedules 서비스와 `backend/tests/schedules.rs`.
- 그룹별 태스크 다중 선택: `frontend/src/features/schedules/TaskDirectory.tsx`와 인접 테스트. 생성은 useScheduleTaskDraft, 저장된 일정은 ScheduleTaskRows에서 연결하며 task-directory-reference에 상태 예시가 있다.
- 자동 높이 메모: `frontend/src/features/shared/ui.tsx`의 AutoTextarea. ScheduleEditor와 MemoEditor에서 사용한다.


- 페이지 공통 배치: `frontend/src/features/shared/WorkspaceHeader.tsx`, `workspace-header.css` (같은 폴더). 일정 검색 진입점은 `frontend/src/features/schedules/ScheduleSearchControl.tsx`.
루트 기준 경로. 먼저 해당 행의 파일을 찾고 관련 심볼·테스트로 범위를 좁힌다.

## 문서·에이전트 검사

- 개발 도구 버전: 루트 `.nvmrc`(Node 24), `rust-toolchain.toml`(Rust 1.94.0·rustfmt·clippy). macOS 설치·실행은 루트 `README.md`를 참고한다.

- 구조 검사: `frontend/scripts/check-structure.mjs`와 `check-structure-tests.mjs` (같은 폴더). 프런트 lint에서 순환·미사용 모듈·계층 경계를 확인한다.
- 탐색 상태와 호환 URL: `frontend/src/features/workspace/workspaceRoute.ts`와 인접 테스트. `App.tsx`는 페이지와 단일 overlay 상태를 렌더한다.
- 이름 카탈로그 HTTP/응답 검증: `frontend/src/api/names.ts`; 로딩·오류 상태는 `frontend/src/features/shared/useNames.ts`.
- 헤더·브랜드의 기본/반응형 스타일: `frontend/src/styles/shell-calendar.css`; 독립 시각 확인: `frontend/tests/header.html`.

- 최근 기록: `docs/CHANGES.md` → `docs/changes/`. 기준 문서 갱신·검증 기록 절차: `docs/AGENT_HARNESS.md`.
- 파일별 기록 게이트·명령: `scripts/change-policy.mjs`, `scripts/check-changes.mjs`; 회귀 검사: `scripts/change-policy.test.mjs`.
- Codex 시작/프롬프트 문서 전달·종료 검사: `.codex/hooks.json`, `scripts/agent-docs-hook.mjs`. 로컬/CI 연결: `package.json`, `.github/workflows/check.yml`. 기록 해시: `docs/change-ledger.json`.

## 실행 흐름

- 브라우저: `frontend/src/main.tsx` → `App.tsx`(목록 hash 라우팅·상세/수정 통합 팝업) → `features/` → `api/client.ts`.
- 서버: `backend/src/main.rs` → `lib.rs` → `routes/mod.rs` → 기능 route → service → SQLite.
- DB 초기화: `backend/src/db/mod.rs`, `backend/migrations/`. 사용자 결정: `backend/src/auth.rs` (서비스 호환 import: `backend/src/local_user.rs`).
- API Host/Origin·응답 헤더: `backend/src/security.rs`, `backend/src/config.rs`, `backend/tests/security_audit.rs`. 앱 HTML 헤더: `frontend/vite.config.ts`, `docker/Caddyfile`.
- 워크는 UI·소스에서 `works`, HTTP·DB 및 기존 백엔드 테스트에서는 `entities`다.

## 변경 경로

| 기능 | 프런트 (`frontend/src/` 기준) | 백엔드 (`backend/src/` 기준) | 테스트 |
| --- | --- | --- | --- |
| 스티커 메모 | `features/sticky/`, `App.tsx`, `features/shared/ScheduleCardActions.tsx` | 기존 일정·실행 API 공유, 창/메모는 계정·트랙별 브라우저 저장 | `frontend/src/features/sticky/StickyWorkspace.test.tsx`, `frontend/src/features/sticky/StickySchedules.test.tsx` |
| 트랙 | `features/workspace/TrackBoundary.tsx`, `TrackSelector.tsx`, `trackContext.ts` (같은 폴더), `api/tracks.ts`, `api/trackScope.ts`, `App.tsx` | `routes/tracks.rs`, `services/tracks.rs`, 도메인 service, `backend/migrations/202609270001_tracks.sql` (루트 기준) | `backend/tests/tracks.rs`, `frontend/src/api/tracks.test.ts`, `frontend/src/features/workspace/TrackBoundary.test.tsx` |
| 가상 계정·인증 경계 | `features/auth/AccountBoundary.tsx`, `features/auth/AccountMenu.tsx`, `features/auth/account-menu.css`, `api/auth.ts`, `App.tsx` | `auth.rs`, `config.rs`, `lib.rs`, `migrations/202609260002_virtual_account.sql` (backend 기준) | `backend/tests/auth.rs`, `frontend/src/features/auth/AccountBoundary.test.tsx` |
| 워크 프리셋 | `features/works/`, `api/works.ts` | `routes/works.rs`, `services/works.rs` | `backend/tests/entities.rs`, `frontend/src/api/works.test.ts` |
| 태스크 프리셋 | `features/tasks/`, `api/taskPresets.ts` | `routes/task_presets.rs`, `services/task_presets.rs` | `backend/tests/task_presets.rs`, `frontend/src/features/tasks/TaskPresets.test.tsx` |
| 일정 생성·수정·검색 | `features/schedules/`, `api/schedules.ts` | `routes/schedules.rs`, `services/schedules.rs` | `backend/tests/schedules.rs`, `frontend/src/features/schedules/Schedules.test.tsx`, `frontend/src/features/schedules/ScheduleSearch.test.tsx` |
| 실행·완료 | `features/schedules/TaskExecution.tsx`, `api/schedules.ts` | `routes/execution.rs`, `services/execution.rs` | `backend/tests/execution.rs`, `frontend/src/features/schedules/TaskExecution.test.tsx` |
| Today·캘린더 | `features/workspace/` | 일정·실행 API를 공유 | 같은 폴더의 `*.test.tsx`, `frontend/src/reviewTimezone.test.tsx` |
| 시간 원판 | `features/schedules/TimeDial.tsx`, `dialGeometry.ts`, `DialFace.tsx` (같은 폴더) | 일정 검증 | `frontend/src/features/schedules/TimeDial.test.tsx` |
| 매개변수·메모 | `features/shared/taskParameters.ts`, `MemoButton.tsx`, `MemoPopover.tsx`, `memoPlacement.ts`, `MemoEditor.tsx`, `useMemoAutosave.ts`, `ScheduleCardActions.tsx`, `useMobileMemoLayout.ts` (같은 폴더) | `services/task_parameters.rs`, 일정·실행 service | `frontend/src/features/shared/taskParameters.test.ts`, `MemoButton.test.tsx`, `memoPlacement.test.ts`, `MemoEditor.test.tsx`, `useMemoAutosave.test.ts`, `ScheduleCardActions.test.tsx` (같은 폴더) |
| 사진 | `features/schedules/Photos.tsx`, `api/photos.ts` | `routes/photos.rs`, `services/photos.rs` | `backend/tests/photos.rs`, `frontend/src/features/schedules/Photos.test.tsx` |
| 알림·Web Push | `features/schedules/Reminders.tsx`, `api/push.ts`, `frontend/public/sw.js` (루트 기준) | `reminder_worker.rs`, `push.rs`, `routes/push.rs` | `backend/tests/push.rs`, `frontend/src/sw.test.ts` |
| 앱 설정·초기화 | `features/settings/`, `api/settings.ts`, `App.tsx`, `features/workspace/Sidebar.tsx` | `routes/settings.rs`, `services/settings.rs`, `migrations/202609250005_user_settings.sql` (backend 기준) | `frontend/src/features/settings/Settings.test.tsx`, `frontend/src/App.test.tsx`, `backend/tests/settings.rs`, `backend/tests/push.rs` |
| 공통 UI·모달 | `features/shared/`, `tokens.css`, `design-system.css` | — | 같은 폴더의 `*.test.tsx`, `frontend/scripts/check-design.mjs` |
| 다국어 | `i18n/`, `i18n/locales/`, `frontend/scripts/sync-i18n-assets.mjs` (루트 기준) | 알림의 날짜·시각·시간대 필드: `reminder_worker.rs` | `frontend/src/i18n/i18n.test.tsx`, `frontend/src/sw.test.ts`, `backend/tests/push.rs` |

- 팝업 하단 저장 영역: `frontend/src/features/shared/PresetModal.tsx`의 `ModalActions`와 `frontend/src/styles/preset-modal.css`. 폼 외부 버튼은 폼 ID와 명시적 disabled를 연결한다.
- Today의 1초 시계 갱신·요약 렌더 경계: `frontend/src/features/workspace/TodayOverview.tsx`; 상세 카드 갱신 격리 회귀: `Today.rendering.test.tsx` (같은 폴더). 시간대별 포맷터 재사용·날짜/시각 변환: `frontend/src/features/schedules/timeRange.ts`와 인접 테스트.
- 요약 시계의 cap/자정 경계를 포함한 고정 열·자정 연속 범위: `frontend/src/features/workspace/todayDialLayout.ts`와 인접 테스트. TodayDial에서 날짜·일정 변경 시에만 계산한다.
- 요약 시계의 공통 원/막대 도형·투명 외곽 마스크: `frontend/src/features/workspace/TodayDialStroke.tsx`, `TodayDialSeparation.tsx`(같은 폴더). TodayDial과 지정 레퍼런스에서 재사용한다.
- 요약 시계의 호·저장 후 갱신: `frontend/src/features/workspace/TodayDial.tsx`, `Today.tsx` (같은 폴더). 드래그 경계는 `frontend/src/features/schedules/TimeDial.tsx`.

- 일정·실행 태스크 삭제: `backend/src/services/schedule_deletion.rs`, `frontend/src/features/shared/SwipeDelete.tsx`. 완료 취소는 `backend/src/services/execution.rs`; 실행·삭제 API와 첨부 정리 회귀는 `backend/tests/execution.rs`.

- 직접 입력·숨겨진 프리셋: `backend/src/services/unmanaged_presets.rs`, `backend/src/routes/unmanaged_presets.rs`, `backend/migrations/202609260001_unmanaged_presets.sql`, `frontend/src/api/unmanagedPresets.ts`, `frontend/src/features/shared/UnmanagedSuggestions.tsx`. 일정 선택 입력은 `Picker.tsx`, 이름 전달은 `api/schedules.ts`가 담당한다.

- 캘린더 막대 배치: `frontend/src/features/workspace/calendarLayout.ts`, 공통 월/연간 격자: `CalendarGrid.tsx`, 전환·조회: `Calendar.tsx`, 실측 좌표 확대/축소·페이지 전환: `useCalendarTransition.ts`, 6주 격자 날짜 드롭다운: `CalendarDatePicker.tsx`, 전용 스타일: `calendar.css` (같은 폴더).

- 수평 탐색 밑줄·본문 전환: `frontend/src/features/shared/HorizontalNavigation.tsx`와 인접 테스트. 프리셋 공통 헤더/전환 경계는 `frontend/src/features/workspace/PresetWorkspace.tsx`, 사이드 메뉴의 캘린더 모션 연결은 App의 CalendarNavigation ref다.

## 스타일

- `frontend/src/styles.css`: 기존 전역 스타일의 순서가 명시된 집계 파일. 각 파일은 `@layer features`를 유지한다.
- `frontend/src/styles/`: base, workspace, appearance, preset-forms, theme, execution, shell-calendar, today, preset-modal, custom-details, chrome, schedule-picker.
- 세부 소유 범위와 cascade 순서는 [styles README](../frontend/src/styles/README.md)를 확인한다.
- 기능 폴더에 이미 있는 `schedules.css`, `search.css`, `customization.css`, `toast.css`는 해당 컴포넌트가 사용한다.
- 색상은 `tokens.css`, 공통 컨트롤은 `design-system.css`. 제품 UI 수정은 [디자인 시스템](DESIGN_SYSTEM.md)을 먼저 확인한다.
- 고정 목록 드롭다운은 `frontend/src/features/shared/DropdownSelect.tsx`, 입력 가능한 종류 선택은 `frontend/src/features/works/DetailKindInput.tsx`가 담당한다. 두 입력 모두 공통 메뉴 표면을 사용한다.
- 스케줄 구분색: `frontend/src/features/schedules/ScheduleColorPicker.tsx`, `frontend/src/api/scheduleColors.ts`, `frontend/src/api/schedules.ts`, `backend/src/services/schedules.rs`, `backend/migrations/202609250006_schedule_color.sql`. 스케줄 필드로 저장하고 `tokens.css`·`design-system.css`에서 상단 보더에 연결한다.

## 범위를 좁힌 검증

```sh
npm run test:frontend -- src/features/schedules/TaskExecution.test.tsx
npm run test:backend -- --test execution
npm run check:docs
```

선택 테스트는 반복 편집 중 피드백용이다. 완료 시 변경한 쪽의 `check:frontend` / `check:backend`를 실행한다. 프런트·백엔드 계약 변경은 양쪽 검사와 SPEC 관련 절을 함께 확인한다.

- 반응형 기준: `frontend/src/features/shared/useMobileLayout.ts` (700px), 메모 호환 이름은 `useMobileMemoLayout.ts`. 일간 태스크 직접 편집은 `frontend/src/features/workspace/SavedScheduleCard.tsx`, 모달 퇴장과 포커스 복귀는 `frontend/src/features/shared/PresetModal.tsx` 및 인접 테스트.

- 스케줄 태스크 행·추가 초안: `frontend/src/features/schedules/ScheduleTaskRows.tsx`. 생성·편집 공통 이름 자동 검색: `frontend/src/features/schedules/TaskNameInput.tsx`.

- 메뉴·날짜 선택·메모 팝업 퇴장과 재열기 취소: `frontend/src/features/shared/usePopupExit.ts`. 모달 배경 블러 전환: `frontend/src/design-system.css`.

- 스티커 메모 창·우하단 크기 조절: `frontend/src/features/sticky/StickyWindow.tsx`, `stickyState.ts`; 우하단 수납 목록·키보드 탐색: `StickyTray.tsx`; 저장·활성 창 관리: `StickyWorkspace.tsx`; 스케줄 색상 갱신·완료: `StickySchedules.tsx` (모두 같은 폴더). API 없는 미리보기는 `StickyDemo.tsx`이며 디자인 레퍼런스에서 사용한다.

- 스티커 지니 효과: `frontend/src/features/sticky/stickyGenie.ts`와 인접 테스트. 실제 수납 버튼 좌표와 비대화형 스냅샷을 사용한다.

- 생성 태스크 수동 초안·행별 수정·검증·저장 변환: `frontend/src/features/schedules/useScheduleTaskDraft.ts`와 인접 테스트. `ScheduleEditor.tsx`는 추가·수정의 동일 배치와 일정 필드를 조정한다. `Schedules.tsx`의 ScheduleModal은 공통 외곽 모달, ScheduleView는 기존 일정 로드·실행 동작을 담당한다.
- 화면 공통 일정 완료/취소: `frontend/src/features/schedules/scheduleCompletion.ts`. Today·일간 카드·상세·스티커 동작 비교는 `scheduleCompletion.test.tsx`에서 같은 fixture로 검사한다.
- 일정 변경 알림: `frontend/src/api/scheduleChanges.ts` (ID·종류·성공 상세). 동시 조회 공유·호출자별 취소: `frontend/src/api/scheduleReads.ts`; 상세/요약 페이지 검증과 쓰기 알림은 `api/schedules.ts`, 회귀는 `api/schedules.test.ts` (모두 frontend/src 기준). 스티커 응답 반영은 `features/sticky/StickySchedules.tsx`, 월/연 요약·일간 상세 선택은 `features/workspace/Calendar.tsx`에서 담당한다. 요약의 워크 스냅샷 이름은 `backend/src/services/schedules.rs`의 목록 transaction에서 페이지 단위로 읽는다.

- 콘텐츠 우클릭·길게 누르기와 휠클릭 차단: `frontend/src/features/shared/ContentContextMenu.tsx`, `content-context-menu.css`, `ContentContextMenu.test.tsx` (같은 폴더). `main.tsx`와 디자인 레퍼런스에 한 번 설치하고 콘텐츠의 명시적 data 속성으로 기존 액션을 연결한다.

- 펼치기·접기 공통 아이콘과 native summary: `frontend/src/features/shared/ui.tsx`의 DisclosureIcon/DisclosureSummary. 기준 상태는 `frontend/src/design-reference.tsx`의 disclosure-reference, 모션은 `frontend/src/design-system.css`.

- 앱/레퍼런스 테마 판정·OS 변경 구독: `frontend/src/features/settings/useTheme.ts`. 입력 토글 회귀: `frontend/src/features/works/DetailKindInput.test.tsx`.

- 메뉴 상단 기존 컨트롤 연결: `frontend/src/features/shared/ContextMenuSlot.tsx`; 일정 색상 연결: `frontend/src/features/schedules/ScheduleContextColor.tsx`. 포인터 원점 공통 모션: `frontend/src/features/shared/popupMotion.ts`. 스티커 생성·삭제 스냅샷: `frontend/src/features/sticky/stickyMotion.ts` (지니 효과와 스냅샷 공유).

- 설정 세로 탐색·이동 선택 배경·수직 페이지 전환: `frontend/src/features/shared/VerticalTabs.tsx`. 공통 토글 스위치: `frontend/src/features/shared/ui.tsx`의 ToggleSwitch. 스타일은 `frontend/src/design-system.css`, 상태 예시는 `frontend/src/design-reference.tsx`의 settings-controls-reference. 제품 연결은 `frontend/src/features/settings/Settings.tsx`·`SettingsFields.tsx`, 검증은 같은 폴더 Settings.test.tsx.

- 카드 시간·메모 한 줄 표현: TodayScheduleCard.tsx·SavedScheduleCard.tsx(위 workspace 폴더), 공통 클래스는 shared/customization.css. ScheduleCardActions.tsx가 버튼 실측 너비를 카드 여백에 전달한다. 완료 체크 상태 레퍼런스는 design-reference.tsx의 completion-reference다.

- 보관 기능 제거 이관: `backend/migrations/202609270003_remove_preset_archiving.sql`; 기본 태스크 경로 제거·빈 일정·이관 보존 회귀: `backend/tests/work_tasks.rs`. 기존 WorkTasks/프런트 workTasks API/서버 work_tasks route·service는 제거했다.

- 알림 목록·재알림: `frontend/src/features/schedules/NotificationMenu.tsx`, `Reminders.tsx`, `reminderInbox.ts`, `notifications.css` (같은 폴더). API 없는 지정 레퍼런스는 `NotificationDemo.tsx` → design-reference의 notification-reference. 토스트 퇴장은 `frontend/src/features/shared/Toast.tsx`·toast.css·usePopupExit를 공유한다. 기존 알림 상태 재검증 API는 `frontend/src/api/reminders.ts` → `backend/src/routes/schedules.rs` → `backend/src/services/schedules.rs`; 소유자/시작 후 경계 회귀는 `backend/tests/reminder_inbox.rs`다.

- 팝오버 위치·화면 경계·resize/scroll 구독: `frontend/src/features/shared/anchoredPopover.ts`와 인접 테스트. DropdownSelect·DetailKindInput·AnchoredPopup·CalendarDatePicker·TaskNameInput이 공유하고 키보드/닫힘/모션은 기존 컴포넌트가 소유한다. Today 카드의 태스크 추가도 ScheduleTaskRows의 NewTaskRows를 사용하며 별도 AddTaskPicker는 제거했다.
