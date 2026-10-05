"use client";

import Image from "next/image";
import { fileUrl, getMe } from "@/archive-api";
import { CampusDot, campusColor } from "@/lib/campus";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ExternalLink, Eye, FileText, ImagePlus, LoaderCircle, Lock, Plus, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Role = "staff" | "admin";
type RequestStatus = "approval_pending" | "producing" | "reviewing" | "delayed" | "completed";
type ReferenceImage = { src: string; name?: string };
type HistoryItem = { status: RequestStatus; at: string; by?: string; note?: string };
type ProductionRequest = {
  id: string; title: string; branch: string; requester: string; assetType: string; purpose: string; specifications: string;
  requiredCopy: string; requestedDate: string; desiredDate: string; assignee: string; status: RequestStatus; progressPercent: number;
  driveUrl: string; delayedReason: string; revisedDueDate: string; notes: string; resultAssetId: string | null;
  referenceImages?: ReferenceImage[]; history?: HistoryItem[]; createdBy?: string; approvedAt?: string; approvedBy?: string; completedAt?: string; updatedAt?: string; demo?: boolean;
};
type ProductionSchedule = {
  id: string; title: string; branch: string; scheduleDate: string; assetType: string; manager: string; status: RequestStatus;
  notes: string; delayedReason: string; revisedDueDate: string; linkedRequestId: string | null; demo?: boolean;
};
type PriorityOverride = { monthKey: string; branch: string };
type StatusFilter = "open" | "all" | RequestStatus;

const campuses = ["김해캠퍼스", "센텀캠퍼스", "명지캠퍼스"] as const;
const short: Record<string, string> = { 김해캠퍼스: "김해", 센텀캠퍼스: "센텀", 명지캠퍼스: "명지", "본사 공통": "본사" };
const statusLabels: Record<RequestStatus, string> = { approval_pending: "승인 대기", producing: "제작 중", reviewing: "컨펌 중", delayed: "지연", completed: "완료" };
const statusOrder: RequestStatus[] = ["approval_pending", "producing", "reviewing", "delayed", "completed"];
const statusProgress: Record<RequestStatus, number> = { approval_pending: 10, producing: 45, reviewing: 80, delayed: 60, completed: 100 };
const statusTone: Record<RequestStatus, string> = {
  approval_pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200", producing: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200",
  reviewing: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200", delayed: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
};
const statusBar: Record<RequestStatus, string> = { approval_pending: "bg-amber-500", producing: "bg-indigo-500", reviewing: "bg-sky-500", delayed: "bg-rose-500", completed: "bg-emerald-500" };

const demoRequests: ProductionRequest[] = [
  { id: "request-demo-1", title: "입시설명회 현수막", branch: "김해캠퍼스", requester: "원장", assetType: "현수막", purpose: "입시설명회 외부 게시", specifications: "가로형 현수막 1종", requiredCopy: "2027학년도 입시설명회", requestedDate: "2026-10-01", desiredDate: "2026-10-12", assignee: "", status: "approval_pending", progressPercent: 10, driveUrl: "", delayedReason: "", revisedDueDate: "", notes: "학교명과 일시는 최종 확인 예정", resultAssetId: null, demo: true },
  { id: "request-demo-2", title: "학부모 간담회 안내 배너", branch: "센텀캠퍼스", requester: "원장", assetType: "SNS 배너", purpose: "밴드 및 문자 공지", specifications: "1080×1350px", requiredCopy: "디자인예비반 학부모 간담회", requestedDate: "2026-10-02", desiredDate: "2026-10-15", assignee: "제작실", status: "producing", progressPercent: 45, driveUrl: "", delayedReason: "", revisedDueDate: "", notes: "참석 신청 링크 포함", resultAssetId: null, demo: true },
];
const demoSchedules: ProductionSchedule[] = [
  { id: "schedule-demo-1", title: "입시설명회 제작물", branch: "본사 공통", scheduleDate: "2026-10-12", assetType: "현수막·안내문", manager: "행정마케팅파트", status: "producing", notes: "연간 제작 주요 일정", delayedReason: "", revisedDueDate: "", linkedRequestId: null, demo: true },
];

function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function todayStr() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function defaultPriority(key: string) {
  const [year, month] = key.split("-").map(Number);
  const diff = (year - 2026) * 12 + month - 9;
  return campuses[((diff % campuses.length) + campuses.length) % campuses.length];
}
function effectiveDue(item: ProductionRequest) { return item.revisedDueDate || item.desiredDate; }
function dotted(date: string) { return (date || "").slice(0, 10).replaceAll("-", "."); }
function dday(date: string) {
  if (!date) return "";
  const diff = Math.round((new Date(date + "T00:00:00").getTime() - new Date(todayStr() + "T00:00:00").getTime()) / 86400000);
  return diff === 0 ? "D-day" : diff > 0 ? `D-${diff}` : `D+${-diff}`;
}
function stamp(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function myCampus() { const me = getMe(); return me && me.campus !== "전체" ? `${me.campus}캠퍼스` : campuses[0]; }
function myName() { const me = getMe(); return me ? `${me.name}${me.title ? " " + me.title : ""}` : ""; }

export function ProductionRequestsSection({ role, demoMode, onOpenMarketing }: { role: Role; demoMode: boolean; onOpenMarketing: () => void }) {
  const [requests, setRequests] = useState<ProductionRequest[]>(demoMode ? demoRequests : []);
  const [schedules, setSchedules] = useState<ProductionSchedule[]>(demoMode ? demoSchedules : []);
  const [overrides, setOverrides] = useState<PriorityOverride[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [listLimit, setListLimit] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [managed, setManaged] = useState<ProductionRequest | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ProductionSchedule | null>(null);
  const canManage = role === "admin" || demoMode;
  const selectedMonthKey = monthKey(monthCursor);
  const currentPriority = overrides.find((item) => item.monthKey === selectedMonthKey)?.branch ?? defaultPriority(selectedMonthKey);

  useEffect(() => {
    if (demoMode) return;
    Promise.all([
      fetch("/api/production-requests", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ requests?: ProductionRequest[] }> : { requests: [] }),
      fetch("/api/production-schedules", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ schedules?: ProductionSchedule[] }> : { schedules: [] }),
      fetch("/api/production-priority", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ overrides?: PriorityOverride[] }> : { overrides: [] }),
    ]).then(([requestData, scheduleData, priorityData]) => {
      setRequests(requestData.requests ?? []);
      setSchedules(scheduleData.schedules ?? []);
      setOverrides(priorityData.overrides ?? []);
    }).catch(() => toast.error("제작 요청을 불러오지 못했습니다.")).finally(() => setLoading(false));
  }, [demoMode]);

  const counts = useMemo(() => {
    const scoped = requests.filter((item) => branchFilter === "all" || item.branch === branchFilter);
    const by = Object.fromEntries(statusOrder.map((status) => [status, scoped.filter((item) => item.status === status).length])) as Record<RequestStatus, number>;
    return { ...by, open: scoped.filter((item) => item.status !== "completed").length, all: scoped.length };
  }, [requests, branchFilter]);

  const listed = useMemo(() => {
    const rows = requests.filter((item) => (branchFilter === "all" || item.branch === branchFilter) && (statusFilter === "all" ? true : statusFilter === "open" ? item.status !== "completed" : item.status === statusFilter));
    return rows.sort((a, b) => {
      if (statusFilter === "open") {
        const rank = (s: RequestStatus) => (s === "delayed" ? 0 : s === "approval_pending" ? 1 : 2);
        return rank(a.status) - rank(b.status) || effectiveDue(a).localeCompare(effectiveDue(b));
      }
      return (b.updatedAt ?? b.requestedDate).localeCompare(a.updatedAt ?? a.requestedDate);
    });
  }, [requests, branchFilter, statusFilter]);

  const campusSummary = campuses.map((campus) => {
    const campusItems = requests.filter((item) => item.branch === campus);
    return {
      campus,
      requested: campusItems.filter((item) => item.requestedDate.startsWith(selectedMonthKey)).length,
      producing: campusItems.filter((item) => ["approval_pending", "producing", "reviewing"].includes(item.status)).length,
      completed: campusItems.filter((item) => item.status === "completed" && effectiveDue(item).startsWith(selectedMonthKey)).length,
      delayed: campusItems.filter((item) => item.status === "delayed").length,
    };
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    const base = {
      title: String(form.get("title") ?? ""), branch: String(form.get("branch") ?? ""), requester: String(form.get("requester") ?? ""), assetType: String(form.get("assetType") ?? ""),
      purpose: String(form.get("purpose") ?? ""), specifications: String(form.get("specifications") ?? ""), requiredCopy: String(form.get("requiredCopy") ?? ""),
      requestedDate: todayStr(), desiredDate: String(form.get("desiredDate") ?? ""), driveUrl: String(form.get("driveUrl") ?? ""), notes: String(form.get("notes") ?? ""),
    };
    const fresh = { assignee: "", status: "approval_pending" as RequestStatus, progressPercent: 0, delayedReason: "", revisedDueDate: "", resultAssetId: null, history: [{ status: "approval_pending" as RequestStatus, at: new Date().toISOString(), by: base.requester, note: "요청 등록" }] };
    try {
      if (demoMode) {
        const referenceImages = files.map((file) => ({ src: URL.createObjectURL(file), name: file.name }));
        setRequests((current) => [{ id: crypto.randomUUID(), ...base, ...fresh, referenceImages, demo: true }, ...current]);
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
        setRequests((current) => [{ id: data.id!, ...base, ...fresh, updatedAt: new Date().toISOString(), referenceImages: references.map((image) => ({ src: fileUrl(image.key) ?? "", name: image.name })) }, ...current]);
      }
      setFormOpen(false); setFiles([]); setStatusFilter("open"); toast.success("제작 요청을 등록했습니다. 관리자가 확인 후 승인합니다.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "요청을 등록하지 못했습니다."); }
    finally { setSaving(false); }
  }

  async function saveWorkflow(override?: Partial<ProductionRequest>) {
    if (!managed || !canManage) return;
    const merged = { ...managed, ...override };
    const original = requests.find((item) => item.id === merged.id);
    const next = { ...merged, progressPercent: merged.status === "completed" ? 100 : merged.progressPercent };
    if (!next.assignee.trim() && next.status !== "approval_pending") return toast.error("제작 담당자를 입력해 주세요.");
    if (next.status === "delayed" && (!next.delayedReason.trim() || !next.revisedDueDate)) return toast.error("지연 사유와 변경 완료일을 입력해 주세요.");
    setSaving(true);
    try {
      if (!demoMode && !managed.demo) {
        const response = await fetch(`/api/production-requests/${managed.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next.status, assignee: next.assignee, progressPercent: next.progressPercent, driveUrl: next.driveUrl, delayedReason: next.delayedReason, revisedDueDate: next.revisedDueDate, notes: next.notes }) });
        const data = await response.json().catch(() => ({})) as Partial<ProductionRequest> & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "진행 상태를 저장하지 못했습니다.");
        Object.assign(next, data);
      } else if (original && original.status !== next.status) {
        next.history = [...(original.history ?? []), { status: next.status, at: new Date().toISOString(), by: "체험" }];
      }
      setRequests((current) => current.map((item) => item.id === next.id ? next : item)); setManaged(null); toast.success(`${statusLabels[next.status]} 상태로 저장했습니다.`);
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteRequest() {
    if (!managed || !canManage) return;
    setSaving(true);
    try {
      if (!demoMode && !managed.demo) {
        const response = await fetch(`/api/production-requests/${managed.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("요청을 삭제하지 못했습니다.");
      }
      setRequests((current) => current.filter((item) => item.id !== managed.id)); setManaged(null); toast.success("요청을 삭제했습니다.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  async function saveSchedule() {
    if (!canManage) return;
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
    if (!canManage) return;
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

  const boardItems: { key: StatusFilter; label: string; count: number; tone: string }[] = [
    { key: "open", label: "진행 중 전체", count: counts.open, tone: "bg-primary text-primary-foreground" },
    { key: "approval_pending", label: "승인 대기", count: counts.approval_pending, tone: statusTone.approval_pending },
    { key: "producing", label: "제작 중", count: counts.producing, tone: statusTone.producing },
    { key: "reviewing", label: "컨펌 중", count: counts.reviewing, tone: statusTone.reviewing },
    { key: "delayed", label: "지연", count: counts.delayed, tone: statusTone.delayed },
    { key: "completed", label: "완료", count: counts.completed, tone: statusTone.completed },
  ];

  return <div className="space-y-4 sm:space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-[0_10px_35px_rgba(38,33,28,0.06)] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold">캠퍼스 제작 요청 {canManage ? <Badge variant="secondary" className="gap-1"><ShieldCheck className="size-3.5" />관리자</Badge> : <Badge variant="outline" className="gap-1"><Eye className="size-3.5" />보기·요청</Badge>}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{canManage ? "요청을 승인하고 제작 진행·완료 상태를 업데이트합니다." : "누구나 제작을 요청할 수 있어요. 승인과 진행 상태는 관리자가 업데이트합니다."}</p>
      </div>
      <Button className="h-11 rounded-xl sm:h-10" onClick={() => setFormOpen(true)}><Plus className="size-4" />새 제작 요청</Button>
    </div>
    {demoMode && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">체험판에서는 일정과 진행 상태를 직접 시험할 수 있으며 새로고침하면 초기화됩니다.</div>}

    {/* 상태판 */}
    <Card className="rounded-2xl py-0"><CardContent className="space-y-4 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">요청 현황</h2>
        <div className="flex flex-wrap gap-1.5">{["all", ...campuses].map((campus) => <button key={campus} type="button" onClick={() => { setBranchFilter(campus); setListLimit(10); }} className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] ${branchFilter === campus ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{campus !== "all" && <CampusDot branch={campus} />}{campus === "all" ? "전체" : short[campus]}</button>)}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {boardItems.map((item) => <button key={item.key} type="button" onClick={() => { setStatusFilter(item.key); setListLimit(10); }} className={`relative rounded-xl border p-2.5 text-left transition sm:p-3 ${statusFilter === item.key ? "border-primary ring-2 ring-primary/20" : "border-border/70 hover:bg-muted/40"}`}>
          <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold sm:text-xs ${item.tone}`}>{item.label}</span>
          <b className="mt-1.5 block text-xl tabular-nums sm:text-2xl">{item.count}<span className="ml-0.5 text-sm font-medium text-muted-foreground">건</span></b>
          {canManage && item.key === "approval_pending" && item.count > 0 && <span className="absolute top-2 right-2 size-2 animate-pulse rounded-full bg-amber-500" aria-label="처리 필요" />}
        </button>)}
      </div>
      {canManage && counts.approval_pending > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">승인 대기 중인 요청이 <b>{counts.approval_pending}건</b> 있어요. 눌러서 담당자를 정하고 승인해 주세요.</p>}

      {/* 요청 목록 */}
      <div className="divide-y overflow-hidden rounded-xl border">
        {loading && <p className="p-6 text-center text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />불러오는 중…</p>}
        {!loading && listed.slice(0, listLimit).map((item) => <RequestRow key={item.id} item={item} onOpen={() => setManaged({ ...item })} />)}
        {!loading && !listed.length && <p className="p-8 text-center text-sm text-muted-foreground">해당하는 요청이 없습니다.</p>}
        {listed.length > listLimit && <button type="button" className="w-full p-3 text-sm font-medium text-primary hover:bg-muted/40" onClick={() => setListLimit((n) => n + 10)}>더 보기 ({listed.length - listLimit}건)</button>}
      </div>
    </CardContent></Card>

    <ProductionScheduleView monthCursor={monthCursor} setMonthCursor={setMonthCursor} selectedDate={selectedDate} setSelectedDate={setSelectedDate} schedules={schedules} requests={requests} priority={currentPriority} canManage={canManage} onPriority={savePriority} onOpenSchedule={(item) => setScheduleDraft({ ...item })} onOpenRequest={(item) => setManaged({ ...item })} onNewSchedule={openNewSchedule} />

    {/* 캠퍼스별 현황 */}
    <Card className="rounded-2xl py-0"><CardContent className="p-4 md:p-5">
      <h2 className="font-semibold">{selectedMonthKey.replace("-", "년 ")}월 캠퍼스별 현황</h2>
      <p className="mt-1 text-sm text-muted-foreground">카드를 누르면 위 목록이 그 캠퍼스 요청만 보여줍니다.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">{campusSummary.map((item) => <button key={item.campus} type="button" onClick={() => { setBranchFilter(item.campus); setStatusFilter("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`rounded-xl border p-3 text-left hover:bg-muted/40 ${branchFilter === item.campus ? "border-primary bg-primary/5" : ""}`}>
        <span className="flex items-center gap-1.5 font-semibold"><CampusDot branch={item.campus} />{short[item.campus]}캠퍼스</span>
        <span className="mt-2 grid grid-cols-4 gap-1 text-center text-[12px] text-muted-foreground">
          <span><b className="block text-base text-foreground tabular-nums">{item.requested}</b>이달 요청</span>
          <span><b className="block text-base text-foreground tabular-nums">{item.producing}</b>진행</span>
          <span><b className="block text-base text-foreground tabular-nums">{item.completed}</b>완료</span>
          <span><b className={`block text-base tabular-nums ${item.delayed ? "text-rose-600" : "text-foreground"}`}>{item.delayed}</b>지연</span>
        </span>
      </button>)}</div>
    </CardContent></Card>

    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>새 제작 요청</DialogTitle><DialogDescription>요청하면 '승인 대기'로 등록되고, 관리자가 담당자를 정해 승인합니다. 참고 이미지는 최대 10장까지 첨부할 수 있어요.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <RequestField label="제작물 제목" name="title" placeholder="예: 겨울특강 모집 현수막" required />
          <RequestSelect label="캠퍼스" name="branch" items={campuses.map((value) => [value, value])} defaultValue={myCampus()} />
          <RequestField label="요청자" name="requester" defaultValue={myName()} placeholder="원장명 또는 담당자" required />
          <RequestField label="제작물 종류" name="assetType" placeholder="현수막, 배너, 카드뉴스" required />
          <RequestField label="희망 완료일" name="desiredDate" type="date" min={todayStr()} required />
          <RequestField label="규격·수량" name="specifications" placeholder="예: A2 2장 / 1080×1350px" />
        </div>
        <RequestText label="사용 목적과 채널" name="purpose" placeholder="예: 인스타그램 피드 + 원내 게시" />
        <RequestText label="필수 문구" name="requiredCopy" placeholder="꼭 들어가야 하는 문구, 날짜, 연락처" />
        <div className="space-y-2"><Label>레퍼런스 이미지</Label><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"><ImagePlus className="mb-2 size-5" />{files.length ? `${files.length}장 선택됨` : "이미지 최대 10장 선택"}<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 10))} /></label></div>
        <RequestField label="참고 자료 Google Drive 링크" name="driveUrl" type="url" placeholder="원본 사진·로고 폴더 링크 (선택)" />
        <RequestText label="추가 요청사항" name="notes" />
        <DialogFooter className="gap-2"><Button type="button" variant="outline" className="h-11 sm:h-10" onClick={() => setFormOpen(false)}>취소</Button><Button className="h-11 sm:h-10" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Send />}요청 등록</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>

    <RequestDialog item={managed} setItem={setManaged} canManage={canManage} saving={saving} onSave={saveWorkflow} onDelete={deleteRequest} onOpenMarketing={onOpenMarketing} />
    <ScheduleDialog item={scheduleDraft} setItem={setScheduleDraft} canManage={canManage} saving={saving} onSave={saveSchedule} />
  </div>;
}

function RequestRow({ item, onOpen }: { item: ProductionRequest; onOpen: () => void }) {
  const due = effectiveDue(item);
  const late = item.status !== "completed" && due && due < todayStr();
  return <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 bg-card px-3.5 py-3 text-left hover:bg-muted/40 sm:px-4">
    <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: campusColor(item.branch) }} />
    <span className="min-w-0 flex-1">
      <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 font-medium leading-6">{item.title}</span><Badge className={`shrink-0 ${statusTone[item.status]}`}>{statusLabels[item.status]}</Badge></span>
      <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{short[item.branch] ?? item.branch} · {item.assetType} · {item.requester}</span>
      <span className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className={`block h-full rounded-full ${statusBar[item.status]}`} style={{ width: `${item.status === "completed" ? 100 : Math.max(item.progressPercent, 4)}%` }} /></span>
        <span className="shrink-0 tabular-nums">{item.status === "completed" ? `완료 ${dotted(item.completedAt ?? due)}` : <>마감 {dotted(due).slice(5)} <b className={late ? "text-rose-600" : "text-foreground"}>{dday(due)}</b></>}</span>
      </span>
      <span className="mt-1 block text-[12px] text-muted-foreground">담당 {item.assignee || "미정"}</span>
    </span>
  </button>;
}

function ProductionScheduleView({ monthCursor, setMonthCursor, selectedDate, setSelectedDate, schedules, requests, priority, canManage, onPriority, onOpenSchedule, onOpenRequest, onNewSchedule }: { monthCursor: Date; setMonthCursor: React.Dispatch<React.SetStateAction<Date>>; selectedDate: string; setSelectedDate: (date: string) => void; schedules: ProductionSchedule[]; requests: ProductionRequest[]; priority: string; canManage: boolean; onPriority: (branch: string) => void; onOpenSchedule: (item: ProductionSchedule) => void; onOpenRequest: (item: ProductionRequest) => void; onNewSchedule: (date: string) => void }) {
  const year = monthCursor.getFullYear(); const month = monthCursor.getMonth() + 1; const key = monthKey(monthCursor);
  const firstDay = new Date(year, month - 1, 1).getDay(); const lastDate = new Date(year, month, 0).getDate();
  const rawDays = Array.from({ length: firstDay + lastDate }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const days = [...rawDays, ...Array.from({ length: (7 - rawDays.length % 7) % 7 }, () => null)];
  const monthSchedules = schedules.filter((item) => item.scheduleDate.startsWith(key));
  const todayKey = todayStr();
  const daySchedules = schedules.filter((item) => item.scheduleDate === selectedDate);
  const dayRequests = requests.filter((item) => effectiveDue(item) === selectedDate);
  function dateFor(day: number) { return `${key}-${String(day).padStart(2, "0")}`; }
  function moveMonth(amount: number) { setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)); }
  const [sy, sm, sd] = selectedDate.split("-").map(Number);
  return <Card className="overflow-hidden rounded-2xl py-0"><CardContent className="p-4 md:p-5">
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" /><h2 className="font-semibold">주요 일정</h2></div><p className="mt-1 text-sm text-muted-foreground">날짜를 누르면 그날 일정과 마감 요청을 아래에서 볼 수 있어요.{canManage ? " 일정 추가·수정은 관리자만 가능합니다." : ""}</p></div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/35 px-3 py-2"><span className="text-sm text-muted-foreground">이번 달 우선 캠퍼스</span>{canManage ? <Select value={priority} onValueChange={onPriority}><SelectTrigger className="h-8 w-24 bg-background"><SelectValue /></SelectTrigger><SelectContent>{campuses.map((campus) => <SelectItem key={campus} value={campus}>{short[campus]}</SelectItem>)}</SelectContent></Select> : <Badge>{short[priority]}</Badge>}<span className="flex items-center gap-1.5 text-xs text-muted-foreground"><CampusDot branch="김해" />김해→<CampusDot branch="센텀" />센텀→<CampusDot branch="명지" />명지 순환</span></div>
    </div>
    <Tabs defaultValue="monthly"><TabsList><TabsTrigger value="monthly">월간</TabsTrigger><TabsTrigger value="annual">연간</TabsTrigger></TabsList>
      <TabsContent value="monthly" className="mt-3">
        <div className="mb-3 flex items-center justify-between rounded-xl bg-muted/55 px-2 py-1.5"><Button type="button" size="icon" variant="ghost" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft /></Button><b>{year}년 {month}월</b><Button type="button" size="icon" variant="ghost" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight /></Button></div>
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border text-center text-xs text-muted-foreground">
          {["일", "월", "화", "수", "목", "금", "토"].map((day, weekIndex) => <div key={day} className={`border-b border-r bg-muted/35 py-2 text-[13px] font-semibold last:border-r-0 ${weekIndex === 0 ? "text-brand" : weekIndex === 6 ? "text-[#2f6fdb]" : "text-foreground/70"}`}>{day}</div>)}
          {days.map((day, index) => {
            const date = day ? dateFor(day) : "";
            const ds = day ? monthSchedules.filter((item) => item.scheduleDate === date) : [];
            const dr = day ? requests.filter((item) => effectiveDue(item) === date) : [];
            const selected = date === selectedDate;
            return <div key={`${day ?? "empty"}-${index}`} role={day ? "button" : undefined} tabIndex={day ? 0 : -1} aria-label={day ? `${month}월 ${day}일 일정 ${ds.length + dr.length}건` : undefined} onClick={() => day && setSelectedDate(date)} onKeyDown={(event) => { if (day && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedDate(date); } }} className={`flex min-h-14 min-w-0 cursor-pointer flex-col items-stretch justify-start border-b border-r p-1 text-left md:min-h-24 md:p-1.5 ${day ? (selected ? "bg-primary/8 ring-2 ring-inset ring-primary/40" : "bg-card hover:bg-muted/30") : "pointer-events-none bg-muted/15"} ${index % 7 === 6 ? "border-r-0" : ""}`}>
              {day && <span className={`inline-grid size-6 shrink-0 place-items-center self-center rounded-full text-xs font-semibold md:self-start ${date === todayKey ? "bg-brand text-white" : index % 7 === 0 ? "text-brand" : index % 7 === 6 ? "text-[#2f6fdb]" : "text-foreground"}`}>{day}</span>}
              {/* 휴대폰: 점만 */}
              {(ds.length + dr.length > 0) && <span className="mt-1 flex flex-wrap justify-center gap-0.5 md:hidden">{[...ds.map((item) => ({ id: item.id, color: campusColor(item.branch), square: true })), ...dr.map((item) => ({ id: item.id, color: campusColor(item.branch), square: false }))].slice(0, 4).map((dot) => <span key={dot.id} className={`size-1.5 ${dot.square ? "rounded-[1px]" : "rounded-full"}`} style={{ background: dot.color }} />)}</span>}
              {/* PC: 제목 */}
              <span className="hidden md:block">
                {ds.slice(0, 2).map((item) => <span key={item.id} className={`mt-1 block truncate rounded border-l-[3px] px-1.5 py-0.5 text-xs leading-4 ${statusTone[item.status]}`} style={{ borderLeftColor: campusColor(item.branch) }}>{item.title}</span>)}
                {dr.slice(0, 1).map((item) => <span key={item.id} className="mt-1 block truncate rounded border-l-[3px] bg-brand-soft px-1.5 py-0.5 text-xs leading-4 text-foreground" style={{ borderLeftColor: campusColor(item.branch) }}>요청 · {item.title}</span>)}
                {ds.length + dr.length > 3 && <span className="mt-1 block text-[11px]">외 {ds.length + dr.length - 3}건</span>}
              </span>
            </div>;
          })}
        </div>
        {/* 선택한 날 목록 */}
        <div className="mt-3 rounded-xl border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><b className="text-sm">{sm}월 {sd}일{sy !== year ? ` (${sy})` : ""} · {daySchedules.length + dayRequests.length}건</b>{canManage && <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => onNewSchedule(selectedDate)}><Plus className="size-3.5" />일정 추가</Button>}</div>
          {!daySchedules.length && !dayRequests.length && <p className="py-3 text-center text-sm text-muted-foreground">이 날은 일정이나 마감 요청이 없어요.</p>}
          <div className="space-y-1.5">
            {daySchedules.map((item) => <button key={item.id} type="button" onClick={() => onOpenSchedule(item)} className="flex w-full items-center gap-2.5 rounded-lg border-l-4 bg-card px-3 py-2.5 text-left shadow-xs" style={{ borderLeftColor: campusColor(item.branch) }}><CalendarDays className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">일정 · {short[item.branch] ?? item.branch} · {item.assetType || "제작물 미정"}</span></span><Badge className={statusTone[item.status]}>{statusLabels[item.status]}</Badge></button>)}
            {dayRequests.map((item) => <button key={item.id} type="button" onClick={() => onOpenRequest(item)} className="flex w-full items-center gap-2.5 rounded-lg border-l-4 bg-card px-3 py-2.5 text-left shadow-xs" style={{ borderLeftColor: campusColor(item.branch) }}><FileText className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">마감 요청 · {short[item.branch] ?? item.branch} · 담당 {item.assignee || "미정"}</span></span><Badge className={statusTone[item.status]}>{statusLabels[item.status]}</Badge></button>)}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="annual" className="mt-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 12 }, (_, index) => index + 1).map((itemMonth) => { const itemKey = `${year}-${String(itemMonth).padStart(2, "0")}`; const items = schedules.filter((item) => item.scheduleDate.startsWith(itemKey)); return <div key={itemMonth} className={`rounded-xl border p-3 ${itemMonth === month ? "border-primary bg-primary/5" : ""}`}><div className="mb-2 flex items-center justify-between"><b>{itemMonth}월</b><Badge variant="secondary">{items.length}건</Badge></div>{items.slice(0, 3).map((item) => <button key={item.id} type="button" className="block w-full truncate py-1 text-left text-sm hover:text-primary" onClick={() => onOpenSchedule({ ...item })}>{item.scheduleDate.slice(8)}일 · {item.title}</button>)}{!items.length && (canManage ? <button type="button" className="text-sm text-muted-foreground" onClick={() => { setMonthCursor(new Date(year, itemMonth - 1, 1)); onNewSchedule(`${itemKey}-01`); }}>+ 일정 추가</button> : <p className="text-sm text-muted-foreground">일정 없음</p>)}</div>; })}</div></TabsContent>
    </Tabs>
  </CardContent></Card>;
}

const flowSteps: RequestStatus[] = ["approval_pending", "producing", "reviewing", "completed"];

function RequestDialog({ item, setItem, canManage, saving, onSave, onDelete, onOpenMarketing }: { item: ProductionRequest | null; setItem: (item: ProductionRequest | null) => void; canManage: boolean; saving: boolean; onSave: (override?: Partial<ProductionRequest>) => void; onDelete: () => void; onOpenMarketing: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setConfirmDelete(false), [item?.id]);
  if (!item) return null;
  const due = effectiveDue(item);
  const stepIndex = item.status === "delayed" ? 1 : flowSteps.indexOf(item.status);
  const quick: { label: string; status: RequestStatus; progress: number } | null = item.status === "approval_pending" ? { label: "승인하고 제작 시작", status: "producing", progress: 45 }
    : item.status === "producing" || item.status === "delayed" ? { label: "시안 완료 · 컨펌 요청", status: "reviewing", progress: 80 }
    : item.status === "reviewing" ? { label: "최종 완료 처리", status: "completed", progress: 100 } : null;
  return <Dialog open onOpenChange={(open) => !open && setItem(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader className="text-left"><DialogTitle className="pr-6 leading-7">{item.title}</DialogTitle><DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="inline-flex items-center gap-1"><CampusDot branch={item.branch} />{item.branch}</span><span>· 요청 {dotted(item.requestedDate)}</span><span>· 마감 {dotted(due)} {item.status !== "completed" && <b className="text-foreground">{dday(due)}</b>}</span></DialogDescription></DialogHeader>

    {/* 진행 단계 */}
    <div className="rounded-xl border p-3">
      <div className="grid grid-cols-4 gap-1">{flowSteps.map((step, index) => <div key={step} className="text-center"><div className={`mx-auto h-1.5 rounded-full ${index <= stepIndex ? statusBar[item.status === "delayed" && index === 1 ? "delayed" : step] : "bg-muted"}`} /><span className={`mt-1.5 block text-[11px] sm:text-xs ${index === stepIndex ? "font-bold text-foreground" : "text-muted-foreground"}`}>{item.status === "delayed" && index === 1 ? "지연" : statusLabels[step]}</span></div>)}</div>
      <div className="mt-2 flex items-center justify-between text-sm"><Badge className={statusTone[item.status]}>{statusLabels[item.status]}</Badge><span className="text-muted-foreground">작업률 <b className="text-foreground tabular-nums">{item.status === "completed" ? 100 : item.progressPercent}%</b> · 담당 <b className="text-foreground">{item.assignee || "미정"}</b></span></div>
      {item.status === "delayed" && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">지연 사유: {item.delayedReason || "-"} · 변경 완료일 {dotted(item.revisedDueDate)}</p>}
    </div>

    {item.referenceImages?.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{item.referenceImages.slice(0, 8).map((image, index) => <div key={`${image.src}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-muted"><Image src={image.src} alt={image.name ?? "참고 이미지"} fill unoptimized className="object-cover" /></div>)}</div> : null}
    <dl className="grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2">
      <Info label="제작물" value={`${item.assetType} · ${item.specifications || "규격 미입력"}`} />
      <Info label="요청자" value={item.requester} />
      <Info label="사용 목적" value={item.purpose} wide />
      <Info label="필수 문구" value={item.requiredCopy} wide />
      {item.notes && <Info label={canManage ? "메모" : "추가 요청사항·메모"} value={item.notes} wide />}
    </dl>

    {/* 처리 기록 */}
    {item.history?.length ? <div><p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Clock3 className="size-4" />처리 기록</p><ol className="space-y-1.5 border-l-2 border-border pl-3">{item.history.map((h, index) => <li key={index} className="relative text-sm"><span className={`absolute top-1.5 -left-[17px] size-2.5 rounded-full ${statusBar[h.status] ?? "bg-muted"}`} /><b>{statusLabels[h.status] ?? h.status}</b> <span className="text-muted-foreground">· {stamp(h.at)}{h.by ? ` · ${h.by}` : ""}{h.note ? ` · ${h.note}` : ""}</span></li>)}</ol></div> : null}

    {canManage ? <div className="space-y-4 rounded-xl border-2 border-primary/15 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" />관리자 처리</p>
      {quick && <Button type="button" className="h-11 w-full rounded-xl" disabled={saving} onClick={() => onSave({ status: quick.status, progressPercent: Math.max(item.progressPercent, quick.progress) })}><CheckCircle2 />{quick.label}</Button>}
      {quick && <p className="-mt-2 text-center text-xs text-muted-foreground">또는 아래에서 단계·담당자·작업률을 직접 바꾸고 저장하세요.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>진행 단계</Label><Select value={item.status} onValueChange={(value) => { const status = value as RequestStatus; setItem({ ...item, status, progressPercent: status === "completed" ? 100 : Math.max(item.progressPercent, statusProgress[status]) }); }}><SelectTrigger className="h-11 sm:h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <RequestField label="제작 담당자" name="assignee" value={item.assignee} placeholder="예: 제작실장" onChange={(event) => setItem({ ...item, assignee: event.target.value })} />
      </div>
      <div className="space-y-3"><div className="flex justify-between text-sm"><Label>작업률</Label><b>{item.progressPercent}%</b></div><Slider value={[item.progressPercent]} max={100} step={5} onValueChange={(value) => setItem({ ...item, progressPercent: value[0] ?? 0 })} /></div>
      {item.status === "delayed" && <div className="grid gap-4 sm:grid-cols-2"><RequestField label="변경 완료일" name="revisedDueDate" type="date" value={item.revisedDueDate} onChange={(event) => setItem({ ...item, revisedDueDate: event.target.value })} /><RequestField label="지연 사유" name="delayedReason" value={item.delayedReason} onChange={(event) => setItem({ ...item, delayedReason: event.target.value })} /></div>}
      <RequestField label="Google Drive 완성본 링크" name="driveUrl" type="url" value={item.driveUrl} onChange={(event) => setItem({ ...item, driveUrl: event.target.value })} />
      <RequestText label="메모" name="notes" value={item.notes} onChange={(event) => setItem({ ...item, notes: event.target.value })} />
      <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" className={confirmDelete ? "text-rose-600" : "text-muted-foreground"} disabled={saving} onClick={() => { if (confirmDelete) onDelete(); else setConfirmDelete(true); }}><Trash2 className="size-4" />{confirmDelete ? "한 번 더 누르면 삭제돼요" : "요청 삭제"}</Button></div>
    </div> : <p className="flex items-center gap-1.5 rounded-xl bg-muted/45 px-3 py-2.5 text-sm text-muted-foreground"><Lock className="size-4 shrink-0" />승인과 진행 상태 변경은 관리자만 할 수 있어요.</p>}

    <DialogFooter className="gap-2">
      <Button variant="outline" className="h-11 sm:h-10" onClick={() => setItem(null)}>닫기</Button>
      {item.driveUrl && /^https?:\/\//.test(item.driveUrl) && <Button variant="outline" className="h-11 sm:h-10" asChild><a href={item.driveUrl} target="_blank" rel="noreferrer"><ExternalLink />Drive</a></Button>}
      {item.status === "completed" && <Button variant="outline" className="h-11 sm:h-10" onClick={onOpenMarketing}><FileText />제작물 보기</Button>}
      {canManage && <Button className="h-11 sm:h-10" onClick={() => onSave()} disabled={saving}>{saving && <LoaderCircle className="animate-spin" />}저장</Button>}
    </DialogFooter>
  </DialogContent></Dialog>;
}

function Info({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words">{value?.trim() || "미입력"}</dd></div>;
}

function ScheduleDialog({ item, setItem, canManage, saving, onSave }: { item: ProductionSchedule | null; setItem: (item: ProductionSchedule | null) => void; canManage: boolean; saving: boolean; onSave: () => void }) {
  if (!item) return null;
  if (!canManage) return <Dialog open onOpenChange={(open) => !open && setItem(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
    <DialogHeader className="text-left"><DialogTitle>{item.title}</DialogTitle><DialogDescription>{dotted(item.scheduleDate)} · {item.branch}</DialogDescription></DialogHeader>
    <dl className="grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2"><Info label="상태" value={statusLabels[item.status]} /><Info label="제작물 종류" value={item.assetType} /><Info label="담당자" value={item.manager} />{item.status === "delayed" && <Info label="지연" value={`${item.delayedReason} · 변경일 ${dotted(item.revisedDueDate)}`} />}<Info label="메모" value={item.notes} wide /></dl>
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="size-4" />일정 수정은 관리자만 할 수 있어요.</p>
    <DialogFooter><Button variant="outline" className="h-11 sm:h-10" onClick={() => setItem(null)}>닫기</Button></DialogFooter>
  </DialogContent></Dialog>;
  return <Dialog open onOpenChange={(open) => !open && setItem(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>주요 일정 편집</DialogTitle><DialogDescription>날짜와 진행 상태를 바꾸면 달력에 바로 반영됩니다.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><RequestField label="일정 제목" name="scheduleTitle" value={item.title} onChange={(event) => setItem({ ...item, title: event.target.value })} /><RequestField label="일정 날짜" name="scheduleDate" type="date" value={item.scheduleDate} onChange={(event) => setItem({ ...item, scheduleDate: event.target.value })} /><div className="space-y-2"><Label>캠퍼스</Label><Select value={item.branch} onValueChange={(branch) => setItem({ ...item, branch })}><SelectTrigger className="h-11 sm:h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="본사 공통">본사 공통</SelectItem>{campuses.map((campus) => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}</SelectContent></Select></div><RequestField label="제작물 종류" name="scheduleAssetType" value={item.assetType} onChange={(event) => setItem({ ...item, assetType: event.target.value })} /><RequestField label="담당자" name="scheduleManager" value={item.manager} onChange={(event) => setItem({ ...item, manager: event.target.value })} /><div className="space-y-2"><Label>상태</Label><Select value={item.status} onValueChange={(status) => setItem({ ...item, status: status as RequestStatus })}><SelectTrigger className="h-11 sm:h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>{item.status === "delayed" && <div className="grid gap-4 sm:grid-cols-2"><RequestField label="변경 예정일" name="scheduleRevised" type="date" value={item.revisedDueDate} onChange={(event) => setItem({ ...item, revisedDueDate: event.target.value })} /><RequestField label="지연 사유" name="scheduleDelay" value={item.delayedReason} onChange={(event) => setItem({ ...item, delayedReason: event.target.value })} /></div>}<RequestText label="일정 메모" name="scheduleNotes" value={item.notes} onChange={(event) => setItem({ ...item, notes: event.target.value })} /><DialogFooter className="gap-2"><Button variant="outline" className="h-11 sm:h-10" onClick={() => setItem(null)}>취소</Button><Button className="h-11 sm:h-10" onClick={onSave} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}일정 저장</Button></DialogFooter></DialogContent></Dialog>;
}

function RequestField({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} className="h-11 rounded-xl sm:h-9" {...props} /></div>; }
function RequestText({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Textarea>) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} className="min-h-24 rounded-xl" {...props} /></div>; }
function RequestSelect({ label, name, items, defaultValue }: { label: string; name: string; items: (readonly [string, string])[]; defaultValue?: string }) { return <div className="space-y-2"><Label>{label}</Label><Select name={name} defaultValue={defaultValue ?? items[0]?.[0]}><SelectTrigger className="h-11 rounded-xl sm:h-9"><SelectValue /></SelectTrigger><SelectContent>{items.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select></div>; }
