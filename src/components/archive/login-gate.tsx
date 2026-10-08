"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { ExternalLink, Fingerprint, LoaderCircle, LogIn, UserPlus } from "lucide-react";
import { toast, Toaster } from "sonner";

import { inAppBrowser, openExternalBrowser, passkeyApi } from "@/archive-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampusDot } from "@/lib/campus";

export const CAMPUSES = ["센텀", "김해", "명지"] as const;
export const TITLES = ["원장", "전임", "행정", "이사", "제작실장"] as const;
const ALL_CAMPUS = "전체"; // 이사는 캠퍼스 소속 없음
type Role = "staff" | "admin";

function NativeSelect({ id, name, options, placeholder = "선택", labels = {}, value, onChange, disabled }: { id: string; name: string; options: readonly string[]; placeholder?: string; labels?: Record<string, string>; value?: string; onChange?: (value: string) => void; disabled?: boolean }) {
  return (
    <select id={id} name={name} required={!disabled} disabled={disabled} {...(value !== undefined ? { value } : { defaultValue: "" })} onChange={(event) => onChange?.(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-muted disabled:text-muted-foreground">
      <option value="" disabled>{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}
    </select>
  );
}

export function LoginGate({ onLogin }: { onLogin: (role: Role) => void }) {
  const [tab, setTab] = useState<"login" | "apply">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(null);
  const [applyTitle, setApplyTitle] = useState("");
  const director = applyTitle === "이사";
  const [canPasskey, setCanPasskey] = useState(false);
  const [offer, setOffer] = useState<{ role: Role; name: string } | null>(null);
  const [inApp, setInApp] = useState<string | null>(null);
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
  useEffect(() => {
    setCanPasskey(passkeyApi.supported());
    setInApp(inAppBrowser());
    try { const reason = sessionStorage.getItem("hi5-logout-reason"); if (reason) { sessionStorage.removeItem("hi5-logout-reason"); setMessage({ text: reason }); } } catch { /* 무시 */ }
  }, []);
  const SKIP = "hi5-passkey-skip";
  const skipped = () => { try { return localStorage.getItem(SKIP) === "1"; } catch { return false; } };

  function done(role: Role, name: string, fromPassword: boolean) {
    toast.success(`${name}님, 환영합니다.`);
    // 비밀번호로 들어왔고 이 기기에 지문이 없으면 한 번 제안 (PC는 '나중에'가 기본)
    if (fromPassword && canPasskey && !passkeyApi.onThisDevice() && !skipped()) { setOffer({ role, name }); return; }
    onLogin(role);
  }
  async function fingerprintLogin() {
    setBusy(true); setMessage(null);
    try { const { role, me } = await passkeyApi.login(); done(role, me.name, false); }
    catch (error) {
      const e = error as Error;
      passkeyApi.report("login", e);
      setMessage({ text: e.name === "NotAllowedError" ? "지문 확인이 취소됐거나 시간이 지났어요. 다시 누르거나 비밀번호로 로그인해 주세요." : e.name === "SecurityError" ? "이 화면에서는 지문을 쓸 수 없어요. 사파리나 크롬에서 열어 주세요." : e.message || "지문으로 로그인하지 못했어요." });
      if (/등록되지 않은/.test(e.message)) passkeyApi.forgetDevice();
    } finally { setBusy(false); }
  }
  async function registerNow() {
    if (!offer) return;
    setBusy(true);
    try { await passkeyApi.register(); toast.success("등록 완료! 다음부터 지문으로 바로 들어와요 👆"); onLogin(offer.role); }
    catch (error) { const e = error as Error; passkeyApi.report("register", e); toast.error(e.name === "NotAllowedError" ? "등록을 취소했어요. '내 정보'에서 언제든 켤 수 있어요." : e.message || "등록하지 못했어요."); onLogin(offer.role); }
    finally { setBusy(false); }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campus: form.get("campus"), name: String(form.get("name") ?? "").trim(), pin: form.get("pin") }) });
      const data = await response.json() as { role?: Role; me?: { name: string }; error?: string };
      if (!response.ok || !data.role) { setMessage({ text: data.error ?? "로그인하지 못했어요." }); return; }
      done(data.role, data.me?.name ?? "", true);
    } catch { setMessage({ text: "연결에 실패했어요. 잠시 후 다시 시도해 주세요." }); }
    finally { setBusy(false); }
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const pin = String(form.get("pin") ?? "");
    if (!/^[0-9]{4}$/.test(pin)) { setMessage({ text: "비밀번호는 숫자 4자리로 입력해 주세요." }); return; }
    if (form.get("agree") !== "on") { setMessage({ text: "보안서약에 동의해 주세요." }); return; }
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/auth/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campus: director ? ALL_CAMPUS : form.get("campus"), title: form.get("title"), name: String(form.get("name") ?? "").trim(), pin, agree: true, email: String(form.get("email") ?? "").trim() }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) { setMessage({ text: data.error ?? "신청하지 못했어요." }); return; }
      formElement.reset(); setApplyTitle("");
      setMessage({ text: "가입 신청이 접수됐어요. 관리자 승인 후 로그인할 수 있어요.", ok: true });
    } catch { setMessage({ text: "연결에 실패했어요. 잠시 후 다시 시도해 주세요." }); }
    finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--archive-canvas)] p-4 sm:p-6">
      <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-16">
        <section className="hidden lg:block">
          <div className="grid h-16 w-24 place-items-center rounded-xl bg-white p-1.5 ring-1 ring-border/60"><Image src="./hi5-logo.webp" alt="Hi5" width={128} height={78} className="h-full w-full object-contain" priority /></div>
          <p className="mt-8 text-sm font-semibold tracking-[0.2em] text-brand">STAFF ARCHIVE</p>
          <h1 className="mt-3 text-5xl font-bold leading-[1.1] tracking-tight">행정마케팅파트<br />학원 아카이브</h1>
          <p className="mt-5 max-w-md leading-7 text-muted-foreground">하이파이브미술학원 교직원 전용 아카이브입니다. 승인된 교직원만 열람할 수 있습니다.</p>
        </section>
        <Card className="w-full rounded-3xl border-border/70 py-0 shadow-[0_28px_80px_rgba(38,33,28,0.12)]">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="grid h-12 w-[72px] shrink-0 place-items-center rounded-xl bg-white p-1 ring-1 ring-border/60"><Image src="./hi5-logo.webp" alt="Hi5" width={104} height={64} className="h-full w-full object-contain" priority /></div>
              <div><p className="text-xs font-semibold text-brand">하이파이브미술학원</p><p className="text-lg font-bold">학원 아카이브</p></div>
            </div>
            {!offer && <div className="grid grid-cols-2 rounded-full border border-border p-1" role="tablist">
              {(["login", "apply"] as const).map((key) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setMessage(null); }} className={`h-10 rounded-full text-sm font-semibold transition ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{key === "login" ? "로그인" : "가입 신청"}</button>)}
            </div>}

            {offer ? (
              <div className="mt-6 space-y-4 text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"><Fingerprint className="size-9" /></div>
                <div><p className="text-lg font-bold">다음부터 지문으로 로그인할까요?</p><p className="mt-2 text-sm leading-6 text-muted-foreground">매번 비밀번호 대신 {isMobile ? "지문이나 얼굴 인식" : "윈도우 Hello·터치ID"}으로 1초 만에 들어와요.<br />지문 정보는 이 기기 밖으로 나가지 않아요.{!isMobile && <><br /><b>PC는 선택이에요.</b> 지문 센서가 없으면 '나중에'를 눌러 주세요.</>}</p></div>
                <Button className="h-12 w-full rounded-xl text-base" disabled={busy} onClick={registerNow}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}이 기기에 지문 등록하기</Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={() => onLogin(offer.role)}>나중에</Button>
                  <Button variant="ghost" className="h-11 rounded-xl text-muted-foreground" disabled={busy} onClick={() => { try { localStorage.setItem(SKIP, "1"); } catch { /* 무시 */ } onLogin(offer.role); }}>이 기기는 묻지 않기</Button>
                </div>
              </div>
            ) : tab === "login" ? (
              <>
              {inApp && <div className="mt-6 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <p className="flex items-center gap-1.5 font-semibold"><Fingerprint className="size-4" />{inApp} 안에서는 지문 로그인이 안 돼요</p>
                <p>사파리나 크롬에서 열면 지문으로 로그인할 수 있어요. 비밀번호 로그인은 여기서도 돼요.</p>
                <Button type="button" variant="outline" className="h-11 w-full rounded-xl bg-background" onClick={() => { if (!openExternalBrowser()) { void navigator.clipboard?.writeText(location.href.split("#")[0]).catch(() => undefined); setMessage({ text: "주소를 복사했어요. 화면 오른쪽 아래(또는 위) ··· 메뉴에서 'Safari로 열기'를 누르거나, 사파리에 붙여넣어 주세요.", ok: true }); } }}><ExternalLink className="size-4" />사파리·크롬으로 열기</Button>
              </div>}
              {canPasskey && <div className="mt-6 space-y-3">
                <Button type="button" variant={passkeyApi.onThisDevice() ? "default" : "outline"} className="h-12 w-full rounded-xl text-base" disabled={busy} onClick={fingerprintLogin}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Fingerprint className="size-5" />}지문으로 로그인</Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />또는 비밀번호로<span className="h-px flex-1 bg-border" /></div>
              </div>}
              <form className={canPasskey ? "mt-3 space-y-4" : "mt-6 space-y-4"} onSubmit={login} autoComplete="on">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="login-campus">캠퍼스</Label><NativeSelect id="login-campus" name="campus" options={[...CAMPUSES, ALL_CAMPUS]} labels={{ [ALL_CAMPUS]: "이사 (캠퍼스 없음)" }} /></div>
                  <div className="space-y-2"><Label htmlFor="login-name">이름</Label><Input id="login-name" name="name" required maxLength={20} autoComplete="name" className="h-12 rounded-xl" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="login-pin">비밀번호 (숫자 4자리)</Label><Input id="login-pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="current-password" className="h-12 rounded-xl tracking-[0.4em]" /></div>
                <Button variant={canPasskey && passkeyApi.onThisDevice() ? "outline" : "default"} className="h-12 w-full rounded-xl text-base" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}로그인</Button>
                <p className="text-center text-xs text-muted-foreground">보안을 위해 창을 닫거나 30분 동안 사용하지 않으면 다시 로그인해야 해요.</p>
              </form>
              </>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={apply}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="apply-title">직책</Label><NativeSelect id="apply-title" name="title" options={TITLES} value={applyTitle} onChange={setApplyTitle} /></div>
                  <div className="space-y-2"><Label htmlFor="apply-campus">캠퍼스</Label>{director ? <div className="flex h-12 items-center rounded-xl border border-dashed bg-muted/50 px-3 text-sm text-muted-foreground">캠퍼스 없음 (전체)</div> : <NativeSelect id="apply-campus" name="campus" options={CAMPUSES} />}</div>
                </div>
                <div className="space-y-2"><Label htmlFor="apply-name">이름</Label><Input id="apply-name" name="name" required maxLength={20} placeholder="실명으로 입력해 주세요" className="h-12 rounded-xl" /></div>
                <div className="space-y-2"><Label htmlFor="apply-pin">비밀번호 (숫자 4자리)</Label><Input id="apply-pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="new-password" className="h-12 rounded-xl tracking-[0.4em]" /><p className="text-xs text-muted-foreground">로그인할 때 캠퍼스 · 이름 · 비밀번호를 사용합니다.{director && <> 이사는 캠퍼스에서 <b>이사 (캠퍼스 없음)</b>을 고르면 됩니다.</>}</p></div>
                <div className="space-y-2"><Label htmlFor="apply-email">메일 주소 <span className="font-normal text-muted-foreground">(선택)</span></Label><Input id="apply-email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={120} placeholder="예) hong@gmail.com" className="h-12 rounded-xl" /><p className="text-xs text-muted-foreground">적어 두면 승인 후 제작 요청·승인 소식을 메일로도 받아요. 나중에 '내 정보'에서 바꿀 수 있어요.</p></div>
                <div className="max-h-56 overflow-y-auto rounded-xl border bg-muted/40 p-4 text-[13px] leading-6 text-muted-foreground" tabIndex={0}>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">학원 아카이브 보안서약</h3>
                  <ol className="list-decimal space-y-1.5 pl-4">
                    <li>본 사이트의 행사 기록, 홍보 실적, 제작물, 회의록, 학생 작품 이미지 등 모든 자료는 <b className="text-foreground">하이파이브 미술학원의 내부 자산</b>이며, 열람 권한은 승인된 교직원 본인에게만 부여됩니다.</li>
                    <li>자료를 캡처·촬영·다운로드하여 <b className="text-foreground">외부(SNS, 타 학원, 개인 수업, 메신저 등)로 유출하거나</b>, 계정을 타인과 공유하지 않겠습니다.</li>
                    <li>모든 접속과 열람 기록은 저장되며, 유출 발생 시 확인 자료로 사용될 수 있음에 동의합니다.</li>
                    <li>위반 시 계정이 즉시 정지되며, <b className="text-foreground">저작권법·부정경쟁방지법 등 관련 법령에 따른 민·형사상 책임과 손해배상 책임</b>을 질 수 있음을 확인합니다.</li>
                    <li>퇴사 후에도 본 서약의 비밀유지 의무는 유지됩니다.</li>
                  </ol>
                </div>
                <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" name="agree" className="mt-0.5 size-4 accent-[var(--brand)]" /><span>위 보안서약을 읽었으며 이에 동의합니다. <span className="text-xs text-muted-foreground">(동의 일시가 기록됩니다)</span></span></label>
                <Button className="h-12 w-full rounded-xl text-base" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}가입 신청</Button>
              </form>
            )}
            {message && <p role="status" className={`mt-4 text-sm ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>{message.text}</p>}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">{CAMPUSES.map((campus) => <span key={campus} className="inline-flex items-center gap-1.5"><CampusDot branch={campus} />{campus}캠퍼스</span>)}</div>
          </CardContent>
        </Card>
      </div>
      <Toaster richColors position="top-center" />
    </main>
  );
}
