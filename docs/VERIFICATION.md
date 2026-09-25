# Phase 0 검증 결과

검증일: 2026-09-24 (Asia/Tokyo)

> 이 문서는 Phase 0 완료 당시의 검증 기록이다. 이후 SPEC v1.1에서 인증을 후순위로 옮겼다.
> 최신 다음 구현 대상은 Entity 관리이며, 현재 계획은 SPEC.md와 IMPLEMENTATION_PLAN.md를 따른다.
> 문서 개정만으로 아래 검증 결과나 구현 범위가 추가된 것은 아니다.

## 환경

- Windows, PowerShell 7
- Rust/cargo 1.94.1 (MSVC)
- Node.js 24.14.1, npm 11.11.0
- Docker Engine 29.4.1 (WSL Ubuntu), Compose 5.1.3
- Axum 0.8.9, SQLx 0.8.6, Vite 7.3.6, Vitest 4.1.11
- Cargo.lock 및 frontend/package-lock.json 생성 완료

## 완료 범위

최종 SPEC, 단계별 구현 계획, Rust/React 기반, 실제 SQLite 연결과 migration,
DB readiness API, 프런트 API client/상태/재시도, 개발용 Compose/Caddy, lint/format/test/build,
CI workflow와 저장 암호화·백업 운영 문서를 작성했다.
Phase 1 인증과 업무 기능은 구현하지 않았다.

## 자동 검증

| 명령/검증 | 결과 |
| --- | --- |
| cargo fmt --manifest-path backend/Cargo.toml --check | 통과 |
| cargo clippy --manifest-path backend/Cargo.toml --all-targets --locked -- -D warnings | 통과 |
| cargo test --manifest-path backend/Cargo.toml --locked | 통합 테스트 4개 통과 |
| cargo build --manifest-path backend/Cargo.toml --locked | 통과 |
| npm run check:frontend | Prettier/ESLint/TypeScript/Vite 통과 |
| Vitest | 2 파일, 테스트 7개 통과 |
| npm dependency audit (마지막 npm install 결과) | 알려진 취약점 0개 |
| docker compose up --build -d --wait | backend/frontend/Caddy 빌드·기동 통과 |
| docker compose ps | 세 서비스 healthy 확인 |
| Caddy validate 및 fmt --diff | valid configuration, 포맷 차이 없음 |

백엔드 테스트: 실제 임시 SQLite에서 health 200, DB 종료 시 503/내부 정보 비노출,
migration 영속성·재실행·foreign keys·WAL, 404/405 JSON 오류 계약.
프런트 테스트: same-origin 요청, HTTP 실패, JSON/계약 불일치,
화면 성공 상태와 실패 후 재시도 복구.

프런트 production build: JS 226.55 kB (gzip 71.10 kB), CSS 3.22 kB (gzip 1.27 kB).
GitHub Actions workflow는 작성했지만 원격 저장소가 없어 실제 CI 서비스에서는 실행하지 않았다.
수치는 이 검증 시점의 lockfile과 빌드 기준이며 성능 벤치마크나 보안 인증을 뜻하지 않는다.

## 실제 실행 확인

| 대상 | 관찰 결과 |
| --- | --- |
| http://127.0.0.1:3000/api/health | HTTP 200, {"status":"ok"} |
| http://127.0.0.1:15173/api/health | Vite proxy 경유 HTTP 200, 같은 JSON |
| http://localhost:8080/api/health | Docker/Caddy 경유 HTTP 200, 같은 JSON |
| http://localhost:8080/ | HTTP 200 및 브라우저 연결 성공 표시 |
| 로컬 브라우저 | 연결됨/실제 확인 시각/다시 확인 버튼 동작 |
| 모바일 390×844 viewport | 가로 넘침 없음, 버튼 높이 46px |

backend startup/migration/shutdown 구조화 JSON 로그를 Docker에서 확인했다.
실데이터는 생성하지 않았다. 로컬 개발 DB에는 인프라 메타데이터와 SQLx migration 이력만 존재한다.

## 해결한 문제와 알려진 환경 제한

1. Windows가 기본 Vite 포트 5173을 포함한 5157–5256을 예약하고 있었다.
   개발 포트를 15173으로 바꾸고 로컬/컨테이너/proxy/문서를 통일했다.
2. 초기 Vitest 3 계열에서 advisory GHSA-82fw-gwwq-j7x9가 확인되었다.
   수정된 Vitest 4.1.11과 지원 중인 ESLint 10으로 갱신 후 모든 프런트 검증을 통과했다.
3. 이 PC의 docker.cmd는 WSL Ubuntu의 Docker를 호출한다.
   짧은 WSL 호출이 끝난 뒤 distro/Docker 서비스가 종료·재시작되는 현상을 관찰했다.
   docker compose logs --follow 세션을 유지한 상태에서는 세 서비스가 healthy이고 브라우저가 연결됐다.
   같은 환경에서는 docker compose up --build를 foreground로 실행하거나 WSL 세션을 열어두는 방식이 적합하다.
   OS/WSL의 전역 설정은 변경하지 않았다.
4. Docker buildx 플러그인이 없어 경고가 출력됐지만 classic builder로 이미지 빌드는 성공했다.
5. 개발 Compose는 localhost HTTP와 Vite 개발 서버다. HTTPS, 암호화 볼륨,
   운영 static frontend 배포와 전체 보안 audit는 Phase 11 요구이며 현재 완료 기능이 아니다.
6. 모바일 검증은 브라우저 viewport 기반이며 실제 모바일 기기 성능/설치 테스트는 아니다.
7. PWA, Google 로그인, 사용자 소유권 기반 업무 API는 각 후속 단계에서 구현한다.

## 다음 단계

별도 승인 후 Phase 1: Google OIDC + 서버 세션 + CSRF + 인증된 API/보호된 화면.
OAuth client와 callback URL은 해당 단계에서 운영 환경에 맞춰 설정한다.
