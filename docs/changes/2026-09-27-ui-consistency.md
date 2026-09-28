# UI 일관성과 레퍼런스 의무화

## 변경

- 기존 트랙·메뉴·스티커·모션 작업을 보존하고 트랙 변경 DropdownSelect의 화살표를 DisclosureIcon으로 공유했다. native summary(사진·워크 상세·시간·도움말)와 사이드바도 동일 SVG/회전으로 통합했다. 모바일 시간의 +/−와 버튼 전체 회전을 제거했다.
- 고정/입력형 메뉴가 같은 선택 상태와 키보드 탐색 outline을 사용한다. 드롭다운·메뉴·폼·모달·페이지의 기준 구현을 DESIGN_SYSTEM에 명시했다.
- AGENTS에 시각 UI 작업 전 레퍼런스 확인/재사용과 기록을 의무화하고 훅에 DESIGN_SYSTEM을 전달한다. ESLint로 직접 summary 작성을 막는다.
- 참조: TrackSelector → DropdownSelect, MenuSurface/MenuOption, PresetModal. 레퍼런스 위치: /design-reference.html#disclosure-reference. 백엔드·실제 데이터는 변경하지 않았다.

## 문서

- AGENTS, DESIGN_SYSTEM, SPEC, STATUS, CODE_MAP, AGENT_HARNESS, CHANGES를 갱신했다.

## 검증

- 최종 npm run check:frontend 통과: 포맷, ESLint·디자인·구조 검사, 60개 파일 330개 테스트, TypeScript·Vite 빌드. 기존 500kB 초과 chunk 경고는 남아 있다.
- npm run check:docs 및 git diff --check 통과. ESLint의 메모리 fixture로 직접 summary 차단·DisclosureSummary 허용을 확인했다.
- 실제 브라우저 /design-reference.html에서 아래/위 SVG 동일 경로, 0°/180°, rotate 0.46s cubic-bezier(0.22,1,0.36,1)을 확인했다. 클릭·Enter 본문 펼침, 드롭다운 방향키/Enter 선택과 Escape 닫기를 확인했다. 390px 뷰포트에서 가로 넘침 없음(scrollWidth 381px).
- 브라우저 시각 검증은 레퍼런스의 기본 테마와 데스크톱·모바일 폭에서 수행했다. 모든 실제 화면의 테마/OS 모션 축소 조합과 실제 터치 기기는 미검증이다. 모션 축소는 기존 preferences CSS 및 prefers-reduced-motion 분기를 보존했다. 백엔드는 변경하지 않아 재검사하지 않았다.
- 훅 컨텍스트 전달은 저장소 설정으로 추가했다. 현재 세션의 훅 활성화 또는 원격 필수 검사 설정을 변경한 것은 아니다. 정적 게이트는 지원하는 패턴 위반을 차단하며 모든 디자인 판단을 증명하지 않는다.
