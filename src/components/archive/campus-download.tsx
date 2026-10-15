"use client";

/* 제작물 사진을 캠퍼스별로 한 번에(zip) 받기
   - 사진마다 original(원본 PNG/JPG 경로)이 있으면 원본으로, 없으면 화면용 이미지로 받는다.
   - 캠퍼스는 campus 필드 → 캡션·설명·파일 이름 속 "김해/명지/센텀…" 순으로 알아낸다. */
import { useState } from "react";
import { zipSync } from "fflate";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type DownloadPhoto = { src: string; alt?: string; caption?: string; original?: string; campus?: string; key?: string };

const CAMPUSES = ["센텀", "김해", "명지", "사우", "장기", "구래", "검단", "김포"] as const;

export function campusOfPhoto(p: DownloadPhoto): string | null {
  if (p.campus) return p.campus.replace(/캠퍼스$/, "");
  const text = [p.caption, p.alt, p.original, p.key].filter(Boolean).map((s) => { try { return decodeURIComponent(String(s)); } catch { return String(s); } }).join(" ");
  return CAMPUSES.find((c) => text.includes(c)) ?? null;
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

function fileNameOf(p: DownloadPhoto, url: string, index: number, title: string) {
  const raw = (p.original || url).split("?")[0].split("/").pop() || "";
  let base = raw; try { base = decodeURIComponent(raw); } catch { /* 그대로 */ }
  const ext = (base.match(/\.(png|jpe?g|webp|gif)$/i)?.[0] ?? ".png").toLowerCase();
  const label = safe(p.caption || p.alt || `${title} ${index + 1}`);
  return `${String(index + 1).padStart(2, "0")}_${label}${ext}`;
}

async function downloadZip(title: string, label: string, photos: DownloadPhoto[]) {
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const url = p.original || p.src;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`${res.status}`);
    let name = fileNameOf(p, url, i, title);
    while (files[name]) name = name.replace(/(\.\w+)$/, "_$1");
    files[name] = new Uint8Array(await res.arrayBuffer());
  }
  const zipped = zipSync(files, { level: 0 }); // 이미지라 압축 안 함(빠르게)
  const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safe(title)}_${label}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

export function CampusDownload({ title, photos }: { title: string; photos: DownloadPhoto[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!photos.length) return null;
  const groups = new Map<string, DownloadPhoto[]>();
  for (const p of photos) { const c = campusOfPhoto(p); if (c) groups.set(c, [...(groups.get(c) ?? []), p]); }
  const byCampus = groups.size >= 2 ? CAMPUSES.filter((c) => groups.has(c)).map((c) => [c, groups.get(c)!] as const) : [];
  const hasOriginal = photos.some((p) => p.original);

  const run = async (label: string, list: DownloadPhoto[]) => {
    if (busy) return;
    setBusy(label);
    try { await downloadZip(title, label, list); toast.success(`${label} ${list.length}장 받았어요`); }
    catch { toast.error("받기에 실패했어요. 잠시 후 다시 해주세요."); }
    finally { setBusy(null); }
  };

  return (
    <div className="mt-6 rounded-xl border bg-muted/30 p-4">
      <p className="text-sm font-semibold">한 번에 받기 <span className="font-normal text-muted-foreground">· {hasOriginal ? "원본 화질" : "미리보기 화질"} zip</span></p>
      <div className="mt-3 flex flex-wrap gap-2">
        {byCampus.map(([campus, list]) => (
          <Button key={campus} variant="outline" className="rounded-xl" disabled={!!busy} onClick={() => run(campus, list)}>
            {busy === campus ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{campus} {list.length}장
          </Button>
        ))}
        <Button className="rounded-xl" disabled={!!busy} onClick={() => run("전체", photos)}>
          {busy === "전체" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}전체 {photos.length}장
        </Button>
      </div>
    </div>
  );
}
