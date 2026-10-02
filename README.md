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

## 권한
- **본사 관리자 인증키**: 모든 기록 등록·수정·삭제, 공개 전환, 일정 관리, 제작실 기금 열람
- **직원 인증키**: 공개된 기록 열람, 홍보 기록·제작 요청·이수증 새로 등록(초안으로 저장)
- 인증키·기금 비밀번호는 코드에 없고, Supabase `app_config`에 SHA-256 해시로만 저장됩니다.

## 로컬 실행
```bash
npm install
npm run dev
```
`.env.production`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 사용합니다(공개용 키).

## 인증키 변경
Supabase SQL 편집기에서 새 키의 SHA-256 해시로 `app_config`의 `staff_key_hash` / `admin_key_hash` / `fund_password_hash` 값을 바꾸면 됩니다.
