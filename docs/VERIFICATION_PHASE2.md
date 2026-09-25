# Phase 2 현장 관리 검증 결과

검증일: 2026-09-24 (Asia/Tokyo) · 기준: SPEC.md v1.2

## 구현 결과

- 최소 users와 고정 로컬 사용자, 최초 기기 IANA 시간대 저장.
- entities/tags/entity_tags migration과 소유자 FK, CHECK, 목록 인덱스.
- 현장 생성·조회·부분 수정·검색·보관·복원 API. 태그 포함 쓰기는 transaction.
- 이름/관리번호/주소 검색, 기본 20건과 최대 100건 제한, offset 페이지 이동.
- 모바일 목록·상세·편집 화면, 방문 요건/작업 시간/태그 표시.
- 빈 상태, 요청 중, 저장 중, 오류/재시도, 저장 실패 시 입력 유지, 오프라인 안내.
- 기능 UI는 frontend/src/features/entities/Entities.tsx, 탐색은 App.tsx에 분리.
- Rust uuid 1.26.1, chrono-tz 0.10.4 추가. Cargo.lock 갱신. 프런트 의존성 추가 없음.

## 자동 검증

| 명령 | 결과 |
| --- | --- |
| npm run check:backend | rustfmt, clippy -D warnings, tests, build 통과 |
| backend tests | Entity 6개 + 기존 health/migration 4개, 총 10개 통과 |
| npm run check:frontend | Prettier, ESLint, Vitest, TypeScript, Vite build 통과 |
| frontend tests | UI 6개 + Entity API 7개 + 기존 health API 5개, 총 18개 통과 |

백엔드는 독립적인 임시 SQLite DB로 검증했다. 모든 현장 필드와 태그 저장,
부분 수정 시 기존 값 보존, 시간 삭제, 이름/번호/주소 검색, 페이지 분리,
%/_ 문자 그대로 검색, 보관·복원·재접속 영속성, UUID/입력/JSON/query 오류,
타 사용자 조회·수정·보관 차단, 교차 소유자 태그 FK 차단을 포함한다.
태그 링크에 실패 trigger를 넣어 현장 갱신/생성 및 태그가 모두 rollback되는 것도 검증했다.
시간대의 유효성 및 최초 값 유지, migration 재실행을 검증했다.

프런트는 목록 실패 후 재시도, 검색/보관 범위/페이지 초기화,
저장 실패 후 입력 보존과 재시도, 불완전한 시간 차단, 보관/복원,
편집 시 읽기 전용 필드 제외, same-origin 요청과 응답 계약/네트워크/JSON 오류를 검증했다.

최종 production build: JS 236.83 kB (gzip 74.16 kB), CSS 5.78 kB (gzip 1.82 kB).
수치는 현재 lockfile 기준이며 성능 벤치마크가 아니다.

## 실제 브라우저 확인

http://127.0.0.1:15173 에서 실행 중인 Vite와 새 백엔드를 사용했다.

- 현장 이름·번호·주소·담당자·연락처·안내·메모·요건·태그 등록 후 상세 표시 확인.
- 주소 수정, 작업 허용 시간 09:00–17:30 저장 후 상세와 목록 표시 확인.
- 관리번호 검색 결과 확인.
- 보관 후 사용 중 목록 0건, 보관함 1건 확인.
- 복원 후 사용 중 목록에 다시 표시됨을 확인하고 검증용 현장을 다시 보관.
- 390×844 viewport에서 목록/상세 화면 확인. 가로 넘침 없음, 상세 버튼 높이 46px.
- viewport 복원 후 데스크톱 상세 화면과 새로고침 시 데이터 보존 확인.
- 최종 화면 제목: Preset — 현장 관리.

검증용 '[검증용] 중앙 현장' 한 건(관리번호 QA-20260924)은 로컬 DB 보관함에 남아 있다.
입력은 가상 데이터이며 실개인정보를 사용하지 않았다.

## 수정한 문제와 검증 한계

- 기존 실행 중인 개발 백엔드가 exe를 잠그고 있어 경로를 확인한 뒤 종료하고 새 버전으로 재실행했다.
- 검색 SQL의 escape 문자 문제를 테스트로 발견해 ! 방식으로 수정했다.
- UI 테스트의 입력 요소 선택과 TypeScript strict 배열 접근 검사를 수정했다.
- 브라우저 자동화의 time fill만으로 React 값이 확정되지 않아 실제 키 입력으로 시간 값을 변경·검증했다.
- 이번 단계에서는 로컬 서버/API/브라우저를 검증했다. Docker 재빌드와 원격 CI 실행은 하지 않았다.
- 모바일은 viewport 검증이며 실제 기기 테스트가 아니다.
- 고정 로컬 사용자는 인증이 아니다. Google 로그인과 운영 배포는 예정된 후속 단계다.
- 시간대 수동 변경 UI, 프리셋·일정·작업 실행은 아직 구현하지 않았다.
- 별도 기기의 동시 편집 충돌 UI나 optimistic concurrency 버전 계약은 이번 범위에 포함하지 않았다.

## 다음 단계

Phase 3 TaskPreset: 프리셋 CRUD/search, checkbox/text/number 항목 정의,
순서·required·기본값·단위·분류·태그 및 version 관리.
구체적인 범위는 IMPLEMENTATION_PLAN.md와 SPEC.md를 따른다.