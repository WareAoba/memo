# 공개 배포 전 보안 점검 — 2026-09-25

> 후속 수정: 사용자 요청으로 로그인(S1)과 운영 배포 전환(S4)은 제외했다. S2는 전체 API의 정확한 Host/Origin 허용 목록과 브라우저 요청 검사로, S3는 본문 수신 전 동시 업로드 4건·30초 수신 제한·사전 대상 검증·사용자당 사진 1GiB 예약으로, S5는 Vite/Caddy/API 응답 헤더로 보완했다. 초기화 후 삭제 대기 파일도 저장 한도에 포함한다. 세션용 CSRF 토큰은 향후 로그인 단계의 계약이며 이번에 인증 기능을 추가한 것은 아니다. 아래 내용은 수정 전 점검 기록이다. 현재 동작은 SPEC과 STATUS를 기준으로 한다.

> 재현 테스트의 외부 요청 수락 기대값은 403 거절과 데이터 불변 검증으로 전환했다. 업로드 과부하 시 본문을 읽지 않음, 취소·시간 초과 후 슬롯 반환, 대상 사전 검증, 저장 한도·정리 후 해제를 검증한다. RSA 간접 의존성은 현재 ES256 사용 경로에서 실제 취약 연산이 확인되지 않아 교체하지 않았다.

> 후속 검증: 별도 `backend/target-security`에서 `check:backend` 통과(73개 테스트, fmt/clippy/build). `check:frontend` 통과(174개 테스트, format/lint/build), Vite 임시 서버 HTML의 CSP/X-Frame-Options/nosniff 확인, Caddy 컨테이너의 설정 validate 통과. 실행 중인 기존 서버와 실제 데이터는 변경하지 않았으므로 백엔드 변경 적용에는 재시작/재빌드가 필요하다.

판정: **현재 상태로 인터넷 공개 배포 불가.** 로컬 단일 사용자 개발 구현이며, SPEC 2.1/2.1.1에서 요구한 공개 전 인증 경계가 아직 없다. 기본 Compose의 loopback 바인딩은 유지해야 한다.

## 범위와 방법

- Rust routes/services, 사용자 식별, SQLite 쿼리와 transaction, 사진 입출력, Push 전송·예약, React 렌더링·저장소·서비스 워커, Docker/Caddy/Vite/CI 설정을 검토했다.
- 실제 `data/`와 비밀 파일을 읽거나 테스트에 사용하지 않았다. 공격 재현은 tempfile의 독립 SQLite와 Axum in-process 요청으로만 실행했다.
- 저장소가 점검 시작부터 모두 untracked여서 커밋 기준 변경 비교는 불가능했다. 기존 구현은 수정하지 않고 재현 테스트와 이 보고서만 추가했다.
- 실제 운영 도메인, TLS 종단, 방화벽, 호스트 권한·암호화 볼륨, 백업 복구, 컨테이너 이미지 CVE는 검증하지 않았다. 아래 결과가 보안 무결성을 보증하지 않는다.

## 발견 사항

### S1 — 치명적: 모든 외부 요청이 같은 사용자 권한으로 실행됨

근거: `backend/src/local_user.rs:2`, `backend/src/lib.rs:35`, `backend/src/routes/mod.rs:17`, `backend/src/services/settings.rs:115`.

`current_user_id()`는 고정 UUID를 반환한다. 라우터에는 인증 미들웨어가 없으며 API 호출에 쿠키나 Authorization이 필요하지 않다. SQL의 user_id 조건과 타 소유자 404 처리는 존재하지만, 요청자의 신원을 확인하지 않으므로 로컬 사용자의 모든 데이터에 접근할 수 있다.

네트워크 접근이 가능하면 워크·일정·메모·사진을 열람·변경할 수 있다. 특히 `/api/settings/reset`은 `target`과 `confirmation` 문자열이 같으면 영구 삭제한다. 이 문자열은 사용자 실수 방지 장치이며 인증 수단이 아니다. Push 활성 상태에서는 공격자 기기를 같은 사용자 구독으로 등록할 수 있어 알림 내용 유출도 가능하다.

재현: `backend/tests/security_audit.rs`에서 인증정보 없이 생성 201, 목록 200, works 초기화 204와 DB 행 삭제를 확인했다. 실제 데이터에는 실행하지 않았다.

배포 조건: SPEC의 Google OIDC 검증, 계정 허용 목록, 서버 세션과 만료·폐기, 검증된 사용자 ID를 service까지 전달하는 요청 단위 권한 경계를 구현한다. health 등 명시적인 공개 경로 이외에는 미인증 요청을 거절하고 로컬 사용자 경로도 운영에서 차단한다. 초기화에는 로그인 사용자 확인과 재인증 정책을 적용한다. 인증 도입 전에는 공개 포트·터널을 열지 않는다.

### S2 — 높음: 공통 Origin/Host 검증과 CSRF 방어가 없음

근거: `backend/src/lib.rs:45`, `backend/src/routes/push.rs:10`, `backend/src/routes/settings.rs:31`, `docker/Caddyfile:1`.

Origin 검사는 Push의 세 변경 경로에만 있다. 일반 API는 외부 Origin, `Sec-Fetch-Site: cross-site`, 임의 Host를 받아들인다. 재현 테스트에서 이 헤더를 넣은 워크 생성이 201로 성공했다. Push 검사도 설정된 공개 origin 대신 요청 Host와 비교하고 스킴까지 대조하지 않으므로 운영용 공통 검증을 대체하지 못한다.

일반 브라우저의 cross-origin JSON 요청에는 preflight가 적용되고 현재 CORS 허용 설정은 없으므로, 이 테스트가 임의 사이트의 브라우저 CSRF 성공을 입증하지는 않는다. 다만 백엔드에는 독립 방어가 없으며, 쿠키 인증 도입 후 CSRF 방어 없이 공개해서는 안 된다. 로컬 서비스의 DNS rebinding 방어 역시 Host 검증·브라우저 사설망 정책·프록시 구성에 의존하며 실제 브라우저 공격은 미검증이다.

배포 조건: 고정된 허용 Host와 정확한 origin(스킴·호스트·포트)을 검증한다. 세션 기반 변경 요청에는 CSRF 토큰 검증을 공통 적용한다. 프록시 전달 헤더는 신뢰하는 프록시에서만 받아들이고, 변경 API마다 외부 origin·누락/잘못된 토큰을 거절하는 테스트를 둔다.

### S3 — 높음: 사진 업로드 대기열을 통한 메모리·CPU 고갈 가능

근거: `backend/src/routes/photos.rs:33`, `backend/src/services/photos.rs:151`.

Bytes extractor가 최대 10 MiB 본문 전체를 읽은 뒤 service의 `acquire_owned()`를 기다린다. 세마포어는 디코딩 2건만 제한하며 대기 중인 HTTP 요청 수와 이미 수신한 본문은 제한하지 않는다. 따라서 동시 업로드가 늘면 대기 요청마다 본문이 메모리에 남는다. 100건의 10 MiB 본문이면 본문 버퍼만 약 1 GiB이며, 실제 값은 수신 상태와 allocator에 따라 달라진다.

대상 UUID·소유권·사진 개수 확인도 디코딩 이후이므로 잘못된 대상에 대한 요청도 디코더를 사용한다. 대상당 100장 제한은 있지만 사용자 전체 저장량 제한과 요청 속도 제한은 없어 반복적인 자원 생성으로 디스크를 소진할 수도 있다. 실제 메모리 고갈 부하 공격은 실행하지 않았다.

배포 조건: 본문 수신 전에 인증 및 동시 요청 입장 제한을 적용하고, 대기열에 상한 또는 즉시 429/503 거절을 둔다. 가능하면 비싼 디코딩 전에 대상 권한을 검사하되 저장 시 transaction 안에서 다시 확인한다. 사용자 저장량·업로드 속도·요청 시간 제한과 컨테이너 자원 상한을 함께 설정한다. 현재 MIME/픽셀/할당량/디코더 제한은 유지한다.

### S4 — 높음(공개 배포 시): 제공된 Compose는 운영 구성이 아님

근거: `docker/frontend.Dockerfile:7`, `docker/Caddyfile:1`, `docker-compose.yml:45`.

프런트 컨테이너는 `npm run dev -- --host 0.0.0.0`으로 Vite 개발 서버를 실행하며 Caddy는 HTTP :80에서 이를 프록시한다. HTTPS 인증서·리다이렉트 설정이 없다. 기본 호스트 포트가 127.0.0.1인 점은 적절하지만, 이를 외부 IP로 바꾸거나 그대로 터널에 연결하면 개발 구성이 공개된다. TLS를 제공하는 외부 프록시가 따로 있다면 실제 종단을 별도로 검증해야 한다.

배포 조건: `vite build`의 dist 정적 파일을 운영 웹서버에서 제공하는 별도 구성을 만든다. 고정 도메인 HTTPS를 설정하고 백엔드 직접 접근을 막는다. 운영 문서 역시 개발 Compose와 구분한다. [Vite 공식 빌드 안내](https://vite.dev/guide/build), [정적 배포 안내](https://vite.dev/guide/static-deploy).

### S5 — 중간: 앱 문서에 프레임 삽입 방지 헤더가 없음

근거: `docker/Caddyfile:1`, `frontend/index.html:1`, `backend/src/lib.rs:48`.

사진 응답에는 CSP와 nosniff가 있지만 앱 HTML에는 `Content-Security-Policy: frame-ancestors ...` 또는 X-Frame-Options가 설정되어 있지 않다. 앱을 공격자 페이지의 iframe에 넣어 사용자 클릭을 유도하는 방어가 서버 구성에 없다. 실제 브라우저에서 클릭재킹은 재현하지 않았다.

배포 조건: 앱 HTML에 `frame-ancestors 'none'` 또는 필요한 origin만 허용하고, 지원 브라우저에 맞춰 X-Frame-Options를 보완한다. 운영 정적 빌드에 맞는 CSP, nosniff, Referrer-Policy를 적용하고 HTTPS 설정 완료 후 HSTS 정책을 정한다. CSP는 inline style 등 실제 UI 요구를 확인해 배포 전 검증한다.

## 의존성 검사

- `npm --prefix frontend audit --json`: 취약점 0건, 총 의존성 304개(개발 의존성 포함).
- `cargo audit --file backend/Cargo.lock --json`: 알려진 취약점 1건, 경고 0건, lockfile 의존성 339개. RustSec DB 커밋 `593df8c1b5ed0bcde9dddadfeeead776fa514ff8`(2026-09-24 갱신).
- `rsa 0.9.10`: [RUSTSEC-2023-0071 / CVE-2023-49092](https://rustsec.org/advisories/RUSTSEC-2023-0071.html), RSA 개인키 연산의 타이밍 부채널. 점검 시 공지에 패치 버전이 없었다.
- 활성 의존 경로(Windows와 Linux target 모두 확인): `web-push-native 0.4.0 → jwt-simple 0.12.17 → superboring 0.1.14 → rsa 0.9.10`.
- 현재 `backend/src/push.rs`는 ES256KeyPair/P-256을 사용한다. 코드에서 RSA 개인키 연산 경로는 확인하지 못했으므로 **알려진 취약 의존성 포함**과 **앱에서의 실제 악용 가능성**을 구분한다. 안전한 feature/의존성 대체로 RSA를 제거할 수 있는지 검토하고, 예외 처리 시 호출 경로 근거·만료일·재검토 조건을 기록한다. 전체 취약점 ID를 무조건 무시하지 않는다.
- CI에는 audit 단계가 없다. 배포 gate에 lockfile 보안 검사와 컨테이너 이미지 검사를 추가할 필요가 있다.

## 확인한 방어

- 읽은 SQL에서 외부 값은 bind 매개변수로 전달되고 동적 SQL은 상수 절과 placeholder로 구성된다. 직접적인 SQL injection 경로를 발견하지 못했다.
- 타 소유자 읽기/쓰기 거절과 DB FK 범위 테스트가 통과했다. 다만 S1의 실제 사용자 인증을 대신하지 않는다.
- 사진 경로는 검증된 사용자/사진 UUID와 MIME별 확장자로 만들어져 입력 filename을 파일 경로로 사용하지 않는다.
- JPEG/PNG/WebP 허용 목록, 실제 형식 대조, 전체 디코딩, 10 MiB/8192px/4000만 픽셀/256 MiB 디코더 한도와 동시 디코딩 제한이 있다.
- Push 목적지는 알려진 공급자 도메인·HTTPS·443으로 제한하고 리다이렉트를 금지하며 전송 타임아웃을 설정한다. 임의 URL SSRF 경로는 발견하지 못했다.
- 읽은 React 코드에서 위험한 HTML 삽입과 eval 사용을 발견하지 못했다. 서비스 워커 알림 이동은 동일 origin과 일정 hash 경로를 확인한다. API에는 no-store가 적용된다.
- 오류 응답은 내부 SQL/스택을 노출하지 않으며 VAPID 파일은 Unix에서 0600으로 생성한다. 백엔드 컨테이너는 비root 사용자로 실행한다.
- 비밀값을 출력하지 않는 소스 패턴 검색에서 PEM 개인키·일부 대표 API 키 형식은 발견되지 않았다. 실제 .env/data, Git 과거 이력, 모든 유형의 토큰을 검사한 것은 아니다. .gitignore/.dockerignore의 데이터·환경 파일 제외 규칙을 확인했다.

## 검증 결과와 재현 파일

- 기존 백엔드 테스트 66개 통과. 재현 테스트 추가 후 `npm run check:backend`의 fmt/clippy/테스트 68개/build 통과.
- `backend/tests/security_audit.rs`의 2개 테스트는 현재 취약한 요청 수락을 입증한다. 성공은 보안 합격이 아니다. 인증·요청 검증 구현 시 거절을 기대하도록 전환해야 한다.
- `npm run check:frontend`: format/lint 통과, 전체 테스트 171개 중 170개 통과/1개 실패. `App.test.tsx`의 `retains form values after failure and creates on retry`에서 `WorkListView.tsx:27`의 listWorks 결과가 undefined여서 `.then` 오류가 발생했다. 프런트 코드는 이 점검에서 수정하지 않았다.
- 실패 파일만 재실행한 `npm run test:frontend -- src/App.test.tsx`: 17개 통과. 전체 검사에서 발생한 실패를 무시해 전체 합격으로 보고하지 않는다. 테스트 격리/타이밍에 관한 별도 조사가 필요하다.
- `npm --prefix frontend run build`: 성공. 500 kB 초과 청크 경고만 존재한다.

공개 전 우선순위: S1 인증 경계 → S2 요청 보호 → S3 자원 제한 → S4 운영 구성/S5 헤더 → 의존성 잔여 위험 처리와 실제 배포 환경 검증. 현재 로컬 기능 테스트 통과만으로 공개 가능 판정을 내려서는 안 된다.
