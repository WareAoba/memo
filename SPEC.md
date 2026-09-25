# 프로젝트 최종 청사진

버전: 2.1 · 수정일: 2026-09-24 · 상태: 구현 기준 명세

이 문서는 아키텍처와 데이터 동작의 권위 있는 기준이다. 변경 전 작업과 관련된 절을 읽는다.
코드와 충돌하면 이 명세가 우선하며, 요구 변경은 명세를 먼저 수정한다.
현재 구현 범위와 남은 단계는 [docs/STATUS.md](docs/STATUS.md)에서 관리한다. 아래 Phase별 설명은 계약의 도입 배경이며 현재 상태를 중복 관리하지 않는다.
Google 로그인·세션 인증·실제 서비스 연동 준비는 핵심 흐름 구현 이후, 서비스 공개 전에 진행한다.

## 1. 목표와 핵심 개념

셀프호스팅 가능한 모바일 우선 일정·반복 작업 실행 PWA를 만든다.
학습, 운동, 개인 프로젝트, 고객 관리, 현장 업무에 공통으로 사용할 수 있어야 한다. 특정 업무의 어휘와 필드를 기본 화면의 전제로 삼지 않는다.

핵심 흐름:
워크 등록 → 태스크 프리셋 등록 → 워크에 기본 태스크 연결 → 날짜·시간에 워크 배치 →
워크 안의 태스크 실행·체크 → 결과와 실행 이력 보존.

사용자가 확정한 의미: **워크는 현장·과목·고객 등 대상이다.**
워크 자체를 태스크 묶음이나 일정과 동일시하지 않는다. 같은 워크를 여러 날짜에 배치할 수 있고,
각 일정의 태스크 상태는 독립적이다. 대상 등록 없이 매번 현장 정보를 입력하게 하지 않는다.

| 사용자 용어 | 내부 모델 | 의미와 예시 |
| --- | --- | --- |
| 워크 | Entity | 반복해서 활동하는 대상. 영어, 체력 관리, 고객 A, 개인 프로젝트 |
| 태스크 프리셋 | TaskPreset | 워크에 붙여 사용할 재사용 실행 정의. 단어 복습, 스쿼트, 자료 검토 |
| 워크의 기본 태스크 | work_task_presets | 워크에 연결된 태스크 프리셋과 순서 |
| 일정 / 워크 일정 | Schedule | 특정 날짜·시간에 배치한 워크 한 회차 |
| 일정 안의 태스크 | ScheduleTask | 이번 회차에서 실행하고 완료를 체크하는 태스크 |
| 세부 항목 | ChecklistItem | 태스크 안의 체크·텍스트·숫자 기록 항목 |
| 사진 / 메모 | Photo / notes | 선택적 실행 사진과 참고 정보 |

프리셋 설정의 워크/태스크는 재사용 정의를 관리한다. 당일 요약·캘린더의 체크는
해당 일정의 실행 상태만 변경하며 프리셋을 변경하지 않는다.
기존 Entity API와 데이터는 유지하되 사용자에게 내부 이름 Entity를 노출하지 않는다.
별도의 PresetSet 화면은 MVP 주 구조에서 제거한다. Phase 4는 워크의 기본 태스크 연결로 조정한다.

일반 노트나 범용 데이터베이스 빌더가 아니다.
재사용 가능한 대상과 태스크를 일정으로 연결하고 실행 기록을 남기는 것이 핵심이다.

## 2. 확정된 인증·보안 방향

### 2.1 인증
아래 내용은 서비스 연동 시 적용할 목표 설계다. 현재 핵심 기능 개발의 선행 조건이 아니다.
- MVP는 Google OpenID Connect 로그인만 지원한다.
- 자체 이메일/비밀번호 가입, password_hash, 암호 재설정, Argon2 비밀번호 저장은 MVP에서 제외한다.
- 사용자 식별은 검증된 issuer + subject(sub)를 내부 UUID에 연결한다. 이메일로 계정을 자동 병합하지 않는다.
- Authorization Code 흐름을 서버에서 처리한다. state/nonce를 검증하고 지원되는 PKCE S256을 사용한다.
- 토큰 서명, issuer, audience, expiration, nonce와 redirect URI를 검증한다.
- 필요한 범위는 openid/email/profile로 제한한다. Calendar/Drive 권한이나 장기 Google API 토큰은 필요 없다.
- Google 인증 후 앱 자체 서버 세션을 발급한다. Google 로그인 성공만으로 요청 소유권 검사를 대체하지 않는다.
- 추측 불가능한 세션 토큰을 Secure/HttpOnly/SameSite=Lax 쿠키에 담는다.
- 서버에는 세션 토큰의 해시, 사용자, 만료 시각 등을 보관한다. 로그인 시 교체, 로그아웃 시 폐기한다.
- 변경 요청에는 CSRF 토큰 및 Origin 검증을 적용한다. 인증 흐름의 state도 별도 검증한다.
- 인증 시작/콜백의 요청 제한과 실패 로그를 제공한다. 비밀이나 토큰을 로그에 남기지 않는다.
- 배포 운영자가 Google OAuth client와 고정 callback URL을 설정한다.
- 기본 셀프호스팅은 운영자 지정 Google 계정 허용 목록을 사용한다. 공개 가입은 명시적으로 활성화할 때만 허용한다.
- 상세 인증 구현은 기존 Phase 1의 식별자를 유지하되 Phase 10 이후로 미룬다.
- OAuth client 발급, callback 등록, 세션 테이블·로그인 UI 구축은 인증 단계에서 진행한다.
- Phase 0 완료 시점에는 공개 health 엔드포인트만 구현되어 있다.

### 2.1.1 가상 계정으로 로그인한 개발 환경
- `AUTH_MODE=virtual`(기본값)은 서버가 가상 계정으로 로그인했다고 가정한다. `disabled`는 계정 API를 401로 차단하며 잘못된 설정값은 시작을 실패시킨다. Google 로그인·실제 세션 발급은 아직 제공하지 않는다.
- 기존 로컬 사용자 UUID를 유지하고 `auth_identities`에 `urn:preset:virtual` issuer와 `local` subject를 연결한다. 기존 데이터·설정·사진 경로는 같은 계정에 그대로 귀속된다. 별도 계정의 데이터는 합치지 않는다.
- `GET /api/auth/me`는 `{user:{id,display_name,email},mode:"virtual"}`를 반환한다. 프런트는 계정 확인 후 사용자별 설정·화면을 마운트하고 계정 프로필과 이름을 좌하단 계정 메뉴에 표시한다. 선택적 `picture` HTTPS URL이 있으면 사진을 표시하고, 없거나 로드에 실패하면 이름 첫 글자를 표시한다. 접힌 사이드바와 모바일 하단 메뉴는 아바타를 표시하고 펼친 계정 메뉴에서 이름·이메일과 설정 버튼을 제공한다. 실패 시 비공개 화면 대신 오류와 재시도를 제공한다. 후속 저장의 401은 편집 초안을 지우지 않고 오류로 표시한다.
- 도메인 데이터의 user_id와 소유자별 조회·수정 범위는 처음부터 유지한다.
- 임의 요청 헤더나 본문의 user_id를 신뢰하여 현재 사용자를 선택하지 않는다.
- 사용자 선택은 인증 미들웨어에 두고 요청별 비동기 컨텍스트에 저장한다. 서비스에는 고정 사용자 기본값이 없다. health는 공개이며 데이터·설정·사진·푸시 API는 동일한 인증 경계를 거친다.
- 인증 단계에서 가상 계정 조회를 검증된 서버 세션 조회로 교체한다. 백그라운드 작업은 요청 컨텍스트를 상속하지 않으며 DB 레코드의 명시적인 소유자를 사용한다.
- 로컬 데이터의 실제 계정 귀속 절차는 인증 도입 시 설계한다. 첫 로그인에 무조건 자동 귀속하지 않는다.
- 이 방식은 인증을 제공하지 않는다. 현재 loopback 개발 범위를 유지하고 외부 공개 전에 인증을 완성한다.
- 인증 전에도 모든 API는 허용 Host와 정확한 Origin(스킴·호스트·포트)을 검사한다. `APP_ORIGINS`는 쉼표로 구분한 명시적인 HTTP(S) origin 목록이며 미설정 시 loopback의 3000/15173/8080 포트와 내부 health용 127.0.0.1:80을 허용한다. 외부/동일 사이트의 다른 origin 요청은 403으로 거절한다. 브라우저 변경 요청은 Origin을 요구하고, 브라우저 메타데이터가 없는 로컬 CLI는 허용한다. 이는 세션 인증/CSRF 토큰을 대체하지 않는다.
- 앱 HTML은 CSP `frame-ancestors 'none'`과 `X-Frame-Options: DENY`로 외부 프레임 삽입을 차단한다. 개발 Vite와 Caddy 모두 적용한다.
- 로컬 사용자 선택과 최초 기기 시간대 저장은 Phase 2에 구현했다. 시간대는 앱 설정에서 변경한다.

### 2.2 사용자 정보 보호
- **MVP는 서버가 평문 업무 데이터를 처리할 수 있는 구조다.**
- 과거의 “서버도 내용을 알 수 없어야 한다” 요구는 이후 사용자 결정에 따라 MVP에서 철회되었다.
- 클라이언트 종단간 암호화, 기기 복호화 키, 사용자 복구 키, 별도 잠금 해제 암호를 구현하지 않는다.
- 사용자는 다른 기기에서도 Google 로그인만으로 자신의 데이터를 이용한다.
- HTTPS는 Caddy가 종료한다. 개발 환경의 localhost HTTP는 운영 배포가 아니다.
- 운영 DB, WAL/SHM, 첨부파일과 민감 임시파일은 운영체제/인프라가 제공하는 암호화 저장 볼륨 안에 둔다.
- 볼륨 키는 운영 환경에서 관리하고 데이터/백업과 분리한다. 앱 코드나 이미지에 포함하지 않는다.
- Docker named volume 자체는 암호화 기능이 아니다. 개발 Compose는 저장 암호화나 운영 TLS를 보장하지 않는다.
- 백업 자체도 암호화하고 접근을 제한한다. Google 인증은 DB 백업이나 복구를 대신하지 않는다.
- 디스크/백업 유출 보호와 실행 중인 서버 침해 보호를 혼동하지 않는다.
- 종단간 암호화는 향후 엔터프라이즈 요구가 있을 때 별도 위협 모델과 데이터 마이그레이션으로 검토한다.
- 최소 개인정보만 수집하고 로그·분석 도구로 업무 데이터가 유출되지 않게 한다.
- 모든 사용자 소유 레코드는 조회·수정·삭제·첨부 다운로드까지 소유권을 확인한다.

## 3. UX와 화면

모바일 우선, 최소 44px 터치 영역, 적은 탭 수, 화이트·다크·시스템 테마와 명시적인 상태 표시를 사용한다.
상위 탐색은 정확히 **당일 요약 / 전체 캘린더 / 프리셋 설정** 세 개다.
데스크톱은 상단, 모바일은 하단에 같은 탐색을 유지한다.
당일 요약 탐색 아이콘에는 기기의 오늘 월·일을 표시한다. 표면은 중성 회색과 테두리·그림자가 없는 부드러운 플랫 배경를 사용하며, 태스크 블록은 민트·블루·바이올렛·피치·옐로·로즈의 전체 배경색으로 구분한다. 완료 후에도 색을 유지하고 체크와 취소선으로 상태를 표현한다. 워크 제목과 시간은 블록 상단에 크게 배치한다.

모바일 주 메뉴는 목적지로 바로 이동하며 화면 내부 보기 선택과 중복되는 drawer를 열지 않는다. 페이지 이동은 main 스크롤을 초기화하고 모달 복귀는 기존 위치를 유지한다.

### 앱 설정
- 왼쪽 하단 계정 메뉴의 설정 버튼은 컨텐츠 영역을 설정 화면으로 전환한다. 우상단 닫기로 이전 화면과 입력 상태로 돌아간다.
- 설정 표시 중 기존 사이드 메뉴의 활성 표시를 해제한다. 직전 화면의 메뉴를 다시 눌러도 해당 화면으로 전환한다. 상세 설정은 큰 외곽 박스 없이 배치하며 드롭다운·버튼은 공통 디자인 레퍼런스를 따른다.
- 설정 상단 수평 탭 바와 우상단 닫기는 모바일과 스크롤 중에도 항상 보인다. 탭 선택은 해당 패널만 전환한다.
- 설정은 기본적으로 변경 즉시 저장·반영하고 최신 값을 불러오는 핫세이브·핫로드 방식이며 별도 저장 버튼을 두지 않는다. 사용자별 DB 값이 기준이며 접속·포커스 복귀·온라인 복귀와 보이는 동안 30초마다 다시 불러온다. 저장 중이거나 미저장 변경이 있으면 덮어쓰지 않는다.
- 일반: 한국어·영어·일본어, IANA 시간대. 화면: 화이트·다크·시스템, 컨텐츠 배율(80/90/100/110/125%), 최대 너비(900/1200px/전체), 강조색(보라/파랑/초록/장미/주황), 애니메이션(시스템/전체/줄이기/비활성화).
- 일정: 시계판 이동 단위 1/5/10/15/30/60분, 기본 5분. 알림: 계정 전체 푸시 활성화와 기기별 권한·구독. 데이터: 스케줄/워크 프리셋/태스크 프리셋을 각각 초기화.
- 초기화는 RESET 확인 후 해당 사용자 데이터만 transaction으로 영구 삭제한다. 프리셋 삭제는 일정의 원본 연결만 NULL로 만들고 독립 스냅샷·실행값을 유지한다. 스케줄 초기화는 첨부 사진과 푸시 전달 기록도 제거한다.
- 설정 API: GET/PATCH /api/settings, POST /api/settings/bootstrap, POST /api/settings/reset. 필드·기본값·실패와 동기화 계약은 [앱 설정](docs/SETTINGS.md)을 따른다.

### 당일 요약
기본 시작 화면. 사용자 시간대의 날짜와 완료 태스크/전체 태스크를 표시한다.
해당 날짜의 워크 일정을 시작 시간순으로 나열한다.
예: 영어 09:00–10:00, 체력 관리 18:30–19:30.

- 시계판 옆 목록의 제목은 `요약`, 하단 상세 목록은 `오늘의 스케줄`로 표시한다. 중복 안내와 스크롤바처럼 보이는 진행률 막대 대신 완료 수를 표시한다.
- 하단 워크 카드의 제목 또는 빈 영역을 누르면 해당 카드만 배경으로 강조한다. 제목은 키보드로도 선택할 수 있다. 선택된 카드 하단에 레이블을 포함한 태스크 추가 버튼과 수정 팝업 링크를 표시한다. 미선택 상태에서는 버튼을 숨기되 하단 자리를 유지하고, 추가 목록은 버튼 아래에 열린다.
- 메모나 태스크가 없는 카드에는 빈 상태 설명을 표시하지 않는다. 각 스케줄 카드에도 전체 태스크 완료 체크를 제공한다. 필수 항목 검증·transaction은 기존 완료 API를 사용하며, 실패하면 이전 체크를 유지한다. 취소 일정·편집 중에는 체크를 잠근다. 완료된 일정의 체크를 해제하면 완료·건너뜀 태스크를 pending으로 되돌리고 completed_at을 비우며 입력값·메모·최초 시작 시각은 보존한다.

### 편집 팝업
- 모바일 일정 작성은 워크 이름 → 접힌 시간 요약 → 태스크 순서다. 시계를 접어도 입력값은 유지한다. 주 저장·보관·복원은 텍스트로 의미를 표시하고 메모 자동 저장 상태와 구분한다. 모달 닫기는 모션 선호를 존중하는 짧은 퇴장 후 포커스를 복귀시킨다.

- 일정·일정 안의 태스크 삭제: 데스크톱은 각 행의 hover/focus 삭제 버튼, 모바일은 왼쪽 스와이프로 노출한 삭제 버튼을 사용한다. 스와이프만으로 삭제하지 않으며 확인·취소를 제공한다. 실패하면 행과 편집 내용을 유지한다. 편집 팝업에서도 삭제할 수 있다.
- 일정 체크는 네모, 태스크 체크는 작은 원으로 채워지는 원형이다. 부모 일정 hover가 내부 모든 태스크의 버튼을 드러내지 않으며 각 행의 hover/focus만 반응한다.
- POST /api/schedules/:id/reopen은 완료 표시를 취소한다. DELETE /api/schedules/:id는 204, DELETE /api/schedule-tasks/:id는 남은 일정 상세를 반환한다. 소유권 검사·실행 항목·사진 메타데이터·푸시 기록 정리는 단일 transaction이며 파일 정리 실패는 기존 photo_deletions를 통해 재시도한다. 태스크 삭제 후 순서를 압축하고 일정 상태를 재계산한다.
- 모든 시계판 편집 화면은 여러 날 체크가 꺼져 있으면 날짜 입력과 날짜 요약을 숨기고 선택한 날짜를 보존한다. 단, 일정 추가 창의 하단 저장 영역에는 추가될 날짜를 읽기 전용으로 표시한다. 체크한 경우에만 시작·종료 날짜를 입력할 수 있다.
- 일정·워크·태스크 주 저장 버튼은 팝업의 고정 하단 안전 영역 우측에 둔다. 구분색은 작은 색 점만 표시하고 접근성 이름·툴팁은 유지한다.
- 시계판 드래그는 내부 이동 누적값도 하루 범위로 제한한다. 자정에서 여러 바퀴 이동해도 역방향 조작에 즉시 반응하며, 여러 날 일정의 날짜는 명시적 날짜 입력으로만 변경한다.
- 일정 저장 후 당일 요약의 시계판은 변경 이벤트와 팝업 복귀 시 즉시 갱신한다. 자동 날짜 변경 중 열린 실행 초안은 보존한다.
- 다크 모드의 시간 종료·미완료 호는 흰색으로 표시한다. 일정 호는 기존 외곽 높이를 최소로 5단계 높이를 배정하고 연속 호의 높이가 같지 않게 한다. ID 기반 배정으로 재렌더 때 무작위로 흔들리지 않는다.
- 스케줄의 생성·편집 팝업에서 독립적인 구분색을 고른다. `color` 값은 none(기본)/red/orange/yellow/green/blue/indigo/violet이며 원색 계열의 고정 무지개 팔레트를 사용한다. 앱 강조색과 연동하지 않고 스케줄별 DB 값으로 저장한다. Today·캘린더의 스케줄 카드 상단 보더는 4px, 내부 태스크 구분선은 1px로 유지한다. 색 없음은 중성 구분선이며 선택 배경·완료 상태 색과 구분한다.
- 일정·워크 프리셋·태스크 프리셋의 상세/수정 진입점은 같은 편집 폼을 팝업으로 연다. 기존 상세 URL과 /edit URL도 호환하며, 직접 접속 시 해당 목록 또는 Today를 배경으로 연다.
- 목록에서 열 때 URL·필터·스크롤과 화면 상태를 유지한다. 닫으면 원래 화면으로 복귀하고 저장된 값을 다시 조회한다. 로드·저장 실패는 팝업 안에서 재시도하며 편집 초안을 유지한다.
- 개별 실행 태스크도 팝업에서 수정한다. 중첩 팝업의 Escape는 가장 안쪽 팝업만 닫는다.
- Today 카드 배경에는 공통 카드 반경을 적용한다. Today·캘린더의 태스크 행은 체크·한 줄 제목·편집/메모 동작만 표시하고 상태와 메모 본문을 별도 줄로 늘어놓지 않는다. 긴 제목은 말줄임 처리하며 편집 팝업에서 전체 내용을 확인한다.

### 전체 캘린더
- 모바일 월간은 날짜와 일정 수로 요약하며 날짜 선택은 일간으로 연결한다. 일간 태스크 이름은 해당 실행 편집을 바로 연다. 일정 상세는 실행 태스크를 앞에, 워크 참고 정보는 접힌 영역에 둔다.

일간/월간/연간 전환은 페이지 라벨과 같은 줄 우상단에 워크/태스크와 같은 밑줄형 토글로 제공한다. 일간 상단 중앙에는 날짜·요일, 월간에는 연·월, 연간에는 연도를 크게 표시하고 이전/다음 화살표는 양 끝에 둔다. 일·월·연간 본문은 동일한 배경 패널 안에 배치하며 제목과 탐색 화살표 크기를 통일한다. 일간 날짜 선택은 트리거에 붙는 드롭다운으로 제공하고, 6주 격자로 월마다 높이를 유지하며 오늘로 즉시 이동한다. 월간 날짜 칸 사이에는 여유 간격을 두고 일정 막대만 흰색 채움·어두운 글자·양방향 그림자로 떠오르게 표현한다. 일정은 날짜당 최대 4개의 가로 막대로 표시하며 가용 너비·높이에 따라 1–3개로 줄이고 나머지는 `+ 그 외 n개`로 표시한다. 여러 날 일정은 주 단위로 이어지며 주·월 경계에서 연결 형태로 잘린다. 월간 스케줄 구분색은 얇은 내부 테두리로 표시하며 막대의 좌우 여백을 동일하게 둔다. 초과 개수는 날짜 칸 안에서 가로 중앙 정렬한다.
연간 월 컨텐츠는 가용 높이를 채우며 최소 크기 이하에서는 스크롤한다. 연간은 달성률 색칠 대신 월간과 동일한 막대 배치와 둥근 사각 날짜 칸의 축소 실루엣을 사용한다. 월 식별 제목 외에 날짜·요일·일정 이름 등 세부 텍스트는 표시하지 않는다. 연간 스케줄 구분색과 강조색은 막대의 채움에 적용한다. 일·월·연간 이동은 실제 날짜 칸·월 카드 좌표에 맞춘 확대/축소 전환을 사용하고, 이전/다음 탐색과 날짜 드롭다운 월 탐색에는 좌우 페이지 전환을 적용한다. 모션 축소/끄기 설정을 따른다. 일간 상세 일정 카드는 배경을 표시하고 내부 텍스트는 좌정렬한다.
선택 날짜 아래의 상세 일정에는 당일 요약과 동일한 워크 블록을 사용한다.
좁은 월 셀 안에 모든 태스크를 펼치지 않는다. 주/일 타임라인과 drag-and-drop은 후속 범위다.

### 워크 블록 안의 태스크 블록
- 바깥 블록 상단에 워크 이름과 시작–종료 시간을 크게 표시한다.
- 그 아래에 이번 일정의 태스크들을 각각 작은 블록으로 배치한다.
- 각 태스크에 완료 체크와 이름을 표시한다. 완료 여부는 체크·문구·텍스트 스타일을 함께 사용한다.
- 헤더에 완료 태스크 수/전체 태스크 수를 표시하며 체크 시 즉시 갱신한다.
- 실제 실행 단계에서 완료 체크는 필수 세부 항목 검증 후 저장한다. 부족한 항목은 태스크 상세로 안내한다.
- 체크 해제는 완료 취소로 처리한다. 취소 시 completed_at을 비우며 관련 일정 완료 상태를 재평가한다.
- 세부 체크리스트 전체를 항상 펼치지 않고 태스크 상세에서 보여준다. 기본 화면의 중첩은 2단계다.
- 태스크 상태 pending/in_progress/completed/skipped를 유지하며 skipped는 완료 체크와 구별한다.
- 모든 태스크 체크가 워크 프리셋을 완료시키지는 않는다. 해당 일정의 진행 상태만 변경한다.

### 프리셋 설정
하위 탐색은 **워크 / 태스크** 두 개다. 대상 관리·세트·More를 별도 주 탭으로 늘리지 않는다.
- 워크: 이름·설명/메모·태그를 기본 입력으로 사용한다. 이름만 필수다.
- 참조 코드, 장소, 관련 사람/연락처, 이용 가능 시간, 방문 정보는 선택 항목으로 접어 둔다.
- 기존 현장 전용 데이터는 삭제하거나 의미가 다른 필드로 옮기지 않는다.
  출입 안내·주차/반입·계약 메모는 방문 관련 선택 정보에 보존한다.
- 목록은 이름·설명·태그 중심. 참조 코드/장소는 값이 있을 때만 표시한다.
- 검색은 이름·참조 코드·장소를 지원한다. 작업 흐름에서 워크를 불러오는 기준은 이름이다.
- 태스크: 이름·세부 항목·기본 메모·태그 관리. 설명·분류·예상 소요 시간은 입력 UI, API, DB 및 일정 스냅샷에서 제외한다.
  세부 항목 종류 checkbox/text/number, required/default_value/unit과 순서를 지원한다.
- Phase 4에서 워크에 기본 태스크를 추가·제거·재정렬한다.

### 직접 입력과 관리되지 않는 프리셋
- 일정 작성 및 실행 태스크 추가는 이름 직접 입력이 기본이다. 입력한 이름은 Enter 또는 사용 버튼으로 확정하고, 프리셋 제안은 명시적으로 선택할 때만 적용한다. 동명 정식 프리셋이 있어도 직접 입력은 숨겨진 프리셋만 재사용한다. 태스크 그룹 탐색은 별도 펼치기 동작으로 제공하며 선택 화면에서 프리셋 원본 메모를 수정하지 않는다. 직접 입력은 일정 저장 transaction에서 사용자별 숨겨진 프리셋으로 저장하며 일반 검색·목록·그룹에는 노출하지 않는다.
- 이름은 앞뒤 공백 제거 후 ASCII 대소문자를 무시하여 매칭한다. 숨겨진 동일 이름은 UUID 하나를 공유한다. 프리셋 생성 폼에서는 이름 접두어로 최대 10개를 제안한다.
- 정식 프리셋 생성 시 같은 이름의 숨겨진 UUID를 승격하고 연결된 모든 일정에 새 상세정보를 일괄 적용한다. 워크 상세 스냅샷, 태스크 기본 메모·세부 항목을 갱신하며 일정별 제목·실행 이름·매개변수·메모·완료 상태·사진은 보존한다. 이후 일반 프리셋 수정은 독립 스냅샷에 전파하지 않는다.
- 생성 요청은 entity_id 대신 entity_name을 지원하며 task_preset_ids의 항목 및 태스크 추가의 task_preset_id는 UUID 또는 {"name":"이름"}을 허용한다. 실패한 저장은 숨겨진 프리셋 생성까지 롤백한다.

### 일정 생성과 통합 편집
- 생성 폼의 일정 메모는 한 입력란에서 작성한다. 워크 이름 옆에 같은 메모의 별도 버튼을 두지 않는다. 태스크 없이 저장 가능 여부나 원본과의 저장 범위 설명은 상시 안내하지 않는다. 워크 변경·수정·상세 보기 동작은 목적이 드러나는 텍스트로 표시한다.
생성/PATCH 요청과 목록/상세 응답은 `color` 필드를 지원한다. 생략한 생성 요청과 기존 데이터의 기본값은 `none`이다. PATCH에서 생략하면 기존 색을 유지하고 `none`을 보내면 해제한다. 허용 목록 밖의 문자열, null, 숫자는 400으로 거절한다. 색 변경은 해당 스케줄만 변경하며 프리셋·스냅샷·다른 스케줄에 전파하지 않는다.
워크 선택 → 날짜·시작/종료 지정 → 기본 태스크 검토 및 추가/제거 → 저장.
같은 프리셋의 중복 선택은 첫 등장 순서로 한 번만 추가한다.
MVP는 같은 날짜 안에서 end_time > start_time을 요구한다.
생성 시 워크 정보와 태스크 정의를 독립 snapshot으로 복사한다.
상세와 수정은 동일한 편집 팝업이다. 일정 팝업에는 날짜·시계판·리마인드 편집과 워크 스냅샷, 세부 실행 기록, 메모, 선택적 사진 및 일정 상태를 함께 제공한다. 메모는 입력을 멈춘 뒤 600ms 후 자동 저장하며 별도 저장 버튼을 두지 않는다. blur·닫기·화면 이동은 대기 중 변경을 즉시 저장한다. 저장 요청을 직렬화하며 실패하면 초안을 유지하고 재시도를 제공한다.

데스크톱 스케줄 카드 내부의 메모·수정 바로가기는 카드 hover 또는 키보드 focus 시 표시한다. 메모 오버레이는 버튼 중심에 모서리를 겹쳐 그 모서리에서 대각선으로 확대한다. 기본 우상단이며 화면 여백에 따라 다른 모서리로 전환한다. 모션 줄이기 설정을 따른다. 모바일(700px 이하)에서는 이 바로가기와 오버레이를 렌더링하지 않으며, 워크·태스크 편집 팝업에서 메모를 확인·수정한다.
일정 상태 planned/in_progress/completed/cancelled를 유지한다.

### 현재 구현 범위
워크·태스크 프리셋·일정·실행 기록은 실제 SQLite에 저장한다.
당일 요약과 월 캘린더는 동일한 실제 일정과 실행 체크를 사용한다. 월 범위를 모든 페이지에 걸쳐 조회하며 여러 날 일정은 겹치는 날짜마다 표시한다.
월 이동·오늘 이동·날짜 선택·선택 날짜로 생성·편집 팝업 열기를 지원한다. 다른 창의 변경은 새로고침으로 반영한다.
사진은 일정·태스크 상세의 접힌 선택 영역에서만 추가하며 사진 없이 완료할 수 있다.

## 4. 데이터와 불변 조건

### 공통 규칙
- 도메인 레코드는 UUID, created_at, updated_at을 가진다. 시간은 UTC ISO 8601로 저장한다.
- 일정 날짜는 YYYY-MM-DD, 시각은 HH:mm. Schedule에 IANA time_zone을 함께 보관한다.
- 사용자 time_zone 기본값은 최초 확인한 기기 시간대이며 설정에서 수정 가능하게 한다.
- SQLite의 UUID는 TEXT. DB 이식성을 위해 SQLite 전용 JSON 쿼리 의존을 최소화한다.
- archive/soft delete는 워크·태스크 프리셋에 적용한다. 일정과 실행 태스크는 명시적인 삭제 확인 후 관련 실행값·사진을 함께 제거한다.
- 필수 FK, 인덱스, 범위·상태 CHECK와 서버 검증을 함께 적용한다.
- 변경은 SQLx migration으로만 관리한다. 이미 적용된 migration은 수정하지 않는다.
- Phase 0에는 인프라 메타데이터만 생성한다. 다음 논리 모델은 해당 단계에서 migration으로 구현한다.

### 논리 모델
| 테이블 | 주요 필드 |
| --- | --- |
| users | id, email, display_name, time_zone, created_at, updated_at |
| auth_identities | id, user_id, issuer, subject, created_at, updated_at; issuer+subject unique |
| sessions | id, user_id, token_hash, expires_at, created_at, updated_at |
| entities | id, user_id, name, reference_code, address, contact_name, contact_info, advance_contact_required, notice_required, default_work_start_time, default_work_end_time, access_instructions, parking_info, special_notes, general_notes, archived, timestamps |
| tags | id, user_id, name, timestamps |
| entity_tags | entity_id, tag_id; 복합 PK |
| task_presets | id, user_id, name, default_notes, archived, version, timestamps |
| task_preset_items | id, task_preset_id, position, label, item_type, required, default_value, unit, timestamps |
| task_preset_tags | task_preset_id, tag_id; 복합 PK |
| work_task_presets | entity_id, task_preset_id, user_id, position, timestamps; entity_id+task_preset_id 복합 PK |
| schedules | id, user_id, entity_id, title, scheduled_date, end_date, start_time, end_time, time_zone, status, notes, timestamps |
| schedule_entity_snapshot | id, schedule_id unique, entity_name, reference_code, address, contact_name, contact_info, advance_contact_required, notice_required, default_work_start_time, default_work_end_time, access_instructions, parking_info, special_notes, general_notes, timestamps |
| schedule_tasks | id, schedule_id, source_task_preset_id, source_task_preset_version, name_snapshot, default_notes_snapshot, position, status, started_at, completed_at, execution_notes, timestamps |
| schedule_task_items | id, schedule_task_id, source_preset_item_id, position, label_snapshot, item_type_snapshot, required_snapshot, unit_snapshot, default_value_snapshot, value_boolean, value_text, value_number, completed, completed_at, timestamps |
| photos | id, user_id, schedule_id nullable, schedule_task_id nullable, filename, mime_type, size_bytes, state, timestamps |

timestamps는 created_at + updated_at을 의미한다. 단순 연결 테이블의 복합 PK는 UUID 규칙의 예외다.
첨부는 정확히 하나의 대상(schedule 또는 task)에 귀속하고 해당 대상 소유권을 검증한다.
schedule_requirements(name/status/notes)는 고정 요건 필드를 대체하는 미래 확장으로 남긴다.
Note는 별도 독립 테이블이 필요해질 때까지 execution_notes/notes로 표현한다.
필수 인덱스: schedules(user_id, scheduled_date, start_time), 소유자별 목록,
각 FK, task/item position, 인증 identity와 세션 해시/만료 조회.

### 스냅샷
TaskPreset과 ScheduleTask는 반드시 분리한다.
일정 생성 시 Entity의 관련 정보를 독립 snapshot에 복사한다.
프리셋을 붙일 때 이름·기본 메모·version과 모든 체크리스트 정의·기본값을 복사한다.
source ID는 추적용이며 과거 렌더링의 값 공급원이 아니다.
프리셋/대상 편집·archive는 기존 실행 기록에 영향을 주지 않는다.
스냅샷 정의는 생성 이후 일반 실행 PATCH로 바꾸지 않는다. 체크 값·측정값·실행 메모·상태는 수정 가능하다.
실행 기록은 미래 템플릿 변경으로부터 불변이며, 사용자가 삭제를 확인하면 해당 일정 또는 실행 태스크와 그 첨부 기록을 영구 삭제할 수 있다. 원본 프리셋과 다른 일정의 스냅샷은 보존한다.

## 5. 서버와 API

Rust + Axum + SQLx + SQLite의 modular monolith.
REST/JSON, UUID, 외부 입력 검증, 일관된 오류, 구조화 로그.
향후 PostgreSQL 이동이 가능하도록 DB 접근을 모듈로 구분하되 범용 repository 추상화를 미리 만들지 않는다.

### 엔드포인트 계획
- Phase 0: GET /api/health → {"status":"ok"} (DB 접근 실패 시 503)
- Auth: GET /api/auth/google/start, GET /api/auth/google/callback, POST /api/auth/logout, GET /api/auth/me
- Entity: GET/POST /api/entities, GET/PATCH/DELETE /api/entities/:id
- TaskPreset: GET/POST /api/task-presets, GET/PATCH/DELETE /api/task-presets/:id
- 워크 기본 태스크: GET/PUT /api/entities/:id/task-presets
- Schedule: GET/POST /api/schedules, GET/PATCH/DELETE /api/schedules/:id
- Task: PATCH /api/schedule-tasks/:id, POST /api/schedule-tasks/:id/start, POST /api/schedule-tasks/:id/complete
- Checklist: PATCH /api/schedule-task-items/:id
- Photo: GET/POST /api/photos?target_type=schedule|task&target_id=UUID, GET/DELETE /api/photos/:id

DELETE는 위 보존 규칙을 따른다. UUID 형식 오류는 400, 타 사용자 자원은 존재를 노출하지 않는 404.
일정 조회: ?date=2026-10-03 또는 ?from=2026-10-01&to=2026-10-31, 선택적 entity_id.
목록에는 페이지/개수 제한을 적용한다. 실제 단계를 구현할 때 API 계약과 타입을 동기화한다.

### Phase 2 Entity API 계약

- `GET /api/entities?q=&archived=false&limit=20&offset=0` → `{items,total,limit,offset}`.
  q는 이름·참조 코드·장소(기존 reference_code/address)의 부분 문자열 검색, 최대 200자. `%`, `_`, `!`는 일반 문자로 검색한다.
  archived는 true/false로 범위를 구분한다. limit 1–100, 기본 20; offset 0–1,000,000.
  목록은 name/id 순서. 현재는 SQLite LIKE의 기본 대소문자 동작을 사용하며 locale 검색은 후속 범위다.
- POST는 name 필수, 나머지는 기본값을 적용하고 201과 Entity를 반환한다.
  GET/PATCH 개별 조회·수정은 200과 Entity, DELETE는 보관 후 204를 반환한다.
  `PATCH {"archived":false}`로 복원한다. PATCH 생략 필드는 유지한다.
- Entity 응답은 명세의 워크 필드, id, created_at, updated_at, tags 문자열 배열이다.
  user_id는 서버가 결정하고 API 요청에서는 허용하지 않는다. 알 수 없는 필드도 400이다.
- 문자열은 앞뒤 공백 제거. 이름 1–200자, 관리번호 100자, 주소·연락처 500자,
  담당자명 200자, 각 안내·메모 5,000자. 선택 문자열은 빈 문자열로 지운다.
- 작업 허용 시간은 둘 다 null 또는 유효한 HH:mm 쌍이며 end > start.
  시간 삭제는 두 필드를 함께 null로 보낸다.
- 태그 최대 20개, 각각 1–50자. 앞뒤 공백과 중복을 제거하고 정렬한다.
  동일 소유자의 이름이 같은 태그를 재사용한다. 빈 배열은 연결을 모두 제거한다.
  entity_tags에 소유자 FK를 함께 두어 다른 사용자의 태그 연결을 DB에서도 차단한다.
- UUID/입력/JSON/query 오류는 400 INVALID_INPUT. 없는 자원과 타 사용자 자원은 404 ENTITY_NOT_FOUND.
  DB 오류는 503 DATABASE_UNAVAILABLE이며 SQL·업무 데이터는 응답이나 로그에 담지 않는다.
- 워크·태그 쓰기는 한 transaction. PATCH는 BEGIN IMMEDIATE로 읽기·수정을 직렬화한다.
  조회는 transaction 내에서 워크 필드·태그·개수를 일관되게 읽는다.
- `POST /api/local-user {"time_zone":"Asia/Tokyo"}`는 유효한 IANA 시간대를 최초 한 번 저장한다.
  이미 저장된 시간대는 유지하며 `{time_zone}`을 반환한다. 사용자 선택/인증 API가 아니다.
- UI는 `#/today`, `#/calendar`, `#/presets/works`, `#/presets/tasks`를 사용한다.
  워크 생성·상세·편집은 `#/presets/works/new`, `#/presets/works/:id`, `#/presets/works/:id/edit`다.
  기존 `#/entities` 하위 경로도 호환한다. API 경로와 기존 DB 컬럼은 변경하지 않는다.
  목록 기본 20건, 보관함, 검색, 저장 실패 시 입력 유지, 재시도와 오프라인 안내를 제공한다.

### Phase 3 TaskPreset API 계약

- `GET /api/task-presets?q=&archived=false&limit=20&offset=0` → `{items,total,limit,offset}`.
  목록 항목은 상세 응답의 items 대신 item_count를 제공한다. 세부 정의는 상세 GET에서 조회한다.
  이름 또는 태그 부분 검색. 검색 문자 이스케이프와 pagination 제한은 Entity와 동일하다. name/id 순서.
- POST는 name 필수, default_notes 빈 문자열, tags/items 빈 배열, archived false 기본값.
  201과 프리셋을 반환한다. GET/PATCH는 200, DELETE는 보관 처리 후 204. PATCH archived=false로 복원.
- 응답: id, name, default_notes, tags, items, archived, version, created_at, updated_at.
  이름 1–200자, 기본 메모 5,000자, 태그는 Entity와 같은 제한. 설명·분류·예상 소요 시간 필드는 제외한다.
- items는 최대 100개. 각 항목: id, position, label, item_type, required, default_value, unit.
  position은 배열 순서와 일치하는 0부터 연속 정수. label 1–200자, unit 50자 이내이며 number만 허용.
  checkbox 기본값은 boolean/null, text는 최대 5,000자 문자열/null, number는 유한 JSON 숫자/null.
  required 기본값 false, default_value null, unit 빈 문자열. 필수 항목도 기본값은 생략할 수 있다.
- PATCH 생략 필드는 유지한다. items를 보내면 전체 정의를 교체한다. 빈 배열은 모두 제거한다.
  기존 항목 id는 해당 프리셋 소속 ID만 허용하며 중복 불가. 새 항목은 id 생략/null로 보내 서버 UUID를 받는다.
  순서 변경 시 기존 항목 ID/생성 시각은 유지한다. 항목 정의 저장은 실행 체크를 수행하지 않는다.
- version은 1에서 시작하고 정규화 후 실제 변경이 있는 PATCH 및 보관/복원마다 1 증가한다.
  동일 PATCH와 반복 DELETE는 version을 증가시키지 않는다. 낙관적 동시 편집 충돌 검출은 후속 범위다.
- 프리셋·항목·태그 저장은 단일 transaction, PATCH는 BEGIN IMMEDIATE로 직렬화한다.
  타 사용자 자원은 404 TASK_PRESET_NOT_FOUND, 입력/UUID 오류 400 INVALID_INPUT, DB 실패 503 DATABASE_UNAVAILABLE.
  알 수 없는 필드와 클라이언트 지정 version/user_id는 거부한다. 교차 소유자 태그 연결은 복합 FK로 차단한다.
- 화면 경로: `#/presets/tasks`, `/new`, `/:id`, `/:id/edit`. 실제 SQLite 저장을 사용한다.
  워크·태스크 편집의 태그는 한 줄에 하나씩 입력하며 쉼표를 태그 내용으로 보존한다.
  워크 연결은 Phase 4, 실행 스냅샷은 Phase 5에서 구현한다.

### Phase 4 워크 기본 태스크 API 계약

- `GET /api/entities/:id/task-presets`와 `PUT /api/entities/:id/task-presets`는 `{items:[{id,name,archived,position}]}`을 반환한다.
- PUT 본문은 `{task_preset_ids:[UUID,...]}`이며 전체 연결 목록을 교체한다. 최대 100개, 빈 배열은 모두 제거한다. 중복 UUID와 알 수 없는 필드는 400이다.
- position은 전달 순서대로 0부터 연속한다. 이름과 보관 상태는 현재 프리셋 값이다. 실행 스냅샷이 아니다.
- 없는/타 사용자 워크는 404 ENTITY_NOT_FOUND, 없는/타 사용자 태스크는 404 TASK_PRESET_NOT_FOUND다.
- 보관된 태스크는 기존 연결의 유지·재정렬·제거만 허용한다. 신규 연결은 400이다. 보관된 워크의 연결도 편집할 수 있다.
- BEGIN IMMEDIATE 단일 transaction으로 검증·교체·응답 조회를 수행한다. 실패하면 기존 목록을 보존한다. 동시 전체 저장은 마지막 성공한 요청을 따른다.
- work_task_presets는 (entity_id,task_preset_id) PK, (entity_id,position) UNIQUE와 소유자 복합 FK를 갖는다.
- 워크 상세에서 활성 태스크 검색·페이지 이동·추가·제거·순서 변경·명시적 저장·변경 취소를 제공한다. 저장 실패 시 편집 내용을 유지한다.
- Phase 5 일정 생성의 초기 선택은 이 목록에서 archived=false인 태스크만 순서대로 사용한다. 실제 일정 생성은 Phase 5에서 구현했다.

### Phase 5 일정 API 계약
- GET/POST /api/schedules, GET/PATCH /api/schedules/:id. 목록은 date 또는 from/to, entity_id, q, limit(1–100, 기본 20), offset을 지원한다.
- 생성: entity_id, scheduled_date(실제 YYYY-MM-DD), end_date(생략 시 시작 날짜), start_time/end_time(HH:mm, 종료 날짜·시간 > 시작 날짜·시간), IANA time_zone, task_preset_ids(최대 100), 선택 title/notes(200/5000자).
- 활성 워크와 활성 태스크만 생성에 사용한다. 태스크 중복은 첫 선택 순서로 제거한다. 태스크 없는 일정도 허용한다.
- PATCH는 날짜·시간·시간대·제목·메모만 변경한다. 워크와 태스크 정의는 생성 시 확정하며 변경하려면 새 일정을 만든다. 일정 보관·복원 기능은 제공하지 않으며 삭제 확인 후 영구 삭제를 제공한다.
- 일정·워크 스냅샷·태스크·세부 항목은 BEGIN IMMEDIATE 한 transaction으로 저장한다. 소유자 복합 FK를 적용한다.
- 워크 스냅샷과 항목 정의는 각각 별도 행의 JSON으로 저장한다. 실행 값·상태는 별도 컬럼이며 원본 정의를 참조하여 렌더링하지 않는다. source 항목 ID는 프리셋 편집 시 삭제될 수 있어 추적 값으로만 보관한다.
- 일정 미존재/타 소유자는 404 SCHEDULE_NOT_FOUND. 잘못된 입력은 400, DB 실패는 503.
- 일정 관리 경로는 #/schedules 아래이며 기존 주 탐색은 유지한다. Today는 Phase 6에서 실데이터를 연결했다. 실행 체크는 Phase 7에서 구현했다. 월 캘린더 실데이터는 Phase 8에서 구현했다.

### Phase 5 UI 조정
- 기본 시간 입력은 자정 00시(위) → 06시(오른쪽) → 정오 12시(아래) → 18시(왼쪽)의 24시간 원판. 클릭/터치로 시작·끝 선택, 손잡이 드래그 및 키보드로 사용자 설정 단위(기본 5분) 조정.
- 보라·피치·주황 파스텔 배경은 하루 흐름을 표현한다. 실제 지역의 일출·일몰 계산을 뜻하지 않는다.
- 원판 심볼은 자정·정오만 표시한다. 일출·일몰 심볼과 하단 범례는 제거한다.
- 선택 호는 얇은 그라데이션 링을 흰색으로 덮으며 양 끝 원과 하나의 외곽을 이룬다. 눈금과 간격을 유지하고 은은한 외부 그림자로 높이를 표현한다.
- 손잡이 교차 시 고정 손잡이의 시간은 유지하고 시작·종료 역할을 바꾼다. 같은 시각에서는 기존 범위를 유지해 0분 일정을 만들지 않는다.
- 종료 00:00은 생성·명시적인 시간 수정 API와 편집 UI에서 허용하지 않는다. 시작 00:00은 허용한다. 기존 종료 00:00 기록은 메모 등 부분 수정이 가능하며 편집 폼은 종료를 설정 이동 단위의 첫 시각으로 보정한 초안을 표시하고, 저장 전에는 DB를 바꾸지 않는다.
- 드래그는 자정 경계를 넘어 순환하지 않는다. 00:00 / 23:55에서 멈추며 반대 손잡이는 이동하지 않는다. 포인터가 경계 안으로 돌아오면 조정을 재개한다.
- '여러 날에 걸친 일정'에도 시계판을 표시하며 시작/종료 날짜·시간을 분 단위로 직접 입력할 수 있다. 날짜가 다르면 시계판 양쪽 손잡이를 독립적으로 조정하고 날짜는 유지한다. 중앙 시간은 날짜 차이를 포함한 전체 길이다.
- end_date를 실제 저장하며 날짜 조회는 해당 날짜와 겹치는 일정도 포함한다. 기존 일정의 end_date는 scheduled_date로 이관한다. 기존 스냅샷·ID·실행값은 유지한다.
- 새 일정과 시간 변경은 HH:mm 분 정밀도로 검증한다. 시계판 이동 단위는 조작 설정이며 기존 시간을 강제 반올림하지 않는다.
- 시간대 입력 UI는 제거하고 앱에 저장된 사용자 시간대를 사용한다. 기존 일정 수정은 기존 시간대를 유지한다. 설정의 시간대 변경은 오늘·캘린더와 새 일정에 반영한다.
- 표시 언어는 한국어·영어·일본어를 지원하며 설정의 일반 탭에서 선택한다. DB 저장값이 기준이며 최초 설정 시 브라우저에 저장된 선택, 지원하는 브라우저 언어, 한국어 순서로 초기화한다. 언어 변경은 사용자 입력·저장 데이터·일정 시간대를 바꾸지 않는다. UI 문구·접근성 레이블·오류·날짜 표시와 기기 알림은 선택 언어를 따른다. 구현 안내는 [다국어 지원](docs/I18N.md)을 참고한다.
- 앱 전반은 따뜻한 중성 배경, 테두리 없는 단색 표면, 둥근 모서리, 충분한 여백을 공유한다. 키보드 포커스 표시와 태스크 색 구분은 유지한다.

### 원자적 일정 생성
요청: entity_id, scheduled_date, start_time, end_time, time_zone, task_preset_ids[]. 워크 기본 태스크를 초기 선택으로 제공하고 사용자가 검토한 최종 목록을 전송한다.
1. 입력과 대상 소유권 검증.
2. 선택한 태스크 프리셋의 소유권과 활성 여부 검증.
3. 선택 순서를 보존하고 중복 제거.
4. 일정, Entity snapshot, ScheduleTasks, ScheduleTaskItems 생성.
5. 모두 하나의 DB transaction에서 commit. 하나라도 실패하면 전체 rollback.
서버가 현재 프리셋을 읽고 스냅샷을 생성한다. 클라이언트가 보낸 이름/내용을 신뢰하지 않는다.
작업 완료는 필수 checkbox 체크와 필수 text/number 값 검증 후 허용한다.
일정 완료는 모든 작업이 completed 또는 skipped일 때 허용한다.
체크 항목 하나의 변경이 전체 일정과 전체 이력의 재저장을 요구하지 않게 한다.

### 오류·로그
오류 형식: {"error":{"code":"ENTITY_NOT_FOUND","message":"Entity not found"}}.
panic, SQL, 내부 경로, stack trace를 사용자에게 보내지 않는다.
startup, migration, auth failure, API error, file upload failure, unexpected error는 구조화 로그로 남긴다.
비밀번호, 세션 토큰, OAuth code/token, 키, 업무 본문은 로그에 기록하지 않는다.

## 6. 프런트엔드와 성능

React + TypeScript + Vite. React Router, TanStack Query, Zod, React Hook Form은 필요한 단계에 도입한다.
Phase 0은 health API와 상태 화면만 구현하여 의존성을 최소화한다.
서버와 UI는 독립적인 REST 계약을 사용한다. 미래 네이티브 앱에 웹 전용 데이터 표현을 강제하지 않는다.
로컬은 Vite /api proxy, Docker는 Caddy /api reverse proxy로 같은 origin을 유지한다.
불필요한 전체 목록 refetch/과도한 polling을 피하고 날짜 조회, 인덱스, pagination을 사용한다.
사진은 필요 시 로드하며 업로드 전 클라이언트 크기 조절을 검토한다.
성능은 중저가 스마트폰과 현실적 데이터 크기로 측정한다. 측정 없는 지연 보장을 하지 않는다.
UI는 로딩/실패/재시도/오프라인 상태를 명시하고 서버 오류를 유용한 문장으로 표시한다.

## 7. 선택적 사진 첨부

사진은 일정 또는 태스크 상세에서 원할 때만 추가한다. 필수 첨부나 일반 파일/PDF 첨부는 제공하지 않는다. 사진 없이 모든 실행·완료 기능을 사용할 수 있다.
메타데이터는 SQLite, 실제 파일은 로컬 filesystem.
경로: PHOTO_DIR/user_uuid/generated_uuid.extension (기본 data/photos).
원본 파일명은 별도 저장, 저장명은 무작위 UUID, 경로는 서버에서 생성한다.
소유권, 크기 제한, allowlist MIME과 실제 디코딩 형식 일치 및 디코딩 성공을 검증한다. 해상도와 복구 정책은 문서 말미의 리뷰 보완 계약을 따른다.
path traversal 차단, 실행 파일/HTML/SVG 등 활성 콘텐츠는 MVP 업로드 대상으로 허용하지 않는다.
허용 형식은 JPEG/PNG/WebP, 사진당 10MiB이며 Phase 9에서 검증했다.
조회도 서버 소유권 검증을 경유한다. POST는 filename 쿼리와 image MIME의 binary body를 사용한다. 대상당 최대 100장, 사진은 선택 사항이다. 취소 일정의 추가/삭제는 제한하고 조회는 허용한다.
업로드는 본문 수신 전 서버당 4건까지 입장시키고 초과 요청은 대기 없이 429로 거절한다. MIME·파일명·대상 권한을 먼저 검사하고 본문 수신은 30초(초과 408), 10MiB(초과 413)로 제한한다. 취소된 요청의 디코더가 끝날 때까지 입장 슬롯을 유지한다. 사용자당 사진 저장 한도는 1GiB이며 pending/삭제 대기 파일도 포함해 transaction 안에서 예약한다(초과 507). 초기화 후 정리 대기 기록은 크기 정보가 없으므로 파일당 10MiB로 보수적으로 계산하며 파일 정리 후 해제한다. 기존 파일을 자동 삭제하지 않는다.
저장 전 pending 메타데이터를 기록하고 파일 저장 후 ready로 전환한다. 삭제는 deleted 표시 후 파일을 지운다. 실패/중단 시 남은 pending/deleted 파일은 서버 시작 때 정리한다. UUID와 MIME으로 경로를 생성하며 원본 이름은 경로에 사용하지 않는다.
향후 S3-compatible storage는 별도 단계다.

## 8. PWA와 오프라인

### 일정 리마인드 (2026-09-25)
- 일정 생성·수정에서 리마인드 체크박스와 양의 정수, 분/시간/일/주 단위를 제공한다. 신규 일정은 꺼짐, 설정 기본값은 15분이다. 최대 간격은 365일이며 일/주는 각각 24시간/168시간이다.
- 설정은 일정에 저장한다. 일정의 IANA 시간대로 시작 시각을 UTC로 변환해 알림 시각을 계산한다. DST 중복 시각은 빠른 시각을 사용하며 존재하지 않는 시각은 리마인드 설정 시 거부한다.
- 앱이 열려 있을 때 15초 간격 및 포커스·온라인 복귀·일정 변경 시 확인한다. 알림 시각 이상, 시작 시각 미만인 활성 일정만 조회한다. 완료·취소 일정은 제외한다. 시작 전 앱을 다시 열면 아직 보지 않은 알림을 표시한다.
- 우하단 공통 Toast를 쌓고 일정 열기·닫기를 제공한다. 시간제 자동 닫힘은 없으며 시작·완료·취소 시 표시를 정리한다. 같은 브라우저에서는 일정 ID·알림 시각으로 중복을 억제하며 시작이 지난 기록은 정리한다. 저장소 사용 불가 시 현재 탭 메모리로 대체한다.
- Web Push 구독 기기는 서버 예약 발송을 사용한다. 앱을 보고 있는 기기는 토스트로 표시하고 수신 기록을 서버에 전달한다. 실제 공통 Toast와 표시 데모를 design-reference.html에 등록한다.

### 서버 예약 Web Push (2026-09-25)
- 서버는 리마인드 설정의 기준이다. 기기별 구독과 일정 리마인드 버전별 전달 기록을 SQLite에 저장한다. 5초 간격으로 도래한 작업을 생성하고 lease로 중복 실행을 방지한다. 재시작 시 만료 lease를 회수한다.
- 발송 직전 소유자·현재 버전·활성 상태·시작 전 여부를 재확인한다. 변경·해제·완료·취소된 예약은 발송하지 않는다. 이미 전송 중이거나 OS가 표시한 알림은 원격으로 회수할 수 없다.
- 전송은 RFC8291 aes128gcm 및 VAPID를 사용한다. 개인키는 DB와 별도의 영속 파일에 생성/저장하고 API·로그로 노출하지 않는다. 브라우저 endpoint는 알려진 푸시 제공자의 HTTPS 주소만 허용하고 redirect를 따르지 않는다.
- 전달 기록은 pending/sending/sent/failed/cancelled로 관리한다. 일시 실패는 최대 5회, 시작 시각 전까지 지수 backoff로 재시도한다. 404/410은 만료 구독을 비활성화한다. TTL은 시작 시각까지(최대 24시간)이며 provider 수락은 사용자 표시 보장을 의미하지 않는다.
- 브라우저는 명시적인 알림 설정 버튼으로 권한 요청·구독·해제를 제공한다. 서비스 워커는 시스템 알림과 같은 origin의 일정 이동만 처리하며 API 캐싱은 하지 않는다.
- 화면이 보이는 동안 기기 heartbeat로 45초간 푸시를 보류하고 토스트 표시를 같은 전달 기록에 반영한다. 전환 경합·네트워크 불확실성에서 완전한 exactly-once 전달은 보장하지 않는다. 서비스 워커의 알림 ID 저장과 notification tag로 재시도 중복을 줄인다.
- 서버 예약/전달 기록과 Web Push 전송 모듈을 구분해 향후 APNs/FCM 전송을 추가할 수 있게 한다. 네이티브 토큰 등록과 로컬 OS 예약은 해당 앱 구현 단계다.

Phase 10: manifest, standalone, icons, service worker, cached app shell, offline indicator.
앱 shell이 오프라인에서 열려야 한다. 최근 조회 데이터 캐시는 선택적이며 사용자별 격리/로그아웃 정리가 필요하다.
인증 응답이나 민감 API 전체를 무차별 service worker cache에 넣지 않는다.
오프라인 쓰기/백그라운드 sync는 구현하지 않는다.
미래 IndexedDB sync layer는 mutation(local_id, entity_type, entity_id, operation, payload, created_at, sync_status)
queue와 명시적 conflict handling을 먼저 설계한 뒤 구현한다.

## 9. 배포와 백업

Docker Compose: backend + frontend development server + Caddy + persistent volume.
Phase 0은 localhost 전용 HTTP 개발 환경. 운영 개발 서버 노출 금지.
Phase 11에서 frontend static build와 Caddy 자동 HTTPS, 비루트 프로세스, secure headers,
비밀 주입, 암호화 볼륨 연결, logging/validation/authorization audit를 완성한다.
영속 경로: /data/database, /data/attachments.
운영 노출 포트는 reverse proxy만 사용하고 DB는 네트워크 서비스로 공개하지 않는다.
SQLite는 foreign_keys, WAL, busy timeout을 사용한다. 동시 writer의 한계를 인정하고 단일 backend로 시작한다.
백업은 DB와 첨부를 일관된 한 묶음으로 포함한다.
가장 단순한 절차는 쓰기 중지/서버 정지 후 전체 데이터 디렉터리를 백업하고 재시작하는 것이다.
실행 중인 DB 파일만 복사하지 않는다. 무중단 백업은 SQLite backup API와 첨부 일관성 절차가 필요하다.
암호화한 백업을 별도 저장하고 복원 후 DB integrity와 첨부를 검사한다.
사용자 데이터 JSON/CSV export와 자동 백업 스케줄러는 후속 기능이다.

## 10. 테스트

해당 단계마다 formatter, linter, compile/build, 관련 테스트와 가능한 수동 검증을 통과한다.
깨진 빌드에서 다음 단계로 진행하지 않는다.
- Phase 0: 실제 SQLite migration, 재실행 안전성, health 200/503, 일관된 404/405, API 클라이언트 오류, 화면 상태, Docker와 proxy.
- 이후: Entity/TaskPreset CRUD, 워크 기본 태스크 연결, schedule creation/rollback, ownership, invalid UUID.
- 핵심 회귀: 프리셋 A로 일정 생성 → A 변경 → 기존 작업/항목 유지 확인 → 새 일정은 변경된 A 사용.
- frontend 핵심 흐름: 워크/태스크 프리셋/기본 태스크 연결/일정 생성, 체크리스트·작업·일정 완료.
- 업로드 경로·MIME·크기·소유권, auth CSRF/session/Google 검증은 각 단계에 추가.
구현을 그대로 반복하는 불필요한 테스트보다 계약과 중요한 실패 경로를 검증한다.

## 11. 구현 단계와 승인 경계

단계 번호는 기존 문서와의 추적을 위해 유지한다. 실행 순서는 **0 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 1 → 11**이다.
핵심 기능은 단계별로 검증하며 진행하고 인증·실제 서비스 연결 준비 때문에 개발을 멈추지 않는다.
Phase 2·3·4·5·6·7·8·9 구현·검증을 완료했다. 후속 단계는 별도 작업 범위로 진행한다.

| 단계 | 산출물 |
| --- | --- |
| 0 (완료) | README/SPEC/plan, Rust·React skeleton, SQLite migration, health+상태 화면, Docker 개발, formatting/lint, 검증 |
| 2 (완료) | 로컬 단일 사용자 기반, Entity CRUD/search, 모바일 목록/상세/편집, 보관/복원 |
| 3 (완료) | TaskPreset CRUD, 항목 편집/순서/태그/version |
| 4 (완료) | 워크 기본 태스크 연결, 추가/제거/순서 |
| 5 (완료) | 워크 일정 CRUD, 태스크 선택 UI, snapshot/transaction |
| 6 (완료) | Today, 진행률, 요건, 일정 상세 |
| 7 (완료) | 상태/체크리스트/text/number/notes/완료 |
| 8 (완료) | 월 calendar, agenda, 날짜에서 생성/수정 |
| 9 (완료) | 선택적 사진 업로드/list/view/delete |
| 10 | PWA 설치, shell cache, offline indicator |
| 1 (후순위) | Google OIDC, 서버 세션/logout/me, CSRF, 인증 제한, protected frontend, 로컬 사용자 전환 |
| 11 | 운영 Docker/HTTPS/암호화 저장소, backup, 검증·인증·권한 audit, rate limits, headers, logging |

각 단계 시작 시 SPEC 검토 및 변경 파일 범위 설명 → 구현 → format/lint/build/test →
실패 수정 → 가능한 수동 확인 → 결과 요약.
Phase 0 종료 보고에는 아키텍처, tree, 로컬/Docker 명령, 검증 결과, 알려진 제한, 다음 단계를 포함한다.
작동하지 않는 placeholder를 완료 기능으로 보고하지 않는다.

### Phase 2 완료 범위: Entity 관리
- 이름·관리번호·주소·연락처·작업 허용 시간·출입/주차 안내·메모·방문 요건·태그 등록과 수정.
- 이름·관리번호·주소 검색, 모바일 목록·상세·편집, 빈 화면·로딩·실패·재시도 처리.
- DELETE는 보관 처리하며 복원을 지원한다. 영구 삭제는 제공하지 않는다.
- UUID, 입력 검증, 소유자 범위, 태그를 포함한 다단계 쓰기 transaction, migration과 관련 테스트.
- 구현 전 명세 검토, 구현 후 formatter/linter/build/test 및 가능한 브라우저 검증.
- 위 내용은 Phase 2 완료 범위다. Phase 2 검증 결과는 docs/VERIFICATION_PHASE2.md에 보존한다. 태스크 프리셋은 Phase 3에서 완료했으며 일정·실행은 후속 단계다.

### Phase 6 완료 범위
- 사용자 저장 시간대의 오늘 날짜로 활성 일정 조회. 여러 날 일정은 기존 date 겹침 계약을 따른다. 날짜 변경 시 이전 요청을 취소한다.
- GET /api/schedules에 include_details=true 옵션 추가. 기본 false이며 기존 목록 계약을 유지한다. true는 소유자 범위·페이지 제한·정렬을 유지하고 각 항목에 상세와 동일한 스냅샷/태스크/실행값을 반환한다. 페이지 내부 조회는 단일 읽기 transaction이다.
- Today는 20개 단위 전체 페이지를 읽은 후 요약한다. 페이지 간 변경은 전체 snapshot을 보장하지 않으며 새로고침으로 갱신한다.
- 완료율은 completed / 전체 태스크. skipped는 별도 표시하고 완료에 합산하지 않는다. cancelled 일정의 태스크는 진행률에서 제외한다. 빈 태스크는 0%다.
- 워크 요건은 생성 당시 스냅샷이다. 당일 블록에서 사전 연락/공지/이용 가능 시간을 표시하고 상세에서 연락처/출입/주차/메모와 실행값을 읽기 전용으로 확인한다.
- 실행 상태 변경은 Phase 7, 캘린더 실데이터는 Phase 8이다.

### 변경 기록
- 2.1 (2026-09-24): Phase 8 실제 월 캘린더·날짜별 agenda·선택 날짜 생성, Phase 9 선택적 사진 API/UI·소유권·파일 복구 구현. 일반 파일/PDF 제외.
- 2.0 (2026-09-24): Phase 7 실행 API·타입별 입력·메모·필수 검증·완료/취소·건너뜀·일정 상태 전이 구현. 기존 일정 상태를 보존 migration으로 명세와 정렬.
- 1.9 (2026-09-24): Phase 6 실제 Today·진행률·요건·상세 연결 및 페이지 상세 조회 옵션 구현.
- 1.8 (2026-09-24): 시계판 최종 조정. 자정·정오 심볼, 손잡이 교차 시 역할 전환, 자정 경계 차단, 얇은 선택 호와 외부 그림자.
- 1.7 (2026-09-24): Phase 6 전 시간 원판·여러 날 일정(end_date)·앱 시간대 적용·공통 플랫 UI. VERIFICATION_SCHEDULE_UI.md에 검증 기록.
- 1.6 (2026-09-24): Phase 5 일정 CRUD·독립 스냅샷·보관/복원·선택 UI와 테스트 구현. 다음은 Phase 6. 워크 스냅샷과 항목 정의의 물리 저장은 별도 행의 JSON이며 위 논리 필드를 보존한다.
- 1.5 (2026-09-24): Phase 4 워크 기본 태스크 연결 API/DB/UI, 보관 정책과 원자적 전체 저장 계약 구현. 다음은 Phase 5 일정.
- 1.4 (2026-09-24): Phase 3 태스크 프리셋 API/DB/UI와 항목 정의·버전 계약 구현. 다음 단계는 워크 기본 태스크 연결.
- 1.3 (2026-09-24): 워크=대상, 태스크=실행 정의로 확정. 3개 주 탭과 워크/태스크 하위 탭, 중첩 일정 블록과 완료 체크 UX. Phase 4를 워크 기본 태스크 연결로 조정.
- 1.2 (2026-09-24): Phase 2 Entity/로컬 사용자 구현 및 API 계약 확정. 테스트와 브라우저 검증 추가.
- 1.0 (2026-09-24): Google 인증과 서버 측 저장 암호화를 목표로 최종 청사진 작성. Phase 0 구현.
- 1.1 (2026-09-24): 사용자 지시에 따라 인증·세션·서비스 연동 준비를 뒤로 이동.
  핵심 기능 우선 순서, 인증 전 로컬 단일 사용자 설계와 다음 Entity 범위를 기록.
  이 개정에서는 문서만 변경하고 앱 코드·DB·의존성은 변경하지 않는다.

## 12. 제외된 미래 기능

오프라인 쓰기 sync, native iOS/Android, background sync, GPS/maps/navigation,
Apple/Google Calendar 연동, 반복 일정, 팀/역할/공유, audit logs, marketplace,
custom fields/terminology, analytics/time statistics, route optimization, NFC/Bluetooth/QR/barcode/voice,
JSON/CSV export, 자동 backup, enterprise 종단간 암호화.

미래 domain template pack은 labels/default fields를 바꾸되 핵심 Entity/Preset/Schedule 모델을 유지한다.
FIELD SERVICE: Site/Visit/Work. STUDY: Subject/Study Session/Study Task. FITNESS: Program/Workout/Exercise.
학습 시험일·목표·자료, 운동 부위·장비 등 도메인 필드는 해당 확장 단계에서 설계한다.

## 13. 설계 참고 자료

- Google OIDC: https://developers.google.com/identity/openid-connect/openid-connect
- OWASP sessions: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP storage: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- SQLite backup: https://www.sqlite.org/backup.html
- Axum serve: https://docs.rs/axum/latest/axum/fn.serve.html
- SQLx migrations: https://docs.rs/sqlx/0.8.6/sqlx/macro.migrate.html
- Vite: https://vite.dev/guide/

## Phase 7 실행 API 계약

- PATCH /api/schedule-tasks/:id: status(pending/in_progress/completed/skipped), execution_notes(최대 5000자). 생략 필드 유지. POST .../:id/start와 .../:id/complete는 빈 객체로 상태만 변경한다.
- PATCH /api/schedule-task-items/:id: {value: boolean|string|number|null}. 스냅샷 종류에 맞는 값만 허용. text는 5000자 이하, number는 유한 숫자. null은 값 삭제. 정의/소유자/임의 상태 변경은 거부한다.
- 필수 checkbox=true, text=공백 아닌 문자열, number=유한 숫자(0 포함)일 때 완료 허용. 실패는 409 REQUIREMENTS_INCOMPLETE. 필수값을 지우면 완료 태스크는 in_progress로 돌아가고 completed_at을 비운다.
- 항목 completed/completed_at은 입력 충족 여부에 따라 서버가 갱신한다. 첫 실제 항목 변경은 태스크를 진행 중으로 만든다. 건너뜀 태스크의 항목 편집도 진행 중으로 되돌린다.
- 일정 생성 시 기본값에도 같은 항목 충족 규칙을 적용한다. 충족한 항목의 completed_at은 생성 시각이며, 태스크와 일정은 자동 시작/완료하지 않는다. 기존 불일치 항목은 migration으로 보정하고 기존 실행값·태스크 상태는 보존한다.
- 태스크 완료 취소는 pending으로 되돌리며 completed_at을 비운다. 실행 값과 메모는 보존한다. started_at은 최초 실행 시각을 보존하며 중복 완료 요청은 완료 시각을 변경하지 않는다.
- PATCH /api/schedules/:id/status: {status: planned|in_progress|completed|cancelled}. 완료는 모든 태스크가 completed/skipped일 때 허용(태스크 없는 일정은 명시적 완료 가능). planned로 재개하면 저장된 태스크를 기준으로 상태를 재계산한다.
- 태스크 실행 변경 시 일정 상태는 모두 완료/건너뜀이면 completed, 실행 흔적이 있으면 in_progress, 그 외 planned로 재계산한다. 취소는 명시적으로 재개할 때까지 유지한다.
- 취소 일정의 실행 쓰기는 409 EXECUTION_LOCKED. 타 소유자/미존재는 404, 잘못된 UUID/본문/알 수 없는 필드는 400. 실행 API는 변경된 일정 상세를 반환한다.
- 모든 실행 변경·완료 검사·일정 재계산·응답 조회는 BEGIN IMMEDIATE 단일 transaction이며 프리셋 및 스냅샷 정의는 수정하지 않는다.
- 일정 상태 migration은 기존 pending→planned, skipped→cancelled로 바꾸고 ID·날짜·스냅샷·실행값을 보존한다.
- Today 완료 체크는 성공 응답으로 진행률 갱신, 필수 항목 미충족이면 상세 입력으로 안내한다. 상세 항목은 개별 명시적 저장, 메모는 디바운스 자동 저장이며 실패 시 입력 유지. 저장하지 않은 항목이나 저장 대기·실패한 메모가 있으면 태스크 완료를 막는다.

### 리뷰 보완 계약 (2026-09-24)

- 2026-09-25 사용자 요청으로 일정 보관·복원과 관련 검색 필터·API를 제거했다. 새 마이그레이션은 기존 보관 일정을 다시 표시하고 deleted_at 컬럼을 제거한다. 일정 내용·실행 이력·사진은 유지한다. 아래 과거 변경 기록의 일정 보관 기능은 현재 적용되지 않는다.

- 2026-09-25 사용자 확인: 일정 제목은 워크 이름을 사용하고, 하루 일정은 선택한 날짜에 추가하므로 별도 날짜 입력을 표시하지 않는다. 두 동작은 의도된 UX다.
- 당일 요약·일간·월간·연간 캘린더의 공통 검색 행은 모든 날짜의 일정 제목·워크 스냅샷 이름·태스크 스냅샷 이름·일정 메모를 검색한다. 20개 단위 페이지를 제공하며 결과에서 일정 상세를 연다.
- GET /api/schedules의 q는 최대 200자, 앞뒤 공백 제거와 LIKE 특수문자 리터럴 검색을 적용한다. 검색·소유자 필터는 페이지 처리 전에 적용한다. 일정 archived/include_archived 필드는 지원하지 않는다.

- 사진 정리의 개별 파일 실패는 로그와 미정리 행을 보존하고 서버 기동을 계속한다. 논리 삭제 커밋 후 파일 정리 실패도 삭제 성공으로 응답하며 다음 서버 시작에서 재시도한다.
- 사진은 허용 MIME과 실제 디코딩 형식을 일치시키고 전체 디코딩을 검사한다. 최대 한 변 8192px, 총 4000만 픽셀, 디코더 할당 256MiB와 동시 디코딩 2건 제한을 적용한다.
- 일반 편집은 보관 상태를 전송하지 않는다. 보관·복원은 별도 동작으로만 변경한다.
- 날짜는 저장된 시간대 확정 렌더에서 즉시 계산한다.
- 일정 목록은 사용자별 revision을 응답한다. 후속 페이지는 동일 revision을 요청하며 변경 시 409 SCHEDULE_LIST_CHANGED로 거부한다. 클라이언트는 최대 3회 전체 조회를 재시도한 후 오류를 표시한다. 같은 개수의 수정·삽입도 감지한다.

- 앱 공통 상단바 중앙의 큰 + 아이콘·“일정 추가” 버튼으로 일정 생성을 통합한다. 일간 캘린더에서는 선택 날짜, 그 외 화면(월간·연간 포함)에서는 앱 시간대의 오늘을 사용한다. 설정 화면에서는 이 버튼을 숨긴다. 화면별 기존 일정 추가 버튼은 표시하지 않는다.
