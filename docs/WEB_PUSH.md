# 서버 예약 리마인드

상단 **알림 → 이 기기 알림 켜기**에서 브라우저 권한을 허용한다. 스케줄의 리마인드를 켜면 서버가 해당 시각에 기기별로 발송한다. 앱을 보고 있는 기기는 기존 토스트를 사용하고, 화면을 떠난 기기는 Web Push 시스템 알림을 받는다. 알림 클릭은 해당 스케줄을 연다.

## 실행과 설정

- 기존 `npm run dev:backend`로 예약 작업도 함께 실행된다. 별도 cron이나 Redis는 필요 없다.
- `PUSH_ENABLED=true`가 기본이다. `false`면 구독 API와 예약 발송이 꺼지고 인앱 토스트는 유지된다.
- `VAPID_KEY_PATH=data/push/vapid.key`: 최초 실행 시 P-256 개인키를 생성한다. 파일은 Git 제외 경로에 보관된다. 서버 재시작·배포 시 반드시 같은 키를 유지한다. Unix에서는 생성 파일 권한을 0600으로 제한한다. Windows에서는 데이터 폴더 ACL을 따른다.
- `VAPID_SUBJECT`: 운영자 연락처 `mailto:operator@example.com`으로 설정한다. 개발 기본값은 `mailto:admin@example.invalid`이다.
- Docker는 `/data/push/vapid.key`를 기존 데이터 볼륨에 보관한다. DB·사진과 함께 키도 암호화 백업에 포함한다. 키를 교체하면 각 브라우저에서 알림을 다시 켜 구독을 갱신해야 한다.
- 운영 서비스는 HTTPS가 필요하다. localhost는 개발 예외다. iOS/iPadOS는 지원 버전에서 홈 화면에 추가한 웹 앱으로 사용한다. manifest는 포함하지만 오프라인 캐시는 추가하지 않았다.
- 브라우저나 OS를 강제 종료하거나 절전·집중 모드인 경우 도착이 지연되거나 누락될 수 있다. 서버와 기기 모두 인터넷 연결이 필요하다.

## 처리 구조

1. 스케줄의 알림 시각은 서버가 IANA 시간대로 계산한다. 리마인드 설정이나 시작 시각이 변경되면 `reminder_version`이 증가한다.
2. 서버가 5초 간격으로 도래한 활성 스케줄과 구독을 확인해 `push_deliveries`에 작업을 만든다. `(subscription_id, schedule_id, reminder_version)`이 유일하다. 일정 재개 등으로 같은 버전이 다시 발송 조건을 만족하면 미전송 취소 건을 복구한다. 기존 재시도 횟수·대기 시간은 유지하며 발송 완료·영구 실패 건은 복구하지 않는다.
3. 30초 lease로 한 번에 최대 4개를 확보해 병렬 전송한다. 만료된 lease는 재시작 후 회수한다. 전송 직전에 최신 버전·상태·소유자·시작 전 여부를 확인한다.
4. RFC8291 암호화와 VAPID 서명 후 HTTPS로 발송한다. VAPID 서명 유효기간은 12시간, 메시지 TTL은 시작 시각까지 최대 24시간이다. TTL과 서명 만료는 별개다.
5. 성공은 provider가 수락한 상태이며 기기 표시 확인이 아니다. 네트워크/408/425/429/5xx는 최대 5회 재시도한다. 30초부터 최대 5분 backoff와 초 단위 Retry-After(최대 1시간)를 적용한다. 404/410은 구독을 비활성화한다. 나머지 거절은 영구 실패로 남긴다.
6. 화면이 보이는 탭은 15초 간격으로 45초 유효한 heartbeat를 전송한다. 탭마다 상태를 저장해 다른 탭의 숨김 이벤트가 열린 탭의 상태를 지우지 않는다. 비정상 종료 시 최대 45초 뒤 푸시로 전환한다. 토스트를 표시한 알림은 같은 전달 기록에 반영한다.
7. 서비스 워커는 IndexedDB의 알림 ID와 OS notification tag로 중복을 줄인다. 브라우저에서 앱을 다시 열면 시스템 알림 수신 기록도 읽어 같은 토스트를 반복하지 않는다. 네트워크 단절·전송 중 변경 등에서는 정확히 한 번 표시를 보장할 수 없다.

`reminder_worker.rs`는 작업 생성·lease·재시도를, `push.rs`는 구독·암호화·Web Push 전송을 담당한다. 네이티브 앱 추가 시 기기 토큰 저장과 APNs/FCM 어댑터를 구현하며 서버 일정/리마인드 버전과 전달 기록 정책을 재사용한다. 네이티브 전송 자체는 아직 구현하지 않았다.

## API

| API | 용도 |
| --- | --- |
| `GET /api/push/config?installation_id=UUID` | 서버 활성화·공개키·기기 구독 상태 |
| `POST /api/push/subscriptions` | `{installation_id, subscription: PushSubscription.toJSON()}` 등록/갱신 |
| `DELETE /api/push/subscriptions/:installation_id` | 현재 사용자의 기기 구독 해제 |
| `POST /api/push/presence` | `{installation_id, tab_id, visible, seen:[{schedule_id,reminder_version}]}` |
| `GET /api/reminders` | 현재 도래한 인앱 알림, `reminder_version` 포함 |

기존 서버 소유 사용자 경계를 사용한다. 인증 전에는 로컬 개발 범위이며 외부 공개 전 기존 인증 단계를 완료해야 한다. 변경 API는 요청 Origin을 검사한다. endpoint는 알려진 Google/Mozilla/Apple/Windows 푸시 도메인의 HTTPS 443만 허용하며 redirect를 따르지 않는다. 구독 endpoint·암호화 키·개인키는 로그에 남기지 않는다. 다른 사용자 endpoint는 재등록할 수 없다.

## 검증

- Rust 통합 테스트: 재시작 보존, 동시 claim 중복 방지, lease 회수, 실패 재시도 상한, 변경/취소 후 발송 제외, 만료 구독, 기기별/탭별 상태, 사용자 격리, 암호문 복호화 round trip, VAPID/TTL, endpoint 검증, Origin 거부.
- 프런트엔드 테스트: 명시적인 권한 요청, 거부 시 등록 중단, 자동 권한 요청 없음, 서버 해제 우선, 서비스 워커 표시·기한 만료·같은 origin 이동, 기존 토스트 회귀.
- 실제 외부 푸시 제공자를 거쳐 OS에 표시되는 실기기 전달은 자동 테스트와 구분한다. 사용자의 브라우저에서 알림을 켠 뒤 가까운 미래의 스케줄을 등록하고 탭을 닫아 확인한다. 자동 검증에서는 실제 사용자 구독을 만들거나 권한을 허용하지 않는다.

## 알려진 제한

- 2026-09-25 실제 내장 브라우저 테스트에서 권한 허용 후 `jmt17.google.com` 구독이 발급됐고 서버의 공급자 검증에서 거절됐다. 이는 [Chromium에서 폐기 대상으로 지정한 staging 주소](https://chromium.googlesource.com/chromium/src.git/+/40644b8cf2b03be542976e7d1192c653e389c14e)다. 이 경우 일반 Chrome/Edge에서 활성화하도록 안내한다. 권한 허용만으로 실제 푸시 수신 성공으로 판정하지 않는다.
- 이미 provider로 전송 중이거나 OS에 표시된 알림은 이후 수정·취소로 회수할 수 없다.
- API/서비스 워커의 내용 캐싱과 오프라인 쓰기는 제공하지 않는다.
- 브라우저 저장소 삭제·권한 철회·구독 만료 후에는 알림 설정에서 다시 켠다. 삭제된 기기 정보는 서버에서 자동 활성화하지 않는다.
- 단일 서버/SQLite 기반 소규모 서비스에 맞춘 작업량이다. 작업량이 늘면 동일한 영속 작업 정책을 유지하면서 전송 동시성과 작업 큐를 확장한다.

자동 검증: npm run check:backend 통과(59 tests, fmt/clippy/build), npm run check:frontend 통과(141 tests, format/lint/build). 개발 서버 재시작 후 공개키 설정 API·sw.js·manifest 200 응답과 실제 브라우저의 알림 설정 모달을 확인했다.

실수신 검증(2026-09-25): 일반 브라우저 구독 등록 후 API로 ‘푸시 수신 테스트’ 스케줄을 생성했다. 실제 예약 시각에 서버가 발송하여 push_deliveries에서 status=sent, attempts=1, result_code=accepted를 확인했고, 사용자가 시스템 알림이 나타났다고 확인했다. 테스트 스케줄 ID는 `027b77b2-b508-4c62-9d82-cf7480e6d3b1`이며, 검증 후 해당 스케줄의 리마인드를 끄고 완료 기록을 남겼다. 기기 알림 구독은 활성 상태로 유지했다.
