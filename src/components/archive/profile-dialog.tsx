"use client";

import { useEffect, useState } from "react";
import { Fingerprint, LoaderCircle, Mail, Send, X } from "lucide-react";
import { toast } from "sonner";

import { inAppBrowser, passkeyApi, profileApi, type Profile } from "@/archive-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Me = { name: string; title: string; campus: string };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// 내 정보: 메일 주소와 '메일로도 받기' 설정
export function ProfileDialog({ open, onOpenChange, me, isAdmin }: { open: boolean; onOpenChange: (open: boolean) => void; me: Me | null; isAdmin: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [emailOn, setEmailOn] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "test" | "pk">("");
  const [keys, setKeys] = useState<{ id: string; device: string | null; created_at: string; last_used_at: string | null }[] | null>(null);
  const loadKeys = () => passkeyApi.list().then((r) => setKeys(r.items)).catch(() => setKeys([]));
  async function addKey() {
    setBusy("pk");
    try { await passkeyApi.register(); toast.success("이 기기에 지문 로그인을 켰어요 👆"); await loadKeys(); }
    catch (error) { const e = error as Error; passkeyApi.report("register", e); toast.error(e.name === "NotAllowedError" ? "등록을 취소했어요." : e.message || "등록하지 못했어요."); }
    finally { setBusy(""); }
  }
  async function removeKey(id: string) {
    setBusy("pk");
    try { await passkeyApi.remove(id, (keys ?? []).length === 1); toast.success("지문 로그인을 지웠어요."); await loadKeys(); }
    catch { toast.error("지우지 못했어요."); } finally { setBusy(""); }
  }

  useEffect(() => {
    if (!open) return;
    setProfile(null); setKeys(null); void loadKeys();
    profileApi.get().then((p) => { setProfile(p); setEmail(p.email); setEmailOn(p.emailOn); }).catch(() => toast.error("내 정보를 불러오지 못했어요."));
  }, [open]);

  const trimmed = email.trim();
  const valid = !trimmed || EMAIL_RE.test(trimmed);
  const dirty = !!profile && (trimmed !== profile.email || (emailOn && !!trimmed) !== profile.emailOn);

  async function save() {
    if (!valid) { toast.error("메일 주소 형식을 확인해 주세요."); return; }
    setBusy("save");
    try {
      const p = await profileApi.save(trimmed, emailOn);
      if (p.ok === false) { toast.error(p.msg ?? "저장하지 못했어요."); return; }
      setProfile(p); setEmail(p.email); setEmailOn(p.emailOn);
      toast.success(p.emailOn ? "저장했어요. 이제 메일로도 알려드릴게요 📬" : "저장했어요.");
    } catch { toast.error("저장하지 못했어요."); } finally { setBusy(""); }
  }
  async function test() {
    setBusy("test");
    try {
      const r = await profileApi.testMail();
      if (r.ok) toast.success(`${profile?.email}로 확인 메일을 보냈어요. 1~2분 안에 도착해요. (안 보이면 스팸함도 확인!)`);
      else toast.error(r.msg ?? "메일을 보내지 못했어요.");
    } catch { toast.error("메일을 보내지 못했어요."); } finally { setBusy(""); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md rounded-2xl">
      <DialogHeader className="text-left">
        <DialogTitle>내 정보</DialogTitle>
        <DialogDescription>{me ? `${me.campus === "전체" ? "전체 캠퍼스" : `${me.campus}캠퍼스`} · ${me.name} ${me.title}${isAdmin ? " · 관리자" : ""}` : ""}</DialogDescription>
      </DialogHeader>

      {!profile ? <p className="py-8 text-center text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />불러오는 중…</p> : <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="profile-email">메일 주소</Label>
          <Input id="profile-email" type="email" inputMode="email" autoComplete="email" maxLength={120} value={email} onChange={(e) => { setEmail(e.target.value); if (!profile.email && e.target.value.trim()) setEmailOn(true); }} placeholder="예) hong@gmail.com" className="h-12 rounded-xl" aria-invalid={!valid} />
          {!valid && <p className="text-xs text-rose-600">메일 주소 형식을 확인해 주세요.</p>}
        </div>

        <label className="flex items-start justify-between gap-4 rounded-xl border p-4">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold"><Mail className="size-4" />메일로도 받기</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{isAdmin ? "새 제작 요청·가입 신청, 마감 임박·지남 알림" : "내 제작 요청의 승인·시안·지연·완료 알림"}을 메일로도 보내드려요. 아침 9시 점검은 하루 한 통으로 묶어서 와요.</span>
          </span>
          <Switch checked={emailOn && !!trimmed} disabled={!trimmed || !valid} onCheckedChange={setEmailOn} aria-label="메일로도 받기" />
        </label>

        <div className="rounded-xl border p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Fingerprint className="size-4" />지문 로그인</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">보안을 위해 사이트를 열 때마다 로그인해요. 지문(얼굴 인식·윈도우 Hello)을 등록해 두면 1초 만에 들어와요. PC는 선택이에요.</p>
          {keys === null ? <p className="mt-3 text-xs text-muted-foreground">불러오는 중…</p> : keys.length > 0 && <ul className="mt-3 space-y-1.5">{keys.map((k) => <li key={k.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"><Fingerprint className="size-4 text-primary" /><span className="min-w-0 flex-1 truncate">{k.device ?? "등록한 기기"}<span className="ml-1.5 text-xs text-muted-foreground">{k.last_used_at ? `최근 ${k.last_used_at.slice(5, 10).replace("-", "/")}` : `등록 ${k.created_at.slice(5, 10).replace("-", "/")}`}</span></span><Button type="button" size="icon-sm" variant="ghost" aria-label="이 지문 로그인 지우기" disabled={!!busy} onClick={() => void removeKey(k.id)}><X className="size-4" /></Button></li>)}</ul>}
          {passkeyApi.supported() && passkeyApi.onThisDevice() && (keys?.length ?? 0) > 0 ? <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">✓ 이 기기는 지문 로그인이 켜져 있어요.</p> : passkeyApi.supported() ? <Button type="button" variant="outline" className="mt-3 h-10 w-full rounded-xl" disabled={!!busy} onClick={() => void addKey()}>{busy === "pk" ? <LoaderCircle className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}이 기기에 지문 등록</Button> : <p className="mt-3 text-xs text-muted-foreground">{inAppBrowser() ? `${inAppBrowser()} 안에서는 지문을 등록할 수 없어요. 사파리나 크롬에서 열어 주세요.` : "이 브라우저는 지문 로그인을 지원하지 않아요."}</p>}
        </div>

        {!profile.mailReady && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">메일 발송 연결을 준비하고 있어요. 주소를 미리 저장해 두면 연결되는 즉시 받아요.</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={!profile.email || !profile.mailReady || dirty || !!busy} onClick={test}>{busy === "test" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}확인 메일 보내기</Button>
          <Button type="button" className="h-11 rounded-xl" disabled={!dirty || !valid || !!busy} onClick={save}>{busy === "save" && <LoaderCircle className="size-4 animate-spin" />}저장</Button>
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}
