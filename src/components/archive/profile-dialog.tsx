"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { profileApi, type Profile } from "@/archive-api";
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
  const [busy, setBusy] = useState<"" | "save" | "test">("");

  useEffect(() => {
    if (!open) return;
    setProfile(null);
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

        {!profile.mailReady && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">메일 발송 연결을 준비하고 있어요. 주소를 미리 저장해 두면 연결되는 즉시 받아요.</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={!profile.email || !profile.mailReady || dirty || !!busy} onClick={test}>{busy === "test" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}확인 메일 보내기</Button>
          <Button type="button" className="h-11 rounded-xl" disabled={!dirty || !valid || !!busy} onClick={save}>{busy === "save" && <LoaderCircle className="size-4 animate-spin" />}저장</Button>
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}
