# 에이전트 작업 골격 리팩토링 — 2026-09-25

## 범위

- 루트 AGENTS, 현재 상태, 기능별 파일 지도, 문서 색인, 제품 안내 분리.
- README는 시작·실행·검증 중심으로 정리. 과거 문서 경로는 유지.
- 전역 CSS를 책임별 파일로 분리하고 기존 선언 순서와 cascade layer 유지.
- 선택 테스트 명령과 로컬 문서 링크 검사 추가.
- API·DB·제품 동작 계약은 변경하지 않음.

## 작업 전 상태

- 로컬 Git에 커밋이 없고 프로젝트 파일은 미추적 상태였음.
- 첫 `npm run check:frontend`는 기존 다국어 작업의 60개 파일 포맷 오류로 중단됨.
- 작업 중 다른 작업이 프런트 파일을 계속 수정함. 관련 변경은 보존하고 이 리팩토링의 결과와 구분함.

## 검증 결과

- `npm run check:docs`: 33개 Markdown 파일의 로컬 링크 대상 존재 확인 통과. 문서 안의 앵커와 인라인 코드 경로는 검사 대상이 아님.
- CSS 분리 직후·포맷 후: PostCSS 구문 트리의 선택자, 속성값, 미디어 조건, 선언 순서가 원본과 일치.
- Vite `preprocessCSS`로 12개 import를 실제 처리한 결과도 원본 선언·순서와 일치. 기존 import 진입점과 cascade layer 유지.
- 변경한 CSS·스타일 안내·검사 스크립트·루트 package.json 포맷 검사 통과.
- 프런트 ESLint·디자인 규칙 검사 통과. 전체 테스트 33개 파일 / 157개 테스트 통과. TypeScript·Vite 배포 빌드 통과.
- Vite는 500kB 초과 JS 청크 경고를 출력함. 이번 변경은 JS 구조를 바꾸지 않음.
- 백엔드 format·clippy·tests·build 통과. 실행 중인 서버의 exe 잠금을 피하기 위해 `CARGO_TARGET_DIR=backend/target-validation` 사용.
- 전체 `check:frontend`는 별도 다국어 작업이 생성한 `frontend/public/notification-locales.js` 포맷 오류에서 중단. 위 lint/test/build는 각각 실행해 확인함.
- 브라우저 수동 시각 검증은 수행하지 않음. 이번 스타일 변경은 Vite 처리 후 CSS 의미·순서 비교로 검증함.

## Git 기준점

다른 작업이 계속 파일을 수정하고 전체 프런트 포맷 검사가 미통과이므로 전체 프로젝트를 검증 완료 기준 커밋으로 묶지 않았다. 두 작업이 완료된 시점에 전체 검사 후 최초 커밋을 만들 수 있다.
