# 학원 아카이브 — 작업 인수인계 노트 (Claude용)

> 이 사이트를 고치는 Claude는 작업 시작 전에 이 파일을 읽고, 작업이 끝나면 **"최근 변경 기록"과 바뀐 구조를 갱신**한다.
> 기본 구성·권한 설명은 `README.md` 참고. 여기에는 README에 없는 운영 규칙·최신 구조만 적는다.

## 0. 꼭 지킬 것
- **저장소는 공개(PUBLIC)** — 비밀키·토큰·비밀번호·Apps Script 비밀값을 절대 커밋하지 않는다. (`tools/mail-relay.gs`의 SECRET은 자리표시자 그대로)
- 사용자: 윤경학 부원장(관리자). **한국어**, 친근한 남자 선생님 말투, 예시 위주.
  - 작업 전에 방향을 질문으로 확인. 선택지에는 ⭐/(추천) 표시. "ㄱㄱ" = 추천안으로 진행.
  - 작업이 끝나면 마지막에 👉 https://hi5-academy-archive.vercel.app 링크.
- 커밋 전 항상 `git pull --rebase` (다른 대화방이 push했을 수 있음). push가 500이면 재시도.
- `main`에 push하면 Vercel이 자동 배포. **서버(edge function) 배포가 필요한 화면 변경은 서버 먼저 배포하고 나서 push** (안 그러면 운영 사이트가 깨짐).
- `pkill -f` 쓰지 말 것.

## 1. 구조 요약
- 화면: Vite + React 19 + Tailwind 4 + shadcn. `src/archive-api.ts`가 `/api/*` fetch를 가로채 edge function `call(path, body)`로 보냄.
- 서버: Supabase 프로젝트 `xflelzgpwgavtwixiolg`(무료 플랜), edge function **`archive-api` (현재 v16, verify_jwt=false)**.
  - 배포: `mcp__Supabase__deploy_edge_function`에 `supabase/functions/archive-api/index.ts` **전체 내용**을 넣어 배포. 저장소 파일 = 배포본이 되도록 유지.
- 서버 함수 **`archive-notes`**(v1, verify_jwt=false): 「노트 제작」 전용. archive-api와 같은 토큰(`x-archive-token`)·회원 확인을 쓰고 `docs`의 `noteBooks`·`noteComments`·`noteImages`만 다룬다. archive-api를 건드리지 않으려고 따로 둠(6만 자 통째 재배포 위험 회피). 배포 방법은 위와 같고 파일은 `supabase/functions/archive-notes/index.ts`.
- DB: `docs(collection, id, data jsonb)`. 컬렉션: events, marketing, meetings, promotions, productionRequests, productionSchedules, productionPriority, compliance*, nationalNews, **inbox** 등.
- 정적 이미지: `public/marketing/*.webp`(미리보기) + `public/marketing/orig/…`(다운로드용 원본, 갤러리 항목의 `original`), `public/events/...` → 로그인 안 하면 `middleware.js`가 막음. 갤러리 이미지는 `./marketing/파일.webp` 형식으로 data에 넣음.

## 2. 권한 (서버 기준)
- `TITLES` = 원장·전임·행정·이사·**제작실장** (DB 제약 `members_title_check`도 제작실장 허용).
- **제작실장**(`isProducer`) = 제작 컬렉션(`PROD_COLLECTIONS`)에서 관리자와 같은 권한 + 제작실 기금 열람.
- `canFund` = 원장 또는 제작실장. 기금은 PIN 재입력 잠금: 서버 토큰 HMAC 30분, 화면은 10분 미사용 시 잠금(`x-fund-token` 헤더는 기금 호출에만).
- `ownPending`: 요청자는 승인 대기(approval_pending) 상태인 **자기 제작 요청**만 수정·삭제 가능. 자료함은 올린 사람이 자기 묶음 수정·삭제 가능.

## 3. 주요 기능 위치
| 기능 | 파일 |
| --- | --- |
| 제작 요청·달력(직접 수정/추가/삭제, 완료 건은 달력에서 숨김)·공동 캠퍼스·진행 이미지·완료 처리(→ 마케팅 제작물 + 드라이브)·주간 운영표 | `src/components/archive/production-requests-section.tsx` |
| 홍보(부산/김포/전체 탭, 캠퍼스 8개) | `promotions-section.tsx` |
| 제작실 기금(PIN 잠금) | `fund-section.tsx` |
| **자료함**(카톡형 대화창 업로드함) | `inbox-section.tsx` |
| 알림 센터(kind: inbox·notes 등) | `notification-center.tsx` |
| **노트 제작**(노트 목록 → 편집기 iframe, 코멘트·구성 공유) | `notes-section.tsx`(목록·iframe·서버 중계) + `public/notes/editor.html`(편집기 본체) + `archive-api.ts`의 `notesApi` + 서버 `archive-notes` |
| 메뉴·배지·섹션 배치 | `src/app/page.tsx` |
| 패스키(인앱 브라우저는 제외·외부 브라우저 안내) | `src/archive-api.ts`, `login-gate.tsx` |

## 4. 자료함 ↔ 구글 드라이브
- 파일은 사이트 저장소를 **거치지 않고** 브라우저 → 사용자 구글 드라이브로 직접 올라감(용량 제한 사실상 없음, 1파일 10GB까지 허용). 채팅에는 기록·드라이브 링크만 남음.
- 흐름: 화면 `inboxApi.upload` → 서버 `drive/start` → Apps Script(`action: "upload-start"`)가 폴더 `학원 아카이브 자료함/YYYY-MM/MMDD HHMM 캠퍼스 이름` 생성 후 Drive resumable 세션 URL 반환 → 브라우저가 XHR PUT으로 업로드(3개 동시).
- Apps Script 중계: 코드 원본 `tools/mail-relay.gs`. 주소는 DB `app_config.mail_relay_url`, 비밀값은 DB에만. 처리: 메일 발송 / `drive`(제작 완료 이미지 저장) / `upload-start`. 현재 배포 버전 2.
  - 수정하려면 사용자 크롬에서 script.google.com 편집 → **배포 관리 → 새 버전**으로 배포해야 반영.
- inbox 문서 필드: title, memo, files[{driveId,name,size,type,url}], folderUrl, uploader, campus, createdAt, status(new|done), checkedAt/checkedBy/reaction, doneNote/doneAt/fileNames, proposedAt.
- 공유: 「학원 아카이브 자료함」 최상위 폴더 = **링크가 있는 사람 보기**(2026-10-14 설정, 하위 폴더·파일 상속). 업로드는 사이트가 소유자 계정으로 대신 하므로 보기 권한과 무관.
- 드라이브는 100MB 넘는 zip·.ai를 미리보기 못 함 → 크롬으로 PC 다운로드 폴더에 받아 PC 셸에서 열기(.ai는 PDF 호환이라 `pdftoppm -r 72 -f N -l N`으로 대지별 렌더, 1장씩 끊어서).

## 5. 예약 작업
- **"자료함 확인·정리 제안"** (매일 08:47·17:47 KST, 푸시 알림): status≠done인 자료함 묶음을 살펴 어디에 둘지 제안 → 사용자가 "응/ㄱㄱ" 하면 등록·정리 완료 처리. 드라이브 원본은 절대 삭제하지 않음.

## 6. 테스트 방법
- `npm run build` 후 `python3 -m http.server 4177 -d dist` + Playwright(`executablePath: /opt/pw-browsers/chromium`), 로그인 토큰은 sessionStorage `hi5-archive-token`.
- 타입 검사: 기존 오류(next/image, promotions 데모 타입)는 원래 있던 것.
- 테스트 계정을 만들었으면 끝나고 정지/삭제. 테스트 데이터·드라이브 테스트 폴더도 정리.

## 6-1. 노트 제작 (2026-10-21 추가)
- 메뉴 「노트 제작」(`#notes`) → 노트 목록 → 노트를 열면 `public/notes/editor.html?book=<id>`가 iframe으로 열린다. 편집기는 한 파일짜리 순수 HTML/JS이고, 저장·로그인 확인은 **부모 화면이 대신**한다: iframe이 `postMessage`로 `{t:"note-rpc", op, args}`를 보내면 `notes-section.tsx`가 `notesApi`로 서버(`archive-notes`)에 전달하고 `{t:"note-rpc-res"}`로 돌려준다. 편집기 안에서는 `window.claude.use("db"|"user")` 모양의 어댑터(파일 앞쪽 `<script>`)가 이를 감싼다(원래 Claude 아티팩트 시안 코드를 그대로 쓰기 위해). 다른 사람의 코멘트·공유는 6초마다 다시 읽어 반영(실시간 아님).
- 저장 위치(docs): `noteBooks`(`<노트>:main`=공유 구성, `<노트>:h:<id>`=이전 공유본 최근 20개) · `noteComments`(`<노트>:n:`=포스트잇·`:r:`=답글·`:s:`=스티커) · `noteImages`(`<노트>:<id>`=직원이 올려 공유한 이미지, 한 번 올리면 바뀌지 않음, 256KiB 이하 JPEG).
- 권한(서버): 로그인한 승인 회원 전원이 읽기·작성·구성 공유 가능. 남의 코멘트는 '반영 완료' 표시만 바꿀 수 있고 지우기는 본인·관리자·제작실장만. 공유 구성(`:main`)·공유 이미지 삭제는 관리자·제작실장만. 작성자는 서버가 `createdById/Name/Campus`로 기록(화면 값은 믿지 않음).
- 모바일(좁은 화면 ≤760px 또는 가로로 돌린 폰): `editor.html`의 `body.mob` 규칙이 처리. 아래 4칸 메뉴(편집·최종본·코멘트·더보기), 편집은 한 쪽씩 보기(`#pview`)+두 줄 모아보기(`#ovm`), 이미지 서랍은 아래 창, 펼친 최종본은 세로·가로 모두 기존 3D 펼침(부채 넘김 포함). 데스크톱 화면은 그대로.
- 크게 보기: ① 전체보기 카드의 「🔍 크게」(또는 그림 누르기) → 큰 보기 창(‹ ›·밀기·Esc·아무 곳이나 한 번 더 누르면 닫힘) ② 최종본 펼침의 「⛶ 크게」→ 전체 화면(탭하면 닫힘, 넘기기는 끌기·←→ 키)(부모 iframe에 `allow="fullscreen"` 필요). 세로 폰은 화면을 90° 돌려 노트를 크게 쓰고(`body.big.rot`, 끌기 좌표 `GX/GY`로 변환), 가로 폰·데스크톱은 전체 화면.
- 스프링(링) 표현은 제거함(제본이 스프링이 아님). 최종본 펼침은 두 손가락 벌리기(PC는 Ctrl+휠)로 최대 4배 확대, 확대 중에도 한 손가락 끌기는 페이지 넘기기·두 손가락은 이동, 두 번 탭하면 원래대로(닫힌 3D 노트 표지도 동일하되, 확대 중에도 한 손가락은 노트 돌리기·두 손가락은 이동).
- 알림(kind `notes`): 새 코멘트·구성 공유 → 관리자+제작실장, 내 코멘트에 답글·반영 완료 → 작성자. 알림 센터에 「노트 제작」 분류.
- 이미지: `public/notes/<노트>/pNN.jpg`(로그인해야 보임 — `middleware.js` matcher에 `/notes/:path*`). **저장소가 공개라서 올리는 이미지는 광고용 시안뿐**이어야 한다.
- 새 노트 추가: ① `notes-section.tsx`의 `BOOKS`에 항목 ② `public/notes/editor.html`의 `BOOKS`에 같은 id(제목·이미지 목록·기본 구성 `spring`) ③ 이미지를 `public/notes/<id>/`에. 이미지는 가로 1100px 안팎 JPEG로 줄여서(1장 200~350KB).
- 페이지 비율은 편집기 ⚙설정의 「페이지 크기」(A4 .7048 / 봄노트 .7575 / 3:4)이고 구성에 함께 저장된다.
- 첫 노트: `spring-mid` = 2026 봄노트 센텀 중고등(표지 2·속지 18·백지 18쪽, 단면). 순서는 원본 폴더의 '업로드용' 펼침면 기준.
- **마케팅 제작물 불러오기**(서랍 왼쪽 「🗂 마케팅 제작물 불러오기」): 부모 화면이 `/api/marketing?limit=all`을 읽어 `{t:"note-rpc", op:"marketing"}`로 목록을 준다(사진이 있는 제작물만). 고른 사진은 서랍의 지금 탭(표지/속지)에 들어간다. **사이트 안 사진(`./marketing/…`)은 경로만 저장**(`ref`, id `um…`, 공유할 때도 `noteImages`에 `{ref}`만 올라감 — `refOk`가 `/marketing/`·`/events/` 경로만 허용), **만료되는 저장소 주소 사진은 가져와서 줄여 직접 올린 이미지처럼 저장**(공유 시 256KiB 이하).
- 백지 묶음 위에서 넘기면(‹ ›·키보드·백지 클릭·**끌기**) 백지 쪽수만큼 종이가 부채처럼 넘어가는 효과(`riffle`)가 항상 재생된다. 내용 페이지는 어디서든 한 장씩(`blankSideOf`로 구분). 전에는 백지 묶음이 앞 속지와 바로 붙은 구성에서 조건에 안 걸려 사라졌었다(2026-10-21 수정).
- 뒤로가기: 사이트 안에서는 편집기가 기록을 따로 쌓지 않고(`EMBED`), `useBackClose`로 '노트 목록'으로만 돌아간다.

## 7. 최근 변경 기록 (최신이 위)
- 2026-10-21 노트 제작: 끌어서(스와이프) 넘길 때는 부채 효과가 빠져 있던 문제 수정 — 백지 묶음 위에서 끌면 놓을 때 부채처럼 넘어감, 백지 묶음에 안내 문구 추가.
- 2026-10-21 노트 제작: 펼친 최종본 노트가 안내 문구·서랍과 겹쳐 잘려 보이던 문제 수정(넓은 화면에서 노트 크기를 칸의 실제 크기 `cqh`로 맞추고 아래 종이 두께·그림자 자리를 남김).
- 2026-10-21 노트 제작: 「마케팅 제작물 불러오기」 추가(편집기 서랍 + `notes-section.tsx`의 `marketing` 중계), 백지 묶음 부채 넘기기 효과 복구, 사진이 날아가다 멈춘 잔상 방지.
- 2026-10-21 **노트 제작** 메뉴 추가(위 6-1). 서버 함수 `archive-notes` 신규 배포(v1, archive-api는 그대로), 화면 `notes-section.tsx`·`public/notes/editor.html`, 알림 kind `notes`, 미들웨어에 `/notes/` 보호. 봄노트 중고등 20장 등록.- 2026-10-16 마케팅 제작물 상세에 **캠퍼스별 한 번에 받기**(`src/components/archive/campus-download.tsx`, fflate로 브라우저에서 zip). 사진에 `original`(원본 경로)·`campus`가 있으면 원본으로, 없으면 미리보기로. 캠퍼스는 campus → 캡션/설명/파일명 속 캠퍼스명으로 판단, 2곳 이상일 때만 캠퍼스 버튼. 원본은 `public/marketing/orig/<slug>/NN.png`(middleware로 보호). 성신·동덕·경희(54장)·중부대(12장)를 3캠퍼스 전체+원본으로 교체, 한양·중앙 합격에 원본 연결.
- 2026-10-15 마케팅 제작물에 「2027 수시 중부대 출제문제 (만화애니메이션)」 4장 등록, 자료함 정리 완료.
- 2026-10-15 마케팅 제작물에 「2027 수시 성신·동덕·경희 출제문제」(zip 54장 중 김해판 9문제×2종 18장) · 「2027 한양대·중앙대 1차 합격 (김해) 시안」 2장 등록, 자료함 4묶음 정리 완료(중복 zip 1건 포함).
- 2026-10-15 마케팅 제작물에 「센텀 배너 2종 (하이파이브 디자인 · 애니하이 애니)」 등록(zip 안 JPG), 자료함 묶음 정리 완료.
- 2026-10-15 마케팅 제작물에 「센텀 판넬 3종 (대상 13관왕 · 디자인 정시반 · 청강대 준비반)」 등록(zip 안 JPG 사용), 자료함 묶음 정리 완료.
- 2026-10-15 마케팅 제작물에 「명지 비포·애프터 성장 판넬 (시안)」 9장 등록(원본 .ai는 PC에서 pdftoppm으로 대지별 렌더 → webp), 자료함 묶음 정리 완료 + 이상헌 원장 알림.
- 2026-10-14 운영표 날짜 예외에 '요청 어려움' 체크(`busy` 날짜 배열) → 달력·주간 띠·선택일·요청서에 ⛔ 빨간 안내. 10/16~11/7 금·토 '노트 작업'으로 입력.
- 2026-10-13 사진 휠 확대·오른쪽 클릭 다운로드(`src/lib/image-tools.ts`, 우클릭 저장 방지 해제·드래그 방지 유지), 제작 요청 레퍼런스 전체화면 보기.
- 2026-10-14 자료함 드라이브 폴더 '링크가 있는 사람 보기'로 공유(직원 액세스 요청 없이 열람).
- 2026-10-13 마케팅 제작물에 「김해·명지 학원 홍보 포스터 (DRAW YOUR DREAM)」 4장 등록, 자료함 묶음 정리 완료.
- 2026-10-13 자료함 추가(대화창 UI, 확인 👀 도장·반응·정리 완료, 드라이브 바로 올리기), Apps Script v2.
- 2026-10-13 제작실 주간 운영표(요일별 계획 + 날짜 예외) — 달력 태그·주간 띠·요청서 안내에 표시.
- 2026-10-12~13 제작실장 직책, 기금 PIN 잠금, 완료 처리 → 마케팅 제작물·드라이브, 달력 직접 편집, 공동 캠퍼스·진행 이미지, 진행 중 건수 통일, 홍보 부산/김포 탭, 패스키 인앱 브라우저 처리, 마케팅 참고자료 선택·읽음 표시.
- 2026-10-06 홍보 김포 캠퍼스(사우·장기·구래·검단) + 사진 237장, 마케팅 제작물 10월 휴원 안내·수원대 출제문제.
