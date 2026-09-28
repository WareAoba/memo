# UX·컴포넌트 패턴 재점검

## 변경

사용자가 제시한 다섯 기준으로 최신 제품 코드와 디자인 레퍼런스를 다시 대조했다. 이번 변경은 이 감사 기록과 CHANGES 색인뿐이며 제품 코드·데이터는 수정하지 않았다. 기존 작업 트리의 구현 변경은 다른 작업의 기록에 속한다.

### 확인한 사례

| 기준 | 위치 | 확인 내용·개선 방향 |
| --- | --- | --- |
| 중복 결과 | `frontend/src/features/schedules/ScheduleSearch.tsx:88` | 결과가 없으면 ‘검색 결과 0개’와 ‘검색 결과가 없습니다’를 연속 표시한다. 실제 검색 화면에서 재현했다. 빈 결과에서는 하나만 남길 수 있다. |
| 중복 결과 | `frontend/src/features/works/WorkListView.tsx:124`, `frontend/src/features/tasks/TaskPresetListView.tsx:146` | 두 프리셋 목록도 결과 수를 먼저 표시한 뒤 빈 검색 결과를 다시 표시한다. 소스의 렌더 분기로 확인했다. |
| 중복 데이터 | `frontend/src/features/works/WorkDetail.tsx:79`, `frontend/src/features/tasks/TaskPresetDetail.tsx:92` | 상단 편집기의 TagInput에 있는 태그를 메모 아래 배지로 다시 출력한다. 입력 중에는 초안과 저장된 태그가 서로 다른 값으로 보일 수도 있다. 하단 배지 제거 후보다. |
| 불필요한 범위 설명 | `frontend/src/features/works/WorkDetail.tsx:67`, `frontend/src/features/tasks/TaskPresetDetail.tsx:80`, `frontend/src/features/shared/PresetMemoButton.tsx` | ‘프리셋의 기본 메모입니다. 이미 만든 스케줄의 기록은 바뀌지 않습니다.’를 메모 편집에 전달한다. 미사용 번역이 아니라 실제 렌더 경로다. 메모의 이름으로 맥락을 전달하고 상시 설명을 줄일 수 있다. |
| 장황한 안내 | `frontend/src/features/settings/SettingsFields.tsx:118`, `frontend/src/features/settings/PushSettings.tsx` | 계정/기기 적용 범위, 기기별 허용, 인앱 리마인드, 앱 실행/종료 시 전달 방식, 기기별 설정 안내가 인접해 있다. 알림이 이미 켜진 설정 화면에서도 확인했다. 현재 기기 상태와 필요한 동작을 중심으로 줄일 후보다. |
| 오래된 설명 | `frontend/src/features/settings/DataReset.tsx:24`, `frontend/src/i18n/locales/ko.json:525` | 초기화 안내가 제거된 ‘보관함’, ‘기본 태스크 연결’, ‘워크 연결’을 계속 설명한다. 동적 번역 키로 실제 사용된다. 삭제 영향 안내 자체는 필요하지만 현재 계약에 맞게 고쳐야 한다. |
| 레퍼런스와 다른 입력 | `frontend/src/features/schedules/TaskNameInput.tsx:107` | MenuSurface는 공유하지만 옵션은 별도 Button이며 `aria-selected={index === active}`로 키보드 탐색과 확정 선택을 혼용한다. 기준 DetailKindInput은 선택값과 data-active를 구분한다. 레퍼런스 화면에서도 선택 배경과 탐색 outline이 분리되는 것을 확인했다. |
| 레퍼런스와 다른 팝업 배치 | `frontend/src/features/schedules/TaskNameInput.tsx`, `frontend/src/features/schedules/schedules.css`의 `.task-name-options` | absolute 팝업·최대 높이 240px를 별도로 사용한다. 기준 선택기는 top layer/화면 경계 보정과 활성 항목 스크롤을 제공한다. TaskNameInput에는 활성 항목을 보이게 하는 스크롤 처리가 없다. 실제 잘림이나 화면 밖 탐색은 이번 브라우저 점검에서 재현하지 않았으므로 영향은 코드상 위험으로 남긴다. |

### 코드 축소·통합 후보

- `frontend/src/features/settings/SettingsProvider.tsx:22`: 제품 소비처가 없는 saving React 상태가 남아 있다. 실제 요청 직렬화에 쓰는 running ref와 구분해서 정리할 수 있다.
- `frontend/src/features/shared/useMemoAutosave.ts:19`: 소비처가 없는 state.saved 성공 플래그가 남아 있다. 변경 비교에 필요한 private saved 문자열과 저장 중/dirty 상태는 별개이며 제거 대상으로 보지 않는다.
- `frontend/src/features/schedules/Picker.tsx:163`: 조건과 본문에서 같은 matchHint를 두 번 계산한다. 한 번 계산한 표시값으로 줄일 수 있다.
- `frontend/src/features/shared/DropdownSelect.tsx`, `frontend/src/features/works/DetailKindInput.tsx`, `frontend/src/features/shared/AnchoredPopup.tsx`, `frontend/src/features/workspace/CalendarDatePicker.tsx`: 팝오버 열기·위치 계산·화면 경계·스크롤/resize 구독이 반복된다. 키보드 의미를 보존하면서 위치 계산 책임만 공유할 후보다.
- `frontend/src/features/workspace/TodayScheduleCard.tsx:252`의 AddTaskPicker와 ScheduleEditor/ScheduleTaskRows의 TaskNameInput·TaskDirectory는 태스크 추가를 서로 다른 UI·초안 상태로 처리한다. 화면 목적 차이는 있으나 같은 선택·매개변수 책임을 두 경로에서 유지하는 비용이 있다. 일괄 선택 등 차이를 확인한 후 공통화할 후보이며 단순히 파일이 길다는 이유로 위반 판정하지 않았다.
- `frontend/src/features/workspace/TodayScheduleCard.tsx:96`: 완료/재개를 직접 분기한다. 다른 화면의 공통 scheduleCompletion 경로와 책임이 겹친다.

### 재점검에서 제외하거나 정정한 항목

- 자동 저장의 진행/성공 문구는 현재 제품 렌더 경로에서 추가로 찾지 못했다. 과거 번역 키나 명시적 작업의 처리 중 상태만으로 같은 문제라고 판정하지 않는다.
- Today의 체크 옆 ‘완료’ 문구는 최근 작업에서 제거되어 이전 지적을 그대로 유지하지 않는다. 완료 수와 전체 진행 요약의 정보량은 별도 검토 대상이다.
- 초기화의 삭제 범위·권한·실패 안내, 저장 직렬화·취소·초안 보존·transaction은 필요한 기능이다. 설명 또는 코드가 길다는 이유만으로 제거 대상으로 삼지 않는다.
- 도메인 컴포넌트가 레퍼런스에 직접 import되지 않았다는 사실만으로 독자 디자인이라고 판정하지 않는다. 위 TaskNameInput은 실제 상태·배치 계약 차이를 근거로 삼았다.

## 문서

STATUS·CODE_MAP·CHANGES, DESIGN_SYSTEM과 관련 최신 변경 기록을 기준으로 대조했다. 기준 컴포넌트는 DetailKindInput·DropdownSelect·MenuSurface/MenuOption이며 실제 레퍼런스의 선택/탐색 상태를 확인했다. 제품 요구·구현·경로를 바꾸지 않았으므로 SPEC·STATUS·CODE_MAP·DESIGN_SYSTEM은 수정하지 않았다. CHANGES에 이번 감사 기록을 연결한다.

## 검증

- 기록 추가 직전 `npm run check:changes`: 273개 변경 파일 기록 통과. 기존 변경을 이번 감사에서 구현한 것으로 기록하지 않았다.
- Chrome의 `http://localhost:15173/#/today`: 검색에 일치하지 않는 문자열을 입력해 빈 결과 중복을 확인하고 설정의 알림 안내를 확인했다. 데이터 저장·설정 변경은 실행하지 않았다.
- `http://localhost:15173/design-reference.html#disclosure-reference`: DetailKindInput에서 확정값과 방향키 탐색 outline의 분리를 확인했다. 설정 화면과 레퍼런스 탭을 유지했다.
- 나머지 항목은 호출자·번역 키·렌더 분기·공통 구현을 읽은 정적 점검이다. 모바일·모션 축소·TaskNameInput의 화면 경계/긴 목록은 이번에 실행 검증하지 않았다.
- 실행 코드 변경이 없어 테스트·빌드는 재실행하지 않는다. 문서 기록 명령과 check:docs 결과는 최종 응답에서 보고한다.
