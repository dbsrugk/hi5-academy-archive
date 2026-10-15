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
- DB: `docs(collection, id, data jsonb)`. 컬렉션: events, marketing, meetings, promotions, productionRequests, productionSchedules, productionPriority, compliance*, nationalNews, **inbox** 등.
- 정적 이미지: `public/marketing/*.webp`, `public/events/...` → 로그인 안 하면 `middleware.js`가 막음. 갤러리 이미지는 `./marketing/파일.webp` 형식으로 data에 넣음.

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
| 알림 센터(kind: inbox 등) | `notification-center.tsx` |
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

## 7. 최근 변경 기록 (최신이 위)
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
