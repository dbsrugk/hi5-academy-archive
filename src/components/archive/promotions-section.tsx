"use client";

import Image from "next/image";
import { CampusDot, campusColor } from "@/lib/campus";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, Banknote, CalendarDays, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileUp, GalleryHorizontalEnd, Globe2, ImageIcon, ListFilter, MapPin, Plus, Route, Search, TableProperties, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Role = "staff" | "admin";
export type PromotionLocation = { id?: string; school: string; schoolLevel: string; activityTime: string; quantity: number; method: string; notes: string };
type PromotionImage = { src: string; name?: string };
export type PromotionCampaign = { id: string; title: string; branch: string; activityDate: string; channel?: "offline" | "online"; promotionType: string; manager: string; expense: number | null; activityCount?: number; platform?: string; campaignStart?: string; campaignEnd?: string; impressions?: number; clicks?: number; inquiries?: number; status: "planned" | "completed"; notes: string; imageUrl: string | null; galleryImages?: PromotionImage[]; locations: PromotionLocation[]; visibility?: "draft" | "published"; demo?: boolean };

const campuses = ["센텀캠퍼스", "김해캠퍼스", "명지캠퍼스"] as const;
const short: Record<string, string> = { 센텀캠퍼스: "센텀", 김해캠퍼스: "김해", 명지캠퍼스: "명지" };
const colors: Record<string, string> = { 센텀캠퍼스: "#4f6df5", 김해캠퍼스: "#24a89a", 명지캠퍼스: "#9567e8" };
const pieColors = ["#4f6df5", "#24a89a", "#9567e8", "#f1a84b"];

const samples = [
  ["센텀캠퍼스", "2026-04-02", "노트 배포", "센텀초", "초등", 220, 154000, "윤경학", "completed"],
  ["김해캠퍼스", "2026-04-09", "노트 배포", "김해중", "중등", 240, 168000, "김서윤", "completed"],
  ["명지캠퍼스", "2026-04-16", "리플렛 배포", "명호초", "초등", 180, 90000, "박은지", "completed"],
  ["센텀캠퍼스", "2026-05-12", "현수막 게시", "해강고", "고등", 1, 65000, "윤경학", "completed"],
  ["김해캠퍼스", "2026-05-19", "현수막 게시", "삼계중", "중등", 2, 120000, "김서윤", "completed"],
  ["명지캠퍼스", "2026-05-26", "노트 배포", "오션중", "중등", 260, 182000, "박은지", "completed"],
  ["센텀캠퍼스", "2026-06-25", "노트 배포", "센텀중", "중등", 360, 252000, "윤경학", "completed"],
  ["김해캠퍼스", "2026-06-11", "노트 배포", "내동초", "초등", 300, 210000, "김서윤", "completed"],
  ["명지캠퍼스", "2026-06-18", "현수막 게시", "명지고", "고등", 2, 120000, "박은지", "completed"],
  ["센텀캠퍼스", "2026-07-07", "리플렛 배포", "해림초", "초등", 210, 105000, "윤경학", "completed"],
  ["김해캠퍼스", "2026-07-14", "리플렛 배포", "분성중", "중등", 190, 95000, "김서윤", "completed"],
  ["명지캠퍼스", "2026-07-21", "노트 배포", "경일고", "고등", 260, 182000, "박은지", "completed"],
  ["센텀캠퍼스", "2026-08-05", "현수막 게시", "센텀중", "중등", 2, 120000, "윤경학", "completed"],
  ["김해캠퍼스", "2026-08-13", "노트 배포", "김해고", "고등", 280, 196000, "김서윤", "completed"],
  ["명지캠퍼스", "2026-08-20", "리플렛 배포", "명호중", "중등", 200, 100000, "박은지", "completed"],
  ["센텀캠퍼스", "2026-09-22", "노트 배포", "센텀중", "중등", 320, 224000, "윤경학", "planned"],
  ["김해캠퍼스", "2026-09-23", "노트 배포", "장유중", "중등", 300, null, "김서윤", "planned"],
  ["명지캠퍼스", "2026-09-29", "현수막 게시", "명지중", "중등", 2, 0, "박은지", "planned"],
] as const;

const demoPromotions: PromotionCampaign[] = [...samples.map((row, index) => ({
  id: `promotion-demo-${index}`, branch: row[0], activityDate: row[1], channel: "offline", promotionType: row[2], expense: row[6], activityCount: 1, platform: "", campaignStart: "", campaignEnd: "", impressions: 0, clicks: 0, inquiries: 0, manager: row[7], status: row[8],
  title: `[${row[2]}] ${row[3]}`, notes: row[8] === "planned" ? "진행 예정입니다." : "현장 홍보를 완료했습니다.",
  imageUrl: index === 6 ? "./promotion-notebook-centum-2026-06-25.webp" : index === 3 ? "./promotion-banner-2026-06-25.webp" : null,
  galleryImages: index === 6 ? [{ src: "./promotion-notebook-centum-2026-06-25.webp" }] : index === 3 ? [{ src: "./promotion-banner-2026-06-25.webp" }] : [],
  locations: [{ school: row[3], schoolLevel: row[4], activityTime: "등·하교 시간", quantity: row[5], method: row[2], notes: "" }], visibility: "published", demo: true,
})),
  { id: "promotion-demo-online-1", title: "9월 당근 지역 광고", branch: "센텀캠퍼스", activityDate: "2026-09-05", channel: "online", promotionType: "당근 광고", manager: "윤경학", expense: 180000, activityCount: 1, platform: "당근", campaignStart: "2026-09-05", campaignEnd: "2026-09-18", impressions: 18400, clicks: 326, inquiries: 19, status: "completed", notes: "센텀구 학부모 타깃으로 운영", imageUrl: null, galleryImages: [], locations: [{ school: "당근", schoolLevel: "온라인", activityTime: "14일", quantity: 0, method: "지역 광고", notes: "" }], visibility: "published", demo: true },
  { id: "promotion-demo-online-2", title: "9월 파워링크 운영", branch: "김해캠퍼스", activityDate: "2026-09-12", channel: "online", promotionType: "파워링크", manager: "김서윤", expense: 240000, activityCount: 1, platform: "네이버", campaignStart: "2026-09-12", campaignEnd: "2026-09-30", impressions: 9600, clicks: 412, inquiries: 27, status: "completed", notes: "김해 미술학원 키워드 중심", imageUrl: null, galleryImages: [], locations: [{ school: "네이버", schoolLevel: "온라인", activityTime: "19일", quantity: 0, method: "검색 광고", notes: "" }], visibility: "published", demo: true },
];

const emptyLocation = (): PromotionLocation => ({ school: "", schoolLevel: "중등", activityTime: "", quantity: 0, method: "직접 배포", notes: "" });

type ImportRow = Omit<PromotionCampaign, "id" | "imageUrl" | "galleryImages"> & { rowNumber: number };

function normalizeCampus(value: unknown) {
  const name = String(value ?? "").trim();
  if (name.endsWith("캠퍼스")) return name;
  if (["센텀", "김해", "명지"].includes(name)) return `${name}캠퍼스`;
  return name;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return date.toISOString().slice(0, 10);
  }
  return String(value ?? "").trim().replaceAll(".", "-").replace(/-+$/, "");
}

function normalizeExpense(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const amount = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : null;
}

function columnIndex(reference: string) {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function unzipEntry(buffer: ArrayBuffer, wantedName: string) {
  const view = new DataView(buffer); let end = view.byteLength - 22;
  while (end > Math.max(0, view.byteLength - 65557) && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end <= 0) throw new Error("ZIP directory not found");
  const entries = view.getUint16(end + 10, true); let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let index = 0; index < entries; index++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true); const size = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true); const extraLength = view.getUint16(offset + 30, true); const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
    if (name === wantedName) {
      const local = view.getUint32(offset + 42, true); const localNameLength = view.getUint16(local + 26, true); const localExtraLength = view.getUint16(local + 28, true);
      const bytes = new Uint8Array(buffer, local + 30 + localNameLength + localExtraLength, size);
      if (method === 0) return decoder.decode(bytes);
      if (method === 8) return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      throw new Error("Unsupported ZIP compression");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return "";
}

async function readFirstSheet(file: File) {
  const buffer = await file.arrayBuffer();
  const sharedXml = await unzipEntry(buffer, "xl/sharedStrings.xml");
  const sheetXml = await unzipEntry(buffer, "xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new Error("첫 번째 시트를 찾지 못했습니다.");
  const parser = new DOMParser();
  const shared = sharedXml ? [...parser.parseFromString(sharedXml, "application/xml").querySelectorAll("si")].map((item) => item.textContent ?? "") : [];
  const rows = [...parser.parseFromString(sheetXml, "application/xml").querySelectorAll("sheetData > row")].map((row) => {
    const values: unknown[] = [];
    row.querySelectorAll("c").forEach((cell) => {
      const index = columnIndex(cell.getAttribute("r") ?? "A1"); const type = cell.getAttribute("t"); const raw = cell.querySelector("v")?.textContent ?? cell.querySelector("is")?.textContent ?? "";
      values[index] = type === "s" ? shared[Number(raw)] ?? "" : type === "inlineStr" || type === "str" ? raw : raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
    });
    return values;
  });
  const headers = rows[0]?.map((value) => String(value ?? "").trim()) ?? [];
  return rows.slice(1).filter((row) => row.some((value) => value !== "" && value !== undefined)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

async function readPromotionWorkbook(file: File): Promise<ImportRow[]> {
  const records = await readFirstSheet(file);
  return records.map((record, index) => {
    const school = String(record["학교명"] ?? "").trim();
    const promotionType = String(record["홍보방식"] ?? "").trim();
    const statusText = String(record["진행상태"] ?? "").trim();
    const channel = String(record["구분(온라인/오프라인)"] ?? record["구분"] ?? "오프라인").includes("온라인") ? "online" as const : "offline" as const;
    const platform = String(record["플랫폼"] ?? "").trim();
    return {
      rowNumber: index + 2,
      title: String(record["제목"] ?? "").trim() || `[${promotionType || "홍보"}] ${school}`,
      branch: normalizeCampus(record["캠퍼스"]), activityDate: normalizeDate(record["진행일"]), channel, promotionType,
      manager: String(record["담당자"] ?? "").trim(), status: statusText === "완료" ? "completed" : "planned",
      expense: normalizeExpense(record["지출비용(원)"] ?? record["비용"]),
      activityCount: Math.max(1, Number(record["실행횟수"] ?? 1) || 1), platform,
      campaignStart: normalizeDate(record["시작일"] ?? ""), campaignEnd: normalizeDate(record["종료일"] ?? ""),
      impressions: Math.max(0, Number(record["노출수"] ?? 0) || 0), clicks: Math.max(0, Number(record["클릭수"] ?? 0) || 0), inquiries: Math.max(0, Number(record["문의수"] ?? 0) || 0),
      notes: String(record["현장반응·특이사항"] ?? "").trim(), visibility: "draft",
      locations: [{ school: school || platform || "온라인", schoolLevel: channel === "online" ? "온라인" : String(record["학교급"] ?? "기타").trim() || "기타", activityTime: String(record["시간"] ?? "").trim(), quantity: Number(record["배포수량"] ?? 0) || 0, method: promotionType, notes: "" }],
    };
  });
}

export function PromotionsSection({ role, demoMode }: { role: Role; demoMode: boolean }) {
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>(demoMode ? demoPromotions : []);
  const [mode, setMode] = useState<"records" | "analytics">("records");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("all");
  const [type, setType] = useState("all");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [branch, setBranch] = useState("all");
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("all");
  const [view, setView] = useState("table");
  const [selected, setSelected] = useState<PromotionCampaign | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch("/api/promotions", { cache: "no-store" }).then(async (response) => response.ok ? response.json() as Promise<{ campaigns?: PromotionCampaign[] }> : { campaigns: [] })
      .then((data) => setCampaigns([...(data.campaigns ?? []), ...(demoMode ? demoPromotions : [])])).catch(() => setCampaigns(demoMode ? demoPromotions : []));
  }, [demoMode]);

  const filtered = useMemo(() => campaigns.filter((item) => {
    const haystack = `${item.title} ${item.branch} ${item.manager} ${item.locations.map((location) => location.school).join(" ")}`.toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (channel === "all" || (item.channel ?? "offline") === channel) && (type === "all" || item.promotionType === type)
      && (level === "all" || item.locations.some((location) => location.schoolLevel === level)) && (status === "all" || item.status === status)
      && (branch === "all" || item.branch === branch) && (year === "all" || item.activityDate.startsWith(year))
      && (month === "all" || Number(item.activityDate.slice(5, 7)) === Number(month));
  }), [branch, campaigns, channel, level, month, query, status, type, year]);

  const completed = filtered.filter((item) => item.status === "completed");
  const basis = status === "planned" ? filtered : completed;
  const rows = filtered.flatMap((campaign) => campaign.locations.map((location) => ({ campaign, location })));
  const totalQuantity = basis.flatMap((item) => item.locations).reduce((sum, item) => sum + item.quantity, 0);
  const totalActivities = basis.reduce((sum, item) => sum + (item.activityCount ?? 1), 0);
  const offlineCount = basis.filter((item) => (item.channel ?? "offline") === "offline").reduce((sum, item) => sum + (item.activityCount ?? 1), 0);
  const onlineCount = basis.filter((item) => item.channel === "online").reduce((sum, item) => sum + (item.activityCount ?? 1), 0);
  const expenseValues = basis.map((item) => item.expense).filter((value): value is number => value !== null);
  const totalExpense = expenseValues.reduce((sum, value) => sum + value, 0);
  const averageExpense = expenseValues.length ? Math.round(totalExpense / expenseValues.length) : 0;
  const uniqueSchools = new Set(basis.filter((item) => (item.channel ?? "offline") === "offline").flatMap((item) => item.locations.map((location) => location.school))).size;
  const rate = filtered.length ? Math.round((completed.length / filtered.length) * 100) : 0;
  const campusData = campuses.map((campus) => {
    const all = filtered.filter((item) => item.branch === campus); const done = all.filter((item) => item.status === "completed");
    const campusExpenses = done.map((item) => item.expense).filter((value): value is number => value !== null);
    const expense = campusExpenses.reduce((sum, value) => sum + value, 0);
    return { campus: short[campus], full: campus, count: done.reduce((sum, item) => sum + (item.activityCount ?? 1), 0), offline: done.filter((item) => (item.channel ?? "offline") === "offline").reduce((sum, item) => sum + (item.activityCount ?? 1), 0), online: done.filter((item) => item.channel === "online").length, schools: new Set(done.filter((item) => (item.channel ?? "offline") === "offline").flatMap((item) => item.locations.map((location) => location.school))).size, quantity: done.flatMap((item) => item.locations).reduce((sum, item) => sum + item.quantity, 0), expense, averageExpense: campusExpenses.length ? Math.round(expense / campusExpenses.length) : 0, rate: all.length ? Math.round(done.length / all.length * 100) : 0 };
  });
  const monthlyData = Array.from({ length: 12 }, (_, index) => campuses.reduce<Record<string, string | number>>((result, campus) => ({ ...result, [short[campus]]: basis.filter((item) => item.branch === campus && Number(item.activityDate.slice(5, 7)) === index + 1).length }), { month: `${index + 1}월` }));
  const typeData = Array.from(new Set(basis.map((item) => item.promotionType))).map((name) => ({ name, value: basis.filter((item) => item.promotionType === name).length }));
  const levelData = ["초등", "중등", "고등"].map((name) => ({ name, value: basis.flatMap((item) => item.locations).filter((item) => item.schoolLevel === name).length }));
  const ranking = Array.from(basis.filter((item) => (item.channel ?? "offline") === "offline").flatMap((item) => item.locations).reduce((map, item) => map.set(item.school, (map.get(item.school) ?? 0) + 1), new Map<string, number>())).map(([school, count]) => ({ school, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  function exportCsv() {
    const data = [["날짜", "캠퍼스", "구분", "학교·플랫폼", "학교급", "홍보유형", "담당자", "상태", "횟수", "수량", "비용(원)", "노출", "클릭", "문의"], ...rows.map(({ campaign, location }) => [campaign.activityDate, campaign.branch, (campaign.channel ?? "offline") === "online" ? "온라인" : "오프라인", campaign.platform || location.school, location.schoolLevel, campaign.promotionType, campaign.manager, campaign.status === "completed" ? "완료" : "예정", String(campaign.activityCount ?? 1), String(location.quantity), campaign.expense === null ? "" : String(campaign.expense), String(campaign.impressions ?? 0), String(campaign.clicks ?? 0), String(campaign.inquiries ?? 0)])];
    const csv = `\uFEFF${data.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "홍보통계.csv"; a.click(); URL.revokeObjectURL(url);
  }

  async function changeVisibility(item: PromotionCampaign, visibility: "draft" | "published") {
    if (item.demo) return toast.info("예시 기록의 공개 상태는 변경되지 않습니다.");
    const response = await fetch(`/api/promotions/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ visibility }) });
    if (!response.ok) return toast.error("공개 상태를 변경하지 못했습니다.");
    setCampaigns((items) => items.map((campaign) => campaign.id === item.id ? { ...campaign, visibility } : campaign));
    setSelected((current) => current?.id === item.id ? { ...current, visibility } : current);
    toast.success(visibility === "published" ? "직원에게 공개했습니다." : "본사 검토용 초안으로 전환했습니다.");
  }

  async function chooseWorkbook(file: File | null) {
    if (!file) return;
    try { const parsed = await readPromotionWorkbook(file); setImportRows(parsed); if (!parsed.length) toast.error("등록할 행이 없습니다."); }
    catch { setImportRows([]); toast.error("엑셀 파일을 읽지 못했습니다. 제공된 양식을 사용해 주세요."); }
  }

  async function importWorkbook() {
    const valid = importRows.filter((item) => item.branch && item.activityDate && item.promotionType && (item.channel === "online" ? item.platform : item.locations[0]?.school));
    if (!valid.length) return toast.error("필수값이 입력된 행이 없습니다.");
    setImporting(true);
    try {
      if (demoMode) {
        const created = valid.map(({ rowNumber: _rowNumber, ...item }) => ({ id: crypto.randomUUID(), ...item, imageUrl: null, galleryImages: [], demo: true }));
        setCampaigns((items) => [...created, ...items]);
      } else {
        const created: PromotionCampaign[] = [];
        for (const { rowNumber: _rowNumber, ...item } of valid) {
          const response = await fetch("/api/promotions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...item, images: [] }) });
          const data = await response.json() as { id?: string; error?: string };
          if (!response.ok || !data.id) throw new Error(data.error ?? "일괄 등록 중 오류가 발생했습니다.");
          created.push({ id: data.id, ...item, imageUrl: null, galleryImages: [] });
        }
        setCampaigns((items) => [...created, ...items]);
      }
      toast.success(`${valid.length}건을 홍보 기록에 반영했습니다.`); setImportOpen(false); setImportRows([]);
    } catch (error) { toast.error((error as Error).message); }
    finally { setImporting(false); }
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)}><TabsList><TabsTrigger value="records"><TableProperties />기록 보기</TabsTrigger><TabsTrigger value="analytics"><BarChart3 />통계 보기</TabsTrigger></TabsList></Tabs><div className="flex flex-wrap gap-2"><Button variant="outline" className="rounded-xl" asChild><a href="./templates/promotion-record-template.xlsx" download><Download />엑셀 양식</a></Button><Button variant="outline" className="rounded-xl" onClick={() => setImportOpen(true)}><FileUp />엑셀 일괄 등록</Button><Button variant="outline" className="rounded-xl" onClick={exportCsv}><FileSpreadsheet />통계 CSV</Button><Button className="rounded-xl" onClick={() => setFormOpen(true)}><Plus />홍보 기록 작성</Button></div></div>
    <Filters query={query} setQuery={setQuery} channel={channel} setChannel={setChannel} year={year} setYear={setYear} month={month} setMonth={setMonth} type={type} setType={setType} level={level} setLevel={setLevel} status={status} setStatus={setStatus} branch={branch} setBranch={setBranch} />
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-6"><Summary label="총 실행" value={`${totalActivities}회`} icon={ListFilter} tone="indigo" /><Summary label="오프라인" value={`${offlineCount}회`} subvalue={`${uniqueSchools}개 학교`} icon={Route} tone="green" /><Summary label="온라인" value={`${onlineCount}건`} icon={Globe2} tone="blue" /><Summary label="총 배포" value={`${totalQuantity.toLocaleString("ko-KR")}개`} icon={ImageIcon} tone="blue" /><Summary label="총 마케팅비" value={`${totalExpense.toLocaleString("ko-KR")}원`} subvalue={expenseValues.length ? `평균 ${averageExpense.toLocaleString("ko-KR")}원` : "비용 기록 없음"} icon={Banknote} tone="rose" /><Summary label="완료율" value={`${rate}%`} icon={CalendarDays} tone="amber" /></div>
    {mode === "analytics" ? <div className="grid gap-4 xl:grid-cols-12">
      <Chart title="캠퍼스별 홍보 활동" className="xl:col-span-5"><CampusBars data={campusData} /></Chart>
      <Chart title="월별 홍보 추이" className="xl:col-span-7"><TrendChart data={monthlyData} /></Chart>
      <Chart title="홍보 유형 비중" className="xl:col-span-4"><TypeDonut data={typeData} /></Chart>
      <Chart title="학교급별 활동" className="xl:col-span-3"><LevelBars data={levelData} /></Chart>
      <Card className="rounded-2xl xl:col-span-5"><CardHeader><CardTitle className="text-base">캠퍼스 비교</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>캠퍼스</TableHead><TableHead className="text-right">전체</TableHead><TableHead className="text-right">오프라인</TableHead><TableHead className="text-right">온라인</TableHead><TableHead className="text-right">학교</TableHead><TableHead className="text-right">마케팅비</TableHead><TableHead className="text-right">완료율</TableHead></TableRow></TableHeader><TableBody>{campusData.map((item) => <TableRow key={item.campus}><TableCell>{item.campus}</TableCell><TableCell className="text-right">{item.count}회</TableCell><TableCell className="text-right">{item.offline}회</TableCell><TableCell className="text-right">{item.online}건</TableCell><TableCell className="text-right">{item.schools}곳</TableCell><TableCell className="text-right">{item.expense.toLocaleString()}원</TableCell><TableCell className="text-right">{item.rate}%</TableCell></TableRow>)}</TableBody></Table></div><div className="mt-4 border-t pt-3"><p className="mb-2 text-sm font-semibold">자주 방문한 학교</p>{ranking.map((item, index) => <div key={item.school} className="flex justify-between py-1 text-sm"><span><b className="mr-2 text-primary">{index + 1}</b>{item.school}</span><span className="text-muted-foreground">{item.count}회</span></div>)}</div></CardContent></Card>
    </div> : <RecordView rows={rows} filtered={filtered} view={view} setView={setView} onOpen={(item) => { setSelected(item); setImageIndex(0); }} />}
    <PromotionFormV2 open={formOpen} setOpen={setFormOpen} role={role} demoMode={demoMode} onCreated={(item) => setCampaigns((items) => [item, ...items])} />
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>홍보 기록 엑셀 일괄 등록</DialogTitle><DialogDescription>온라인·오프라인 구분, 실행 횟수, 비용과 성과 열을 읽어 일괄 등록합니다.</DialogDescription></DialogHeader><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"><FileSpreadsheet className="mb-2 size-6" />{importRows.length ? `${importRows.length}개 행을 읽었습니다.` : "작성한 XLSX 파일 선택"}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => chooseWorkbook(event.target.files?.[0] ?? null)} /></label>{importRows.length > 0 && <div className="overflow-x-auto rounded-xl border"><Table className="min-w-[820px]"><TableHeader><TableRow><TableHead>행</TableHead><TableHead>진행일</TableHead><TableHead>캠퍼스</TableHead><TableHead>구분</TableHead><TableHead>학교·플랫폼</TableHead><TableHead>방식</TableHead><TableHead className="text-right">비용</TableHead></TableRow></TableHeader><TableBody>{importRows.slice(0, 8).map((item) => { const valid = item.branch && item.activityDate && item.promotionType && (item.channel === "online" ? item.platform : item.locations[0]?.school); return <TableRow key={item.rowNumber} className={!valid ? "bg-rose-50" : ""}><TableCell>{item.rowNumber}</TableCell><TableCell>{item.activityDate || "필수"}</TableCell><TableCell>{item.branch || "필수"}</TableCell><TableCell>{item.channel === "online" ? "온라인" : "오프라인"}</TableCell><TableCell>{item.channel === "online" ? item.platform || "필수" : item.locations[0]?.school || "필수"}</TableCell><TableCell>{item.promotionType || "필수"}</TableCell><TableCell className="text-right">{formatExpense(item.expense)}</TableCell></TableRow>; })}</TableBody></Table>{importRows.length > 8 && <p className="border-t px-4 py-2 text-xs text-muted-foreground">외 {importRows.length - 8}개 행</p>}</div>}<DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>취소</Button><Button disabled={!importRows.length || importing} onClick={importWorkbook}>{importing ? "등록 중…" : `${importRows.length}건 반영`}</Button></DialogFooter></DialogContent></Dialog>
    <PromotionDetailV2 item={selected} role={role} imageIndex={imageIndex} setImageIndex={setImageIndex} fullscreen={fullscreen} setFullscreen={setFullscreen} onVisibility={changeVisibility} onClose={() => setSelected(null)} />
  </div>;
}

function Filters(props: { query: string; setQuery: (v: string) => void; channel: string; setChannel: (v: string) => void; year: string; setYear: (v: string) => void; month: string; setMonth: (v: string) => void; type: string; setType: (v: string) => void; level: string; setLevel: (v: string) => void; status: string; setStatus: (v: string) => void; branch: string; setBranch: (v: string) => void }) {
  return <Card className="rounded-2xl py-0"><CardContent className="p-4"><div className="grid gap-3 xl:grid-cols-[1fr_auto]"><div className="relative"><Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="학교명, 플랫폼, 담당자 검색" className="h-11 pl-11" /></div><div className="flex flex-wrap gap-2"><SimpleSelect value={props.channel} setValue={props.setChannel} items={[['all','온·오프라인'],['offline','오프라인'],['online','온라인']]} /><SimpleSelect value={props.year} setValue={props.setYear} items={[['all','전체 연도'],['2026','2026년'],['2025','2025년']]} /><SimpleSelect value={props.month} setValue={props.setMonth} items={[['all','전체 월'], ...Array.from({length:12},(_,i)=>[String(i+1),`${i+1}월`] as [string,string])]} /><SimpleSelect value={props.type} setValue={props.setType} items={[['all','전체 방식'],['노트 배포','노트 배포'],['현수막 게시','현수막 게시'],['리플렛 배포','리플렛 배포'],['당근 광고','당근 광고'],['파워링크','파워링크'],['SNS','SNS']]} /><SimpleSelect value={props.level} setValue={props.setLevel} items={[['all','전체 대상'],['초등','초등'],['중등','중등'],['고등','고등'],['온라인','온라인']]} /><SimpleSelect value={props.status} setValue={props.setStatus} items={[['all','전체 상태'],['completed','완료'],['planned','예정']]} /></div></div><div className="mt-3 flex gap-2">{["all", ...campuses].map((item) => <Button key={item} size="sm" variant={props.branch === item ? "default" : "outline"} className="rounded-full" onClick={() => props.setBranch(item)}>{item !== "all" && <CampusDot branch={item} />}{item === "all" ? "3개 통합" : short[item]}</Button>)}</div></CardContent></Card>;
}

function RecordView({ rows, filtered, view, setView, onOpen }: { rows: { campaign: PromotionCampaign; location: PromotionLocation }[]; filtered: PromotionCampaign[]; view: string; setView: (v: string) => void; onOpen: (item: PromotionCampaign) => void }) {
  return <><div className="flex justify-end"><Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="table"><TableProperties />표 보기</TabsTrigger><TabsTrigger value="gallery"><GalleryHorizontalEnd />갤러리</TabsTrigger></TabsList></Tabs></div>{view === "table" ? <><div className="space-y-2 md:hidden">{rows.map(({ campaign, location }, index) => { const online = (campaign.channel ?? "offline") === "online"; return <button key={`m-${campaign.id}-${index}`} type="button" onClick={() => onOpen(campaign)} className="flex w-full items-start gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-xs"><span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: campusColor(campaign.branch) }} /><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="font-medium leading-6">{online ? campaign.platform || campaign.title : location.school} · {campaign.promotionType}</span><Status status={campaign.status} /></span><span className="mt-0.5 block text-[13px] text-muted-foreground">{campaign.activityDate.replaceAll("-", ".")} · {short[campaign.branch]} · {online ? "온라인" : "오프라인"} · {campaign.manager || "담당 미정"}</span><span className="mt-1 flex justify-between text-[13px]"><span className="text-muted-foreground">{online ? `노출 ${(campaign.impressions ?? 0).toLocaleString()} · 클릭 ${(campaign.clicks ?? 0).toLocaleString()}` : location.quantity ? `${location.quantity.toLocaleString()}개` : "수량 미입력"}</span><b className="tabular-nums">{formatExpense(campaign.expense)}</b></span></span></button>; })}{!rows.length && <p className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">조건에 맞는 홍보 기록이 없습니다.</p>}</div><Card className="hidden overflow-x-auto rounded-2xl py-0 md:block"><Table className="min-w-[1160px] table-fixed"><TableHeader><TableRow className="bg-muted/50"><TableHead className="w-[110px] px-4">날짜</TableHead><TableHead className="w-[74px] px-3">캠퍼스</TableHead><TableHead className="w-[92px] px-3">구분</TableHead><TableHead className="w-[170px] px-4">학교·플랫폼</TableHead><TableHead className="w-[145px] px-4">홍보 방식</TableHead><TableHead className="w-[88px] px-3 text-right">횟수</TableHead><TableHead className="w-[150px] px-4 text-right">수량·성과</TableHead><TableHead className="w-[120px] px-4 text-right">비용</TableHead><TableHead className="w-[86px] px-3">상태</TableHead></TableRow></TableHeader><TableBody>{rows.map(({ campaign, location }, index) => { const online = (campaign.channel ?? "offline") === "online"; return <TableRow key={`${campaign.id}-${index}`} className="cursor-pointer" onClick={() => onOpen(campaign)}><TableCell className="px-4 tabular-nums">{campaign.activityDate.replaceAll("-", ".")}</TableCell><TableCell className="px-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CampusDot branch={campaign.branch} />{short[campaign.branch]}</span></TableCell><TableCell className="px-3"><Badge variant="outline">{online ? "온라인" : "오프라인"}</Badge></TableCell><TableCell className="truncate px-4 font-medium">{online ? campaign.platform || "온라인" : location.school}</TableCell><TableCell className="px-4">{campaign.promotionType}</TableCell><TableCell className="px-3 text-right tabular-nums">{campaign.activityCount ?? 1}회</TableCell><TableCell className="px-4 text-right text-sm tabular-nums">{online ? `노출 ${(campaign.impressions ?? 0).toLocaleString()} · 클릭 ${(campaign.clicks ?? 0).toLocaleString()}` : location.quantity ? `${location.quantity.toLocaleString()}개` : "—"}</TableCell><TableCell className="px-4 text-right font-medium tabular-nums">{formatExpense(campaign.expense)}</TableCell><TableCell className="px-3"><Status status={campaign.status} /></TableCell></TableRow>; })}</TableBody></Table></Card></> : <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{filtered.map((item) => <Card key={item.id} className="group overflow-hidden rounded-2xl py-0"><button className="w-full" onClick={() => onOpen(item)}><div className="relative aspect-[4/3] bg-[var(--archive-image-fallback)]">{item.imageUrl ? <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground">{item.channel === "online" ? <Globe2 /> : <ImageIcon />}</div>}</div><CardContent className="p-4"><div className="mb-2 flex justify-center"><Badge variant="outline">{item.channel === "online" ? "온라인" : "오프라인"}</Badge></div><h3 className="line-clamp-2 text-center font-semibold">{item.title}</h3><p className="mt-2 text-center text-sm text-muted-foreground"><CampusDot branch={item.branch} className="mr-1.5 align-middle" />{short[item.branch]} · {item.activityDate}</p><p className="mt-1 text-center text-xs text-muted-foreground">비용 {formatExpense(item.expense)}</p></CardContent></button></Card>)}</div>}</>;
}

function PromotionForm({ open, setOpen, role, demoMode, onCreated }: { open: boolean; setOpen: (v: boolean) => void; role: Role; demoMode: boolean; onCreated: (item: PromotionCampaign) => void }) {
  const [locations, setLocations] = useState([emptyLocation()]); const [files, setFiles] = useState<File[]>([]); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (locations.some((item) => !item.school.trim())) return toast.error("학교명을 입력해 주세요."); setSaving(true); const form = new FormData(event.currentTarget); const expenseText = String(form.get("expense") ?? "").trim(); const payload = { title: String(form.get("title")), branch: String(form.get("branch")), activityDate: String(form.get("date")), promotionType: String(form.get("type")), manager: String(form.get("manager")), expense: expenseText === "" ? null : Math.max(0, Math.round(Number(expenseText) || 0)), status: String(form.get("status")) as "planned" | "completed", notes: String(form.get("notes")), locations };
    try { if (demoMode) { const galleryImages = files.map((file) => ({ src: URL.createObjectURL(file), name: file.name })); onCreated({ id: crypto.randomUUID(), ...payload, imageUrl: galleryImages[0]?.src ?? null, galleryImages, demo: true }); toast.success("체험판 기록에 추가했습니다. 새로고침하면 초기화됩니다."); }
      else { const images: {key:string;name:string}[] = []; for (const file of files) { const upload = new FormData(); upload.set("file", file); upload.set("purpose", "preview"); const response = await fetch("/api/uploads", { method: "POST", body: upload }); const data = await response.json() as {key?:string;name?:string;error?:string}; if (!response.ok || !data.key) throw new Error(data.error ?? "사진 업로드 실패"); images.push({key:data.key,name:data.name ?? file.name}); } const response = await fetch("/api/promotions", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({...payload,visibility:"draft",images}) }); const data = await response.json() as {id?:string;error?:string}; if (!response.ok || !data.id) throw new Error(data.error ?? "저장 실패"); onCreated({id:data.id,...payload,imageUrl:null,galleryImages:[]}); toast.success(role === "admin" ? "초안으로 저장했습니다." : "본사 검토용으로 제출했습니다."); } setOpen(false); setLocations([emptyLocation()]); setFiles([]); } catch (error) { toast.error((error as Error).message); } finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>홍보 기록 작성</DialogTitle><DialogDescription>입력한 학교와 수량은 캠퍼스 통계에 자동 반영됩니다. 체험판 입력은 현재 브라우저에서만 보입니다.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="제목"><Input name="title" required /></Field><Field label="캠퍼스"><SimpleNamedSelect name="branch" items={campuses.map((v)=>[v,v])} /></Field><Field label="진행일"><Input name="date" type="date" required defaultValue="2026-09-22" /></Field><Field label="담당자"><Input name="manager" required /></Field><Field label="홍보 유형"><SimpleNamedSelect name="type" items={[['노트 배포','노트 배포'],['현수막 게시','현수막 게시'],['리플렛 배포','리플렛 배포'],['기타','기타']]} /></Field><Field label="상태"><SimpleNamedSelect name="status" items={[['completed','완료'],['planned','예정']]} /></Field></div><div className="space-y-3"><div className="flex justify-between"><Label>방문 학교</Label><Button type="button" size="sm" variant="outline" onClick={() => setLocations((items) => [...items, emptyLocation()])}><Plus />학교 추가</Button></div>{locations.map((location, index) => <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-6"><Input className="sm:col-span-2" value={location.school} placeholder="학교명" onChange={(e) => setLocations((items) => items.map((item,i)=>i===index?{...item,school:e.target.value}:item))} /><Select value={location.schoolLevel} onValueChange={(value)=>setLocations((items)=>items.map((item,i)=>i===index?{...item,schoolLevel:value}:item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['초등','중등','고등','기타'].map((v)=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Input value={location.activityTime} placeholder="시간" onChange={(e)=>setLocations((items)=>items.map((item,i)=>i===index?{...item,activityTime:e.target.value}:item))} /><Input type="number" min="0" value={location.quantity} onChange={(e)=>setLocations((items)=>items.map((item,i)=>i===index?{...item,quantity:Number(e.target.value)}:item))} /><Button type="button" variant="ghost" size="icon" disabled={locations.length===1} onClick={()=>setLocations((items)=>items.filter((_,i)=>i!==index))}><Trash2 /></Button></div>)}</div><Field label="현장 사진 (최대 12장)"><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"><Upload className="mb-2" />{files.length ? `${files.length}장 선택됨` : "사진 선택"}<input className="sr-only" type="file" accept="image/*" multiple onChange={(e)=>setFiles(Array.from(e.target.files ?? []).slice(0,12))} /></label></Field><Field label="특이사항·후기"><Textarea name="notes" rows={4} /></Field><DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>취소</Button><Button disabled={saving}>{saving ? "저장 중…" : "초안 제출"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function PromotionDetail({ item, role, imageIndex, setImageIndex, fullscreen, setFullscreen, onVisibility, onClose }: { item: PromotionCampaign | null; role: Role; imageIndex: number; setImageIndex: (v:number)=>void; fullscreen:boolean; setFullscreen:(v:boolean)=>void; onVisibility:(item:PromotionCampaign, visibility:"draft"|"published")=>void; onClose:()=>void }) {
  const images = item?.galleryImages?.length ? item.galleryImages : item?.imageUrl ? [{src:item.imageUrl}] : []; const prev=()=>setImageIndex((imageIndex-1+images.length)%images.length); const next=()=>setImageIndex((imageIndex+1)%images.length);
  const image = images[imageIndex];
  return <><Dialog open={Boolean(item)} onOpenChange={(open)=>{if(!open)onClose();}}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">{item && <><DialogHeader className="text-center"><DialogDescription>{item.branch} · {item.activityDate} · {item.manager}</DialogDescription><DialogTitle className="text-center">{item.title}</DialogTitle></DialogHeader>{image && <div className="relative"><button className="relative block aspect-[16/8] w-full rounded-2xl bg-black" onClick={()=>setFullscreen(true)}><Image src={image.src} alt="홍보 사진" fill unoptimized className="object-contain p-3" /></button>{images.length>1&&<><Arrow side="left" onClick={prev} /><Arrow side="right" onClick={next} /></>}</div>}<div className="flex justify-center gap-2"><Status status={item.status} /><Badge variant="outline">{item.promotionType}</Badge>{item.visibility === "draft" && <Badge variant="secondary">본사 검토 전</Badge>}</div><Table><TableHeader><TableRow><TableHead>학교</TableHead><TableHead>학교급</TableHead><TableHead>시간</TableHead><TableHead className="text-right">수량</TableHead></TableRow></TableHeader><TableBody>{item.locations.map((location,index)=><TableRow key={index}><TableCell>{location.school}</TableCell><TableCell>{location.schoolLevel}</TableCell><TableCell>{location.activityTime||"—"}</TableCell><TableCell className="text-right">{location.quantity||"—"}</TableCell></TableRow>)}</TableBody></Table>{item.notes&&<div className="rounded-xl bg-muted p-4">{item.notes}</div>}{role === "admin" && <DialogFooter><Button variant="outline" onClick={()=>onVisibility(item,"draft")}>초안으로 전환</Button><Button onClick={()=>onVisibility(item,"published")}>직원에게 공개</Button></DialogFooter>}</>}</DialogContent></Dialog><Dialog open={fullscreen} onOpenChange={setFullscreen}><DialogContent showCloseButton={false} className="h-[100dvh] w-screen max-w-none rounded-none border-0 bg-black p-0 sm:max-w-none">{image&&<div className="relative h-full"><Image src={image.src} alt="전체화면" fill unoptimized className="object-contain p-6" /><Button size="icon" className="absolute right-5 top-5 rounded-full" onClick={()=>setFullscreen(false)}><X /></Button>{images.length>1&&<><Arrow side="left" onClick={prev} /><Arrow side="right" onClick={next} /></>}</div>}</DialogContent></Dialog></>;
}

function PromotionFormV2({ open, setOpen, role, demoMode, onCreated }: { open: boolean; setOpen: (v: boolean) => void; role: Role; demoMode: boolean; onCreated: (item: PromotionCampaign) => void }) {
  const [locations, setLocations] = useState([emptyLocation()]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [channel, setChannel] = useState<"offline" | "online">("offline");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const platform = String(form.get("platform") ?? "").trim();
    if (channel === "offline" && locations.some((item) => !item.school.trim())) return toast.error("학교명 또는 배포 장소를 입력해 주세요.");
    if (channel === "online" && !platform) return toast.error("온라인 플랫폼을 입력해 주세요.");
    setSaving(true);
    const expenseText = String(form.get("expense") ?? "").trim();
    const submittedLocations = channel === "online"
      ? [{ school: platform, schoolLevel: "온라인", activityTime: `${String(form.get("campaignStart") ?? "")}~${String(form.get("campaignEnd") ?? "")}`, quantity: 0, method: String(form.get("type")), notes: "" }]
      : locations;
    const payload = {
      title: String(form.get("title")),
      branch: String(form.get("branch")),
      activityDate: String(form.get("date")),
      channel,
      promotionType: String(form.get("type")),
      manager: String(form.get("manager")),
      expense: expenseText === "" ? null : Math.max(0, Math.round(Number(expenseText) || 0)),
      activityCount: Math.max(1, Number(form.get("activityCount")) || 1),
      platform,
      campaignStart: String(form.get("campaignStart") ?? ""),
      campaignEnd: String(form.get("campaignEnd") ?? ""),
      impressions: Math.max(0, Number(form.get("impressions")) || 0),
      clicks: Math.max(0, Number(form.get("clicks")) || 0),
      inquiries: Math.max(0, Number(form.get("inquiries")) || 0),
      status: String(form.get("status")) as "planned" | "completed",
      notes: String(form.get("notes")),
      locations: submittedLocations,
    };
    try {
      if (demoMode) {
        const galleryImages = files.map((file) => ({ src: URL.createObjectURL(file), name: file.name }));
        onCreated({ id: crypto.randomUUID(), ...payload, imageUrl: galleryImages[0]?.src ?? null, galleryImages, demo: true });
        toast.success("체험판 기록에 추가했습니다. 새로고침하면 초기화됩니다.");
      } else {
        const images: { key: string; name: string }[] = [];
        for (const file of files) {
          const upload = new FormData(); upload.set("file", file); upload.set("purpose", "preview");
          const response = await fetch("/api/uploads", { method: "POST", body: upload });
          const data = await response.json() as { key?: string; name?: string; error?: string };
          if (!response.ok || !data.key) throw new Error(data.error ?? "사진 업로드 실패");
          images.push({ key: data.key, name: data.name ?? file.name });
        }
        const response = await fetch("/api/promotions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, visibility: "draft", images }) });
        const data = await response.json() as { id?: string; error?: string };
        if (!response.ok || !data.id) throw new Error(data.error ?? "저장 실패");
        onCreated({ id: data.id, ...payload, imageUrl: null, galleryImages: [] });
        toast.success(role === "admin" ? "초안으로 저장했습니다." : "본사 검토용으로 제출했습니다.");
      }
      setOpen(false); setLocations([emptyLocation()]); setFiles([]); setChannel("offline");
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>홍보 기록 작성</DialogTitle><DialogDescription>온라인과 오프라인을 나눠 실행 횟수, 비용, 성과와 증빙 사진을 기록합니다.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="space-y-2"><Label>홍보 구분</Label><Tabs value={channel} onValueChange={(value) => setChannel(value as "offline" | "online")}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="offline"><Route />오프라인</TabsTrigger><TabsTrigger value="online"><Globe2 />온라인</TabsTrigger></TabsList></Tabs></div><div className="grid gap-4 sm:grid-cols-2"><Field label="제목"><Input name="title" required /></Field><Field label="캠퍼스"><SimpleNamedSelect name="branch" items={campuses.map((value) => [value, value])} /></Field><Field label="진행일"><Input name="date" type="date" required defaultValue="2026-09-22" /></Field><Field label="담당자"><Input name="manager" required /></Field><Field label="홍보 방식"><SimpleNamedSelect key={channel} name="type" items={channel === "offline" ? [["노트 배포", "노트 배포"], ["현수막 게시", "현수막 게시"], ["리플렛 배포", "리플렛 배포"], ["학교 방문", "학교 방문"], ["기타", "기타"]] : [["당근 광고", "당근 광고"], ["파워링크", "파워링크"], ["SNS", "SNS"], ["블로그", "블로그"], ["기타", "기타"]]} /></Field><Field label="상태"><SimpleNamedSelect name="status" items={[["completed", "완료"], ["planned", "예정"]]} /></Field><Field label="실행 횟수"><Input name="activityCount" type="number" min="1" defaultValue="1" /></Field><Field label="마케팅 비용(원)"><Input name="expense" type="number" min="0" step="1" inputMode="numeric" placeholder="미기재는 빈칸, 무상은 0" /></Field></div>{channel === "offline" ? <div className="space-y-3"><div className="flex justify-between"><Label>학교·배포 장소별 기록</Label><Button type="button" size="sm" variant="outline" onClick={() => setLocations((items) => [...items, emptyLocation()])}><Plus />장소 추가</Button></div>{locations.map((location, index) => <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"><Input value={location.school} placeholder="학교명 또는 장소" onChange={(event) => setLocations((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, school: event.target.value } : item))} /><Select value={location.schoolLevel} onValueChange={(value) => setLocations((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, schoolLevel: value } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["초등", "중등", "고등", "기타"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Input value={location.activityTime} placeholder="시간" onChange={(event) => setLocations((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, activityTime: event.target.value } : item))} /><Input aria-label="배포 수량" type="number" min="0" value={location.quantity} placeholder="수량" onChange={(event) => setLocations((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} /><Button type="button" variant="ghost" size="icon" disabled={locations.length === 1} onClick={() => setLocations((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button></div>)}</div> : <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2"><Field label="플랫폼"><Input name="platform" placeholder="당근, 네이버, 인스타그램 등" /></Field><div /><Field label="캠페인 시작일"><Input name="campaignStart" type="date" /></Field><Field label="캠페인 종료일"><Input name="campaignEnd" type="date" /></Field><Field label="노출수"><Input name="impressions" type="number" min="0" /></Field><Field label="클릭수"><Input name="clicks" type="number" min="0" /></Field><Field label="문의수"><Input name="inquiries" type="number" min="0" /></Field></div>}<Field label={channel === "online" ? "성과 화면·광고 이미지 (최대 12장)" : "현장 사진 (최대 12장)"}><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"><Upload className="mb-2" />{files.length ? `${files.length}장 선택됨` : "사진 선택"}<input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 12))} /></label></Field><Field label="특이사항·후기"><Textarea name="notes" rows={4} /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button><Button disabled={saving}>{saving ? "저장 중…" : "기록 저장"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function PromotionDetailV2({ item, role, imageIndex, setImageIndex, fullscreen, setFullscreen, onVisibility, onClose }: { item: PromotionCampaign | null; role: Role; imageIndex: number; setImageIndex: (v:number)=>void; fullscreen:boolean; setFullscreen:(v:boolean)=>void; onVisibility:(item:PromotionCampaign, visibility:"draft"|"published")=>void; onClose:()=>void }) {
  const images = item?.galleryImages?.length ? item.galleryImages : item?.imageUrl ? [{ src: item.imageUrl }] : [];
  const prev = () => setImageIndex((imageIndex - 1 + images.length) % images.length);
  const next = () => setImageIndex((imageIndex + 1) % images.length);
  const image = images[imageIndex];
  const online = item?.channel === "online";
  return <><Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">{item && <><DialogHeader className="text-center"><DialogDescription>{item.branch} · {item.activityDate} · {item.manager}</DialogDescription><DialogTitle className="text-center">{item.title}</DialogTitle></DialogHeader>{image && <div className="relative"><button className="relative block aspect-[16/8] w-full rounded-2xl bg-black" onClick={() => setFullscreen(true)}><Image src={image.src} alt="홍보 증빙 사진" fill unoptimized className="object-contain p-3" /></button>{images.length > 1 && <><Arrow side="left" onClick={prev} /><Arrow side="right" onClick={next} /></>}</div>}<div className="flex flex-wrap justify-center gap-2"><Status status={item.status} /><Badge variant="outline">{online ? "온라인" : "오프라인"}</Badge><Badge variant="outline">{item.promotionType}</Badge><Badge variant="outline">{item.activityCount ?? 1}회</Badge><Badge variant="outline">비용 {formatExpense(item.expense)}</Badge>{item.visibility === "draft" && <Badge variant="secondary">본사 검토 전</Badge>}</div>{online ? <div className="grid gap-3 sm:grid-cols-4"><Metric label="플랫폼" value={item.platform || "미입력"} /><Metric label="노출" value={(item.impressions ?? 0).toLocaleString()} /><Metric label="클릭" value={(item.clicks ?? 0).toLocaleString()} /><Metric label="문의" value={(item.inquiries ?? 0).toLocaleString()} /><div className="rounded-xl bg-muted/50 p-4 sm:col-span-4"><b className="text-sm">운영 기간</b><p className="mt-1 text-sm text-muted-foreground">{item.campaignStart || "미입력"} ~ {item.campaignEnd || "미입력"}</p></div></div> : <div className="overflow-x-auto"><Table className="min-w-[560px]"><TableHeader><TableRow><TableHead>학교·장소</TableHead><TableHead>학교급</TableHead><TableHead>시간</TableHead><TableHead className="text-right">수량</TableHead></TableRow></TableHeader><TableBody>{item.locations.map((location, index) => <TableRow key={index}><TableCell>{location.school}</TableCell><TableCell>{location.schoolLevel}</TableCell><TableCell>{location.activityTime || "—"}</TableCell><TableCell className="text-right">{location.quantity || "—"}</TableCell></TableRow>)}</TableBody></Table></div>}{item.notes && <div className="rounded-xl bg-muted p-4">{item.notes}</div>}{role === "admin" && <DialogFooter><Button variant="outline" onClick={() => onVisibility(item, "draft")}>초안으로 전환</Button><Button onClick={() => onVisibility(item, "published")}>직원에게 공개</Button></DialogFooter>}</>}</DialogContent></Dialog><Dialog open={fullscreen} onOpenChange={setFullscreen}><DialogContent showCloseButton={false} className="h-[100dvh] w-screen max-w-none rounded-none border-0 bg-black p-0 sm:max-w-none">{image && <div className="relative h-full"><Image src={image.src} alt="전체화면" fill unoptimized className="object-contain p-6" /><Button size="icon" className="absolute right-5 top-5 rounded-full" onClick={() => setFullscreen(false)}><X /></Button>{images.length > 1 && <><Arrow side="left" onClick={prev} /><Arrow side="right" onClick={next} /></>}</div>}</DialogContent></Dialog></>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/50 p-4 text-center"><p className="text-xs text-muted-foreground">{label}</p><b className="mt-1 block text-lg">{value}</b></div>; }

function Arrow({side,onClick}:{side:"left"|"right";onClick:()=>void}){return <Button type="button" size="icon" variant="secondary" className={`absolute ${side==='left'?'left-3':'right-3'} top-1/2 -translate-y-1/2 rounded-full`} onClick={onClick}>{side==='left'?<ChevronLeft/>:<ChevronRight/>}</Button>}
function SimpleSelect({value,setValue,items}:{value:string;setValue:(v:string)=>void;items:(readonly [string,string])[]}){return <Select value={value} onValueChange={setValue}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{items.map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>}
function SimpleNamedSelect({name,items}:{name:string;items:(readonly [string,string])[]}){return <Select name={name} defaultValue={items[0][0]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{items.map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-2"><Label>{label}</Label>{children}</div>}
function Status({status}:{status:PromotionCampaign['status']}){return status==='completed'?<Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">완료</Badge>:<Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">예정</Badge>}
function formatExpense(value: number | null) { return value === null ? "미기재" : value === 0 ? "0원 · 무상" : `${value.toLocaleString("ko-KR")}원`; }
function Summary({label,value,subvalue,icon:Icon,tone}:{label:string;value:string;subvalue?:string;icon:typeof MapPin;tone:"indigo"|"green"|"blue"|"amber"|"rose"}){const tones={indigo:"bg-primary/10 text-primary",green:"bg-emerald-100 text-emerald-700",blue:"bg-sky-100 text-sky-700",amber:"bg-amber-100 text-amber-700",rose:"bg-rose-100 text-rose-700"};return <Card className="rounded-2xl py-0"><CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4"><div className={`grid size-8 shrink-0 place-items-center rounded-xl sm:size-10 ${tones[tone]}`}><Icon className="size-4 sm:size-5" /></div><div className="min-w-0"><p className="text-[13px] text-muted-foreground sm:text-sm">{label}</p><strong className="block break-keep text-base tabular-nums sm:text-lg 2xl:text-xl">{value}</strong>{subvalue && <p className="mt-1 text-xs text-muted-foreground">{subvalue}</p>}</div></CardContent></Card>}
function Chart({title,className,children}:{title:string;className:string;children:React.ReactNode}){return <Card className={`rounded-2xl ${className}`}><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>}

function CampusBars({ data }: { data: { campus: string; full: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return <div className="flex h-[270px] items-end justify-around gap-5 border-b border-border px-5 pt-8">{data.map((item) => <div key={item.campus} className="flex h-full flex-1 flex-col justify-end text-center"><b className="mb-2 text-sm">{item.count}회</b><div className="mx-auto w-full max-w-24 rounded-t-xl transition-all" style={{ height: `${Math.max(8, item.count / max * 78)}%`, background: colors[item.full] }} /><span className="mt-3 text-sm font-medium">{item.campus}</span></div>)}</div>;
}

function TrendChart({ data }: { data: Record<string, string | number>[] }) {
  const shown = data.slice(3, 9); const names = campuses.map((campus) => short[campus]);
  const max = Math.max(1, ...shown.flatMap((row) => names.map((name) => Number(row[name] ?? 0))));
  const points = (name: string) => shown.map((row, index) => `${8 + index * 16.8},${86 - Number(row[name] ?? 0) / max * 66}`).join(" ");
  return <div><div className="mb-3 flex justify-end gap-4 text-xs">{campuses.map((campus) => <span key={campus} className="flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: colors[campus] }} />{short[campus]}</span>)}</div><svg viewBox="0 0 100 100" className="h-[220px] w-full overflow-visible" role="img" aria-label="월별 홍보 추이">{[20, 40, 60, 80].map((y) => <line key={y} x1="5" x2="96" y1={y} y2={y} stroke="currentColor" opacity=".1" strokeDasharray="2 2" />)}{campuses.map((campus) => <polyline key={campus} points={points(short[campus])} fill="none" stroke={colors[campus]} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />)}{shown.map((row, index) => <text key={index} x={8 + index * 16.8} y="98" textAnchor="middle" fontSize="4" fill="currentColor" opacity=".65">{String(row.month)}</text>)}</svg></div>;
}

function TypeDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0)); let current = 0;
  const gradient = data.map((item, index) => { const start = current; current += item.value / total * 100; return `${pieColors[index % pieColors.length]} ${start}% ${current}%`; }).join(", ");
  return <div className="flex min-h-[240px] items-center justify-center gap-7"><div className="grid size-36 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient || '#e5e7eb 0 100%'})` }}><div className="grid size-20 place-items-center rounded-full bg-card text-center"><span className="text-xs text-muted-foreground">총 홍보<br /><b className="text-base text-foreground">{total}회</b></span></div></div><div className="space-y-3">{data.map((item, index) => <div key={item.name} className="flex items-center gap-2 text-sm"><i className="size-2.5 rounded-full" style={{ background: pieColors[index % pieColors.length] }} /><span className="min-w-20">{item.name}</span><b>{Math.round(item.value / total * 100)}%</b></div>)}</div></div>;
}

function LevelBars({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return <div className="flex min-h-[240px] flex-col justify-center gap-6">{data.map((item) => <div key={item.name}><div className="mb-2 flex justify-between text-sm"><span>{item.name}</span><b>{item.value}회</b></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${item.value / max * 100}%` }} /></div></div>)}</div>;
}
