# Preset 디자인 레퍼런스

## 날짜·시간·태스크 선택 및 자동 메모 입력

- 시·분 휠의 숫자는 스크롤 위치에 따라 X축 회전·가장자리 투명도를 적용한다. 클릭/키보드는 네이티브 smooth scroll, 터치 스크롤은 브라우저 관성/스냅을 사용한다. 96×220px 휠 영역과 44px 행을 고정해 글꼴 굵기·숫자 회전이 팝업 크기를 바꾸지 않게 한다. 내부 스크롤은 상위 팝업 재배치를 일으키지 않는다. 앱/OS 모션 축소에서는 즉시 정렬하고 숫자 회전은 생략한다. 같은 DateTimePicker가 레퍼런스와 제품에서 사용된다.

- 일정 추가·수정은 같은 시계/워크/태스크/리마인드/메모 레이아웃과 하단 저장을 사용한다. 수정의 실행 태스크도 같은 태스크 영역에 넣는다. 일정 메모는 공통 폼 저장으로 반영한다.

- `/design-reference.html#date-time-reference`의 `shared/DateTimePicker.tsx`를 날짜·시간의 지정 레퍼런스로 사용한다. 날짜는 기존 CalendarDatePicker/CalendarGrid의 6주 격자·월 이동·오늘·포커스 복귀를 재사용한다. 시간은 AnchoredPopup/MenuSurface/usePopupState 기반 비모달 드롭다운의 시·분 두 스크롤 휠, 중앙 선택 행, 44px 간격·scroll snap·방향키/Home/End·적용/취소를 공유한다. 종료 00:00은 적용 불가다. 팝업은 화면 경계를 보정하고 모달 내부에서는 해당 dialog에 연결해 포커스를 유지한다. MenuSurface 진입·usePopupState 퇴장 모션을 공유한다.
- `/design-reference.html#task-directory-reference`는 TaskDirectory와 PresetModal/ModalActions/DisclosureSummary/Input을 사용하는 그룹별 다중 선택 예시다. 태스크 바로 위의 공통 presets 아이콘으로 열고 그룹을 펼쳐 체크해 한 번에 추가한다. 태스크 행은 44px 조작 영역을 유지하면서 중복 세로 여백을 제거한다. 이미 추가한 항목과 100개 한도를 고려한다.
- 시작·종료 조정 버튼은 클릭/재클릭으로 열고 닫는다. 화살표는 선택된 시각 박스 내부에서 460ms 높이 확장·220ms 페이드로 나타난다. 상위 행은 펼침 공간을 예약한다. 원판을 덮거나 좌표를 바꾸지 않는다. 선택 호·양쪽 손잡이는 같은 460ms 토큰으로 회전/길이를 보간하고 직접 드래그 중에는 즉시 따라간다. 일정 모달은 뷰포트 내 고정 높이를 유지하며 모바일 시간 펼침은 native details의 본문 높이/투명도로 전환한다. 편집 원판은 최대 420px로 표시한다. 앱/OS 모션 축소를 따른다. 시간 설명은 원판 아래 짧게 표시한다. 다크모드 선택 호는 흰색 계열 `--dial-selection` 토큰이다.
- 일정 색상 팔레트는 워크명·태스크 위에 둔다. 저장 아이콘과 레이블 간격은 `--space-2`다. `ui.tsx`의 AutoTextarea는 내용과 너비에 맞춰 높이를 갱신하고 수동 resize를 제공하지 않는다. 일정 작성 메모와 공통 MemoEditor에서 재사용한다.


- 페이지 상단은 `WorkspaceHeader`를 사용한다. 첫 줄은 페이지 라벨 좌측·보기 전환 토글 우측, 다음 줄은 검색 좌측·추가 동작 우측으로 배치한다. 빈 행과 고정 높이 여백은 만들지 않는다. 검색 너비는 최대 560px, 버튼은 입력 오른쪽이며 필터 유무와 무관하게 검색 위치를 유지한다. 설정은 왼쪽 세로 탐색 영역의 공통 VerticalTabs를 사용한다.
화면은 공통 컴포넌트와 토큰을 가져다 사용한다. 레퍼런스 미리보기는 개발 서버의 `/design-reference.html`에서 볼 수 있다. 실제 앱과 같은 컴포넌트를 렌더링하며 API나 저장 데이터를 사용하지 않는다. 이 페이지는 개발용이며 기본 배포 번들에는 포함하지 않는다.

## 기준 파일

| 역할 | 파일 |
| --- | --- |
| 색상·간격·크기·모서리·그림자·모션 | `frontend/src/tokens.css` |
| 공통 컴포넌트의 스타일과 상태 | `frontend/src/design-system.css` |
| 버튼·링크 버튼·입력·카드·박스·헤더·메뉴 | `frontend/src/features/shared/ui.tsx` |
| 아이콘 도형, 크기 20px, 선 굵기 1.6 | `frontend/src/features/shared/ActionIcon.tsx` |
| 접근 가능한 이름을 갖는 아이콘 버튼 | `frontend/src/features/shared/IconButton.tsx` |
| 모달 포커스 복원·Escape·배경 클릭 | `frontend/src/features/shared/PresetModal.tsx` |
| 종류/그룹 선택의 키보드 탐색·팝오버 배치 | `frontend/src/features/works/DetailKindInput.tsx` |
| 설정 등 고정 목록 선택·문자 검색·키보드 탐색 | `frontend/src/features/shared/DropdownSelect.tsx` |
| 레퍼런스 페이지 | `frontend/src/design-reference.tsx` |

## 지정 레퍼런스와 필수 작업 순서

미관 기준은 아래 구현으로 고정한다. 가장 단순한 공통 입력·중성 메뉴 표면을 채택하며 화면별 복제품을 만들지 않는다.

| UI 패턴 | 기준 구현 | 필수 상태/동작 |
| --- | --- | --- |
| 펼치기·접기 아이콘 | 트랙 변경의 DropdownSelect → ui.tsx의 DisclosureIcon | 아래 방향 → 열림 180° 회전, 20px/1.6 선, 460ms·ease-settle, 같은 SVG 유지 |
| 접을 수 있는 본문 | ui.tsx의 DisclosureSummary | native details의 open을 단일 기준으로 사용, 기본 삼각형·+/− 교체 금지 |
| 고정 선택 목록 | DropdownSelect | 확정값과 탐색 위치 구분, Escape·포커스 복귀·화면 경계 보정 |
| 입력 가능한 선택 목록 | DetailKindInput + MenuSurface/MenuOption | 고정 선택과 같은 표면·선택색·탐색 outline·화살표 |
| 액션 메뉴 | ContentContextMenu + MenuSurface/MenuOption | 44px 행, 아이콘+텍스트, 위험 동작 마지막, 공통 진입·퇴장 |
| 버튼·폼·표면 | ui.tsx + IconButton | 토큰, 기본/hover/focus/disabled/선택 상태 공유 |
| 모달 | PresetModal + ModalActions | 공통 표면, 본문 스크롤, 하단 저장, 포커스 복귀 |
| 페이지 구성 | WorkspaceHeader | 제목·보기, 검색·추가 정렬 공유 |

1. UI 편집 전 이 표와 해당 컴포넌트 소스를 읽고 /design-reference.html에서 패턴을 확인한다. 펼침 비교는 #disclosure-reference에서 한다.
2. 기존 컴포넌트를 import한다. 아이콘만 복사하거나 화면 CSS에서 회전·타이밍·메뉴 선택색을 재정의하지 않는다. 새로운 패턴은 공통 구현과 레퍼런스에 먼저 등록한다.
3. 열림/닫힘·빠른 재클릭·키보드·disabled, 데스크톱/모바일과 모션 축소를 확인한다. 디자인의 기준과 검증 결과를 변경 기록에 남긴다.
4. ESLint는 공통 구현 밖의 직접 summary/폼 컨트롤을 차단하고 디자인 검사는 독립적인 disclosure 회전을 차단한다. 훅은 이 문서를 컨텍스트에 전달한다. 정적 검사는 미관이나 실제 참조 여부를 증명하지 않으므로 시각 검증 기록도 필요하다.

## 사용 기준

- 워크 변경·항목 수정·상세 보기는 동작을 구분하는 텍스트 버튼을 사용한다. 연필 아이콘 하나로 선택 변경과 상세 열기를 함께 표현하지 않는다. 메모 입력이 있는 폼에는 같은 메모를 여는 버튼을 중복 배치하지 않는다.

- `Button`: 기본 보조 동작. `primary`는 저장·등록, `ghost`는 보조 아이콘 동작, `danger`는 제거, `option`은 전체 폭의 선택 항목이다.
- `IconButton`: 아이콘만 표시할 때 사용한다. `icon`과 `aria-label` 또는 텍스트 children을 전달한다. 실제 버튼에 접근 가능한 이름과 툴팁이 전달된다. 크기는 44×44px이다.
- `ButtonLink`: 페이지 이동을 버튼 형태로 표시한다. 아이콘 전용 링크에는 `iconOnly`와 `aria-label`을 함께 전달한다.
- `Button variant="plain"`: 캘린더 셀, 시계 손잡이, 완료 행처럼 기능 자체의 레이아웃이 필요한 경우에만 사용한다. 일반 동작 버튼의 스타일 우회 수단으로 사용하지 않는다.
- `Input`, `Textarea`, `Select`: 네이티브 입력 속성·ref·폼 제출·fieldset disabled 동작을 보존한다. `Button`의 기본 type은 `button`이므로 저장은 `type="submit"`을 명시한다.
- `Surface`: `as`로 section/article/fieldset 등의 의미를 유지한다. `tone`은 default/soft/accent/danger, `padding`은 none/compact/normal이다. 모서리는 20px, 일반 여백은 24px, 모바일과 모달은 16px이다.
- `CardButton`: 상세 열기 등 카드 전체가 버튼인 경우 사용한다.
- `PageHeader`: 제목과 우측 동작의 정렬·타이포그래피·하단 간격을 공유한다.
- `MenuSurface`, `MenuOption`: 드롭다운의 표면·선택·hover 상태를 공유한다. 직접 입력 가능한 종류 선택은 `DetailKindInput`, 설정처럼 고정 목록을 고르는 입력은 `DropdownSelect`를 쓴다. 항목 종류·그룹 필터·리마인드 단위·언어 선택도 `DropdownSelect`로 통일한다.
- `DropdownSelect`: 공통 입력 표면·메뉴·화살표를 사용한다. 선택된 값과 키보드 탐색 위치를 구분하고 확정 시에만 변경한다. 팝업은 body portal과 top layer로 스크롤 영역의 잘림을 피하고 화면 가장자리에서 위/아래 배치를 조정한다. `disabled`를 명시적으로 전달한다. 스타일은 공통 레이어가 소유하며, 내부의 `plain` 버튼은 combobox 구조용이다.

```tsx
import { Button, Surface, Input } from '../shared/ui';
import { IconButton } from '../shared/IconButton';

<Surface as="fieldset" disabled={saving}>
  <legend>워크 정보</legend>
  <label>이름<Input name="name" required /></label>
  <Button variant="primary" type="submit">저장</Button>
  <IconButton icon="close" aria-label="닫기" onClick={onClose} />
</Surface>
```

## 스타일 우선순위

콘텐츠 계층은 제목의 크기·굵기, 섹션 여백과 얇은 구분선으로 표현한다. 상세 섹션·편집 fieldset·Today 태스크에 배경색 카드를 중첩하지 않는다. 강조색은 선택, 주요 동작과 상태에 사용하고 일반 태그는 보조 텍스트로 표시한다.

일정 완료 체크는 네모, 태스크 체크는 `task-check` 원형 테두리로 구분하며 네모는 초록색 체크 마크, 원형은 초록색 채워진 내부 원을 사용한다. 각 태스크의 `task-hover-actions`는 해당 행 hover/focus에만 노출한다. 일정 버튼도 내부 태스크를 hover할 때는 숨긴다. 모바일은 `SwipeDelete`에서 가로 제스처와 세로 스크롤을 구분하고 왼쪽 스와이프 시 삭제 버튼을 노출한다. 버튼 선택 후 삭제 확인을 받으며, 동작 실패는 원래 항목을 유지한다.

Today 워크 카드에는 `--radius-card`를 적용하고 선택 배경만 강조한다. 태스크는 체크와 한 줄 제목을 중심으로 최소 44px 동작 영역을 유지하며 추가 상태·메모 줄을 표시하지 않는다. 일정 추가·수정은 `Schedules.tsx`의 `ScheduleModal`과 `ScheduleEditor`를 공유하며 중첩 Escape는 내부 팝업에서 전파를 막는다.

스케줄 구분색은 `ScheduleColorPicker`의 네이티브 라디오 그룹으로 고른다. 14px 색 원과 선택 외곽선, 색 이름·툴팁, 키보드 탐색과 30×32px 클릭 영역을 제공한다. 시각적 레이블은 숨기고 스크린 리더용 그룹 이름을 유지한다. `tokens.css`의 `--schedule-*` 원색 팔레트는 앱 강조색/테마와 독립적이며 카드의 `data-schedule-color`가 4px 상단 보더에 연결된다. 색 없음은 중성 보더, 태스크 선은 기존 1px이다. 레퍼런스 페이지에도 같은 선택기를 사용한다.

Today는 main 하나에서 스크롤한다. 모달은 화면 비율과 최대 너비로 크기를 제한하고, 헤더를 제외한 본문 하나에서 스크롤한다. 모달 안의 태스크 목록에 별도 고정 높이 스크롤을 추가하지 않는다. 일정·워크·태스크 편집의 주 저장 버튼은 `ModalActions`로 본문 밖 고정 하단 영역의 우측에 배치한다. 폼 ID로 제출을 연결하고 하단 안전 여백을 확보하며, 본문만 스크롤한다. 드롭다운·메모처럼 독립적으로 열리는 팝오버의 스크롤은 유지한다.

전역 기능 스타일의 진입점은 `frontend/src/styles.css`이며, 책임별 파일은 `frontend/src/styles/`에 있다. [스타일 지도](../frontend/src/styles/README.md)의 import 순서는 기존 cascade를 보존한다. 기능 스타일을 찾을 때 집계 파일 전체를 읽는 대신 해당 파일과 같은 selector의 다른 정의만 검색한다.

`tokens.css`에서 `base → features → components` 순서의 CSS layer를 선언한다. 앱과 레퍼런스 진입점 모두 토큰을 가장 먼저 import한다.

- **base**: 구조적 버튼도 공유하는 최소 초기 스타일.
- **features**: 화면 배치, 반응형 구성, 캘린더·시계의 특수 구조.
- **components**: 공통 컨트롤의 크기·색상·모서리·hover·selected·disabled·focus. 기능 스타일의 selector가 길어도 이 레이어를 덮어쓸 수 없다.

앱 설정은 root의 `data-theme`, `data-accent`, `data-motion`, `data-content-width`와 `--content-scale`을 갱신한다. 테마·강조색 팔레트는 `tokens.css`, 배율·너비·모션 적용은 `features/settings/preferences.css`가 담당한다. 시스템 테마/모션 변경도 실행 중 반영한다.

새 색상은 의미를 가진 토큰으로 정의한다. 캔버스/표면/보조 표면, 본문/보조 글자, 강조/선택, 완료/주의/오류를 구분한다. 시계의 시간대 그라데이션과 일정 상태 색상도 토큰에서 관리한다. 다크 모드의 시간 종료·미완료 호는 흰색이다. 연속 일정은 현재 호 두께를 최소로 5단계 외곽 높이를 사용하며 ID 기반 값과 인접 중복 방지로 매 렌더의 흔들림을 막는다. 완료 비율에 따른 연속 HSL 계산은 `scheduleAppearance.ts`, 연간 캘린더는 달성률 색칠 없이 월간 일정 막대의 축소 실루엣을 사용한다.

모든 SVG를 감지해 버튼 크기를 바꾸는 `:has(> svg)` 규칙은 금지한다. 텍스트와 아이콘이 함께 있는 검색 결과가 축소되는 원인이 된다. 포커스 표시는 공통 레이어에서 유지하고, 움직임 줄이기 설정을 따른다.

## 검증

헤더·브랜드의 선언 소유자는 `frontend/src/styles/shell-calendar.css`다. CSS 집계 import 순서는 유지한다. `/tests/header.html`은 API 없는 헤더 회귀 화면이며 `theme=light/dark`, `motion=full/reduced/none`으로 확인한다.

`npm run check:frontend`는 포맷, ESLint, 디자인 규칙, 테스트, TypeScript와 배포 빌드를 실행한다.

- ESLint: 공통 구현 외의 직접적인 button/input/textarea/select JSX 작성 방지.
- `scripts/check-design.mjs`: 토큰 밖의 CSS 색상 값, layer 없는 CSS, 자식 SVG로 버튼 종류를 추정하는 규칙 방지.
- 공통 폼 회귀 테스트: 보조 버튼의 의도치 않은 제출 방지, 명시적 제출, ref와 disabled 전파 검증.
- 브라우저 확인: 1280px 데스크톱 및 390px 모바일. 워크/태스크 목록, 캘린더, 등록 모달, 종류 팝오버, 일정 추가와 태스크 그룹 선택. 실제 데이터 저장 없이 검증했다.

- 캘린더 보기 전환은 페이지 라벨과 같은 줄 우상단에서 `preset-switch`를 공유한다. 날짜 선택 드롭다운은 `CalendarGrid`의 6주 격자를 재사용해 높이를 안정화한다. 월간 일정 막대는 `--calendar-bar-fill/ink/shadow` 토큰으로 테마와 무관하게 흰색 채움·어두운 글자·양방향 그림자를 적용하며, 뉴모피즘은 막대에 한정한다. 연간 축소 막대는 구분색·강조색으로 내부를 채운다. 일·월·연간은 동일한 패널·제목·화살표 규격을 사용하며 일간 일정 카드는 보조 표면과 좌정렬 텍스트를 사용한다.

## 탐색·편집의 공통 표현

- 모바일 하단 주 메뉴는 목적지로 바로 이동한다. 동일한 보기 선택을 별도 drawer로 반복하지 않는다. 프리셋은 목록 아이콘, 설정은 톱니 아이콘을 사용한다.
- 일정 작성의 모바일 순서는 워크 이름, 접힌 시간 요약, 태스크다. 시간 요약을 펼쳐 원판을 조작하며 접어도 초안을 보존한다.
- 주 저장은 아이콘과 텍스트가 있는 버튼으로 고정 footer 우측에 배치한다. 앱 전역에 저장 중·성공·자동 저장 배지와 저장 아이콘 점멸을 표시하지 않는다. 저장 실패와 재시도는 유지한다.
- 일간 태스크 이름은 해당 실행 편집을 바로 연다. 일정 상세는 실행 태스크를 앞에 두고 워크 참고 정보는 접는다.
- 모바일 월간은 날짜·일정 수로 요약하고 날짜를 누르면 일간으로 이동한다. 데스크톱 월간과 연간 축소 막대는 유지한다. 보기 탭 여백은 components 레이어의 `--view-tab-padding`으로 조정한다.
- 페이지 이동은 실제 main 스크롤을 초기화하고 모달 복귀는 위치를 유지한다. 설정·캘린더 보기 진입 및 모달 퇴장은 짧은 전환을 사용하며 줄이기·비활성화와 OS 모션 선호를 존중한다.

## 모션 리듬

공통 모션은 누름 100ms, 색상 피드백 220ms, 콘텐츠 진입·펼침 460ms, 모달·메모·캘린더 전환 560ms, 모달 퇴장 260ms를 사용한다. `--ease-settle`은 초반 반응 후 길게 감속해 부드럽게 정착한다. 버튼은 누를 때 97%로 압축하고 놓으면 복원하며 구조용 plain 버튼은 제외한다. CSS와 Web Animations는 `tokens.css`의 같은 시간·곡선 토큰을 사용한다. 모션 줄이기·비활성화 및 OS 선호를 유지한다.

- 앱 공통 상단바 중앙의 큰 + 아이콘·“일정 추가” 버튼으로 일정 생성을 통합한다. 일간 캘린더에서는 선택 날짜, 그 외 화면(월간·연간 포함)에서는 앱 시간대의 오늘을 사용한다. 설정 화면에서는 이 버튼을 숨긴다. 화면별 기존 일정 추가 버튼은 표시하지 않는다.

- 체크박스는 네이티브 입력 의미와 키보드 조작을 유지하며 네모는 공통 CSS로 초록색 체크의 짧은 획과 긴 획을 460ms 동안 순서대로 그린다. 원형 task-check는 내부의 채워진 원을 460ms 동안 확대하고 해제 시 220ms 동안 축소한다. 해제 시 220ms 동안 역순으로 지운다. 초록색은 앱 강조색과 독립적인 success 토큰을 사용하며 원형·네모 테두리를 유지한다. 드롭다운은 공통 진입·퇴장 효과와 화살표 회전을 사용한다.

- 스티커 메모의 상단바는 레이블·상단 강조선 없이 스케줄 구분색을 표면색과 혼합한다. 날짜·자유 메모는 보조 표면색이다. 상단바와 아이콘 영역은 데스크톱 28px, 터치 44px이다. 표시될 때 본문 margin-top도 같은 높이로 이동해 가리지 않으며 숨겨지면 0으로 돌아온다. 본문 하단 여백도 축소하며 버튼의 외부 여백은 없다. 본문 이동은 상단바와 같은 220ms 토큰을 쓰며 모션 축소를 따른다. 상단바·우하단 가이드는 hover/활성 시만 나타난다. 우하단 보관함은 공통 메뉴 표면으로 위로 펼치며 모션 줄이기를 존중한다. 해당 버튼 크기·색상은 `sticky.css`의 한정된 components 규칙이 소유한다. 레퍼런스는 토큰·레이어 선언을 기능 컴포넌트보다 먼저 불러온다.

- 스티커 수납·복원은 560ms 지니 효과를 사용한다. 비대화형 창 스냅샷을 가로 조각으로 나누고 아래쪽부터 버튼 중앙으로 휘어 모으며 복원은 역방향이다. 모션 축소·끄기 및 OS 축소에서는 생략한다. 우하단 버튼은 ActionIcon의 sticky(곡선 가장자리·말린 모서리) SVG만 표시한다. 44px 버튼의 접근 가능한 이름·툴팁은 스티커 메모로 유지한다. 보관함 첫 행은 공통 plus 아이콘과 스티커 추가 문구이며 빈 자유 메모를 즉시 생성한다. 상단 스티커 버튼과 별도 대상 선택 모달은 제공하지 않는다. 자유 메모는 제목 입력 없이 Textarea만 사용한다. 기준 예시는 #sticky-demo다.

- 트랙 전환기는 좌상단 앱 타이틀 바로 옆에 배치한다. 헤더의 독립 grid 열과 min-width:0/ellipsis로 일정 추가 버튼 영역을 보장한다. 1100px 이하에서는 가용 폭을 우선하며 360px 이하 일정 추가는 텍스트 중심으로 표시한다. 트랙 선택 목록의 최소 폭은 260px(뷰포트 여백 내)이며 긴 이름을 읽을 수 있다.

## 콘텐츠 컨텍스트 메뉴 레퍼런스

- ContentContextMenu + MenuSurface/MenuOption을 우클릭·길게 누르기 패턴으로 지정한다. 디자인 레퍼런스 첫 콘텐츠 영역에서 같은 컴포넌트를 체험한다.
- 투명한 전체 화면 dialog가 배경 조작을 막고 작은 메뉴만 포인터 근처에 표시된다. 화면 밖 넘침을 보정하고 시각적 제목·테두리 없이 44px 행·기존 ActionIcon·토큰 그림자를 사용한다. MenuSurface와 메모 팝오버는 popupMotion의 포인터 원점 확장/축소를 공유한다. 키보드로 열면 모서리를 기준으로 한다. 삭제는 마지막에 위험 색으로 표시한다.
- 콘텐츠에 data-context-content, 기존 동작에 data-context-action을 명시한다. 중첩 콘텐츠의 액션은 상위 메뉴에 섞지 않는다. data-context-label은 카드 본문 대신 간결한 액션 이름을 제공한다. 편집 링크의 data-context-memo는 같은 편집 기능으로 연결하는 별칭이다. ContextMenuSlot은 원래 기능의 React 컨트롤을 메뉴 상단으로 portal 렌더한다. ScheduleContextColor는 ScheduleColorPicker와 기존 saveSchedule을 공유하며 설명 없이 팔레트를 표시한다.
- 액션은 기존 control.click()으로 위임하고 메뉴에는 HTTP·도메인 변경·확인 로직을 넣지 않는다. 모바일 일정 hover 버튼은 숨기되 메뉴 연결은 유지한다. 입력과 스티커 이동/크기 조절은 대상에서 제외한다.

## 테마·상태·입력·토스트 공통 계약

- 레퍼런스 상단에 해/달/모니터 아이콘을 갖는 라이트·다크·시스템 선택을 제공한다. 앱 SettingsProvider와 레퍼런스는 settings/useTheme.ts의 동일한 시스템 테마 구독을 사용한다. 레퍼런스 선택은 API 설정을 저장하지 않는다.
- 완료·주의·오류 및 보조 배경은 tokens.css의 success/warning/danger 의미 토큰을 사용한다. 화면마다 상태색을 재정의하지 않는다.
- DetailKindInput의 포커스 외곽선은 입력과 오른쪽 화살표를 함께 감싼다. 화살표 배경은 hover에도 투명하며 내부에 중복 외곽선을 그리지 않는다. 입력/화살표 재클릭은 공통 팝업 toggle로 닫고, 키보드는 방향키·Enter·Escape를 사용한다.
- ToastRegion은 스크롤 영역 안에 그림자 여백을 확보한다. Toast와 레퍼런스 알림은 동일한 toast.css를 사용하고 둥근 모서리 밖 그림자를 카드 경계에서 자르지 않는다.

- 팝업 퇴장의 forwards 프레임은 DOM 제거 후 해제한다. usePopupState는 빠른 재클릭과 퇴장 완료 콜백을 제공하며 보관함 복원은 목록 퇴장 뒤 실행해 빈 목록이 잠깐 나타나지 않게 한다. 메뉴 진입을 별도 CSS 애니메이션과 중복 실행하지 않는다.
- 스티커 생성·삭제는 stickyMotion의 확장/축소·페이드를 공유한다. 삭제 시 저장 기록은 즉시 제거하고 비대화형 스냅샷만 퇴장한다. 지니 효과는 최소화/보관함 복원에만 사용한다. 레퍼런스의 #sticky-demo에서 생성·최소화·복원·닫기를 확인한다.

## 설정 탐색·스위치 레퍼런스

- `VerticalTabs.tsx`는 왼쪽 세로 탭·단일 이동 선택 배경·방향별 본문 페이지 전환을 공유한다. 모바일에서도 세로 배치를 유지하고 패널과 탭 스크롤을 분리한다. 위/아래·Home/End 키, 선택 탭의 roving tabindex, tabpanel 연결을 제공한다.
- `ui.tsx`의 `ToggleSwitch`는 네이티브 checkbox에 switch 역할을 제공한다. 48×44px 조작 영역, 48×28px 알약 막대와 22px 원형 손잡이, 꺼짐 회색/켜짐 success 배경, 포커스 외곽선과 disabled 상태를 공유한다. 손잡이는 460ms, 배경색은 220ms이며 모션 축소·끄기 및 OS 선호를 따른다.
- `/design-reference.html#settings-controls-reference`에서 공통 탭, 켜짐/꺼짐, disabled 양쪽 상태를 확인한다. 테마는 기존 ActionIcon의 sun/moon/monitor, 강조색 샘플은 tokens.css의 실제 테마별 팔레트를 공유한다. DropdownSelect decoration은 접근성 이름과 문자 검색에 영향을 주지 않는 장식이다.

## 수평 탐색 레퍼런스

- `/design-reference.html#horizontal-navigation-reference`의 HorizontalNavigation/HorizontalPage를 사용한다. 기존 preset-switch 밑줄을 단일 표시선으로 유지하며 선택 항목의 실제 너비/위치로 460ms 이동한다. 프리셋 헤더는 종류 변경에도 유지하고 본문만 순서에 따라 좌우 56px·560ms로 진입한다. 키보드 링크/버튼·disabled·앱/OS 모션 축소를 유지한다.
- 캘린더 탭과 사이드 메뉴는 Calendar.changeMode를 공유한다. 로딩 상태는 흐름 밖에 표시하여 패널 측정값을 바꾸지 않는다. 조회 중 알려진 요약 막대는 날짜 범위로 잘라 유지하고 새 응답으로 교체한다. 확대/축소 스냅샷은 원본 글자 크기·배율을 보존하며 들어오는 화면과 나가는 화면이 모두 끝난 뒤 제거한다.

## 카드·모션 후속 기준

- 완료 상태는 /design-reference.html#completion-reference에서 네모·원형의 선택/해제·disabled·키보드 상태를 비교한다. ui.tsx의 Input과 design-system.css를 그대로 사용한다.
- 토스트는 화면 오른쪽 바깥에서 기존 우하단 위치로 수평 진입한다. 시작 이동량은 토스트 너비+64px+오른쪽 안전 영역이며 진입 중 가로 스크롤은 숨긴다. 공통 Toast의 레퍼런스 데모와 제품이 같은 toast.css를 사용한다.
- 캘린더 축소는 --motion-slow(560ms)·--ease-exit을 사용하고 나가는 화면을 전환 75%까지 유지한다. 확대·페이지 이동의 기존 조기 페이드는 유지한다.
- ScheduleCardActions는 실제 버튼 묶음 너비+24px를 ResizeObserver로 측정해 카드 hover/focus 여백으로 전달한다. 언어·글자 크기 변경에도 요약 텍스트가 겹치지 않게 한다. 완료 체크 옆의 표시 전용 상태 원이나 같은 완료 상태 문구는 중복 배치하지 않는다.
- Today·일간 카드의 시간은 워크명 옆, 일정 메모는 한 줄 말줄임으로 표시한다. 연속 공백·줄바꿈은 표시할 때만 한 칸으로 정리한다. Today 하단 수정은 제거하고 우상단 수정은 모바일에서도 제공한다.

- 모달/메모 팝업의 바깥 닫힘은 주 포인터 누르기 시작점으로 판단한다. 내부에서 시작한 텍스트 선택을 밖에서 끝내도 닫지 않는다. Escape·닫기 버튼·저장 실패 초안 보존은 유지한다.

## 알림 목록 레퍼런스

- `/design-reference.html#notification-reference`의 `features/schedules/NotificationMenu.tsx`를 알림 목록의 지정 레퍼런스로 사용한다. 공통 ActionIcon의 notifications(종), IconButton, AnchoredPopup/MenuSurface/usePopupState, Button/ButtonLink를 재사용한다. 상단바 오른쪽 44px 버튼·미확인 수, 360px(뷰포트 내) 목록, 일정 열기·개별 확인·모두 확인·빈 목록·재알림 예정 시각이 같은 구현이다.
- 메뉴는 복합 동작이 있어 비모달 dialog로 제공한다. 열면 제목에 포커스, Tab으로 각 동작 이동, Escape로 닫고 버튼으로 복귀한다. 빈 목록은 모두 확인을 비활성화한다. 레퍼런스의 예시 복원으로 반복 확인할 수 있으며 실제 API/저장소는 사용하지 않는다.
- 공통 Toast 닫기는 usePopupExit와 `--popup-exit-transform: translateY(80px)`로 260ms 아래 이동·페이드한다. DOM은 모션 후 제거하며 앱/OS 축소·끄기에서는 즉시 제거한다. 다시 알림 선택도 같은 퇴장을 사용한다. 다섯 간격 선택은 기존 DropdownSelect다.

- 공통 팝오버의 위치 계산은 shared/anchoredPopover.ts에서 관리한다. top layer·화면 여백·위/아래 선택·크기/스크롤 추적을 공유하고 각 입력의 선택/탐색·포커스·퇴장 계약은 유지한다. 태스크 이름 제안도 이 배치를 사용하고 방향키 탐색 항목을 보이게 스크롤한다. 입력 옵션의 기존 표현은 이번 변경에서 유지한다.
- 빈 검색 결과는 하나의 빈 상태로 표현하며 프리셋 상세의 태그는 편집기에 한 번만 표시한다. 프리셋 메모는 이름으로 맥락을 전달하고 원본 적용 범위를 반복 안내하지 않는다.
