"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ImageOff, LoaderCircle, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// 제작 요청에 '마케팅 제작물'을 레퍼런스로 담기
export type PickedRef = { key: string; src: string; name: string; assetId: string; assetTitle: string };
type Asset = { id: string; title: string; branch: string; assetType: string; createdDate: string; previewKey?: string | null; previewUrl?: string | null; galleryImages?: { src: string; key?: string; alt?: string; caption?: string }[] };

const PREFILL = "hi5-request-prefill";
/** 마케팅 제작물 화면에서 "이걸로 제작 요청하기" → 제작 요청 화면이 받아서 요청서를 연다 */
export function stashRequestPrefill(refs: PickedRef[]) { try { sessionStorage.setItem(PREFILL, JSON.stringify(refs)); } catch { /* 무시 */ } }
export function takeRequestPrefill(): PickedRef[] { try { const v = sessionStorage.getItem(PREFILL); sessionStorage.removeItem(PREFILL); return v ? JSON.parse(v) : []; } catch { return []; } }

/** 제작물 한 건의 이미지들을 레퍼런스 후보로 펼친다 (시안이 여러 장이면 장마다) */
export function refsOf(a: Asset): PickedRef[] {
  if (a.galleryImages?.length) return a.galleryImages.map((g, i) => ({ key: g.key ?? g.src, src: g.src, name: g.caption || `${a.title} ${i + 1}`, assetId: a.id, assetTitle: a.title }));
  if (a.previewKey) return [{ key: a.previewKey, src: a.previewUrl ?? "", name: a.title, assetId: a.id, assetTitle: a.title }];
  return [];
}

export function MarketingPicker({ open, onOpenChange, max, picked, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; max: number; picked: PickedRef[]; onDone: (refs: PickedRef[]) => void }) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("전체");
  const [sel, setSel] = useState<PickedRef[]>(picked);

  useEffect(() => {
    if (!open) return;
    setSel(picked);
    if (assets) return;
    fetch("/api/marketing?limit=all", { cache: "no-store" }).then((r) => r.json()).then((d: { assets?: Asset[] }) => setAssets((d.assets ?? []).filter((a) => !String(a.id).startsWith("demo")))).catch(() => setAssets([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const branches = useMemo(() => ["전체", ...Array.from(new Set((assets ?? []).map((a) => a.branch).filter(Boolean)))], [assets]);
  const shown = useMemo(() => (assets ?? []).filter((a) => (branch === "전체" || a.branch === branch) && (!q.trim() || `${a.title} ${a.assetType} ${a.branch}`.toLowerCase().includes(q.trim().toLowerCase()))), [assets, branch, q]);
  const isSel = (r: PickedRef) => sel.some((s) => s.key === r.key);
  const toggle = (r: PickedRef) => setSel((cur) => (cur.some((s) => s.key === r.key) ? cur.filter((s) => s.key !== r.key) : cur.length >= max ? cur : [...cur, r]));

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[92dvh] flex-col gap-3 rounded-2xl sm:max-w-3xl">
      <DialogHeader className="text-left"><DialogTitle>마케팅 제작물에서 가져오기</DialogTitle><DialogDescription>레퍼런스로 쓸 이미지를 눌러 골라 주세요. 시안이 여러 장이면 원하는 장만 고를 수 있어요. (최대 {max}장)</DialogDescription></DialogHeader>
      <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·종류로 찾기 (예: 합격, 휴원, 현수막)" className="h-11 rounded-xl pl-9" /></div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">{branches.map((b) => <button key={b} type="button" onClick={() => setBranch(b)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${branch === b ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{b}</button>)}</div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!assets ? <p className="py-12 text-center text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />불러오는 중…</p>
          : !shown.length ? <p className="py-12 text-center text-sm text-muted-foreground">조건에 맞는 제작물이 없어요.</p>
          : <div className="space-y-4">{shown.map((a) => { const refs = refsOf(a); return <section key={a.id}>
            <p className="mb-1.5 flex items-baseline gap-2 text-sm"><b className="truncate">{a.title}</b><span className="shrink-0 text-xs text-muted-foreground">{a.branch} · {a.assetType} · {a.createdDate}</span></p>
            {refs.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{refs.map((r) => { const on = isSel(r); return <button key={r.key} type="button" onClick={() => toggle(r)} className={`group relative aspect-[4/5] overflow-hidden rounded-xl border-2 bg-muted ${on ? "border-primary" : "border-transparent"}`} aria-pressed={on} aria-label={`${a.title} ${r.name}`}>
              {r.src ? <img src={r.src} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageOff className="m-auto size-6 text-muted-foreground" />}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[11px] text-white">{r.name}</span>
              <span className={`absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full border-2 ${on ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/30 text-transparent"}`}><Check className="size-3.5" /></span>
            </button>; })}</div> : <p className="text-xs text-muted-foreground">미리보기 이미지가 없어요.</p>}
          </section>; })}</div>}
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <span className="text-sm text-muted-foreground">{sel.length}장 선택</span>
        {sel.length > 0 && <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSel([])}><X className="size-4" />모두 빼기</Button>}
        <Button type="button" className="ml-auto h-11 rounded-xl" onClick={() => { onDone(sel); onOpenChange(false); }}>담기</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
