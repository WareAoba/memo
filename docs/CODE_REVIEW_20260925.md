# 코드 리뷰 — 2026-09-25

> 후속 수정 완료: 아래는 발견 당시 기록이다. 확정 버그 3건과 태스크 항목 편집·상세 표시를 수정했다. 프론트엔드 전체 검사 및 120개 테스트가 통과했다. [수정 검증 기록](VERIFICATION_REVIEW_FIXES_20260925.md)을 참고한다.

현재 작업 트리 기준 리뷰. 저장소가 untracked 상태이고 UI 작업도 동시에 진행 중이므로 커밋 diff가 아닌 검토 시점의 구현을 대상으로 했다. 기능 코드와 실제 데이터는 수정하지 않았다.

## 확인된 문제: P2 3건

### 1. 자정에 열린 실행 편집기와 미저장 입력이 사라진다

- 위치: `frontend/src/App.tsx`, Today의 `key={timeZone ? today : 'loading'}`.
- 재현: Today에서 여러 날 일정의 태스크 수정 → 실행 메모 입력 → 앱 시간대의 날짜 변경.
- today가 key에 포함되어 있어 Today 전체가 재마운트된다. editing 상태와 TaskExecution의 name/notes/draft가 폐기된다. 같은 일정이 다음 날에도 이어져도 입력을 복구할 수 없다.
- useToday는 자동으로 날짜를 갱신하므로 사용자가 이동하거나 닫지 않아도 발생한다. Today의 편집 중 자동 조회 중단 로직으로는 상위 key 변경을 막을 수 없다.
- 검증: App을 렌더한 뒤 useToday의 반환 날짜를 다음 날로 변경했다. 계속 조회되는 동일 일정의 미저장 메모가 DOM에서 사라졌다.
- 수정 방향: 날짜별 조회와 편집 세션의 수명을 분리한다. key만 제거하면 Today의 편집 중 조회 중단 조건 때문에 다음 날짜 로딩이 막힐 수 있으므로, 편집 중인 일정/초안을 별도로 유지하면서 날짜 목록을 전환해야 한다.

### 2. 이름 저장 성공 후에도 태스크 완료가 계속 비활성화된다

- 위치: `frontend/src/features/schedules/TaskExecution.tsx`, dirty 계산과 이름 저장 onSubmit.
- 재현: 태스크 이름을 ` Renamed `처럼 앞뒤 공백이 있는 값으로 변경 → 이름 저장.
- 요청은 name.trim()인 `Renamed`를 보내고 서버도 trim한 이름을 반환한다. 그러나 로컬 name 상태는 ` Renamed `로 남는다. name !== task.name_snapshot가 계속 참이므로 시작/완료/건너뛰기가 비활성화된다. 다시 저장해도 동일하다.
- 검증: 정상 저장 응답과 “저장했습니다.” 표시 이후에도 “태스크 완료” 버튼이 disabled였다.
- 수정 방향: 성공한 이름 저장의 정규화 결과를 해당 draft에 반영한다. 다른 항목의 미저장 입력을 초기화하지 않도록 전체 task 동기화는 피한다.

### 3. 워크의 새 상세 정보가 일정 상세에서 누락된다

- 위치: `frontend/src/features/schedules/Schedules.tsx`, 워크 스냅샷의 dl 렌더링.
- 재현: 워크 상세 정보에 종류 `출입 안내`, 내용 `후문으로 입장` 저장 → 해당 워크로 일정 생성 → 일정 상세 열기.
- 백엔드 entities::snapshot은 custom_fields를 포함해 보존한다. EntityDetail도 이를 표시한다. 반면 ScheduleView는 기존 고정 textFields만 순회한다. 따라서 신규 상세 정보는 응답에 있어도 일정 상세에 표시되지 않는다. TodayWorkCard/SavedWorkBlock에도 이를 표시하는 경로가 없다.
- 검증: custom_fields가 있는 ScheduleDetail로 ScheduleView를 렌더했지만 내용이 DOM에 없었다.
- 수정 방향: 일정 생성 당시 entity_snapshot.custom_fields를 렌더링한다. 현재 프리셋을 다시 조회하면 기존 일정의 스냅샷 의미가 달라지므로 사용하지 않는다.

## UI 작업 의도 확인이 필요한 기능 변화

TaskPresetEditor는 현재 items: initial.items를 그대로 전송하고 항목 편집 UI가 없다. TaskPresetDetail도 항목을 표시하지 않는다. 따라서 새 프리셋에는 체크/텍스트/숫자 항목을 추가할 수 없고 기존 항목도 편집할 수 없다. 기존 TaskPresets 테스트 2건이 “+ 항목 추가” 버튼을 찾지 못해 실패한다. UI 정리 과정의 의도적 기능 제거인지 확인할 수 없어 위의 확정 버그 3건에는 포함하지 않았다. 기능 유지가 목표라면 복원이 필요하다.

## 검사 결과

- 백엔드 테스트: 47개 모두 통과. 임시 DB 기반 테스트로 CRUD, 소유권, 트랜잭션 롤백, 독립 스냅샷, 실행 필수값/상태, 목록 revision, 사진 검증/복구를 확인했다.
- 백엔드 rustfmt 및 clippy --all-targets --locked -- -D warnings 통과.
- 백엔드 최초 기본 target 실행은 실행 중인 exe의 Windows 파일 잠금으로 실패했다. 실행 서버를 중지하지 않고 별도 target-review 폴더에서 재실행해 통과했다.
- 프론트 기존 테스트: 112개 중 108개 통과, 4개 실패(01:25 JST 실행).
  - App: 메뉴 버튼 존재 여부에 대한 기대값 불일치 1건.
  - TaskPresets: 항목 추가 컨트롤 부재 2건.
  - TaskPresets: 그룹 입력이 직접 타이핑에서 선택/직접입력 모드로 변경되어 기존 테스트의 입력 방식과 불일치 1건.
- 프론트 TypeScript/Vite build, ESLint, Prettier 통과.
- 추가 정상 동작 assertion 3개는 위 각 문제에서 모두 실패했다. 재현 파일은 일반 테스트/빌드를 방해하지 않도록 docs/review-20260925에 보관했다.
- 테스트 실행 이후 UI 파일이 변경되는 것을 관찰했으므로 이 결과는 실행 시점의 기록이다.

## 검토 범위와 한계

서비스와 라우트, 스키마/마이그레이션, API 클라이언트, Today/캘린더/일정 편집·실행, 워크·태스크 프리셋, 사진 업로드·조회·삭제, 기본 실행 설정을 읽었다. 백엔드에서 새로 확정한 결함은 없다. 테스트 통과가 모든 입력/경쟁 상태의 무결함을 보장하지는 않는다.

명세에서 후순위로 둔 인증/PWA/오프라인 쓰기를 버그로 집계하지 않았다. 실제 브라우저·모바일·Docker 배포 및 전원 손실 실험은 수행하지 않았다. 사용자 DB나 실행 서버에 테스트 데이터를 쓰지 않았다.

재현 방법: `docs/review-20260925/review20260925.test.tsx`를 `frontend/src/review20260925.test.tsx`로 복사하고 `npm --prefix frontend test -- review20260925` 실행. 현재 코드에서는 정상 동작을 요구하는 3개 assertion이 실패한다. 실행 후 복사한 파일만 제거한다.
