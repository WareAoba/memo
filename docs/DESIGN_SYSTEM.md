# Preset 디자인 레퍼런스


- 페이지 상단은 `WorkspaceHeader`를 사용한다. 첫 줄은 페이지 라벨 좌측·보기 전환 토글 우측, 다음 줄은 검색 좌측·추가 동작 우측으로 배치한다. 빈 행과 고정 높이 여백은 만들지 않는다. 검색 너비는 최대 560px, 버튼은 입력 오른쪽이며 필터 유무와 무관하게 검색 위치를 유지한다. 설정 탭도 우측 수평 탐색 영역을 사용한다.
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
- `MenuSurface`, `MenuOption`: 드롭다운의 표면·선택·hover 상태를 공유한다. 직접 입력 가능한 종류 선택은 `DetailKindInput`, 설정처럼 고정 목록을 고르는 입력은 `DropdownSelect`를 쓴다. 기존 네이티브 폼에는 `Select`를 유지한다.
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

일정 완료 체크는 네모, 태스크 체크는 `task-check` 원형 테두리와 내부 작은 원으로 구분한다. 각 태스크의 `task-hover-actions`는 해당 행 hover/focus에만 노출한다. 일정 버튼도 내부 태스크를 hover할 때는 숨긴다. 모바일은 `SwipeDelete`에서 가로 제스처와 세로 스크롤을 구분하고 왼쪽 스와이프 시 삭제 버튼을 노출한다. 버튼 선택 후 삭제 확인을 받으며, 동작 실패는 원래 항목을 유지한다.

Today 워크 카드에는 `--radius-card`를 적용하고 선택 배경만 강조한다. 태스크는 체크와 한 줄 제목을 중심으로 최소 44px 동작 영역을 유지하며 추가 상태·메모 줄을 표시하지 않는다. 상세와 수정은 공통 `PresetModal` 편집 팝업으로 통합하며 중첩 Escape는 내부 팝업에서 전파를 막는다.

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

`npm run check:frontend`는 포맷, ESLint, 디자인 규칙, 테스트, TypeScript와 배포 빌드를 실행한다.

- ESLint: 공통 구현 외의 직접적인 button/input/textarea/select JSX 작성 방지.
- `scripts/check-design.mjs`: 토큰 밖의 CSS 색상 값, layer 없는 CSS, 자식 SVG로 버튼 종류를 추정하는 규칙 방지.
- 공통 폼 회귀 테스트: 보조 버튼의 의도치 않은 제출 방지, 명시적 제출, ref와 disabled 전파 검증.
- 브라우저 확인: 1280px 데스크톱 및 390px 모바일. 워크/태스크 목록, 캘린더, 등록 모달, 종류 팝오버, 일정 추가와 태스크 그룹 선택. 실제 데이터 저장 없이 검증했다.

- 캘린더 보기 전환은 페이지 라벨과 같은 줄 우상단에서 `preset-switch`를 공유한다. 날짜 선택 드롭다운은 `CalendarGrid`의 6주 격자를 재사용해 높이를 안정화한다. 월간 일정 막대는 `--calendar-bar-fill/ink/shadow` 토큰으로 테마와 무관하게 흰색 채움·어두운 글자·양방향 그림자를 적용하며, 뉴모피즘은 막대에 한정한다. 연간 축소 막대는 구분색·강조색으로 내부를 채운다. 일·월·연간은 동일한 패널·제목·화살표 규격을 사용하며 일간 일정 카드는 보조 표면과 좌정렬 텍스트를 사용한다.

## 탐색·편집의 공통 표현

- 모바일 하단 주 메뉴는 목적지로 바로 이동한다. 동일한 보기 선택을 별도 drawer로 반복하지 않는다. 프리셋은 목록 아이콘, 설정은 톱니 아이콘을 사용한다.
- 일정 작성의 모바일 순서는 워크 이름, 접힌 시간 요약, 태스크다. 시간 요약을 펼쳐 원판을 조작하며 접어도 초안을 보존한다.
- 주 저장은 아이콘과 텍스트가 있는 버튼으로 고정 footer 우측에 배치한다. 보관·복원과 실행 상태 변경도 텍스트로 의미를 제공한다. 메모에는 별도 자동 저장 상태를 표시한다.
- 일간 태스크 이름은 해당 실행 편집을 바로 연다. 일정 상세는 실행 태스크를 앞에 두고 워크 참고 정보는 접는다.
- 모바일 월간은 날짜·일정 수로 요약하고 날짜를 누르면 일간으로 이동한다. 데스크톱 월간과 연간 축소 막대는 유지한다. 보기 탭 여백은 components 레이어의 `--view-tab-padding`으로 조정한다.
- 페이지 이동은 실제 main 스크롤을 초기화하고 모달 복귀는 위치를 유지한다. 설정·캘린더 보기 진입 및 모달 퇴장은 짧은 전환을 사용하며 줄이기·비활성화와 OS 모션 선호를 존중한다.

## 모션 리듬

공통 모션은 누름 100ms, 색상 피드백 220ms, 콘텐츠 진입·펼침 460ms, 모달·메모·캘린더 전환 560ms, 모달 퇴장 260ms를 사용한다. `--ease-settle`은 초반 반응 후 길게 감속해 부드럽게 정착한다. 버튼은 누를 때 97%로 압축하고 놓으면 복원하며 구조용 plain 버튼은 제외한다. CSS와 Web Animations는 `tokens.css`의 같은 시간·곡선 토큰을 사용한다. 모션 줄이기·비활성화 및 OS 선호를 유지한다.

- 앱 공통 상단바 중앙의 큰 + 아이콘·“일정 추가” 버튼으로 일정 생성을 통합한다. 일간 캘린더에서는 선택 날짜, 그 외 화면(월간·연간 포함)에서는 앱 시간대의 오늘을 사용한다. 설정 화면에서는 이 버튼을 숨긴다. 화면별 기존 일정 추가 버튼은 표시하지 않는다.
