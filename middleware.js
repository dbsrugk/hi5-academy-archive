// 로그인한 교직원만 샘플 사진·양식 파일에 접근할 수 있게 막는 관문 (Vercel Routing Middleware)
// 로그인 시 화면이 심는 ha_s 쿠키(서버 함수가 서명한 토큰)를 확인한다.
export const config = {
  matcher: ["/marketing/:path*", "/templates/:path*", "/((?!hi5-logo)[^/]+\\.webp)"],
};

const enc = new TextEncoder();
let KEY;
async function hmac(msg) {
  KEY = KEY || await crypto.subtle.importKey("raw", enc.encode(process.env.ARCHIVE_SIGNING_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", KEY, enc.encode(msg)));
  return Array.from(s).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function valid(token) {
  if (!token || token.indexOf(".") < 0 || !process.env.ARCHIVE_SIGNING_SECRET) return false;
  const [body, sig] = token.split(".");
  if ((await hmac(body)) !== sig) return false;
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(body.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
    return JSON.parse(json).exp > Date.now() / 1000;
  } catch { return false; }
}

export default async function middleware(request) {
  const match = (request.headers.get("cookie") || "").match(/(?:^|;\s*)ha_s=([^;]+)/);
  if (match && await valid(decodeURIComponent(match[1]))) return;
  return new Response("로그인이 필요합니다", { status: 401, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
