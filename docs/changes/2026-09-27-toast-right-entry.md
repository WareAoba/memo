# 토스트 오른쪽 화면 밖 진입

## 변경

- 사용자 정정에 따라 직전 작업의 왼쪽 48px 진입만 변경했다. toast-arrive는 토스트 너비+64px+오른쪽 안전 영역만큼 오른쪽 바깥에서 시작한다. 우하단 최종 위치·그림자 여백·460ms 공통 모션·축소 선호는 유지한다.
- ToastRegion의 가로 overflow를 hidden으로 지정해 이동하는 토스트 때문에 가로 스크롤바가 생기지 않게 했다. 기존 세로 알림 스크롤은 유지한다. 다른 미커밋 작업은 보존했다.

## 문서

- SPEC 알림 절과 DESIGN_SYSTEM 토스트 기준을 정정하고 CHANGES에 연결했다. 이전 작업 기록은 당시 이력이므로 보존했다. 기능 범위·파일 위치는 같아 STATUS·CODE_MAP은 수정하지 않았다.
- 지정 레퍼런스 /design-reference.html의 리마인드와 토스트, 실제 Toast.tsx·toast.css·레퍼런스 호출자를 편집 전에 확인했다.

## 검증

- npm run check:frontend 통과: 포맷·lint·디자인/구조·61개 파일 344개 테스트·TypeScript·빌드. 기존 500kB 번들 경고만 남는다. 모션 축소·끄기의 기존 CSS 경로는 유지했다. 동영상 프레임별 검증과 실제 터치 기기는 미검증이다.

- 레퍼런스 토스트 표시 후 가로 overflow:hidden과 390px 뷰포트 내 최종 위치(오른쪽 약 365px)를 확인했다. 시작 위치는 너비 기반 CSS로 화면 밖임을 확인했으며 중간 모션의 프레임별 시각 검증은 하지 않았다. git diff --check 및 최종 npm run check:docs 통과.
