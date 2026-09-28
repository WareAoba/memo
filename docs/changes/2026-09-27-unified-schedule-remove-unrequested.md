# 일정 모달 통합·자동 태스크/프리셋 보관 제거

## 변경

- 사용자 요청 4개를 반영한다. 추가·수정은 ScheduleModal과 ScheduleEditor를 공유하고 저장된 태스크도 추가 화면과 같은 우측(모바일 하단) 태스크 영역에 배치한다. 일정 메모는 공통 폼 초안/하단 저장에 포함하며 실패 시 보존한다. 실행 체크·이름·매개변수·사진·삭제와 원본 스냅샷 격리는 유지한다.
- 워크 선택 시 기본 태스크 조회/자동 추가를 제거했다. WorkTasks 화면·프런트 workTasks API·서버 work_tasks route/service를 삭제하고 더미 생성기의 자동 연결도 제거했다. 기존 연결 경로는 404, 수동 태스크 초안은 워크 변경에도 유지한다. 기존 일정의 태스크는 삭제하지 않는다.
- 워크/태스크 보관·복원 버튼/목록 탭·프런트 API·서버 DELETE 서비스와 보관 필터 SQL을 제거했다. DELETE는 405, archived=true 쓰기/목록은 400. false와 응답/DB archived 필드는 레거시 호환용으로만 남는다. 새 migration은 기존 보관 프리셋을 일반 목록으로 돌려놓고 ID/스냅샷/실행값은 보존한다. 적용된 migration과 실제 데이터는 테스트에 사용하지 않았다.
- 스티커 상단바 표시 상태와 같은 조건으로 본문 margin-top을 28px(터치 44px) 이동하고 숨김 시 돌려준다. 같은 220ms 모션 토큰과 기존 축소 설정을 따른다. 최소화 보관함은 워크/태스크 보관 기능과 별개로 유지한다.
- 기존 작업 트리에 있던 트랙·스티커·입력·알림·하네스 등 변경을 유지했다. 세션 시작 시 임시 복사본과 비교하여 이번 변경 범위를 분리했다. 기존 기본 태스크의 Git 최초 확인은 060a853(2026-09-26 00:34:25 +0900); 최신 더미 생성 기록에 연결 120개가 적혀 있다. 커밋/문서만으로 사용자 지시 여부를 단정하지 않는다.

## 문서

- SPEC의 현재 프리셋 API·태스크 선택·모달·스티커 계약, STATUS, CODE_MAP, PRODUCT_GUIDE, TASK_CUSTOMIZATION, DESIGN_SYSTEM을 갱신했다. 과거 변경 기록과 적용 migration은 보존한다. 새 파일/삭제 경로와 퇴역 API 회귀 위치를 CODE_MAP에 반영했다.
- 참조 구현: PresetModal/ModalActions, ScheduleEditor, ScheduleTaskRows, ui.tsx, StickyWindow/sticky.css. /design-reference.html#sticky-demo, #date-time-reference, #task-directory-reference에서 기존 공통 컨트롤과 상태를 확인했다. 공통 레이아웃/토큰을 재사용했다.

## 검증

- 선택 프런트 검사 4개 파일 61개 통과. 백엔드 entities/task_presets/schedules/tracks/work_tasks 41개 통과. 자동 추가 없음·수동 초안 보존·보관 경로 거부·migration 스냅샷 보존을 포함한다.
- 중간 실패: 제거된 보관 UI/기본 태스크와 이전 메모 자동 저장을 가정한 테스트를 새 계약으로 갱신했다. serde skip_deserializing과 deny_unknown_fields 조합으로 정상 PATCH가 400이 되는 문제를 수정하고 재검사 통과했다. 루트 tsc 실행 경로 오류는 frontend에서 재실행하여 통과했다. 세션 시작 전 전체 검사는 실행하지 않아 기존 전체 합격 여부를 소급 주장하지 않는다.
- 전체 npm run check 통과: 문서/기록 게이트, Rust fmt·clippy·전체 테스트·빌드, 프런트 포맷·lint·디자인/구조·테스트·TypeScript·빌드. 마지막 공통 메모 분기 정리와 레이아웃 회귀 보강 후 npm run check:frontend도 재통과했다(63개 파일, 353개 테스트). node --test scripts/seed-demo-presets.test.mjs 2개 통과. 기존 Vite 번들 500kB 초과 경고는 남으며 빌드는 성공했다.
- 브라우저 1280px에서 추가/수정의 공통 배치와 하단 저장을 비교했다. 기존 기본 연결이 있던 워크를 선택해도 태스크가 추가되지 않았다. 수정의 실행 태스크/메모가 공통 배치 안에 있고 중첩 form이 없음을 확인했다. 390px에서는 워크→시간→태스크→리마인드→메모 순서와 가로 넘침 없음(문서 폭 390px)을 확인했다. 실제 일정 저장/변경 없이 검증했다.
- 디자인 레퍼런스 스티커 활성 상태에서 상단바 높이와 본문 margin-top 모두 28px, 비활성 상태에서 상단바 숨김과 margin-top 0px을 확인했다. 실제 터치 기기의 44px 상단바와 OS 모션 축소 전환은 수동 검증하지 않았다.
- 변경된 백엔드를 재시작하여 health 200, 기본 연결 경로 404, archived=true 목록 400, 워크 경로 Allow: GET,HEAD,PATCH를 확인했다. 기존 보관 해제 migration이 개발 서버 시작 시 적용된다. 개발 데이터는 테스트 fixture로 사용하지 않았다.
- 개발 서버 http://127.0.0.1:15173/ 및 API 3000을 유지하고, 앱의 수정 모달과 /design-reference.html#sticky-demo 탭을 유지했다. 임시 모바일 뷰포트는 원복했다. 최종 diff 검토 후 기록 연결 및 check:docs를 재실행한다.
