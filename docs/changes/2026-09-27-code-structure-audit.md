# 2026-09-27 전체 코드 구조·에이전트 수정 효율 점검

## 변경

사용자 요청은 전체 코드의 스파게티화 여부와 에이전트 코딩 효율에 대한 검사다. 제품 코드·테스트·설정은 수정하지 않았다. 이번 작업은 이 감사 기록과 CHANGES 연결, 해당 파일의 ledger 기록만 추가한다. 시작 당시 존재하던 99개 기록 대상 변경은 기존 작업이며 이 감사의 구현 결과가 아니다.

### 종합 판단

전체가 스파게티 코드인 상태는 아니다. 기능 폴더, HTTP 어댑터, 서비스, 공통 UI, 독립 스냅샷과 transaction 경계는 유효하다. 그러나 프런트엔드의 일정 상태 관리·조회 갱신과 전역 CSS는 부분적으로 복잡해졌다. 파일을 나눈 것에 비해 한 동작의 책임을 따라가야 하는 범위가 넓다. 에이전트가 좁은 기능만 읽고 안전하게 변경하기에 충분히 정리됐다고 보기는 어렵다.

과거 에이전트의 실제 소요 시간·토큰·수정 횟수는 조사 자료에 없으므로 생산성 자체를 수치 평가하지 않는다. 현재 산출물의 변경 용이성, 중복, 경계, 검증 품질을 평가했다. 아래 중요도는 수정 순서이며 장애 발생 빈도나 실행 성능을 측정한 점수가 아니다.

### 범위와 방법

- 현재 미커밋 변경을 포함한 작업 트리를 대상으로 파일 목록·크기·import 관계·호출자·계층 위반 후보·이벤트·CSS 선택자를 검색했다.
- 프런트 `src`의 TS/TSX/CSS 187개 파일, 23,662줄(테스트 포함), 백엔드 `src` Rust 32개 파일, 4,207줄을 계수했다. JSON 번역, migrations, 테스트 디렉터리, 도구는 이 줄 수와 별개다.
- 테스트와 test 폴더를 제외한 프런트 TS/TSX 108개 파일의 정적 상대 import/export 그래프를 TypeScript 파서로 분석했다. 이 범위에서는 모듈 순환 의존성이 없었다. 런타임 이벤트나 CSS 의존성이 없다는 의미는 아니다.
- 일정 작성→실행→Today/캘린더/스티커 갱신을 집중 추적하고, 워크·태스크 프리셋·설정·사진·인증·푸시·문서 하네스의 경계를 교차 확인했다. 모든 줄의 형식 검증이나 모든 사용자 경로의 수동 재현을 했다는 의미의 전수 증명은 아니다.
- 현재 코드 및 인접 테스트를 근거로 판단했다. 과거 VERIFICATION 문서의 성공 결과를 현재 상태에 대신 적용하지 않았다.

### 1. 우선 수정: 워크 재선택 시 유지되는 태스크 행의 입력값은 유실된다

근거: [ScheduleEditor](../../frontend/src/features/schedules/ScheduleEditor.tsx)의 `choose`(95–116행), `customizations`(87행), 태스크 이름 변경(367–378행).

`choose()`는 먼저 `setCustomizations({})`를 실행하고, 기본 태스크 조회 후에는 `rowKey`가 있는 수동 태스크 행을 유지한다. 따라서 수동 행에 입력한 매개변수·메모는 워크를 변경하거나 같은 워크의 기본 태스크 조회를 다시 시도할 때 사라지지만 행 자체는 남는다. 실패한 조회에서도 초기화가 이미 실행된다. 이는 소스 흐름으로 확인한 데이터 보존 결함이며 이번 작업에서 브라우저 재현 테스트를 추가하지는 않았다.

또한 행은 `rowKey`로 구별하면서 customization은 프리셋 ID 또는 `name:` 문자열로 구별한다. 동일 후보를 여러 행에서 선택하면 입력값을 공유하고 서버 생성 단계에서는 ID 중복을 제거한다([schedules.rs](../../backend/src/services/schedules.rs) 286–298행). 서버 중복 제거 자체는 SPEC의 계약이다. 문제는 UI가 별도 행처럼 편집하게 하면서 이 제약을 표현하지 않는 점이다.

권장: `{rowKey, source, name, parameters, executionNotes}`를 하나의 초안 구조로 관리하고 기본 태스크 교체 시 수동 초안 전체를 보존한다. 서버의 중복 제거 계약에 맞춰 중복 후보 선택을 차단하거나 명시적으로 병합한다. 워크 변경·조회 실패/재시도·중복 선택을 회귀 테스트로 고정한다.

### 2. 우선 정리: 화면별 일정 완료 동작과 테스트가 서로 다르다

근거: [Schedules](../../frontend/src/features/schedules/Schedules.tsx) 69–72, 113–119행, [Today](../../frontend/src/features/workspace/Today.tsx)의 `finishSchedule`, [SavedScheduleCard](../../frontend/src/features/workspace/SavedScheduleCard.tsx), [StickySchedules](../../frontend/src/features/sticky/StickySchedules.tsx) 98행, [execution.rs](../../backend/src/services/execution.rs) 223–299행.

상세 편집의 체크는 `PATCH /status`를 호출한다. 이 API는 completed/skipped 이외 상태의 태스크가 하나라도 있으면 거부한다. Today·일간 카드·스티커는 `POST /complete`를 호출해 필수값을 검증한 뒤 전체 태스크를 완료한다. 따라서 필수값이 충족됐지만 아직 pending인 태스크가 있는 일정은 화면에 따라 완료 체크 결과가 달라진다. 두 API의 서버 계약은 각각 유효하므로 이를 서버 계약 위반으로 단정하지 않는다. 사용자 동작의 의미를 화면별로 중복 구현한 데서 생긴 불일치다.

[Schedules.test](../../frontend/src/features/schedules/Schedules.test.tsx) 425행 부근 테스트는 `updateScheduleStatus`를 무조건 성공하도록 mock해서 이 차이를 검출하지 못한다. 체크박스 위치 검사는 유효하지만 실제 완료 흐름을 보장하지 않는다.

권장: 제품 의도를 하나로 정한 뒤 공통 일정 완료 동작으로 연결한다. 같은 fixture로 Today·일간·상세·스티커의 완료 결과와 필수값 실패 결과를 비교하는 계약 테스트가 필요하다. UI 전체를 하나의 거대 카드로 합칠 필요는 없다.

### 3. 성능·결합도: HTTP 공통 계층의 전역 이벤트가 전체 재조회를 유발한다

근거: [client.ts](../../frontend/src/api/client.ts) 64–70행, [Calendar](../../frontend/src/features/workspace/Calendar.tsx) 57–84행, [StickySchedules](../../frontend/src/features/sticky/StickySchedules.tsx) 32–66행, [Today](../../frontend/src/features/workspace/Today.tsx) 48–95행, [Reminders](../../frontend/src/features/schedules/Reminders.tsx).

공통 `requestJson()`이 URL 문자열과 HTTP 메서드로 도메인 변경을 판별해 `schedules-changed`를 발생시킨다. 소비자는 어떤 일정이 변경됐는지 알 수 없어 각자 다시 조회한다. 열린 스티커마다 별도 구독이 있으며 동일 일정을 표시해도 조회를 공유하지 않는다. 성공 응답을 로컬 상태에 반영하는 흐름과 전체 재조회가 공존한다. Today에는 lock·generation 방어가 있지만 Calendar와 스티커의 갱신 구현은 다르다.

연간 캘린더는 연간 전체 일정의 상세를 `include_details=true`, 20개씩 순차 조회한다([api/schedules.ts](../../frontend/src/api/schedules.ts)의 `getRangeSchedules`). N개 일정이면 정상 전체 조회는 `max(1, ceil(N/20))`개의 목록 요청이다. revision 충돌 때 전체 조회를 처음부터 다시 시도하며 최초를 포함해 최대 3회 시도한다. 색상·날짜 막대에 필요하지 않은 태스크 항목과 메모도 받는다.

권장: 변경 이벤트를 일정 API 계층의 명시적 성공 처리로 옮기고 일정 ID·변경 종류·성공 응답을 전달한다. 동일 범위 조회를 공유하고 중복 요청을 합친다. 월/연간은 목록 요약, 일간·편집은 상세로 조회를 구분한다. 측정 없이 특정 라이브러리 도입이나 성능 수치를 약속하지 않는다. 실제 요청 횟수·응답 크기·렌더 시간을 대표 데이터로 측정해야 한다.

### 4. 구조 부채가 가장 뚜렷한 영역: CSS의 소유권이 분산되어 있다

근거: [styles 집계](../../frontend/src/styles.css), [스타일 소유권 문서](../../frontend/src/styles/README.md), [base](../../frontend/src/styles/base.css), [workspace](../../frontend/src/styles/workspace.css), [appearance](../../frontend/src/styles/appearance.css), [theme](../../frontend/src/styles/theme.css), [shell-calendar](../../frontend/src/styles/shell-calendar.css).

정확히 같은 선택자 `.site-header`, `.actions`가 각각 5개 CSS 파일에 있고 `.calendar-day`, `.day-summary`는 각각 4개 파일에 있다. 미디어 쿼리·역할 분담이 있으므로 반복 선언만으로 버그라고 할 수는 없다. 다만 README가 이전 선언 순서와 중복 선택자를 의도적으로 보존했다고 명시하고 있어 현재 구조가 기능 소유권 중심의 정리까지 완료된 것은 아니다.

에이전트는 헤더나 캘린더의 작은 수정에도 여러 파일과 import 순서를 읽어야 한다. 토큰·layer 검사는 있어도 cascade 결과나 작은 화면의 겹침을 증명하지 않는다. 이번 감사는 브라우저 시각 검사를 수행하지 않았다.

권장: 헤더·사이드바·캘린더 등 한 영역씩 최종 계산 스타일을 확인해 소유 파일로 통합한다. import 정렬이나 일괄 중복 삭제는 피한다. 데스크톱/모바일·테마·모션별 시각 회귀 확인을 동반한다.

### 5. 책임 집중: ScheduleEditor와 App의 상태 모델이 수정 범위를 넓힌다

근거: [ScheduleEditor](../../frontend/src/features/schedules/ScheduleEditor.tsx), [App](../../frontend/src/App.tsx).

ScheduleEditor는 513줄, 정적 내부 모듈 참조 23개로 생성/편집, 워크 기본 태스크 조회, 태스크 초안, 매개변수, 날짜·시간, 메모, 알림, 삭제·저장을 함께 다룬다. App은 363줄, 내부 참조 20개이며 hash 해석, 링크 캡처, 세 종류 팝업 상태, 설정, 배경 화면, revision 갱신을 함께 조정한다. 길이 자체보다 동일한 상태 전이가 여러 핸들러에 나뉜 점이 문제다.

권장: ScheduleEditor에서 생성 초안 상태·변환·검증을 먼저 분리한다. App에서는 페이지와 열린 편집 대상을 명시적 상태로 표현하고 라우트 파싱/전이를 한곳으로 모은다. 한 파일당 폴더를 만들거나 JSX 블록만 기계적으로 나누는 방식은 변경 범위를 줄이지 못한다.

모든 화면을 정적으로 가져오므로 현 빌드는 JS 568.22 kB, gzip 172.70 kB의 단일 앱 chunk를 생성하고 500 kB 경고가 발생했다. 비초기 화면의 지연 로딩은 검토 가치가 있다. 이 숫자는 다운로드·실행 지연을 직접 측정한 결과가 아니다.

### 6. 백엔드는 비교적 정돈됐지만 일부 경계·읽기 비용은 개선할 수 있다

근거: [routes/push.rs](../../backend/src/routes/push.rs) 18행, [services/works.rs](../../backend/src/services/works.rs)의 `list`, [services/execution.rs](../../backend/src/services/execution.rs)의 `requirements_met`와 `complete_schedule`, [services/schedules.rs](../../backend/src/services/schedules.rs)의 `details`와 `append_preset`.

- push 설정 route에 구독 SQL이 직접 있다. health의 `SELECT 1`은 진단 목적이라 같은 수준의 도메인 누수로 평가하지 않았다. push 구독 판별은 서비스가 소유하는 편이 경계 규칙에 맞다.
- 워크 목록은 기본 목록·개수 조회 이후 워크별 태그 조회를 반복한다. 전체 완료도 태스크별 필수 항목을 조회한다. 페이지/태스크 수 상한이 있고 SQLite가 같은 프로세스에 있으므로 즉시 성능 장애라고 할 수 없지만, 수에 비례하는 쿼리 수와 쓰기 transaction 점유 시간이 늘어난다. 반면 일정 상세는 페이지 단위 일괄 조회를 구현해 이 문제를 잘 피했다.
- 일정·실행의 내부 응답/스냅샷 조립이 `serde_json::Value`와 문자열 키에 상당 부분 의존한다. 프런트도 별도 타입과 수동 parser를 유지한다. 필드 변경 시 여러 표현을 함께 수정해야 하고 모든 불일치를 컴파일러가 잡지는 못한다. backend/src에는 300자를 넘는 줄이 26개 있어 SQL·JSON·bind 순서를 검토하기도 어렵다.

권장: SQL을 소유 서비스로 이동하고 측정된 반복 조회부터 일괄화한다. 안정된 내부 일정/태스크 DTO부터 타입화하고 SQL·JSON 조립은 읽기 좋게 정리한다. 전 서비스에 범용 repository 계층을 추가할 이유는 확인하지 못했다.

### 7. 낮은 우선순위: 제품 진입점에서 도달하지 않는 모듈이 남아 있다

`main.tsx`와 `design-reference.tsx`를 진입점으로 한 정적 import/export 분석에서 아래 4개가 도달하지 않았다. 검색으로 호출자도 대조했다.

- `frontend/src/features/schedules/TaskGroupPicker.tsx`: 감사 당시 제품에서 사용하지 않던 이전 선택 UI.
- `frontend/src/features/workspace/ScheduleBlock.tsx`: 감사 당시 제품/디자인 참조에서 사용하지 않던 블록.
- `frontend/src/i18n/LanguageSelect.tsx`: 감사 당시 전용 테스트에서는 사용하지만 제품에서는 사용하지 않았다.
- [health API](../../frontend/src/api/health.ts): 테스트만 있고 현재 제품의 호출자는 없다. 서버 health endpoint의 운영상 필요성과는 별개다.

위 UI 3개는 [후속 마무리](2026-09-27-audit-followup-finish.md)에서 제거했다. 깨진 링크 대신 당시 경로를 남기며 이하 판단과 검증은 감사 당시 기록이다.

권장: 보존 목적을 명시하거나 사용하지 않는 UI를 정리한다. 이를 번들에 모두 포함된 코드라고 해석하지 않는다. 현재 ESLint·TypeScript의 unused 검사는 외부로 export된 모듈 전체의 도달 가능성을 검사하지 않으므로 통과해도 이런 잔재가 남을 수 있다.

### 8. 에이전트 효율: 문서 게이트는 유용하나 컨텍스트와 의미 검증 비용이 남는다

근거: [agent-docs-hook](../../scripts/agent-docs-hook.mjs), [STATUS](../STATUS.md), [CODE_MAP](../CODE_MAP.md), [SPEC](../../SPEC.md), [AGENT_HARNESS](../AGENT_HARNESS.md).

시작·매 프롬프트 훅은 AGENTS/STATUS/CODE_MAP/CHANGES 전체 본문을 넣는다. 이번 편집 전 합계는 15,595문자이며 토큰 수로 환산하지 않았다. STATUS에는 현재 기능 요약과 세부 UI 수정 이력이 함께 쌓여 있다. SPEC도 현재 계약과 과거 Phase 설명이 공존한다. 예를 들어 Phase 6의 페이지 간 snapshot 설명과 뒤의 revision 보완 계약을 함께 읽어야 최신 동작을 정확히 이해할 수 있다.

해시 기반 게이트는 기록 누락·변경 후 미갱신을 잘 잡지만 설명의 정확성·import 경계·중복·요청 수를 검증하지 않는다. 체크 통과가 구조 품질 통과와 동의어는 아니다. 하네스 자체도 이 한계를 명시하고 있다.

권장: STATUS를 기능별 현재 상태 중심으로 압축하고 세부 이력은 changes로 보낸다. 현재 계약과 역사 기록을 더 명확히 구분한다. 필수 문서 확인과 기록 게이트를 유지하면서 구조 검사에는 import 경계·미사용 모듈·대표 동작 계약 테스트를 추가하는 편이 효과적이다.

### 유지할 좋은 구조

- 기능별 폴더와 CODE_MAP으로 탐색 시작점이 명확하다. 대부분의 UI는 API 모듈을 사용하고 대부분의 route는 서비스에 위임한다.
- 프런트 정적 모듈 순환이 없고 strict/noUncheckedIndexedAccess가 켜져 있다. 공통 UI 사용을 lint로 제한한다.
- 소유자 범위, 스냅샷, 다단계 쓰기 transaction, 실패 후 사진 정리 재시도, 페이지 revision 검사가 구현돼 있다. 이 경계는 리팩토링 때 보존해야 한다.
- 메모 자동 저장은 별도 상태 객체에 직렬화·실패 초안 보존 로직과 테스트가 있다. 공통화를 잘 적용한 사례다.
- 백엔드 테스트에는 rollback·소유권·기존 데이터 보존·동시 업데이트 검사, 프런트에는 실패·시간대·초안 보존 검사가 있다. 테스트를 단순 개수만 채운 것으로 평가하지 않는다.

### 권장 작업 순서

1. 태스크 초안 유실을 회귀 테스트와 함께 수정하고 완료 체크의 화면 간 의미를 정리한다.
2. 일정 갱신/조회와 초안 상태를 정리해 반복 수정 범위를 줄인다.
3. CSS를 기능 단위로 통합하며 시각 회귀를 확인한다.
4. 백엔드의 작은 계층 예외·측정된 반복 조회·내부 DTO를 점진적으로 개선한다.
5. 미사용 코드와 현재 상태 문서를 정리하고 구조 검사를 추가한다.

전체 재작성이나 선제적인 대규모 라이브러리 도입은 권하지 않는다. 핵심 불변 조건은 유지하면서 변경 부담이 확인된 지점부터 좁혀야 한다.

## 문서

- 후속 문서 유지보수(2026-09-27): 제거된 UI 3개에 대한 로컬 링크를 당시 경로 표기와 후속 마무리 기록 링크로 바꿨다. 원래 감사 판단·검증 결과는 수정하지 않았다. 이 정정으로 원래 기록 본문의 해시도 재연결하며, 당시 제품 검사를 새로 실행한 것으로 해석하지 않는다. 현재 검증은 후속 마무리 기록에 둔다.

- 이 파일: 현재 작업 트리 기준 검사 방법·근거·문제·개선 순서·검증 제한을 기록했다.
- [CHANGES](../CHANGES.md): 감사 기록 링크를 추가했다.
- SPEC·STATUS·CODE_MAP·기능 문서는 수정하지 않았다. 제품 동작·구현 범위·코드 경로를 바꾸지 않은 감사 작업이며 지적 사항이 이미 수정된 것처럼 반영하지 않는다.
- 기존 제품 diff는 변경하지 않았다. ledger는 이번 문서 변경만 추가 연결한다.

## 검증

- `npm run check:frontend`: 통과. Prettier, ESLint/design, 52개 파일·257개 테스트, TypeScript, Vite build 성공. JS 500 kB 초과 경고는 남는다.
- 기본 경로의 `npm run check:backend`: 문서 검사·fmt·Clippy 이후 test 빌드에서 `backend/target/debug/preset-execution-api.exe` 삭제 접근 거부(os error 5)로 중단됐다. 코드/테스트 assertion 실패로 분류하지 않는다. 실행 중 파일 잠금인지 권한 문제인지는 확정하지 않았다.
- 권한 승인 후 `CARGO_TARGET_DIR=C:/Git/memo/backend/target/review`로 `npm run check:backend`: 문서 검사·fmt·Clippy(`-D warnings`)·전체 cargo test·build 모두 통과했다. 기본 경로의 실패를 숨기거나 기존 프로세스를 종료하지 않았다.
- `npm run test:harness`: 9개 통과.
- 정적 import/export 분석과 PostCSS 선택자 교차 파일 분석: 실행 완료. 정적 상대 모듈 참조와 동일 선택자 분포에 한정하며 런타임·시각 동작의 증명은 아니다.
- 감사 문서와 CHANGES의 최종 내용을 검토한 뒤 `npm run record:change -- --record docs/changes/2026-09-27-code-structure-audit.md`로 두 문서만 연결했다. `npm run check:docs`는 Markdown 45개 파일의 로컬 링크와 변경 파일 100개의 기록 검사를 통과했다(링크 anchor는 검사하지 않음).
- 첫 기록 명령은 샌드박스의 `spawnSync git EPERM`으로 실패했고, 그 직후 문서 게이트는 두 문서의 미기록을 올바르게 거부했다. 권한 승인 후 기록·검사가 통과했다. 이 검증 결과 문장 갱신 후 같은 기록·문서 검사를 다시 수행한다.
- 미검증: 실제 브라우저 수동 재현, 실제 기기 성능·대규모 데이터 부하, 실운영 DB/사진, 실제 푸시 전달, 원격 CI. 기존 테스트 통과는 이번에 지적한 초안/화면 간 의미/구조 문제의 부재를 증명하지 않는다.
