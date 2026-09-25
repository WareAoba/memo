# Preset execution workspace

워크에 태스크 프리셋을 연결하고 일정별 독립 스냅샷으로 실행하는 로컬 우선 일정 도구입니다. React/TypeScript + Rust/Axum + SQLite를 사용합니다.

## 시작점

- 에이전트 작업: [AGENTS.md](AGENTS.md) → [현재 상태](docs/STATUS.md) → [기능별 파일 지도](docs/CODE_MAP.md)
- 제품 동작: [사용 안내](docs/PRODUCT_GUIDE.md)
- 요구 계약: [SPEC.md](SPEC.md)의 관련 절
- 전체 문서: [문서 색인](docs/README.md)

## 필요 도구

- Rust 1.94 이상과 rustfmt/clippy. Windows는 MSVC C++ build tools 필요
- Node.js 24 LTS와 npm
- Docker Engine/Desktop 및 Compose v2 (`--wait` 지원)

## 로컬 개발

저장소 루트에서 최초 설치:

```sh
npm --prefix frontend ci
```

선택적으로 .env.example을 .env로 복사합니다(PowerShell: `Copy-Item .env.example .env`,
POSIX: `cp .env.example .env`). 기본값만 사용하면 복사 없이 실행됩니다.
각각 별도 터미널에서 저장소 루트 기준으로 실행합니다.

```sh
npm run dev:backend
npm run dev:frontend
```

- UI: http://127.0.0.1:15173
- API: http://127.0.0.1:3000/api/health
- Vite proxy: http://127.0.0.1:15173/api/health
- DB: data/database/app.sqlite3 (자동 생성, Git 제외)

```sh
curl http://127.0.0.1:3000/api/health
```

PowerShell에서는 `Invoke-RestMethod http://127.0.0.1:3000/api/health` 사용 가능.
backend 포트를 변경하면 API_PROXY_TARGET도 맞춰야 합니다. Vite는 포트가 사용 중이면 실패합니다.
기본 포트 이외의 주소를 쓰면 `.env`의 `APP_ORIGINS`에 UI와 API의 정확한 origin을 쉼표로 나열합니다(예: `http://localhost:15174,http://127.0.0.1:3001`). 설정값은 기본 허용 목록을 대체하며 와일드카드를 사용하지 않습니다. Docker 개발의 허용 origin은 `APP_PORT`에 맞춰 자동 설정됩니다.
backend 시작은 루트에서 실행해야 기본 .env와 상대 DB 경로가 일관됩니다.
환경 변수는 .env보다 우선하며, VITE_ 접두어가 붙은 변수만 브라우저에 공개됩니다.
비밀은 VITE_ 변수로 지정하지 마세요.

## 검증·포맷

```sh
npm run check
npm run format:backend
npm run format:frontend
```

개별 검증:

```sh
npm run check:backend
npm run check:frontend
```

작업 중에는 `npm run test:frontend -- src/features/workspace/Today.test.tsx` 또는
`npm run test:backend -- --test schedules`로 관련 테스트만 실행할 수 있습니다.
문서 경로는 `npm run check:docs`로 검사합니다.

Windows에서 실행 중인 서버가 빌드 대상 exe를 잠그면, 별도 검증 터미널에서
`$env:CARGO_TARGET_DIR='backend/target-validation'`을 설정한 뒤 백엔드 검사를 실행합니다.
개발 서버를 중단하지 않고 검사할 수 있으며 이 디렉터리는 Git에서 제외됩니다.

백엔드: rustfmt → clippy(-D warnings) → tests → build.
프런트: Prettier → ESLint → Vitest → TypeScript/Vite build.

## Docker 개발

```sh
docker compose up --build -d --wait
docker compose ps
docker compose logs backend
```

UI와 API: http://localhost:8080 및 http://localhost:8080/api/health.
APP_PORT로 공개 loopback 포트를 변경할 수 있습니다. backend/frontend 포트는 호스트에 직접 노출하지 않습니다.
frontend src/index.html은 bind mount로 갱신됩니다. backend·의존성·설정 변경 후에는 재빌드합니다.

```sh
docker compose up --build -d --wait
docker compose down
```

`down`은 데이터를 보존합니다. `down -v`는 데이터 볼륨을 삭제하므로 일상 종료 명령으로 사용하지 마세요.
SQLite와 첨부 저장 위치는 컨테이너 /data 아래입니다.
Windows에서 Docker를 WSL shim으로 사용하는 경우 WSL/Docker daemon이 실행 중이어야 합니다. 이 PC처럼 짧은 WSL 호출 후 서비스가 종료되는 환경에서는 `docker compose up --build`를 foreground로 실행하거나 WSL 터미널을 열어두세요. 검증 상세는 docs/VERIFICATION.md에 기록했습니다.

이 구성은 Vite 개발 서버와 localhost HTTP를 사용합니다. 운영 배포용 이미지/static serving/TLS는 Phase 11 범위입니다.
암호화 저장소와 백업 절차: [BACKUP.md](docs/BACKUP.md).

## 마이그레이션

SQL 파일은 backend/migrations/YYYYMMDDNNNN_description.sql에 추가합니다.
sqlx::migrate!가 빌드에 포함하고 서버 시작 시 적용합니다. SQLx CLI 설치나 빌드 시 실DB는 필요 없습니다.
build.rs가 migration 변경을 감지합니다. 이미 적용한 파일을 수정하면 checksum 검증이 실패합니다.
새 migration과 관련 테스트를 추가하고 검증한 뒤 배포하세요.

## 개발 구조

```text
AGENTS.md             에이전트 진입 지침
backend/src/routes/   HTTP 경계
backend/src/services/ 도메인 검증·SQL·트랜잭션
backend/migrations/   추가 전용 DB 변경
backend/tests/        API 통합 테스트
frontend/src/api/     HTTP 계약·오류 처리
frontend/src/features/ 기능별 화면·인접 테스트
frontend/src/styles/  전역 스타일의 책임별 분리
scripts/              저장소 문서 검증
docs/                 상태·파일 지도·기능 문서·과거 기록
```

워크 코드는 `features/works`에 있습니다. 기존 API와 DB의 `entities` 명칭은 호환성을 위해 유지합니다. 기능별 수정 경로와 선택 테스트는 [CODE_MAP](docs/CODE_MAP.md)에 있습니다.
