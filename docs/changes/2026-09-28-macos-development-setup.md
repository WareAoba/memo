# macOS 개발 환경 설정

## 변경

- 작업 시작 시 Git 작업 트리는 깨끗했다. 기존 제품 소스와 의존성 lockfile은 변경하지 않는다.
- Apple Silicon macOS의 기존 Homebrew·Xcode Command Line Tools·nvm·rustup을 재사용했다. 기존 Node 22.11.0/Rust stable 1.93.0을 보존하며 Node 24.21.0(npm 11.19.0) 및 Rust 1.94.0/rustfmt/clippy를 추가했다. nvm 기본 alias를 24로 지정했다.
- `.nvmrc`와 `rust-toolchain.toml`로 README·CI와 일치하는 프로젝트 도구 버전을 선택한다.
- 네이티브 로컬 개발 경로를 설정한다. Docker는 이 경로에 필요하지 않아 설치하지 않는다.

## 문서

- README에 macOS 설치·실행 및 Windows 데이터 이전 주의점을 추가하고 Docker의 선택 범위를 명확히 한다.
- CODE_MAP에 새 버전 설정 파일을 등록하고 CHANGES에 이번 기록을 연결한다.
- 제품 동작·구현 범위·UI는 변경하지 않으므로 SPEC·STATUS·디자인 레퍼런스는 수정하지 않는다. UI 변경이 없어 디자인 시스템 컴포넌트 참조 대상도 없다.

## 검증

- `npm --prefix frontend ci`: 성공, 감사 취약점 0건. 의존성 lockfile 변경 없음.
- 새 터미널 환경에서 Node 24.21.0/npm 11.19.0, 저장소에서 Rust/cargo 1.94.0 선택 확인.
- `npm run check:backend`: rustfmt·clippy·전체 테스트·빌드 성공. 테스트는 저장소의 임시 DB fixture를 사용했다.
- `npm run dev:backend`: 실행 유지. `http://127.0.0.1:3000/api/health`가 `{"status":"ok"}`로 응답했다. 시작 전 data가 없었고 로컬 실행용 기본 data가 새로 생성됐다. Windows 사용자 데이터는 가져오지 않았다.
- 최초 프런트 검사 및 서버는 Vite 설정 로딩에서 대기해 종료 후 재시도했다. esbuild 단독 transform은 성공했으나 bundle의 상위 디렉터리 열기가 대기했고, macOS TCC 로그에서 ChatGPT(com.openai.codex)의 Documents 접근 요청을 확인했다. 사용자에게 OS 권한 창 확인을 요청한 뒤 대기가 해소되어 검사가 계속 진행됐다. 권한 설정을 자동 변경하거나 우회하지 않았다.
- `npm run check:frontend` 재시도: 포맷·ESLint·디자인·구조 검사, 68개 파일/382개 테스트, TypeScript·Vite 빌드 모두 성공. 기존 제품 소스 그대로의 JS 번들 500 kB 초과 경고는 남아 있으며 이번 환경 설정 범위에서 변경하지 않았다.
- `npm run dev:frontend`: `http://127.0.0.1:15173/` HTTP 200, 프록시 `/api/health`의 `{"status":"ok"}` 확인. 내장 브라우저에서 오늘 화면·My Track·빈 일정 상태가 정상 표시됨을 스크린샷으로 검증하고 해당 탭을 유지 대상으로 표시했다. 사용자 확인용 백엔드·프런트 서버는 유지했다. 진단용 추가 Vite 프로세스만 종료했다.
- `git diff --check`와 최종 diff 검토 후 `record:change`, `npm run check:docs`로 기록·문서 경로를 검증했다.
- Docker 경로와 Windows 기존 데이터 이전은 수행하지 않았다. 제품 UI를 수정하지 않아 별도의 디자인 레퍼런스 상태별 회귀 검증은 하지 않았다.
