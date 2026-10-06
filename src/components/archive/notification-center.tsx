"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Bell, BellOff, BellRing, CheckCheck, ClipboardList, LoaderCircle, Send, Share, Smartphone, UserPlus, AlarmClock } from "lucide-react";
import { toast } from "sonner";

import { notifyApi, type NotificationItem, type NotificationState } from "@/archive-api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// 휴대폰 알림(웹 푸시) + 사이트 안 알림함
type PushState = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
function b64ToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function swRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("./")) ?? navigator.serviceWorker.register("./sw.js", { scope: "./" });
}
function ago(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`;
}
const kindIcon: Record<string, typeof Bell> = { request: ClipboardList, member: UserPlus, deadline: AlarmClock, test: BellRing };

export function NotificationCenter({ onNavigate, onBadges, onOpenProfile }: { onNavigate: (link: string) => void; onBadges?: (badges: NotificationState["badges"]) => void; onOpenProfile?: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<NotificationState | null>(null);
  const [push, setPush] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const badgesRef = useRef(onBadges); badgesRef.current = onBadges;
  const navRef = useRef(onNavigate); navRef.current = onNavigate;

  const refresh = useCallback(async () => {
    try { const next = await notifyApi.list(); setState(next); badgesRef.current?.(next.badges ?? {}); return next; } catch { return null; }
  }, []);

  const checkPush = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPush(isIOS() && !isStandalone() ? "ios-install" : "unsupported"); return;
    }
    if (Notification.permission === "denied") { setPush("denied"); return; }
    const reg = await swRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setPush(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => {
    void refresh(); void checkPush();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    const onMessage = (event: MessageEvent) => { if (event.data?.type === "open-link") { navRef.current(String(event.data.link)); void refresh(); } };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); navigator.serviceWorker?.removeEventListener("message", onMessage); };
  }, [refresh, checkPush]);

  useEffect(() => { if (open) { void refresh(); void checkPush(); } }, [open, refresh, checkPush]);

  async function enablePush() {
    setBusy(true);
    try {
      const key = state?.vapidKey ?? (await refresh())?.vapidKey;
      if (!key) throw new Error("알림 설정을 불러오지 못했어요.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPush(permission === "denied" ? "denied" : "off"); throw new Error("알림 허용을 눌러야 받을 수 있어요."); }
      const reg = await swRegistration();
      if (!reg) throw new Error("이 브라우저는 알림을 지원하지 않아요.");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      await notifyApi.subscribe(sub.toJSON());
      setPush("on"); toast.success("이 기기에서 알림을 받아요. 테스트 알림을 보내 볼게요.");
      await notifyApi.test(); void refresh();
    } catch (error) { toast.error((error as Error).message || "알림을 켜지 못했어요."); }
    finally { setBusy(false); }
  }
  async function disablePush() {
    setBusy(true);
    try {
      const reg = await swRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await notifyApi.unsubscribe(sub.endpoint).catch(() => undefined); await sub.unsubscribe(); }
      setPush("off"); toast.success("이 기기의 알림을 껐어요.");
    } finally { setBusy(false); }
  }
  async function sendTest() {
    setBusy(true);
    try { await notifyApi.test(); toast.success("테스트 알림을 보냈어요. 잠시 후 휴대폰을 확인해 보세요."); void refresh(); }
    catch { toast.error("테스트 알림을 보내지 못했어요."); }
    finally { setBusy(false); }
  }
  async function openItem(item: NotificationItem) {
    if (!item.read_at) { void notifyApi.read([item.id]).then(refresh); setState((s) => s ? { ...s, unread: Math.max(0, s.unread - 1), items: s.items.map((i) => i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i) } : s); }
    if (item.link) { setOpen(false); navRef.current(item.link); }
  }
  async function readAll() {
    await notifyApi.read("all").catch(() => undefined);
    setState((s) => s ? { ...s, unread: 0, items: s.items.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })) } : s);
  }

  const unread = state?.unread ?? 0;
  return <>
    <Button type="button" variant="ghost" size="icon" className="relative size-9 rounded-xl" aria-label={`알림 ${unread}개`} onClick={() => setOpen(true)}>
      <Bell className="size-5" />
      {unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-none text-white">{unread > 99 ? "99+" : unread}</span>}
    </Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-2 pr-8"><SheetTitle className="flex items-center gap-2"><Bell className="size-5" />알림</SheetTitle>{unread > 0 && <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={readAll}><CheckCheck className="size-4" />모두 읽음</Button>}</div>
          <SheetDescription>제작 요청·승인·가입 신청 소식이 여기에 모여요.</SheetDescription>
        </SheetHeader>

        <div className="border-b p-4"><PushCard state={push} busy={busy} devices={state?.devices ?? 0} onEnable={enablePush} onDisable={disablePush} onTest={sendTest} />{onOpenProfile && <button type="button" onClick={() => { setOpen(false); onOpenProfile(); }} className="mt-2 flex w-full items-center justify-between rounded-xl border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/40"><span className="flex items-center gap-2"><Mail className="size-4" />메일로도 받기 설정</span><span aria-hidden>›</span></button>}</div>

        <div className="flex-1 overflow-y-auto">
          {!state && <p className="p-8 text-center text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />불러오는 중…</p>}
          {state && !state.items.length && <p className="p-10 text-center text-sm leading-6 text-muted-foreground">아직 알림이 없어요.<br />새 제작 요청이나 승인 소식이 생기면 알려드릴게요.</p>}
          <ul className="divide-y">{state?.items.map((item) => {
            const Icon = kindIcon[item.kind] ?? Bell;
            return <li key={item.id}><button type="button" onClick={() => openItem(item)} className={`flex w-full gap-3 px-4 py-3.5 text-left hover:bg-muted/40 ${item.read_at ? "" : "bg-primary/[0.04]"}`}>
              <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${item.read_at ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2"><span className={`text-[15px] leading-6 ${item.read_at ? "text-foreground/80" : "font-semibold"}`}>{item.title}</span><span className="mt-0.5 shrink-0 text-xs text-muted-foreground">{ago(item.created_at)}</span></span>
                {item.body && <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{item.body}</span>}
              </span>
              {!item.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-rose-500" aria-label="읽지 않음" />}
            </button></li>;
          })}</ul>
        </div>
      </SheetContent>
    </Sheet>
  </>;
}

function PushCard({ state, busy, devices, onEnable, onDisable, onTest }: { state: PushState; busy: boolean; devices: number; onEnable: () => void; onDisable: () => void; onTest: () => void }) {
  if (state === "checking") return <p className="text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />알림 설정 확인 중…</p>;
  if (state === "on") return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
    <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-200"><BellRing className="size-4" />이 기기에서 휴대폰 알림을 받고 있어요</p>
    <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">알림 받는 기기 {devices}대</p>
    <div className="mt-2.5 flex gap-2"><Button type="button" size="sm" variant="outline" className="h-9 flex-1 bg-background" disabled={busy} onClick={onTest}><Send className="size-4" />테스트 알림</Button><Button type="button" size="sm" variant="ghost" className="h-9 text-muted-foreground" disabled={busy} onClick={onDisable}><BellOff className="size-4" />끄기</Button></div>
  </div>;
  if (state === "ios-install") return <div className="rounded-xl border bg-muted/40 p-3 text-sm leading-6">
    <p className="flex items-center gap-1.5 font-semibold"><Smartphone className="size-4" />아이폰은 홈 화면에 추가해야 알림이 와요</p>
    <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-muted-foreground">
      <li>Safari 아래쪽 <b className="text-foreground">공유 버튼 <Share className="inline size-3.5 -translate-y-0.5" /></b>을 눌러요</li>
      <li><b className="text-foreground">홈 화면에 추가</b>를 눌러요</li>
      <li>홈 화면의 <b className="text-foreground">Hi5 아카이브</b> 아이콘으로 열고, 여기서 <b className="text-foreground">알림 받기</b>를 눌러요</li>
    </ol>
    <p className="mt-1.5 text-xs text-muted-foreground">iOS 16.4 이상에서 지원돼요.</p>
  </div>;
  if (state === "denied") return <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
    <p className="font-semibold">알림이 차단돼 있어요</p>
    <p className="mt-0.5">브라우저 주소창 옆 자물쇠(또는 설정) → <b>사이트 설정 → 알림 → 허용</b>으로 바꾼 뒤 다시 눌러 주세요.</p>
  </div>;
  if (state === "unsupported") return <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">이 브라우저는 휴대폰 알림을 지원하지 않아요. 크롬이나 사파리(홈 화면 추가)에서 열어 주세요. 알림은 이 알림함에서 계속 볼 수 있어요.</p>;
  return <div className="rounded-xl border-2 border-dashed border-primary/25 p-3">
    <p className="flex items-center gap-1.5 text-sm font-semibold"><Smartphone className="size-4" />휴대폰으로도 알림 받기</p>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">사이트를 닫아 둬도 새 요청·승인 소식이 휴대폰 알림으로 와요. 기기마다 한 번씩 켜 주세요.</p>
    <Button type="button" className="mt-2.5 h-10 w-full rounded-xl" disabled={busy} onClick={onEnable}>{busy ? <LoaderCircle className="animate-spin" /> : <BellRing />}이 기기에서 알림 받기</Button>
  </div>;
}
