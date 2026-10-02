"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { LoaderCircle, LogIn, UserPlus } from "lucide-react";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampusDot } from "@/lib/campus";

export const CAMPUSES = ["센텀", "김해", "명지"] as const;
export const TITLES = ["원장", "전임", "행정"] as const;
type Role = "staff" | "admin";

function NativeSelect({ id, name, options, placeholder = "선택" }: { id: string; name: string; options: readonly string[]; placeholder?: string }) {
  return (
    <select id={id} name={name} required defaultValue="" className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <option value="" disabled>{placeholder}</option>
      {options.map((value) => <option key={value} value={value}>{value}</option>)}
    </select>
  );
}

export function LoginGate({ onLogin }: { onLogin: (role: Role) => void }) {
  const [tab, setTab] = useState<"login" | "apply">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(null);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campus: form.get("campus"), name: String(form.get("name") ?? "").trim(), pin: form.get("pin") }) });
      const data = await response.json() as { role?: Role; me?: { name: string }; error?: string };
      if (!response.ok || !data.role) { setMessage({ text: data.error ?? "로그인하지 못했어요." }); return; }
      toast.success(`${data.me?.name ?? ""}님, 환영합니다.`);
      onLogin(data.role);
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
      const response = await fetch("/api/auth/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campus: form.get("campus"), title: form.get("title"), name: String(form.get("name") ?? "").trim(), pin, agree: true }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) { setMessage({ text: data.error ?? "신청하지 못했어요." }); return; }
      formElement.reset();
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
            <div className="grid grid-cols-2 rounded-full border border-border p-1" role="tablist">
              {(["login", "apply"] as const).map((key) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setMessage(null); }} className={`h-10 rounded-full text-sm font-semibold transition ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{key === "login" ? "로그인" : "가입 신청"}</button>)}
            </div>

            {tab === "login" ? (
              <form className="mt-6 space-y-4" onSubmit={login} autoComplete="on">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="login-campus">캠퍼스</Label><NativeSelect id="login-campus" name="campus" options={CAMPUSES} /></div>
                  <div className="space-y-2"><Label htmlFor="login-name">이름</Label><Input id="login-name" name="name" required maxLength={20} autoComplete="name" className="h-12 rounded-xl" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="login-pin">비밀번호 (숫자 4자리)</Label><Input id="login-pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="current-password" className="h-12 rounded-xl tracking-[0.4em]" /></div>
                <Button className="h-12 w-full rounded-xl text-base" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}로그인</Button>
              </form>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={apply}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="apply-campus">캠퍼스</Label><NativeSelect id="apply-campus" name="campus" options={CAMPUSES} /></div>
                  <div className="space-y-2"><Label htmlFor="apply-title">직책</Label><NativeSelect id="apply-title" name="title" options={TITLES} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="apply-name">이름</Label><Input id="apply-name" name="name" required maxLength={20} placeholder="실명으로 입력해 주세요" className="h-12 rounded-xl" /></div>
                <div className="space-y-2"><Label htmlFor="apply-pin">비밀번호 (숫자 4자리)</Label><Input id="apply-pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="new-password" className="h-12 rounded-xl tracking-[0.4em]" /><p className="text-xs text-muted-foreground">로그인할 때 캠퍼스 · 이름 · 비밀번호를 사용합니다.</p></div>
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
