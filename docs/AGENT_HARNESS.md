# 에이전트 문서 하네스

## 작업 계약

사용자 확인용 개발 서버와 미리보기 프로세스는 완료 후 유지한다. 변경 반영을 위한 재시작 후에는 다시 가동한다. 시각 검증한 화면도 닫지 않고 도구의 탭 유지 기능으로 남긴다. 최종 응답에 접속 주소와 유지한 화면을 적는다. 실행 파일 잠금을 피해야 하는 Windows 서버는 빌드 결과의 임시 실행 사본을 사용해도 되며 실제 데이터 경로/작업 디렉터리는 유지한다.

1. 편집 전 `git status --short`, STATUS, CODE_MAP, CHANGES와 작업에 해당하는 SPEC·기능 문서를 확인한다.
2. 변경 중 해당 기준 문서를 함께 갱신한다. 단순 테스트·도구 변경으로 제품 계약이 바뀌지 않으면 SPEC 미수정 이유를 작업 기록에 적는다.
3. `docs/changes/<날짜>-<작업>.md`에 변경 이유·범위, 기준 문서, 실제 검증/실패/미검증을 기록한다. 필수 절은 `## 변경`, `## 문서`, `## 검증`이다. CHANGES에 링크한다.
4. 최종 diff를 검토하고 `npm run record:change -- --record docs/changes/<날짜>-<작업>.md`를 실행한다. 출력 파일 목록 전체가 기록에 설명된 범위인지 확인한다. 이전에 기록된 변경을 다시 설명할 필요는 없지만 이후 재수정한 부분은 기록한다.
5. `npm run check:docs`와 변경한 영역의 완료 검사를 실행하고 결과를 기록한다. 검사 후 문서를 고쳤다면 같은 기록 명령과 문서 검사를 다시 실행한다.

과거 기록은 보존하고 새 작업은 새 파일을 만든다. 같은 작업이 진행 중일 때만 해당 기록을 갱신한다. 자동 생성된 해시는 문장으로 된 기록을 대신하지 않는다.

## 검사 범위

`frontend/scripts/check-structure.mjs`는 프런트 lint에 연결한다. TypeScript AST로 상대 import/export와 문자열 동적 import를 추적하고, 타입 전용 참조를 제외한 런타임 순환·진입점 미도달 모듈·API→UI·UI 직접 fetch/HTTP helper import를 검사한다. Rust route의 `sqlx::`도 검사하며 health 진단은 예외다. 이는 제한된 정적 검사이며 별칭·동적 경로·간접 네트워크 호출·SQL 문자열의 의미나 CSS cascade를 증명하지 않는다. 검사 자체의 정상/위반 fixture 테스트를 함께 실행한다. health 프런트 어댑터는 응답 계약 테스트용 예외로 유지한다.

`scripts/change-policy.mjs`는 HEAD 대비 작업 트리(스테이징 포함)와 Git 비무시 신규 파일을 검사한다. 삭제는 null, 이동은 이전 경로 삭제와 새 경로 추가로 기록한다. 각 파일의 SHA-256과 이를 설명하는 작업 기록의 SHA-256을 `docs/change-ledger.json`에 연결한다. 텍스트 CRLF/LF는 정규화한다. 기록 후 파일이나 설명이 달라지면 다시 실패한다. 자기 참조를 피하기 위해 ledger 자체만 파일 해시 대상에서 제외하고 스키마는 검사한다.

CI는 PR base 또는 push 이전 SHA를 `DOCS_BASE`로 지정해 커밋된 변경도 검사한다. 새 브랜치 push는 최초 하네스 도입 commit의 부모를 기준으로 검사한다. 로컬에서도 `npm run check:changes -- --base <commit>`으로 같은 범위를 검증할 수 있다. 부분 스테이징 상태의 로컬 통과는 커밋 내용 전체의 통과를 보장하지 않으므로 CI에서 다시 확인한다.

`check:docs`와 루트 `check:frontend`/`check:backend`의 pre 스크립트, CI documentation job이 이 게이트를 실행한다. 게이트 회귀 검사는 `npm run test:harness`다. 무시된 data·빌드 결과는 검사하거나 기록하지 않는다.

## Codex 훅과 활성화

저장소 `.codex/hooks.json`은 `SessionStart` 및 `UserPromptSubmit`에서 Git 상태와 AGENTS·STATUS·CODE_MAP·CHANGES·DESIGN_SYSTEM의 최신 본문을 컨텍스트에 전달하고 `Stop`에서 같은 기록 게이트를 실행한다. 최초 문서 전달 시 HEAD를 OS 임시 폴더의 세션별 파일에 저장하며 종료 때 이 기준과 비교하므로 작업 중 커밋으로 변경을 숨길 수 없다. 누락이면 `decision: block`으로 기록 보완을 요청한다. 문서·해시는 자동 승인하지 않는다. Git 루트에서 스크립트를 찾으므로 하위 폴더에서도 실행할 수 있다.

프로젝트와 훅은 Codex에서 신뢰되어야 실행된다. 새 세션에서 CLI `/hooks`로 정의를 검토하고 승인한다. 훅 신뢰는 사용자 결정이며 저장소 파일로 자동 승인하거나 우회하지 않는다. 현재 세션에 새 훅이 자동 적용됐다고 간주하지 않는다. Node와 Git이 PATH에 있어야 한다.

하네스는 문서 전달과 파일별 기록 존재·최신성만 강제한다. 에이전트의 이해나 설명의 정확성을 기계적으로 증명하지 못하며 검토가 필요하다. 로컬 훅 비활성화·검사 생략을 권한 수준에서 금지하는 장치는 아니다. 원격 병합 차단에는 GitHub branch protection에서 documentation job을 필수 검사로 지정해야 한다(원격 설정 변경은 이 저장소 구성에 포함되지 않는다).

공식 규격: [Codex Hooks](https://learn.chatgpt.com/docs/hooks). 관리되지 않는 훅은 사용자의 신뢰 승인 전에는 실행되지 않는다.
