# 코드 리뷰 — 2026-09-24

> 아래는 수정 전의 역사적 기록이다. 지적 5건은 모두 수정했으며 추가 2건도 보완했다. 최신 결과는 [수정 검증 기록](VERIFICATION_REVIEW_FIXES.md)을 따른다.

대상: Phase 0 및 Phase 2–9 현재 작업 트리. 기능 코드는 변경하지 않았다.
저장소 전체가 아직 untracked 상태이므로 커밋 간 diff가 아니라 현재 구현을 기준으로 검토했다.

## 결론

수정 필요 사항 5건(P1 1건, P2 4건)을 독립 재현했다. 기존 테스트가 통과하더라도 이 사례들은 잡지 못한다.
핵심 업무 기능은 구현되었지만 기능 개발 전체 완료는 아니다. 계획상 Phase 10 PWA·오프라인 shell, Phase 1 인증, Phase 11 운영 배포가 남아 있다.

## 1. [P1] 사진 정리 실패가 서버 전체 기동을 차단한다

위치: backend/src/main.rs:20, backend/src/services/photos.rs의 cleanup/purge.

- 삭제할 수 없는 pending/deleted 파일 하나가 있으면 cleanup이 즉시 오류를 반환한다.
- main에서 이를 `?`로 전파하고 리스너를 생성하기도 전에 종료한다. 사진 문제 때문에 일정·프리셋·실행·health까지 모두 사용할 수 없게 된다.
- 사진 삭제 도중 권한 문제/파일 잠금 등으로 파일 삭제가 실패하면 deleted 행이 남으므로 재시작한다고 해결되지 않는다.
- 재현에서는 생성한 사진 경로를 삭제 불가능한 디렉터리로 대체했다. DELETE는 503, 목록은 0개, cleanup은 Err였다. main의 오류 전파 때문에 동일 상태에서는 서버가 기동하지 않는다.

수정 방향: 파일별 실패를 로깅하고 미정리 행을 보존한 채 나머지 정리와 서버 시작을 계속한다. 재시도 경로를 제공하고, 사진 저장소의 실패를 핵심 일정 기능 전체의 기동 실패와 분리한다. 삭제가 논리적으로 완료된 경우의 응답과 UI도 실제 상태에 맞춰야 한다.

## 2. [P2] 일반 일정 수정이 다른 탭에서 보관한 일정을 복원한다

위치: frontend/src/features/schedules/ScheduleEditor.tsx:108–117.
동일 패턴: EntityEditor의 전체 fields 전송, TaskPresetEditor의 initial.archived 전송.

- A 탭에서 활성 일정 수정 화면을 연다.
- B 탭에서 그 일정을 보관한다.
- A 탭에서 메모만 바꿔 저장하면, A가 기억한 archived=false도 PATCH에 포함된다.
- 서버는 정상적인 명시적 복원 요청으로 처리하므로 일정이 활성 목록으로 돌아온다. 반대 방향이면 의도하지 않은 재보관도 가능하다.
- 실제 서버 로직의 임시 DB에서 보관 후 프런트가 만드는 것과 같은 메모+archived PATCH를 보냈으며 결과는 archived=false였다.

수정 방향: 일반 편집 요청에서 archived를 빼고 전용 보관/복원 동작에서만 전송한다. 그 외 필드도 변경한 값만 PATCH하도록 하면 서로 다른 필드 편집의 불필요한 덮어쓰기를 줄일 수 있다. 이 문제는 같은 필드의 의도적인 마지막 쓰기 정책과 다르다.

## 3. [P2] 저장된 시간대와 기기 시간대가 다르면 잘못된 날짜로 캘린더가 열린다

위치: frontend/src/features/workspace/Workspace.tsx:11–12.
관련: App의 Calendar key=timeZone, useToday의 effect 기반 날짜 갱신.

- 앱 시작 시 useToday의 초기 값은 기기 날짜다.
- 저장 시간대를 비동기로 받은 직후 Calendar가 아직 갱신되지 않은 today로 마운트된다.
- 그 다음 today가 사용자 시간대에 맞게 바뀌어도 Calendar의 selected/month는 초기 값에 남는다.
- 기기 날짜 2026-09-24, 저장 시간대 Pacific/Honolulu의 날짜 2026-09-23 조건에서 캘린더 생성 링크는 2026-09-24를 가리켰다. 월 경계에서는 다른 월을 조회할 수도 있다.

수정 방향: 해당 시간대의 today가 확정된 후 Calendar를 마운트하거나, 사용자 선택 이전의 초기 날짜를 시간대 확정 시 동기화한다. 사용자가 직접 선택한 과거 날짜를 자정마다 강제로 바꾸는 수정은 피한다.

## 4. [P2] 페이지 조회 중 보관/삽입이 발생하면 일정을 조용히 누락하거나 중복한다

위치: frontend/src/api/schedules.ts:176–179.
관련: backend/src/services/schedules.rs의 LIMIT/OFFSET 목록 조회.

- 22건 중 첫 페이지 20건을 받은 후, 다른 탭에서 앞쪽 일정 한 건을 보관한다.
- 다음 OFFSET 20 요청은 이동된 레코드를 건너뛰어 마지막 1건만 반환한다.
- 클라이언트는 현재 total=21과 누적 길이 21이 같아 정상 완료한다.
- 재현 결과 ID 0–19,21을 반환했다. 보관된 0은 남고 활성 20은 빠졌지만 오류는 없었다. 반대로 앞쪽 삽입은 중복 ID·잘못된 개수·React key 충돌을 만들 수 있다.
- getDaySchedules도 같은 함수를 사용하므로 Today의 개수와 진행률에도 영향을 준다.

수정 방향: 일관된 목록 revision/snapshot 또는 안정적인 페이지 커서를 도입한다. 최소한 total 변화·중복 ID를 감지해 전체 조회를 재시도해야 한다. ID 중복 제거만으로 누락을 복구할 수는 없다.

## 5. [P2] 사진 시그니처 검사만 통과한 가짜 파일이 정상 저장된다

위치: backend/src/services/photos.rs:68–84.

- JPEG 검사에서는 시작 3바이트와 끝 2바이트만 확인한다.
- `FF D8 FF FF D9`라는 5바이트 요청을 image/jpeg로 보내면 201로 저장된다. 이미지 프레임과 픽셀 정보가 전혀 없어 사진으로 디코딩할 수 없다.
- PNG/WebP도 컨테이너 표식 위주라 실제 디코딩 가능성을 보장하지 않는다. 클라이언트 File.type과 확장자는 내용 검증이 아니다.
- 사용자는 업로드 성공을 보지만 이후 깨진 사진만 보게 된다. 임의 데이터를 표식으로 감싼 파일도 사진 저장소에 들어갈 수 있다.
- 현재 문서에 전체 디코딩을 하지 않는 제한이 적혀 있으나, 사용자 요구인 사진만 첨부를 실제 내용까지 보장하려면 보완이 필요하다. 실행 코드/XSS가 가능하다는 주장은 아니다.

수정 방향: 허용 이미지 디코더로 내용과 크기를 검증하고 최대 가로·세로·픽셀 수/메모리 제한을 적용한다. 필요하면 검증된 형식으로 재인코딩한다.

## 검증 범위 및 결과

- 소유권 필터와 복합 FK, 불변 스냅샷, 프리셋 항목 변경/정렬, 실행 상태와 필수값, 일정 보관/복원, 사진 transaction/filesystem 경계, 캘린더 초기화/페이지 조회, 저장 실패 UI, 날짜·시간 유틸리티, 기본 Docker 설정을 검토했다.
- 기존 백엔드 39개·프런트 81개 테스트 모두 재통과했다. fmt/clippy/Prettier/ESLint/TypeScript/Vite build도 통과했다.
- 추가 재현 테스트 5개는 기대되는 정상 동작을 assertion으로 작성했고 모두 현재 코드에서 실패했다. 실패 이유와 실제 값은 위 항목에 기록했다.
- 현재 사용 중인 DB나 서버를 재현 실험에 사용하지 않았다. 백엔드는 tempfile DB/사진 폴더, 프런트는 jsdom/mock HTTP와 고정 시각을 사용했다.
- 재현 테스트는 정상 테스트 묶음을 깨뜨리지 않도록 docs/review-20260924에 분리 보관했다. 프로덕션 코드와 실행 서버는 수정하지 않았다.
- 인증 미구현·오프라인 쓰기 미지원·낙관적 편집 충돌 미검출 등 명세에서 미룬 기능을 신규 버그로 집계하지 않았다.
- Docker 빌드/실기기/전원 손실 내구성 검증은 이번 검토에서 수행하지 않았다.

## 재현 자료

- review-20260924/backend_repro.rs: 임시로 backend/tests/review_repro.rs에 복사하고 `cargo test --manifest-path backend/Cargo.toml --test review_repro review_ -- --nocapture` 실행.
- review-20260924/reviewTimezone.test.tsx: 임시로 frontend/src/reviewTimezone.test.tsx에 복사.
- review-20260924/reviewPagination.test.ts: 임시로 frontend/src/api/reviewPagination.test.ts에 복사.
- 프런트 명령: `npm --prefix frontend test -- reviewTimezone reviewPagination`.
- 현재 코드에서는 해당 5개 assertion 실패가 재현 결과다. 재현 후 임시 복사본을 제거하면 기존 검사 묶음은 정상 통과한다.
- 백엔드 실행 파일 잠금을 피하려면 `CARGO_TARGET_DIR=C:\Git\memo\backend\target-validation`을 환경 변수로 지정한다.
