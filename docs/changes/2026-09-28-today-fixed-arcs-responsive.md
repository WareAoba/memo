# 둥근 호·고정 두께와 요약 반응형 보정

## 변경

- 기존 미커밋 환경·일정 시간·상태색·태스크 버튼 작업을 보존했다. 이번 작업은 직전 기록의 구간별 두께 복귀와 조각별 블러를 사용자 후속 요청에 맞게 교체한다.
- TodayDial의 호 양끝에 round cap을 적용했다. todayDialLayout은 실제 겹침으로 연결된 일정 묶음마다 열을 배정하고 각 일정의 두께·반지름을 전체 길이에서 유지한다. 독립 일정은 28px, 겹침 체인은 빈 열 재사용, 자정 연속 부분은 본체와 동일한 열을 사용한다. 입력 순서에 무관한 정렬과 날짜/일정 변경 시 계산 경계를 유지했다.
- 자정 이후 5분 조각·4단계 블러를 제거했다. 끊김 없는 호에 연속 그라데이션 마스크로 선명한 선과 Gaussian blur 선을 혼합한다. 실제 종료/최대 3시간 제한과 다음 날 선명한 표시는 유지한다.
- 요약 배치는 실제 가용 너비에 반응하는 auto-fit grid로 변경했다. 두 열 각각 360px와 간격을 확보하지 못하면 요약이 아래로 이동한다. 긴 제목·시간은 한 줄 말줄임, 제목 툴팁·접근성 이름은 전체 문자열, 완료 수는 nowrap으로 유지한다. 520px 이하 요약에서 hover/focus 액션을 아래 줄에 배치해 본문 너비를 보존한다.
- 서버·DB·API와 저장 동작은 변경하지 않았다.

## 문서

- SPEC·DESIGN_SYSTEM·STATUS의 이전 구간별 두께 복귀 계약을 고정 두께와 연속 블러로 갱신하고 요약 반응형 계약을 기록했다. CODE_MAP의 배치 설명과 CHANGES를 갱신했다.
- 편집 전 DESIGN_SYSTEM과 TodayDial/DialFace·TodayOverview·ScheduleCardActions·ScheduleTimeText의 실제 구현, /design-reference.html#today-dial-reference 상태를 확인했다. 기존 지정 레퍼런스에 새 호 표현을 적용하고 #today-overview-reference에 실제 TodayOverview의 잠긴 긴 제목 예시를 추가했다. 외부 API 호출 없이 표시를 검증한다.

## 검증

- 선택 테스트: TodayDial·todayDialLayout·Today, 3개 파일 30개 테스트 통과. 고정 두께·독립 일정·연쇄 겹침·자정 양쪽 동일 열·연속 마스크·다음 날 복귀·기존 완료 반영을 확인했다.
- 브라우저 다크 레퍼런스에서 둥근 양끝·2/3열 고정 폭·부드러운 자정 흐림을 확인했다. 실제 제품의 820px 너비에서는 요약 하단 전환, 390px에서는 문서 폭 390px·요약 행 67–68px를 실측했다. 1280px에서는 두 열을 확인했다. 긴 제목 레퍼런스는 1000px에서 한 줄 말줄임과 기본 행 67–68px를 확인했다.
- 레퍼런스 hover 검증 중 CSS import 순서로 기존 padding-right가 남는 문제를 발견해 요약 범위 selector 우선순위를 보정했다. 재확인 시 액션 노출 행은 112px로 제한되고 제목 너비 328px·오른쪽 여백 14px가 유지되어 본문이 좁아지지 않는다.
- 도구 제한: 초기 formatter 명령의 상대 경로가 맞지 않았고 하위 작업 디렉터리에서는 npm/npx PATH가 없어 실패했다. 루트 npm --prefix frontend exec와 전체 파일 경로로 보정했다. 브라우저 포커스 직접 지정 및 라이트 전환 시도는 도구 timeout/selector 오류로 완료되지 않았다. 이번 회차의 라이트/키보드 액션·실제 터치/OS 모션 축소는 별도 시각 검증하지 않았다.
- 최종 `npm run check:frontend` 통과: 문서/변경 게이트·포맷·ESLint·디자인/구조 검사·70개 파일 412개 테스트·TypeScript·Vite 빌드. 기존 500kB 초과 청크 경고는 유지된다. 백엔드는 수정하지 않아 재검사하지 않았다.
- 최종 diff·공백 오류를 검토하고 `record:change` 및 `check:docs`를 갱신했다. 검증용 크기 override를 reset했으며 개발 서버와 http://127.0.0.1:15173/#/today 및 http://127.0.0.1:15173/design-reference.html#today-dial-reference 탭을 유지한다.
