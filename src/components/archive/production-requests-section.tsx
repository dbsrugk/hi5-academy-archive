"use client";

import Image from "next/image";
import { fileUrl } from "@/archive-api";
import { CampusDot, campusColor } from "@/lib/campus";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, FileText, ImagePlus, LoaderCircle, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Role = "staff" | "admin";
type RequestStatus = "approval_pending" | "producing" | "reviewing" | "delayed" | "completed";
type ReferenceImage = { src: string; name?: string };
type ProductionRequest = {
  id: string; title: string; branch: string; requester: string; assetType: string; purpose: string; specifications: string;
  requiredCopy: string; requestedDate: string; desiredDate: string; assignee: string; status: RequestStatus; progressPercent: number;
  driveUrl: string; delayedReason: string; revisedDueDate: string; notes: string; resultAssetId: string | null;
  referenceImages?: ReferenceImage[]; demo?: boolean;
};
type ProductionSchedule = {
  id: string; title: string; branch: string; scheduleDate: string; assetType: string; manager: string; status: RequestStatus;
  notes: string; delayedReason: string; revisedDueDate: string; linkedRequestId: string | null; demo?: boolean;
};
type PriorityOverride = { monthKey: string; branch: string };

const campuses = ["김해캠퍼스", "센텀캠퍼스", "명지캠퍼스"] as const;
const short: Record<string, string> = { 김해캠퍼스: "김해", 센텀캠퍼스: "센텀", 명지캠퍼스: "명지", "본사 공통": "본사" };
const statusLabels: Record<RequestStatus, string> = { approval_pending: "승인 대기", producing: "제작 중", reviewing: "컨펌 중", delayed: "지연", completed: "완료" };
const statusProgress: Record<RequestStatus, number> = { approval_pending: 10, producing: 45, reviewing: 80, delayed: 60, completed: 100 };
const statusTone: Record<RequestStatus, string> = {
  approval_pending: "bg-amber-100 text-amber-800", producing: "bg-indigo-100 text-indigo-700", reviewing: "bg-sky-100 text-sky-700",
  delayed: "bg-rose-100 text-rose-700", completed: "bg-emerald-100 text-emerald-700",
};

const demoRequests: ProductionRequest[] = [
  { id: "request-demo-1", title: "입시설명회 현수막", branch: "김해캠퍼스", requester: "원장", assetType: "현수막", purpose: "9월 입시설명회 외부 게시", specifications: "가로형 현수막 1종", requiredCopy: "2027학년도 입시설명회", requestedDate: "2026-09-18", desiredDate: "2026-09-25", assignee: "", status: "approval_pending", progressPercent: 10, driveUrl: "", delayedReason: "", revisedDueDate: "", notes: "학교명과 일시는 최종 확인 예정", resultAssetId: null, demo: true },
  { id: "request-demo-2", title: "학부모 간담회 안내 배너", branch: "센텀캠퍼스", requester: "원장", assetType: "SNS 배너", purpose: "밴드 및 문자 공지", specifications: "1080×1350px", requiredCopy: "디자인예비반 학부모 간담회", requestedDate: "2026-09-19", desiredDate: "2026-09-27", assignee: "김선영 디자이너", status: "producing", progressPercent: 45, driveUrl: "", delayedReason: "", revisedDueDate: "", notes: "참석 신청 링크 포함", resultAssetId: null, demo: true },
  { id: "request-demo-3", title: "여름특강 SNS 배너", branch: "명지캠퍼스", requester: "원장", assetType: "SNS 배너", purpose: "인스타그램 홍보", specifications: "정사각형 2종", requiredCopy: "실기 집중 여름특강", requestedDate: "2026-09-16", desiredDate: "2026-09-23", assignee: "이지은 디자이너", status: "reviewing", progressPercent: 82, driveUrl: "", delayedReason: "", revisedDueDate: "", notes: "1차 시안 컨펌 중이며 수정 의견 2건 반영 예정", resultAssetId: null, demo: true },
  { id: "request-demo-4", title: "장학시상 포스터", branch: "김해캠퍼스", requester: "원장", assetType: "포스터", purpose: "원내 게시", specifications: "A3 세로형", requiredCopy: "2026년 상반기 장학시상", requestedDate: "2026-09-08", desiredDate: "2026-09-15", assignee: "김선영 디자이너", status: "completed", progressPercent: 100, driveUrl: "https://drive.google.com/", delayedReason: "", revisedDueDate: "", notes: "인쇄용 PDF 전달 완료", resultAssetId: "asset-scholarship", demo: true },
];

const demoSchedules: ProductionSchedule[] = [
  [1, 12, "신학기 모집 패키지", "배너·포스터"], [2, 9, "새학기 등록 안내", "SNS·문자 이미지"],
  [3, 10, "실기대회·공모전 안내", "포스터"], [4, 8, "봄 행사 홍보물", "배너·리플렛"],
  [5, 7, "가정의 달 콘텐츠", "SNS 카드뉴스"], [6, 10, "여름특강 모집", "통합 캠페인"],
  [7, 8, "방학특강 안내", "배너·현수막"], [8, 12, "수상·성과 홍보", "포스터·SNS"],
  [9, 7, "2학기 모집물", "노트·배너"], [10, 12, "입시설명회 제작물", "현수막·안내문"],
  [11, 9, "겨울특강 모집", "통합 캠페인"], [12, 7, "연말 성과·신년 안내", "SNS·포스터"],
].map(([month, day, title, assetType], index) => ({
  id: `schedule-demo-${index + 1}`, title: String(title), branch: "본사 공통", scheduleDate: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  assetType: String(assetType), manager: "행정마케팅파트", status: month === 9 ? "producing" : "approval_pending", notes: "연간 제작 주요 일정", delayedReason: "", revisedDueDate: "", linkedRequestId: null, demo: true,
})) as ProductionSchedule[];

function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function defaultPriority(key: string) {
  const [year, month] = key.split("-").map(Number);
  const diff = (year - 2026) * 12 + month - 9;
  return campuses[((diff % campuses.length) + campuses.length) % campuses.length];
}
function effectiveDue(item: ProductionRequest) { return item.revisedDueDate || item.desiredDate; }

export function ProductionRequestsSection({ role, demoMode, onOpenMarketing }: { role: Role; demoMode: boolean; onOpenMarketing: () => void }) {
  const [requests, setRequests] = useState<ProductionRequest[]>(demoRequests);
  const [schedules, setSchedules] = useState<ProductionSchedule[]>(demoSchedules);
  const [overrides, setOverrides] = useState<PriorityOverride[]>([]);
  const [monthCursor, setMonthCursor] = useState(new Date(2026, 8, 1));
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [managed, setManaged] = useState<ProductionRequest | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ProductionSchedule | null>(null);
  const canManage = role === "admin" || demoMode;
  const selectedMonthKey = monthKey(monthCursor);
  const currentPriority = overrides.find((item) => item.monthKey === selectedMonthKey)?.branch ?? defaultPriority(selectedMonthKey);

  useEffect(() => {
    Promise.all([
      fetch("/api/production-requests", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ requests?: ProductionRequest[] }> : { requests: [] }),
      fetch("/api/production-schedules", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ schedules?: ProductionSchedule[] }> : { schedules: [] }),
      fetch("/api/production-priority", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ overrides?: PriorityOverride[] }> : { overrides: [] }),
    ]).then(([requestData, scheduleData, priorityData]) => {
      setRequests([...(requestData.requests ?? []), ...demoRequests]);
      setSchedules([...(scheduleData.schedules ?? []), ...demoSchedules]);
      setOverrides(priorityData.overrides ?? []);
    }).catch(() => undefined);
  }, []);

  const monthRequests = useMemo(() => requests.filter((item) => (item.requestedDate.startsWith(selectedMonthKey) || effectiveDue(item).startsWith(selectedMonthKey)) && (branchFilter === "all" || item.branch === branchFilter)), [branchFilter, requests, selectedMonthKey]);
  const campusSummary = campuses.map((campus) => {
    const campusItems = requests.filter((item) => item.branch === campus);
    return {
      campus,
      requested: campusItems.filter((item) => item.requestedDate.startsWith(selectedMonthKey)).length,
      producing: campusItems.filter((item) => ["producing", "reviewing", "delayed"].includes(item.status) && effectiveDue(item).startsWith(selectedMonthKey)).length,
      completed: campusItems.filter((item) => item.status === "completed" && effectiveDue(item).startsWith(selectedMonthKey)).length,
      delayed: campusItems.filter((item) => item.status === "delayed" && effectiveDue(item).startsWith(selectedMonthKey)).length,
    };
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    const base = {
      title: String(form.get("title") ?? ""), branch: String(form.get("branch") ?? ""), requester: String(form.get("requester") ?? ""), assetType: String(form.get("assetType") ?? ""),
      purpose: String(form.get("purpose") ?? ""), specifications: String(form.get("specifications") ?? ""), requiredCopy: String(form.get("requiredCopy") ?? ""),
      requestedDate: new Date().toISOString().slice(0, 10), desiredDate: String(form.get("desiredDate") ?? ""), driveUrl: String(form.get("driveUrl") ?? ""), notes: String(form.get("notes") ?? ""),
    };
    try {
      if (demoMode) {
        const referenceImages = files.map((file) => ({ src: URL.createObjectURL(file), name: file.name }));
        setRequests((current) => [{ id: crypto.randomUUID(), ...base, assignee: "", status: "approval_pending", progressPercent: 0, delayedReason: "", revisedDueDate: "", resultAssetId: null, referenceImages, demo: true }, ...current]);
      } else {
        const references: { key: string; name: string }[] = [];
        for (const file of files) {
          const upload = new FormData(); upload.set("file", file); upload.set("purpose", "preview");
          const response = await fetch("/api/uploads", { method: "POST", body: upload });
          const result = await response.json() as { key?: string; name?: string; error?: string };
          if (!response.ok || !result.key) throw new Error(result.error ?? "참고 이미지 업로드에 실패했습니다.");
          references.push({ key: result.key, name: result.name ?? file.name });
        }
        const response = await fetch("/api/production-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, references }) });
        const data = await response.json() as { id?: string; error?: string };
        if (!response.ok || !data.id) throw new Error(data.error ?? "요청을 등록하지 못했습니다.");
        setRequests((current) => [{ id: data.id!, ...base, assignee: "", status: "approval_pending", progressPercent: 0, delayedReason: "", revisedDueDate: "", resultAssetId: null, referenceImages: references.map((image) => ({ src: fileUrl(image.key) ?? "", name: image.name })) }, ...current]);
      }
      setFormOpen(false); setFiles([]); toast.success("제작 요청을 등록했습니다.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "요청을 등록하지 못했습니다."); }
    finally { setSaving(false); }
  }

  async function saveWorkflow() {
    if (!managed) return;
    const next = { ...managed, progressPercent: managed.status === "completed" ? 100 : managed.progressPercent };
    if (!next.assignee.trim() && next.status !== "approval_pending") return toast.error("제작 담당자를 입력해 주세요.");
    if (next.status === "delayed" && (!next.delayedReason.trim() || !next.revisedDueDate)) return toast.error("지연 사유와 변경 완료일을 입력해 주세요.");
    setSaving(true);
    try {
      if (!demoMode && !managed.demo) {
        const response = await fetch(`/api/production-requests/${managed.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next.status, assignee: next.assignee, progressPercent: next.progressPercent, driveUrl: next.driveUrl, delayedReason: next.delayedReason, revisedDueDate: next.revisedDueDate, notes: next.notes }) });
        if (!response.ok) throw new Error("진행 상태를 저장하지 못했습니다.");
      }
      setRequests((current) => current.map((item) => item.id === next.id ? next : item)); setManaged(null); toast.success(`${statusLabels[next.status]} 상태로 저장했습니다.`);
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  async function saveSchedule() {
    if (!scheduleDraft || !scheduleDraft.title.trim()) return toast.error("일정 제목을 입력해 주세요.");
    if (scheduleDraft.status === "delayed" && (!scheduleDraft.delayedReason.trim() || !scheduleDraft.revisedDueDate)) return toast.error("지연 사유와 변경일을 입력해 주세요.");
    setSaving(true);
    try {
      const exists = schedules.some((item) => item.id === scheduleDraft.id);
      if (!demoMode && !scheduleDraft.demo) {
        const response = await fetch(exists ? `/api/production-schedules/${scheduleDraft.id}` : "/api/production-schedules", { method: exists ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...scheduleDraft, id: undefined, demo: undefined }) });
        const data = await response.json() as { id?: string; error?: string };
        if (!response.ok) throw new Error(data.error ?? "일정을 저장하지 못했습니다.");
        if (!exists && data.id) scheduleDraft.id = data.id;
      }
      setSchedules((items) => exists ? items.map((item) => item.id === scheduleDraft.id ? scheduleDraft : item) : [scheduleDraft, ...items]);
      setScheduleDraft(null); toast.success("주요 일정을 저장했습니다.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  async function savePriority(branch: string) {
    const next = [...overrides.filter((item) => item.monthKey !== selectedMonthKey), { monthKey: selectedMonthKey, branch }];
    setOverrides(next);
    if (!demoMode) {
      const response = await fetch("/api/production-priority", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ monthKey: selectedMonthKey, branch }) });
      if (!response.ok) return toast.error("우선 캠퍼스를 저장하지 못했습니다.");
    }
    toast.success(`${selectedMonthKey.replace("-", "년 ")}월 우선 캠퍼스를 ${short[branch]}로 저장했습니다.`);
  }

  function openNewSchedule(date: string) {
    if (!canManage) return;
    setScheduleDraft({ id: crypto.randomUUID(), title: "", branch: "본사 공통", scheduleDate: date, assetType: "", manager: "행정마케팅파트", status: "approval_pending", notes: "", delayedReason: "", revisedDueDate: "", linkedRequestId: null, demo: demoMode });
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-[0_10px_35px_rgba(38,33,28,0.06)] sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">캠퍼스 제작 요청</p><p className="mt-1 text-sm leading-6 text-muted-foreground">주요 일정과 요청 진행 상태를 월별로 관리합니다.</p></div><Button className="rounded-xl" onClick={() => setFormOpen(true)}><Plus className="size-4" />새 제작 요청</Button></div>
    <ProductionScheduleView monthCursor={monthCursor} setMonthCursor={setMonthCursor} schedules={schedules} requests={requests} priority={currentPriority} canManage={canManage} onPriority={savePriority} onOpenSchedule={setScheduleDraft} onOpenRequest={(item) => setManaged({ ...item })} onNewSchedule={openNewSchedule} />
    {demoMode && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">체험판에서는 일정과 진행 상태를 직접 시험할 수 있으며 새로고침하면 초기화됩니다.</div>}
    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="rounded-2xl py-0"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">{selectedMonthKey.replace("-", "년 ")}월 캠퍼스별 제작 현황</CardTitle><p className="mt-1 text-sm text-muted-foreground">행을 누르면 해당 캠퍼스 요청만 확인할 수 있습니다.</p></div>{branchFilter !== "all" && <Button size="sm" variant="outline" onClick={() => setBranchFilter("all")}>통합 보기</Button>}</CardHeader><CardContent className="overflow-x-auto pb-5"><Table className="min-w-[620px]"><TableHeader><TableRow><TableHead>캠퍼스</TableHead><TableHead className="text-right">제작 요청</TableHead><TableHead className="text-right">제작 중</TableHead><TableHead className="text-right">제작 완료</TableHead><TableHead className="text-right">지연</TableHead></TableRow></TableHeader><TableBody>{campusSummary.map((item) => <TableRow key={item.campus} className={`cursor-pointer ${branchFilter === item.campus ? "bg-primary/5" : ""}`} onClick={() => setBranchFilter(item.campus)}><TableCell className="font-medium">{short[item.campus]}캠퍼스</TableCell><TableCell className="text-right">{item.requested}건</TableCell><TableCell className="text-right">{item.producing}건</TableCell><TableCell className="text-right">{item.completed}건</TableCell><TableCell className="text-right"><span className={item.delayed ? "font-semibold text-rose-600" : "text-muted-foreground"}>{item.delayed}건</span></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card className="rounded-2xl py-0"><CardHeader><CardTitle className="text-base">최근 요청과 확인 필요</CardTitle></CardHeader><CardContent className="divide-y p-0">{monthRequests.slice(0, 6).map((item) => <button key={item.id} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/45" onClick={() => setManaged({ ...item })}><span className={`size-2 shrink-0 rounded-full ${item.status === "delayed" ? "bg-rose-500" : item.status === "completed" ? "bg-emerald-500" : "bg-primary"}`} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground"><CampusDot branch={item.branch} className="mr-1 align-middle" />{short[item.branch] ?? item.branch} · {item.assignee || "담당자 미정"} · {effectiveDue(item).replaceAll("-", ".")}</span></span><Badge className={statusTone[item.status]}>{statusLabels[item.status]}</Badge></button>)}{!monthRequests.length && <p className="p-8 text-center text-sm text-muted-foreground">선택한 조건의 요청이 없습니다.</p>}</CardContent></Card>
    </div>

    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>새 제작 요청</DialogTitle><DialogDescription>필수 문구와 함께 참고 이미지를 최대 10장 첨부할 수 있습니다.</DialogDescription></DialogHeader><form className="space-y-5" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><RequestField label="제작물 제목" name="title" required /><RequestSelect label="캠퍼스" name="branch" items={campuses.map((value) => [value, value])} /><RequestField label="요청자" name="requester" placeholder="원장명 또는 담당자" required /><RequestField label="제작물 종류" name="assetType" placeholder="현수막, 배너, 카드뉴스" required /><RequestField label="희망 완료일" name="desiredDate" type="date" required /><RequestField label="규격·수량" name="specifications" placeholder="예: A2 2장 / 1080×1350px" /></div><RequestText label="사용 목적과 채널" name="purpose" /><RequestText label="필수 문구" name="requiredCopy" /><div className="space-y-2"><Label>레퍼런스 이미지</Label><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"><ImagePlus className="mb-2 size-5" />{files.length ? `${files.length}장 선택됨` : "이미지 최대 10장 선택"}<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 10))} /></label></div><RequestField label="Google Drive 링크" name="driveUrl" type="url" placeholder="완성본 폴더 또는 파일 링크" /><RequestText label="추가 요청사항" name="notes" /><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>취소</Button><Button disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Send />}요청 등록</Button></DialogFooter></form></DialogContent></Dialog>

    <RequestManageDialog item={managed} setItem={setManaged} canManage={canManage} saving={saving} onSave={saveWorkflow} onOpenMarketing={onOpenMarketing} />
    <ScheduleDialog item={scheduleDraft} setItem={setScheduleDraft} saving={saving} onSave={saveSchedule} />
  </div>;
}

function ProductionScheduleView({ monthCursor, setMonthCursor, schedules, requests, priority, canManage, onPriority, onOpenSchedule, onOpenRequest, onNewSchedule }: { monthCursor: Date; setMonthCursor: React.Dispatch<React.SetStateAction<Date>>; schedules: ProductionSchedule[]; requests: ProductionRequest[]; priority: string; canManage: boolean; onPriority: (branch: string) => void; onOpenSchedule: (item: ProductionSchedule) => void; onOpenRequest: (item: ProductionRequest) => void; onNewSchedule: (date: string) => void }) {
  const year = monthCursor.getFullYear(); const month = monthCursor.getMonth() + 1; const key = monthKey(monthCursor);
  const firstDay = new Date(year, month - 1, 1).getDay(); const lastDate = new Date(year, month, 0).getDate();
  const rawDays = Array.from({ length: firstDay + lastDate }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const days = [...rawDays, ...Array.from({ length: (7 - rawDays.length % 7) % 7 }, () => null)];
  const monthSchedules = schedules.filter((item) => item.scheduleDate.startsWith(key));
  const todayKey = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  function dateFor(day: number) { return `${key}-${String(day).padStart(2, "0")}`; }
  function moveMonth(amount: number) { setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)); }
  return <Card className="overflow-hidden rounded-2xl py-0"><CardContent className="p-4 md:p-5"><div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" /><h2 className="font-semibold">주요 일정</h2></div><p className="mt-1 text-sm text-muted-foreground">날짜나 일정 제목을 눌러 추가·수정하고 요청 상태까지 관리합니다.</p></div><div className="flex items-center gap-2 rounded-xl border bg-muted/35 px-3 py-2"><span className="text-sm text-muted-foreground">이번 달 우선 캠퍼스</span>{canManage ? <Select value={priority} onValueChange={onPriority}><SelectTrigger className="h-8 w-28 bg-background"><SelectValue /></SelectTrigger><SelectContent>{campuses.map((campus) => <SelectItem key={campus} value={campus}>{short[campus]}</SelectItem>)}</SelectContent></Select> : <Badge>{short[priority]}</Badge>}<span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="flex items-center gap-1"><CampusDot branch="김해" />김해</span>→<span className="flex items-center gap-1"><CampusDot branch="센텀" />센텀</span>→<span className="flex items-center gap-1"><CampusDot branch="명지" />명지</span> 순환</span></div></div><Tabs defaultValue="monthly"><TabsList><TabsTrigger value="monthly">월간</TabsTrigger><TabsTrigger value="annual">연간</TabsTrigger></TabsList><TabsContent value="monthly" className="mt-3"><div className="mb-3 flex items-center justify-between rounded-xl bg-muted/55 px-2 py-1.5"><Button type="button" size="icon" variant="ghost" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft /></Button><b>{year}년 {month}월</b><Button type="button" size="icon" variant="ghost" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight /></Button></div><div className="grid grid-cols-7 overflow-hidden rounded-xl border text-center text-xs text-muted-foreground">{["일", "월", "화", "수", "목", "금", "토"].map((day, weekIndex) => <div key={day} className={`border-b border-r bg-muted/35 py-2 text-[13px] font-semibold last:border-r-0 ${weekIndex === 0 ? "text-brand" : weekIndex === 6 ? "text-[#2f6fdb]" : "text-foreground/70"}`}>{day}</div>)}{days.map((day, index) => { const date = day ? dateFor(day) : ""; const daySchedules = day ? monthSchedules.filter((item) => item.scheduleDate === date) : []; const dayRequests = day ? requests.filter((item) => effectiveDue(item) === date) : []; return <button type="button" key={`${day ?? "empty"}-${index}`} disabled={!day || !canManage} onClick={() => day && onNewSchedule(date)} className={`flex min-h-20 min-w-0 flex-col items-stretch justify-start border-b border-r p-1.5 text-left md:min-h-24 ${day ? "bg-card hover:bg-muted/30" : "bg-muted/15"}`}><span className={`inline-grid size-6 shrink-0 place-items-center self-start rounded-full text-xs font-semibold ${date === todayKey ? "bg-brand text-white" : index % 7 === 0 ? "text-brand" : index % 7 === 6 ? "text-[#2f6fdb]" : "text-foreground"}`}>{day}</span>{daySchedules.slice(0, 2).map((item) => <span key={item.id} role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onOpenSchedule({ ...item }); }} className={`mt-1 block truncate rounded border-l-[3px] px-1.5 py-0.5 text-[11px] leading-4 md:text-xs ${statusTone[item.status]}`} style={{ borderLeftColor: campusColor(item.branch) }}>{item.title}</span>)}{dayRequests.slice(0, 1).map((item) => <span key={item.id} role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onOpenRequest(item); }} className="mt-1 block truncate rounded border-l-[3px] bg-brand-soft px-1.5 py-0.5 text-[11px] leading-4 text-foreground md:text-xs" style={{ borderLeftColor: campusColor(item.branch) }}>요청 · {item.title}</span>)}{daySchedules.length + dayRequests.length > 3 && <span className="mt-1 block text-[11px]">외 {daySchedules.length + dayRequests.length - 3}건</span>}</button>; })}</div></TabsContent><TabsContent value="annual" className="mt-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 12 }, (_, index) => index + 1).map((itemMonth) => { const itemKey = `${year}-${String(itemMonth).padStart(2, "0")}`; const items = schedules.filter((item) => item.scheduleDate.startsWith(itemKey)); return <div key={itemMonth} className={`rounded-xl border p-3 ${itemMonth === month ? "border-primary bg-primary/5" : ""}`}><div className="mb-2 flex items-center justify-between"><b>{itemMonth}월</b><Badge variant="secondary">{items.length}건</Badge></div>{items.slice(0, 3).map((item) => <button key={item.id} className="block w-full truncate py-1 text-left text-sm hover:text-primary" onClick={() => onOpenSchedule({ ...item })}>{item.scheduleDate.slice(8)}일 · {item.title}</button>)}{!items.length && <button className="text-sm text-muted-foreground" onClick={() => { setMonthCursor(new Date(year, itemMonth - 1, 1)); if (canManage) onNewSchedule(`${itemKey}-01`); }}>일정 추가</button>}</div>; })}</div></TabsContent></Tabs></CardContent></Card>;
}

function RequestManageDialog({ item, setItem, canManage, saving, onSave, onOpenMarketing }: { item: ProductionRequest | null; setItem: (item: ProductionRequest | null) => void; canManage: boolean; saving: boolean; onSave: () => void; onOpenMarketing: () => void }) {
  if (!item) return null;
  return <Dialog open onOpenChange={(open) => !open && setItem(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{item.title}</DialogTitle><DialogDescription>{item.branch} · 요청 {item.requestedDate.replaceAll("-", ".")} · 희망 {item.desiredDate.replaceAll("-", ".")}</DialogDescription></DialogHeader>{item.referenceImages?.length ? <div className="grid grid-cols-4 gap-2">{item.referenceImages.slice(0, 4).map((image, index) => <div key={`${image.src}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-muted"><Image src={image.src} alt={image.name ?? "참고 이미지"} fill unoptimized className="object-cover" /></div>)}</div> : null}<div className="grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2"><p><b>제작물</b><br />{item.assetType} · {item.specifications || "규격 미입력"}</p><p><b>요청자</b><br />{item.requester}</p><p className="sm:col-span-2"><b>사용 목적</b><br />{item.purpose || "미입력"}</p><p className="sm:col-span-2"><b>필수 문구</b><br />{item.requiredCopy || "미입력"}</p></div>{canManage && <><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>진행 단계</Label><Select value={item.status} onValueChange={(value) => { const status = value as RequestStatus; setItem({ ...item, status, progressPercent: status === "completed" ? 100 : Math.max(item.progressPercent, statusProgress[status]) }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><RequestField label="제작 담당자" name="assignee" value={item.assignee} onChange={(event) => setItem({ ...item, assignee: event.target.value })} /></div><div className="space-y-3"><div className="flex justify-between text-sm"><Label>작업률</Label><b>{item.progressPercent}%</b></div><Slider value={[item.progressPercent]} max={100} step={5} onValueChange={(value) => setItem({ ...item, progressPercent: value[0] ?? 0 })} /></div>{item.status === "delayed" && <div className="grid gap-4 sm:grid-cols-2"><RequestField label="변경 완료일" name="revisedDueDate" type="date" value={item.revisedDueDate} onChange={(event) => setItem({ ...item, revisedDueDate: event.target.value })} /><RequestField label="지연 사유" name="delayedReason" value={item.delayedReason} onChange={(event) => setItem({ ...item, delayedReason: event.target.value })} /></div>}<RequestField label="Google Drive 완성본 링크" name="driveUrl" type="url" value={item.driveUrl} onChange={(event) => setItem({ ...item, driveUrl: event.target.value })} /><RequestText label="메모" name="notes" value={item.notes} onChange={(event) => setItem({ ...item, notes: event.target.value })} /></>}<DialogFooter><Button variant="outline" onClick={() => setItem(null)}>닫기</Button>{item.status === "completed" && item.driveUrl && <Button variant="outline" asChild><a href={item.driveUrl} target="_blank" rel="noreferrer"><ExternalLink />Drive</a></Button>}{item.status === "completed" && <Button variant="outline" onClick={onOpenMarketing}><FileText />제작물 보기</Button>}{canManage && <Button onClick={onSave} disabled={saving}>{saving && <LoaderCircle className="animate-spin" />}저장</Button>}</DialogFooter></DialogContent></Dialog>;
}

function ScheduleDialog({ item, setItem, saving, onSave }: { item: ProductionSchedule | null; setItem: (item: ProductionSchedule | null) => void; saving: boolean; onSave: () => void }) {
  if (!item) return null;
  return <Dialog open onOpenChange={(open) => !open && setItem(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>주요 일정 편집</DialogTitle><DialogDescription>날짜와 진행 상태를 바꾸면 달력에 바로 반영됩니다.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><RequestField label="일정 제목" name="scheduleTitle" value={item.title} onChange={(event) => setItem({ ...item, title: event.target.value })} /><RequestField label="일정 날짜" name="scheduleDate" type="date" value={item.scheduleDate} onChange={(event) => setItem({ ...item, scheduleDate: event.target.value })} /><div className="space-y-2"><Label>캠퍼스</Label><Select value={item.branch} onValueChange={(branch) => setItem({ ...item, branch })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="본사 공통">본사 공통</SelectItem>{campuses.map((campus) => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}</SelectContent></Select></div><RequestField label="제작물 종류" name="scheduleAssetType" value={item.assetType} onChange={(event) => setItem({ ...item, assetType: event.target.value })} /><RequestField label="담당자" name="scheduleManager" value={item.manager} onChange={(event) => setItem({ ...item, manager: event.target.value })} /><div className="space-y-2"><Label>상태</Label><Select value={item.status} onValueChange={(status) => setItem({ ...item, status: status as RequestStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>{item.status === "delayed" && <div className="grid gap-4 sm:grid-cols-2"><RequestField label="변경 예정일" name="scheduleRevised" type="date" value={item.revisedDueDate} onChange={(event) => setItem({ ...item, revisedDueDate: event.target.value })} /><RequestField label="지연 사유" name="scheduleDelay" value={item.delayedReason} onChange={(event) => setItem({ ...item, delayedReason: event.target.value })} /></div>}<RequestText label="일정 메모" name="scheduleNotes" value={item.notes} onChange={(event) => setItem({ ...item, notes: event.target.value })} /><DialogFooter><Button variant="outline" onClick={() => setItem(null)}>취소</Button><Button onClick={onSave} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}일정 저장</Button></DialogFooter></DialogContent></Dialog>;
}

function RequestField({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} className="rounded-xl" {...props} /></div>; }
function RequestText({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Textarea>) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} className="min-h-24 rounded-xl" {...props} /></div>; }
function RequestSelect({ label, name, items }: { label: string; name: string; items: (readonly [string, string])[] }) { return <div className="space-y-2"><Label>{label}</Label><Select name={name} defaultValue={items[0]?.[0]}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{items.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select></div>; }
