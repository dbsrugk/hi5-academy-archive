"use client";

// 📚 노트 제작 — 노트 시안을 페이지별로 구성하고, 포스트잇·스티커·그림으로 의견을 남기는 화면
// 편집기 본체는 public/notes/editor.html (iframe). 저장·로그인 확인은 이 화면이 대신 서버(archive-notes)에 전달한다.
//   iframe → 부모: { t: "note-ready" } · { t: "note-rpc", id, op, args }
//   부모 → iframe: { t: "note-init", info } · { t: "note-rpc-res", id, ok, result | error, code }
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, MessageSquare, Share2 } from "lucide-react";

import { getMe, notesApi } from "@/archive-api";
import { Button } from "@/components/ui/button";
import { useBackClose } from "@/hooks/use-back-close";

// 새 노트를 넣으려면: 여기에 항목 추가 + public/notes/editor.html 의 BOOKS 에 같은 id 추가 + 이미지는 public/notes/<id>/
const BOOKS = [
  { id: "spring-mid", title: "2026 봄노트 · 센텀 중고등", subtitle: "표지 2장 · 속지 18장 · 단면", cover: "/notes/spring-mid/p01.jpg" },
];
const OPEN_KEY = "hi5-notes-open";

type Rpc = { t: "note-rpc"; id: number; op: "list" | "get" | "set" | "update" | "delete" | "marketing"; args: { collection: string; id?: string; prefix?: string; data?: Record<string, unknown> } };

type MkAsset = { id: string; title: string; branch: string; createdDate: string; assetType: string; images: { src: string; caption: string }[] };
// 마케팅 제작물(사진이 있는 것만)을 편집기가 쓰기 좋은 모양으로
async function loadMarketing(): Promise<MkAsset[]> {
  const res = await fetch("/api/marketing?limit=all", { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { assets?: Record<string, any>[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "마케팅 제작물을 불러오지 못했어요.");
  return (data.assets ?? []).map((a) => {
    const gallery = Array.isArray(a.galleryImages) ? a.galleryImages : [];
    const list = gallery.length ? gallery : a.previewUrl ? [{ src: a.previewUrl, caption: "미리보기" }] : [];
    return {
      id: String(a.id), title: String(a.title ?? ""), branch: String(a.branch ?? ""), createdDate: String(a.createdDate ?? ""), assetType: String(a.assetType ?? ""),
      images: list.filter((g: Record<string, any>) => typeof g?.src === "string" && g.src).slice(0, 200).map((g: Record<string, any>) => ({ src: String(g.src), caption: String(g.caption ?? g.alt ?? "").slice(0, 60) })),
    };
  }).filter((a) => a.images.length);
}

function readOpen() { try { const v = sessionStorage.getItem(OPEN_KEY); return BOOKS.some((b) => b.id === v) ? v : null; } catch { return null; } }

export function NotesSection({ demoMode }: { role: "staff" | "admin"; demoMode: boolean }) {
  const [openId, setOpenId] = useState<string | null>(readOpen);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const book = BOOKS.find((b) => b.id === openId) ?? null;

  useBackClose(!!book, () => setOpenId(null)); // 뒤로가기 → 노트 목록으로
  useEffect(() => { try { if (openId) sessionStorage.setItem(OPEN_KEY, openId); else sessionStorage.removeItem(OPEN_KEY); } catch { /* 무시 */ } }, [openId]);

  useEffect(() => {
    if (!book) return;
    const frameWindow = () => frameRef.current?.contentWindow ?? null;
    const reply = (msg: Record<string, unknown>) => frameWindow()?.postMessage(msg, window.location.origin);

    async function handle(m: Rpc) {
      const { op, args } = m;
      if (op === "marketing") {
        if (demoMode) return { assets: [] };
        return { assets: await loadMarketing() };
      }
      if (demoMode) {
        if (op === "list") return { docs: [] };
        if (op === "get") return { doc: null };
        throw new Error("체험 모드에서는 저장되지 않아요.");
      }
      const collection = String(args?.collection ?? "");
      const id = String(args?.id ?? "");
      if (op === "list") return { docs: await notesApi.list(collection, String(args?.prefix ?? "")) };
      if (op === "get") return { doc: await notesApi.get(collection, id) };
      if (op === "set") { await notesApi.set(collection, id, args.data ?? {}); return { ok: true }; }
      if (op === "update") { await notesApi.update(collection, id, args.data ?? {}); return { ok: true }; }
      if (op === "delete") { await notesApi.remove(collection, id); return { ok: true }; }
      throw new Error("없는 요청입니다.");
    }

    async function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameWindow()) return;
      const m = event.data as { t?: string } & Partial<Rpc>;
      if (!m || typeof m !== "object") return;
      if (m.t === "note-ready") {
        const me = getMe();
        const dark = document.documentElement.classList.contains("dark");
        reply({ t: "note-init", info: { me: me ? { id: me.id, name: me.name, campus: me.campus === "전체" ? "이사" : me.campus, title: me.title, isAdmin: me.isAdmin } : null, canWrite: !demoMode && !!me, dark } });
        return;
      }
      if (m.t !== "note-rpc" || typeof m.id !== "number") return;
      try {
        const result = await handle(m as Rpc);
        reply({ t: "note-rpc-res", id: m.id, ok: true, result });
      } catch (error) {
        const status = (error as { status?: number })?.status;
        reply({ t: "note-rpc-res", id: m.id, ok: false, error: (error as Error)?.message ?? "요청을 처리하지 못했어요.", code: status === 401 ? "unauthenticated" : status === 403 ? "forbidden" : "unavailable" });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [book, demoMode]);

  if (book) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOpenId(null)}><ArrowLeft className="size-4" />노트 목록</Button>
          <p className="min-w-0 truncate text-sm font-semibold">{book.title}</p>
        </div>
        <iframe
          ref={frameRef}
          key={book.id}
          title={book.title}
          src={`/notes/editor.html?book=${encodeURIComponent(book.id)}`}
          className="h-[calc(100dvh-200px)] min-h-[620px] w-full rounded-2xl border bg-background"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BOOKS.map((item) => (
          <button key={item.id} type="button" onClick={() => setOpenId(item.id)} className="group flex gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md">
            <div className="aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
              <img src={item.cover} alt="" className="size-full object-cover" draggable={false} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div className="min-w-0 self-center">
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary"><BookOpen className="size-3.5" />노트</p>
              <p className="mt-1 text-lg font-bold leading-snug">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
              <p className="mt-3 text-xs font-medium text-primary group-hover:underline">열어서 구성·코멘트 보기 →</p>
            </div>
          </button>
        ))}
      </div>
      <div className="grid gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground sm:grid-cols-2">
        <p className="flex gap-2"><MessageSquare className="mt-0.5 size-4 shrink-0 text-primary" />페이지를 크게 열어 포스트잇·스티커·손그림으로 의견을 남기면 제작실에 알림이 가요.</p>
        <p className="flex gap-2"><Share2 className="mt-0.5 size-4 shrink-0 text-primary" />「이 구성 공유하기」를 누르면 모든 직원이 같은 구성을 봐요. 이전 공유본으로 되돌릴 수도 있어요.</p>
      </div>
    </div>
  );
}
