# 학원 아카이브 (하이파이브미술학원 행정마케팅파트)

이벤트·홍보·제작 요청·마케팅 제작물·회의록·연간 이수 관리·제작실 기금을 관리하는 직원용 사이트입니다.

## 구성

| 영역 | 내용 |
| --- | --- |
| 화면 | React 19 + Vite + Tailwind 4 (`src/`) |
| 서버 | Supabase Edge Function `archive-api` (`supabase/functions/archive-api/index.ts`) |
| DB | Supabase `docs` 테이블 (컬렉션/ID/JSON), `app_config` 테이블(인증키 해시 등) |
| 파일 | Supabase Storage 비공개 버킷 `archive-files` (서명 URL로만 접근) |
| 배포 | Vercel (GitHub `main` 브랜치에 push하면 자동 배포) |

## 로그인·권한 (교직원 회원제)
- **가입 신청**: 캠퍼스(센텀·김해·명지) · 직책(원장·전임·행정) · 실명 · 숫자 4자리 비밀번호 + 보안서약 동의
- **관리자 승인** 후 캠퍼스 · 이름 · 비밀번호로 로그인 (14일 유지, 5회 틀리면 10분 잠금)
- **관리자**(회원 관리에서 "관리자 지정"): 모든 기록 등록·수정·삭제, 공개 전환, 회원 승인·정지, 접속 기록 열람 (`#admin`)
- **교직원**: 공개된 기록 열람, 홍보 기록·제작 요청·이수증 새로 등록
- **제작실 기금**: 직책이 원장인 회원만 열람
- 보안: 워터마크(캠퍼스·이름·날짜), 이미지 우클릭·드래그 방지, 접속·열람 기록(IP 포함), 비로그인 시 샘플 사진 차단(`middleware.js`)
- 비밀번호는 회원별 솔트로 해시해 Supabase `members`에 저장, 기록은 `access_logs`

## 로컬 실행
```bash
npm install
npm run dev
```
`.env.production`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 사용합니다(공개용 키).

## 환경 변수 (Vercel)
- `ARCHIVE_SIGNING_SECRET`: 샘플 사진 관문(`middleware.js`)에서 로그인 토큰을 검증하는 값. Supabase `app_config.signing_secret`과 같아야 합니다.
