# Agent entry point

사용자 UX는 사람에게 편하게, 개발 구조는 에이전트가 좁은 범위만 읽고 변경하도록 유지한다.

## 탐색 순서

1. `git status --short`로 기존 변경을 확인하고 다른 작업을 덮어쓰지 않는다.
2. [현재 상태](docs/STATUS.md)와 [기능별 파일 지도](docs/CODE_MAP.md)에서 작업 범위를 고른다.
3. 동작 변경은 [SPEC](SPEC.md)의 관련 절과 해당 기능 문서를 읽는다. 전체 문서·과거 검증 기록을 매번 읽지 않는다.
4. `rg`로 관련 심볼과 호출자를 찾고 변경 대상 및 인접 테스트만 읽는다.

## 기본 명령 (저장소 루트)

- 설치: `npm --prefix frontend ci`
- 실행: `npm run dev:backend`, `npm run dev:frontend` (별도 터미널)
- 프런트 선택 테스트: `npm run test:frontend -- src/features/workspace/Today.test.tsx`
- 백엔드 선택 테스트: `npm run test:backend -- --test schedules`
- 완료 검사: 변경한 쪽의 `npm run check:frontend` / `npm run check:backend`; 양쪽 변경은 `npm run check`.
- 문서 경로 검사: `npm run check:docs`
- 포맷은 변경 파일에 한정한다. 전체 포맷으로 다른 작업의 변경을 섞지 않는다.

## 경계와 불변 조건

- React 화면 → `frontend/src/api` → Rust `routes` → `services` → SQLite. HTTP를 UI에, SQL을 routes에 새로 넣지 않는다.
- 워크의 코드 이름은 `works`, 기존 API·DB 이름은 `entities`. 호환 이름을 구조 정리만을 위해 변경하지 않는다.
- 일정은 프리셋의 독립 스냅샷이다. 실행 편집이 원본 프리셋이나 다른 일정에 전파되면 안 된다.
- 소유자 범위, 다단계 쓰기의 transaction, 시간대·날짜 경계, 실패 시 편집 초안 보존을 유지한다.
- 적용된 migration은 수정하지 않고 새 파일을 추가한다. 실제 DB·사진·키는 `data/`에 있으며 테스트에 사용하지 않는다.
- 공통 UI·색상은 [디자인 시스템](docs/DESIGN_SYSTEM.md)을 따른다. CSS 집계 파일의 import 순서는 cascade 계약이다.

## 문서와 구조 유지

- 구현 상태는 `docs/STATUS.md`, 요구 계약은 `SPEC.md`, 경로 안내는 `docs/CODE_MAP.md`가 담당한다.
- 기능·경로 변경 시 해당 기준 문서만 갱신한다. 테스트 개수나 현재 상태를 여러 문서에 복제하지 않는다.
- `VERIFICATION_*`와 `CODE_REVIEW_*`는 당시 기록이며 현재 동작의 근거로 단독 사용하지 않는다.
- 새 코드는 기존 기능 폴더에 둔다. 의미 없는 `utils`나 한 파일당 한 폴더를 늘리지 않는다.
- 검증 전부터 존재한 실패와 이번 변경으로 생긴 실패를 구분해 보고한다.
