# 기능별 파일 지도


- 페이지 공통 배치: `frontend/src/features/shared/WorkspaceHeader.tsx`, `workspace-header.css` (같은 폴더). 일정 검색 진입점은 `frontend/src/features/schedules/ScheduleSearchControl.tsx`.
루트 기준 경로. 먼저 해당 행의 파일을 찾고 관련 심볼·테스트로 범위를 좁힌다.

## 실행 흐름

- 브라우저: `frontend/src/main.tsx` → `App.tsx`(목록 hash 라우팅·상세/수정 통합 팝업) → `features/` → `api/client.ts`.
- 서버: `backend/src/main.rs` → `lib.rs` → `routes/mod.rs` → 기능 route → service → SQLite.
- DB 초기화: `backend/src/db/mod.rs`, `backend/migrations/`. 사용자 결정: `backend/src/auth.rs` (서비스 호환 import: `backend/src/local_user.rs`).
- API Host/Origin·응답 헤더: `backend/src/security.rs`, `backend/src/config.rs`, `backend/tests/security_audit.rs`. 앱 HTML 헤더: `frontend/vite.config.ts`, `docker/Caddyfile`.
- 워크는 UI·소스에서 `works`, HTTP·DB 및 기존 백엔드 테스트에서는 `entities`다.

## 변경 경로

| 기능 | 프런트 (`frontend/src/` 기준) | 백엔드 (`backend/src/` 기준) | 테스트 |
| --- | --- | --- | --- |
| 가상 계정·인증 경계 | `features/auth/AccountBoundary.tsx`, `features/auth/AccountMenu.tsx`, `features/auth/account-menu.css`, `api/auth.ts`, `App.tsx` | `auth.rs`, `config.rs`, `lib.rs`, `migrations/202609260002_virtual_account.sql` (backend 기준) | `backend/tests/auth.rs`, `frontend/src/features/auth/AccountBoundary.test.tsx` |
| 워크 프리셋 | `features/works/`, `api/works.ts` | `routes/works.rs`, `services/works.rs` | `backend/tests/entities.rs`, `frontend/src/api/works.test.ts` |
| 태스크 프리셋 | `features/tasks/`, `api/taskPresets.ts` | `routes/task_presets.rs`, `services/task_presets.rs` | `backend/tests/task_presets.rs`, `frontend/src/features/tasks/TaskPresets.test.tsx` |
| 워크 기본 태스크 | `features/works/WorkTasks.tsx`, `api/workTasks.ts` | `routes/work_tasks.rs`, `services/work_tasks.rs` | `backend/tests/work_tasks.rs`, `frontend/src/features/works/WorkTasks.test.tsx` |
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
- 요약 시계의 호·저장 후 갱신: `frontend/src/features/workspace/TodayDial.tsx`, `Today.tsx` (같은 폴더). 드래그 경계는 `frontend/src/features/schedules/TimeDial.tsx`.

- 일정·실행 태스크 삭제: `backend/src/services/schedule_deletion.rs`, `frontend/src/features/shared/SwipeDelete.tsx`. 완료 취소는 `backend/src/services/execution.rs`; 실행·삭제 API와 첨부 정리 회귀는 `backend/tests/execution.rs`.

- 직접 입력·숨겨진 프리셋: `backend/src/services/unmanaged_presets.rs`, `backend/src/routes/unmanaged_presets.rs`, `backend/migrations/202609260001_unmanaged_presets.sql`, `frontend/src/api/unmanagedPresets.ts`, `frontend/src/features/shared/UnmanagedSuggestions.tsx`. 일정 선택 입력은 `Picker.tsx`, 이름 전달은 `api/schedules.ts`가 담당한다.

- 캘린더 막대 배치: `frontend/src/features/workspace/calendarLayout.ts`, 공통 월/연간 격자: `CalendarGrid.tsx`, 전환·조회: `Calendar.tsx`, 실측 좌표 확대/축소·페이지 전환: `useCalendarTransition.ts`, 6주 격자 날짜 드롭다운: `CalendarDatePicker.tsx`, 전용 스타일: `calendar.css` (같은 폴더).

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
