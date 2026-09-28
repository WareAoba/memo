# 2026-09-27 성능 실측과 기술 도입 조사

## 변경

성능 개선 기술을 선택하기 위해 실제 제품 컴포넌트를 브라우저에서 실행하고, 별도 SQLite DB에 합성 데이터를 넣어 HTTP 응답을 측정했다. 제품 코드·의존성·설정·실제 data 디렉터리는 변경하지 않았다. 이 보고서는 최적화 구현 완료 기록이 아니다.

시작부터 있던 미커밋 UI·스티커·다국어·조회 공유·구조 감사 후속 작업은 별도 작업이다. 조사 도중 다른 작업에서 CSS·서버 DTO·문서가 바뀌었으며 이를 이번 성과로 포함하지 않는다. API 수치는 조사 초반 빌드한 바이너리 기준이다. 최종 작업 트리 전체의 성능 수치로 일반화하지 않는다.

### 측정 방법

- Windows Chrome 154, 화면 3072×1594, CPU 제한 없음. 설치된 React/React DOM 19.3.0, Vite 7.3.6. 개발 모드 대신 별도 Vite production 빌드에 `react-dom/profiling`을 연결했다. 실제 Today·Calendar·일정 API 모듈을 사용하고 HTTP만 fixture로 대체했다.
- Today: 일정 10/50/100개, 각 태스크 3개. 실제 1초 타이머로 갱신한다. 첫 800ms를 제외한 React Profiler `actualDuration`을 수집했다. 1차는 일반→캐시 순서, 2차는 수량·적용 순서를 뒤집었다. 각 조건의 안정 구간 표본은 각각 4/7개다. 작은 표본의 탐색 측정이며 통계적 확정치가 아니다.
- 비교 실험은 `scheduleAppearance`가 사용하는 날짜·시각 포맷터만 재사용한다. 원래 계산 경로는 유지하고 브라우저 fixture의 빌드 변환으로 전환했다. Asia/Tokyo 한 시간대에 한정한 실험이며 실제 제품의 여러 시간대·날짜 경계를 검증한 구현이 아니다.
- API: `CARGO_TARGET_DIR=backend/target/review`에서 `cargo build --manifest-path backend/Cargo.toml --locked` 후 127.0.0.1:3010에 실행했다. DATABASE_PATH·PHOTO_DIR는 `test-results/performance-audit/` 내부, PUSH_ENABLED=false. HTTP로 일정 1,000개와 일정별 태스크 3개를 생성했다. 100개는 9월 27일, 나머지는 12개월에 분산했다. 8회 순차 요청 중 첫 회를 제외한 전체 조회 중앙값이다. Rust debug 빌드·로컬 환경으로, 운영 서버 처리량 비교가 아니다.
- 최초 로딩은 production 번들 크기만 측정했다. LCP·INP·실제 모바일 프레임·전체 브라우저 paint 시간은 측정하지 않았다. Profiler 수치는 React 렌더 시간이며 사용자 입력 지연이나 전체 프레임 시간과 동일하지 않다.
- [원자료·소스 해시·재현용 fixture](2026-09-27-performance-measurements.json)에 두 번의 브라우저 결과, API 결과, 번들 분석, 측정 스크립트 원문을 보관한다. 실행 산출물은 Git 무시 경로 `test-results/performance-audit/`에 남겼다.

### 1. Today의 반복 렌더링: 확인된 우선 병목

| 일정 수 / 태스크 수 | DOM 요소 | 기존 렌더 중앙값 1차 / 2차 | 포맷터 재사용 1차 / 2차 |
| --- | --- | --- | --- |
| 10 / 30 | 951 | 5.4 / 4.4ms | 4.0 / 2.2ms |
| 50 / 150 | 4,351 | 20.2 / 14.4ms | 11.7 / 8.5ms |
| 100 / 300 | 8,601 | 33.9 / 32.4ms | 21.4 / 26.2ms |

`Today.tsx`의 `setNow(new Date())`가 매초 화면 상위에서 실행된다. 시계·요약·모든 상세 카드가 같은 트리에 있으며 카드에 매번 새 콜백을 전달한다. `TodayDial`과 요약 목록은 각각 일정마다 `scheduleAppearance`를 호출하고 날짜·시각 포맷터를 반복 생성한다. 포맷터 캐시만 바꾼 비교에서도 두 실행 모두 비용이 줄어 원인 일부가 확인됐다. 100개 appearance 호출만 분리한 1차 중앙값은 6.4ms→0.4ms였다.

우선 조치: 시간 변화가 필요한 시계/상태 요약과 상세 목록의 렌더 경계를 분리하고, 시간대·locale·옵션별 Intl 포맷터를 재사용한다. 목록에 `memo`를 적용할 때는 콜백 참조도 안정화해야 한다. 표시 정밀도에 맞춘 분 경계 갱신도 검토하되 자정·포커스 복귀·일정 상태 경계를 보존해야 한다. 타이머 전체를 단순히 60초로 바꾸면 경계 반영이 늦어질 수 있다.

새 전역 상태 저장소가 없어도 적용할 수 있는 개선이다. [React memo](https://react.dev/reference/react/memo), [MDN 포맷터 재사용 설명](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleTimeString).

### 2. 범위 조회의 순차 페이지: 확인된 네트워크 병목

`api/schedules.ts`의 `rangeSchedules`는 `limit=20`으로 직전 페이지가 끝난 뒤 다음 페이지를 읽는다. 완료 결과 캐시는 없으므로 같은 범위를 다시 조회해도 모든 페이지를 읽는다.

| 실제 로컬 API 조건 | HTTP 횟수 | 전체 중앙값 | 응답 본문 합계 |
| --- | --- | --- | --- |
| 당일 상세 100개, limit=20 | 5 | 32.2ms | 189,599 bytes |
| 당일 상세 100개, limit=100 | 1 | 21.3ms | 189,352 bytes |
| 연간 요약 1,000개, limit=20 | 50 | 110.5ms | 462,084 bytes |
| 연간 요약 1,000개, limit=100 | 10 | 57.8ms | 459,538 bytes |

연간 limit=20 한 페이지의 중앙값은 약 2.17ms다. 서버가 이미 지원하는 limit=100을 별도 요청으로 비교했으며 프런트 제품 동작은 변경하지 않았다. 더 큰 페이지가 항상 빠른 것은 아니다. 검색은 첫 20개가 약 1.95ms, 첫 100개가 약 5.63ms여서 화면 목적별 선택이 필요하다.

실제 프런트 API 모듈의 mock fetch에 요청당 40ms 지연을 넣은 브라우저 실험에서는 연간 1,000개 조회가 1차 2.340초, 2차 2.330초였다. 동일 범위의 즉시 재조회도 2.333/2.332초와 50요청이 반복됐다. 이는 WAN 실측이 아니라 브라우저 타이머 지연을 포함한 통제 실험이다. 요청 수에 비례해 지연이 누적되는 현상을 확인한 것이다.

우선 조치: 범위 조회의 페이지 크기 조정, revision을 공유하는 제한된 병렬 조회 또는 달력 전용 집계 응답을 검토한다. 페이지 간 revision 검증·취소·최대 재시도를 유지해야 한다. TanStack Query는 재방문 캐시에 유용하지만 `queryFn` 내부 순차 50요청 자체를 없애지 않는다. [공식 request waterfall 설명](https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls).

### 3. 연간 격자 계산: 규모가 커질 때의 후순위

12개월의 같은 날짜에 일정을 집중 배치한 합성 데이터로 `calendarWeeks`를 측정했다. 1차 12개월 계산 중앙값은 100개 0.2ms, 1,000개 1.5ms, 5,000개 15.1ms. Calendar의 데이터 반영 렌더는 각각 1.8/3.0/17.1ms였다. 표시 막대가 4행으로 제한되어 DOM 요소는 이 fixture에서 733개로 동일했다.

1,000개 수준에서는 요청 대기가 훨씬 크다. 높은 중첩 밀도에서는 lane 탐색 비용이 증가하므로 필요하면 월별 선분류·배치 결과 재사용을 먼저 적용한다. 현재 측정으로 Web Worker나 캘린더 라이브러리 교체를 우선 권하지 않는다. 이 분포를 일반 사용량이나 모든 최악 입력으로 해석하지 않는다.

### 4. 초기 번들: 크기 확인, 체감 병목은 미확정

별도 일반 production 빌드는 JS 570.35kB / gzip 173.74kB 한 파일이었다. 설정·프리셋 편집·캘린더가 정적 import되고 세 언어 번역도 포함된다. 번들 모듈 `renderedLength`는 minify 전 기여량이며 압축 크기와 직접 합산하지 않는다.

설정·비초기 편집 화면의 `React.lazy`와 언어 리소스 분할은 후보이나 실제 cold-load LCP를 재기 전에는 최우선 병목으로 단정하지 않는다. 500kB 경고 자체는 사용자 지연을 증명하지 않는다. [React lazy](https://react.dev/reference/react/lazy).

### 기술 선택

| 기술 | 판단 | 적용 범위와 조건 |
| --- | --- | --- |
| Intl.DateTimeFormat 재사용 + React 렌더 경계/memo | 우선 적용 권장 | 실험으로 비용 감소 확인. 런타임 라이브러리 추가 불필요. |
| 범위별 페이지 크기·제한 병렬 조회 | 우선 적용 권장 | 첫 조회 지연을 줄이는 직접 조치. 기존 서버 limit=100 비교에서 감소 확인. |
| TanStack Query | 새 라이브러리 중 우선 후보 | Today·Calendar·Sticky의 서버 데이터 재사용을 통합. 현재 완료 결과 무캐시 계약을 변경해야 하므로 SPEC와 회귀 검증 동반. |
| React Compiler | 제한된 후속 실험 권장 | 상태 저장소 이전 없이 반복 렌더를 자동 메모화할 수 있다. 이 조사에서 설치·A/B 측정하지 않아 효과 수치를 약속하지 않는다. |
| TanStack Virtual | 많은 일정의 목록에 조건부 후보 | 100개에서 DOM 8,601개, 초기 데이터 반영 렌더 1차 63ms. 먼저 타이머 분리 후 스크롤/초기 렌더가 여전히 느릴 때 적용. 편집 중 행이 사라져 초안·포커스가 손실되지 않도록 설계 필요. |
| Zustand / Redux Toolkit | 현재 도입 근거 부족 | 확인된 병목은 반복 계산·넓은 렌더·순차 조회다. 상태 저장소를 옮기는 것만으로 해결되지 않는다. 스티커의 선택 구독 효과는 별도 측정하지 않았다. |
| Redis·DB 교체·Web Worker | 현재 보류 | 측정한 로컬 API 페이지와 일반 크기의 연간 계산에서 우선 도입 근거가 부족하다. 대규모·다중 사용자 부하를 검증한 결론은 아니다. |

TanStack Query를 선택한다면 query key에 계정·날짜 범위·요약/상세를 포함하고, 명시적 쓰기 성공 이벤트와 캐시 갱신/무효화를 통합한다. `staleTime`, 포커스 재조회, 오류 재시도는 현재 동작과 맞춰 설정한다. 기본값만 적용하면 오래된 캐시로 간주해 mount/focus에서 다시 조회하므로 기대한 요청 감소가 없을 수 있다. 편집 초안은 서버 캐시와 분리하고 계정 전환·초기화·날짜 이동·이전 요청 취소·revision 경합을 검증한다. [TanStack Query 기본값](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).

React Compiler는 공식적으로 안정화되었고 Vite·React 19에서 도입할 수 있지만, 현재 컴포넌트의 규칙 준수와 effect 동작을 검증해야 한다. 수동 경계 최적화와 작은 범위에서 비교 후 확대한다. [공식 소개](https://react.dev/learn/react-compiler/introduction), [문제 해결](https://react.dev/learn/react-compiler/debugging).

TanStack Virtual은 보이는 항목만 렌더링하는 headless 도구다. 가변 높이·편집 상태·접근성을 제품이 직접 통합해야 한다. [공식 소개](https://tanstack.com/virtual/latest/docs/introduction). Zustand의 selector는 선택한 값이 바뀔 때 갱신 범위를 좁힐 수 있지만 이 코드에서의 효과는 미측정이다. [공식 selector 설명](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow.html).

### 재현

원자료 JSON의 `harness` 항목을 `test-results/performance-audit/`에 같은 파일명으로 복원하면 된다. 스크립트의 루트 경로는 이 작업 공간 `C:/Git/memo`이므로 다른 환경에서는 수정한다.

1. `node test-results/performance-audit/build.mjs` 실행. 일반 제품 번들 및 Profiler fixture를 별도 출력한다. Vite API로 빌드하며 제품 `check:frontend`를 대신하지 않는다.
2. `node test-results/performance-audit/server.mjs` 실행 후 Chrome으로 `http://127.0.0.1:15180/`을 열어 완료를 기다린다. fixture가 로컬 서버에 `browser-results.json`을 저장한다. 보관한 스크립트는 2차 순서다. 1차 재현은 count를 10/50/100, cache를 false/true, 대기를 4500ms로 바꾼다.
3. 위 측정 방법의 격리된 환경변수로 백엔드를 실행한 뒤 `node test-results/performance-audit/api.mjs`를 실행한다. 3010 포트가 이 테스트 서버임을 확인하며 실제 서버 주소로 바꾸지 않는다. 결과는 `api-results.json`이다.
4. 단위는 ms, 데이터 크기는 bytes. 브라우저/API 측정은 서로 별도 실험이므로 시간을 합쳐 end-to-end 수치로 보고하지 않는다.

## 문서

- 이 기록, 원자료 JSON, CHANGES의 링크를 추가한다. 기준 문서 STATUS·SPEC·CODE_MAP·기능 문서는 제품 구현/계약/소스 경로가 바뀌지 않아 수정하지 않는다.
- 이전 구조 감사의 미실측 범위를 이번 실험이 일부 보완한다. 당시 기록은 바꾸지 않는다. 스티커 드래그·사진·모바일·실사용 데이터 분포는 여전히 미측정이다.

## 검증

- 격리된 Rust debug 빌드 성공. 두 차례 브라우저 Profiler 측정과 실제 HTTP 데이터 생성/조회 비교 완료. 일반 production 번들 및 측정용 production 빌드 성공.
- 최초 Vite 빌드와 변경 기록 검사에서 샌드박스 `spawn EPERM` 발생. 권한 확장 재실행은 성공했다. 제품 테스트 assertion 실패가 아니다.
- 측정 종료 후 이 작업에서 시작한 두 서버를 종료했다. 실제 data·키·사진과 사용자 앱 서버는 사용하지 않았다.
- 전체 제품 테스트는 실행하지 않았다. 이번 저장소 변경은 조사 문서·측정 근거뿐이며 기능 변경 없음. 모바일/실운영/실제 WAN/INP/LCP와 제안 라이브러리 도입 후의 효과는 미검증이다.
- 보고서·원자료·CHANGES 내용을 검토했다. `git diff --check` 통과(기존 CRLF 정규화 경고 있음), `node scripts/check-docs.mjs`는 Markdown 49개 경로 검사 통과.
- `check:changes`는 다른 활성 작업이 수정 중인 `2026-09-27-audit-followup-finish.md`의 기록 해시 불일치로 실패했다. 해당 작업은 승인 대기 상태였다. `record:change`는 저장소 전체의 미기록 파일을 자동 포함하므로, 이 조사에서 검토하지 않은 병행 작업 파일을 가져오지 않기 위해 기록 연결은 보류했다. 다른 작업 본문·해시·게이트는 수정하지 않았다. 문서 내용과 측정은 완료됐지만 통합 `check:docs` 및 ledger 연결은 미완료다. 병행 작업 기록 완료 후 이 보고서를 `record:change`로 연결하고 문서 검사를 재실행해야 한다.
