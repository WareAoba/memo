# Phase 3 태스크 프리셋 검증

검증일: 2026-09-24 (Asia/Tokyo) · SPEC v1.4

## 구현 결과

- task_presets/task_preset_items/task_preset_tags migration. 기존 migration은 변경하지 않았다.
- CRUD/search API, 부분 PATCH, 보관/복원, pagination, 소유자 범위, 공유 태그 재사용.
- 이름·기본 메모·태그와 checkbox/text/number 항목. 설명·분류·예상 소요 시간 제외.
- 항목 순서·추가·삭제·필수 여부·기본값·숫자 단위 편집, 기존 ID와 생성 시각 보존.
- 실제 변경 시 version 증가, 동일 PATCH/반복 보관 시 버전 유지.
- 모든 쓰기 원자성 및 PATCH 직렬화. 실행 snapshot은 Phase 5 범위.
- 프리셋 설정 > 태스크를 실제 목록/상세/등록/편집 화면으로 전환.
- 저장 실패 시 입력 보존, 로딩/오류/재시도, 기존 오프라인 안내 적용.
- 의존성을 추가하지 않았다.

## 자동 검사

| 검사 | 결과 |
| --- | --- |
| npm run check:backend | rustfmt, clippy -D warnings, tests, build 통과 |
| backend tests | 총 16개 통과: 기존 10 + TaskPreset 6 |
| npm run check:frontend | Prettier, ESLint, Vitest, TypeScript, Vite build 통과 |
| frontend tests | 총 40개 통과: 기존 26 + API 8 + UI 6 |

실제 임시 SQLite에서 타입별 기본값, 순서/ID 유지, 생략 필드 보존, 입력 제한,
알 수 없는 필드, 잘못된 UUID, 소유권, 다른 프리셋의 항목 ID와 중복 ID 차단,
교차 소유자 태그 FK, 문자열 그대로 검색, 태그 검색, pagination, 워크 태그 재사용,
보관/복원/version, 재접속 영속성, 동시 부분 수정 시 두 변경 보존을 검증했다.
태그 저장 실패 trigger로 프리셋/항목/태그/version 전체 rollback과 내부 오류 비노출을 확인했다.

UI 테스트는 실패 복구, 검색·보관 범위 페이지 초기화, 타입별 편집/순서/삭제,
숫자 0과 boolean false 보존, 실패 후 재시도, 타입 변경 시 기본값/단위 초기화,
읽기 전용 필드 제외, 상세 조회 재시도, 보관/복원을 검증했다.

Production build: JS 262.66 kB (gzip 79.58 kB), CSS 20.56 kB (gzip 5.05 kB).
빌드 수치는 성능 벤치마크가 아니다.

## 실제 브라우저

http://127.0.0.1:15173/#/presets/tasks 에서 Vite와 새 백엔드를 사용했다.

- 빈 목록에서 [검증용] 복습 등록: 기본 메모, QA-Phase3/학습 태그, 체크/텍스트/숫자 항목.
- 필수 체크, false 기본값, 숫자 0, 텍스트 기본값과 순서 이동 후 저장 확인.
- 새로고침 후 DB 저장 내용 유지 확인.
- 편집에서 항목 순서 이동·삭제, 메모 수정, 숫자 -1.5 입력과 저장 확인.
- 태그 QA-Phase3 검색, 보관, 복원과 버전 증가, 보관함 목록 확인.
- 390×844 모바일 목록/편집에서 가로 넘침 없음. 항목 조작 버튼 높이 46px.
- 모바일 화면의 고정 저장 버튼, 하단 주 메뉴, 항목 편집 배치를 스크린샷으로 확인.
- 임시 viewport 설정을 복원했다.

검증용 프리셋 1개는 보관함에 남겼다.
ID: a188304f-28ad-4d73-ab95-0a14f65af92c. 최종 version 5, 항목 2개.

## 발견·수정 및 한계

- 기존 개발 백엔드가 exe를 잠가 빌드가 실패했다. 프로젝트 경로 확인 후 종료하고 새 버전으로 재실행했다.
- migration 개수 검증을 2개에서 3개로 갱신했다.
- 태스크 예시 분류 테스트를 실제 저장 목록 탐색 검증으로 변경했다.
- Docker 재빌드와 원격 CI는 이번 단계에서 실행하지 않았다. 모바일은 viewport 검증이며 실기기 검증은 아니다.
- 동시 부분 수정은 직렬화하지만 전체 폼의 오래된 값을 감지하는 충돌 UI는 아직 없다.
- 인증, 워크 기본 태스크 연결, 일정 snapshot·실행 저장은 후속 단계다.
- 다음 단계: Phase 4 워크의 기본 태스크 연결·추가·제거·순서.
