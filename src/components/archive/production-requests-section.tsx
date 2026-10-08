"use client";

import { markRead, ReadBadge } from "./read-badge";
import Image from "next/image";
import { fileUrl, getMe } from "@/archive-api";
import { CampusDot, campusColor } from "@/lib/campus";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Images, X, Pencil, Upload, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ExternalLink, Eye, FileText, ImagePlus, LoaderCircle, Lock, Plus, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MarketingPicker, takeRequestPrefill, type PickedRef } from "./marketing-picker";

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
type ProgressImage = { key: string; src?: string | null; name?: string; caption?: string; at?: string; by?: string };
type HistoryItem = { status: RequestStatus; at: string; by?: string; note?: string };
type ProductionRequest = {
  id: string; title: string; branch: string; requester: string; assetType: string; purpose: string; specifications: string;
  requiredCopy: string; requestedDate: string; desiredDate: string; assignee: string; status: RequestStatus; progressPercent: number;
  driveUrl: string; delayedReason: string; revisedDueDate: string; notes: string; resultAssetId: string | null;
  referenceImages?: ReferenceImage[]; progressImages?: ProgressImage[]; createdById?: string | null; refAssets?: { id: string; title: string }[]; history?: HistoryItem[]; createdBy?: string; approvedAt?: string; approvedBy?: string; completedAt?: string; updatedAt?: string; demo?: boolean;
};
type ProductionSchedule = {
  id: string; title: string; branch: string; scheduleDate: string; assetType: string; manager: string; status: RequestStatus;
  notes: string; delayedReason: string; revisedDueDate: string; linkedRequestId: string | null; demo?: boolean;
};
type PriorityOverride = { monthKey: string; branch: string };
type WeeklyPlan = { days: Record<string, string>; exceptions: Record<string, string>; updatedAt?: string; updatedBy?: string };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** 그날 제작실 일정: 날짜 예외가 있으면 그것, 없으면 요일 고정 */
function planFor(plan: WeeklyPlan, date: string) {
  if (!date) return "";
  if (plan.exceptions[date] !== undefined) return plan.exceptions[date];
  return plan.days[String(new Date(date + "T00:00:00").getDay())] ?? "";
}
type StatusFilter = "open" | "all" | RequestStatus;

const campuses = ["김해캠퍼스", "센텀캠퍼스", "명지캠퍼스", "공동"] as const; // 공동 = 여러 캠퍼스가 함께 쓰는 작업물
const ROTATION = ["김해캠퍼스", "센텀캠퍼스", "명지캠퍼스"] as const; // 이달 우선 캠퍼스 순환
const short: Record<string, string> = { 김해캠퍼스: "김해", 센텀캠퍼스: "센텀", 명지캠퍼스: "명지", 공동: "공동", "본사 공통": "공동" };
/** 예전 '본사 공통'도 '공동'으로 센다 */
const branchOf = (b: string) => (b === "본사 공통" ? "공동" : b);
/** 진행 중 = 완료가 아닌 모든 건 (지연 포함) — 위 상태판과 아래 캠퍼스 현황이 같은 기준 */
const isOpen = (s: RequestStatus) => s !== "completed";
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
  return ROTATION[((diff % ROTATION.length) + ROTATION.length) % ROTATION.length];
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
async function uploadImage(file: File) {
  const upload = new FormData(); upload.set("file", file); upload.set("purpose", "preview");
  const response = await fetch("/api/uploads", { method: "POST", body: upload });
  const result = await response.json() as { key?: string; name?: string; error?: string };
  if (!response.ok || !result.key) throw new Error(result.error ?? "이미지를 올리지 못했습니다.");
  return { key: result.key, name: result.name ?? file.name };
}
function myName() { const me = getMe(); return me ? `${me.name}${me.title ? " " + me.title : ""}` : ""; }

export function ProductionRequestsSection({ role, demoMode, onOpenMarketing }: { role: Role; demoMode: boolean; onOpenMarketing: (assetId?: string) => void }) {
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
  const [picked, setPicked] = useState<PickedRef[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  // 마케팅 제작물에서 "이걸로 제작 요청하기"로 넘어오면 요청서를 바로 연다
  useEffect(() => { const refs = takeRequestPrefill(); if (refs.length) { setPicked(refs.slice(0, 10)); setFormOpen(true); } }, []);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [managed, setManaged] = useState<ProductionRequest | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ProductionSchedule | null>(null);
  const [completing, setCompleting] = useState<ProductionRequest | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan>({ days: {}, exceptions: {} });
  const [planOpen, setPlanOpen] = useState(false);
  const [dueDraft, setDueDraft] = useState("");
  const canManage = role === "admin" || getMe()?.title === "제작실장" || demoMode;
  const selectedMonthKey = monthKey(monthCursor);
  const currentPriority = overrides.find((item) => item.monthKey === selectedMonthKey)?.branch ?? defaultPriority(selectedMonthKey);

  useEffect(() => {
    if (demoMode) return;
    Promise.all([
      fetch("/api/production-requests", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ requests?: ProductionRequest[] }> : { requests: [] }),
      fetch("/api/production-schedules", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ schedules?: ProductionSchedule[] }> : { schedules: [] }),
      fetch("/api/production-priority", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ overrides?: PriorityOverride[] }> : { overrides: [] }),
      fetch("/api/production-weekly", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ plan?: WeeklyPlan }> : { plan: undefined }).catch(() => ({ plan: undefined })),
    ]).then(([requestData, scheduleData, priorityData, weeklyData]) => {
      if (weeklyData.plan) setPlan({ days: weeklyData.plan.days ?? {}, exceptions: weeklyData.plan.exceptions ?? {}, updatedAt: weeklyData.plan.updatedAt, updatedBy: weeklyData.plan.updatedBy });
      setRequests(requestData.requests ?? []);
      setSchedules(scheduleData.schedules ?? []);
      setOverrides(priorityData.overrides ?? []);
    }).catch(() => toast.error("제작 요청을 불러오지 못했습니다.")).finally(() => setLoading(false));
  }, [demoMode]);

  // 알림에서 특정 요청 바로 열기
  useEffect(() => {
    if (loading) return;
    const open = (id: string | null) => { const hit = id ? requests.find((r) => r.id === id) : null; if (hit) { setManaged({ ...hit }); try { sessionStorage.removeItem("archive-open"); } catch { /* 무시 */ } } };
    try { open(sessionStorage.getItem("archive-open")); } catch { /* 무시 */ }
    const onEvent = (event: Event) => open(String((event as CustomEvent).detail ?? ""));
    window.addEventListener("archive-open", onEvent);
    return () => window.removeEventListener("archive-open", onEvent);
  }, [loading, requests]);

  const counts = useMemo(() => {
    const scoped = requests.filter((item) => branchFilter === "all" || branchOf(item.branch) === branchFilter);
    const by = Object.fromEntries(statusOrder.map((status) => [status, scoped.filter((item) => item.status === status).length])) as Record<RequestStatus, number>;
    return { ...by, open: scoped.filter((item) => isOpen(item.status)).length, all: scoped.length };
  }, [requests, branchFilter]);

  const listed = useMemo(() => {
    const rows = requests.filter((item) => (branchFilter === "all" || branchOf(item.branch) === branchFilter) && (statusFilter === "all" ? true : statusFilter === "open" ? isOpen(item.status) : item.status === statusFilter));
    return rows.sort((a, b) => {
      if (statusFilter === "open") {
        const rank = (s: RequestStatus) => (s === "delayed" ? 0 : s === "approval_pending" ? 1 : 2);
        return rank(a.status) - rank(b.status) || effectiveDue(a).localeCompare(effectiveDue(b));
      }
      return (b.updatedAt ?? b.requestedDate).localeCompare(a.updatedAt ?? a.requestedDate);
    });
  }, [requests, branchFilter, statusFilter]);

  const campusSummary = campuses.map((campus) => {
    const campusItems = requests.filter((item) => branchOf(item.branch) === campus);
    return {
      campus,
      requested: campusItems.filter((item) => item.requestedDate.startsWith(selectedMonthKey)).length,
      producing: campusItems.filter((item) => isOpen(item.status)).length,
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
        const referenceImages = [...picked.map((r) => ({ src: r.src, name: r.name })), ...files.map((file) => ({ src: URL.createObjectURL(file), name: file.name }))];
        setRequests((current) => [{ id: crypto.randomUUID(), ...base, ...fresh, referenceImages, demo: true }, ...current]);
      } else {
        const references: { key: string; name: string }[] = picked.map((r) => ({ key: r.key, name: `${r.assetTitle} · ${r.name}` }));
        const refAssets = [...new Map(picked.map((r) => [r.assetId, { id: r.assetId, title: r.assetTitle }])).values()];
        for (const file of files) {
          const upload = new FormData(); upload.set("file", file); upload.set("purpose", "preview");
          const response = await fetch("/api/uploads", { method: "POST", body: upload });
          const result = await response.json() as { key?: string; name?: string; error?: string };
          if (!response.ok || !result.key) throw new Error(result.error ?? "참고 이미지 업로드에 실패했습니다.");
          references.push({ key: result.key, name: result.name ?? file.name });
        }
        const response = await fetch("/api/production-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, references, refAssets }) });
        const data = await response.json() as { id?: string; error?: string };
        if (!response.ok || !data.id) throw new Error(data.error ?? "요청을 등록하지 못했습니다.");
        setRequests((current) => [{ id: data.id!, ...base, ...fresh, updatedAt: new Date().toISOString(), referenceImages: references.map((image) => ({ src: fileUrl(image.key) ?? "", name: image.name })), refAssets }, ...current]);
      }
      setFormOpen(false); setFiles([]); setPicked([]); setDueDraft(""); setStatusFilter("open"); toast.success("제작 요청을 등록했습니다. 관리자가 확인 후 승인합니다.");
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
    // 완료는 완료 창에서 (결과 이미지 → 마케팅 제작물 + 드라이브)
    if (next.status === "completed" && original?.status !== "completed" && !demoMode && !managed.demo) { setCompleting(next); return; }
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
    if (!managed) return;
    setSaving(true);
    try {
      if (!demoMode && !managed.demo) {
        const response = await fetch(`/api/production-requests/${managed.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "요청을 삭제하지 못했습니다.");
      }
      setRequests((current) => current.filter((item) => item.id !== managed.id)); setManaged(null); toast.success("요청을 삭제했습니다.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  // 요청자 본인 수정 ('승인 대기'일 때)
  async function editOwn(patch: Partial<ProductionRequest>) {
    if (!managed) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/production-requests/${managed.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...managed, ...patch }) });
      const data = await response.json().catch(() => ({})) as Partial<ProductionRequest> & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "요청을 고치지 못했습니다.");
      const next = { ...managed, ...patch, ...data } as ProductionRequest;
      setRequests((current) => current.map((item) => item.id === next.id ? next : item)); setManaged(next); toast.success("요청을 고쳤어요.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }
  // 진행 이미지 올리기 (관리자·제작실장)
  async function addProgress(files: File[], caption: string) {
    if (!managed || !canManage || !files.length) return;
    setSaving(true);
    try {
      const me = getMe(); const by = me ? `${me.name}${me.title ? " " + me.title : ""}` : "";
      const added: ProgressImage[] = [];
      for (const file of files.slice(0, 10)) {
        if (demoMode || managed.demo) { added.push({ key: crypto.randomUUID(), src: URL.createObjectURL(file), name: file.name, caption, at: new Date().toISOString(), by }); continue; }
        const up = await uploadImage(file);
        added.push({ ...up, caption, at: new Date().toISOString(), by, src: fileUrl(up.key) });
      }
      const list = [...(managed.progressImages ?? []), ...added];
      if (!demoMode && !managed.demo) {
        const response = await fetch(`/api/production-requests/${managed.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ progressImages: list.map(({ src: _src, ...rest }) => rest) }) });
        if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "진행 이미지를 저장하지 못했습니다.");
      }
      const next = { ...managed, progressImages: list, updatedAt: new Date().toISOString() };
      setRequests((current) => current.map((item) => item.id === next.id ? next : item)); setManaged(next);
      toast.success(`진행 이미지 ${added.length}장을 올렸어요. 요청자에게 알림이 가요.`);
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }
  async function deleteSchedule() {
    if (!scheduleDraft || !canManage) return;
    setSaving(true);
    try {
      if (!demoMode && !scheduleDraft.demo) {
        const response = await fetch(`/api/production-schedules/${scheduleDraft.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("일정을 삭제하지 못했습니다.");
      }
      setSchedules((items) => items.filter((item) => item.id !== scheduleDraft.id)); setScheduleDraft(null); toast.success("일정을 삭제했어요.");
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

  async function savePlan(next: WeeklyPlan) {
    if (!canManage) return;
    setSaving(true);
    try {
      if (!demoMode) {
        const response = await fetch("/api/production-weekly", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
        const data = await response.json().catch(() => ({})) as { plan?: WeeklyPlan; error?: string };
        if (!response.ok || !data.plan) throw new Error(data.error ?? "운영표를 저장하지 못했어요.");
        setPlan(data.plan);
      } else setPlan(next);
      setPlanOpen(false); toast.success("제작실 운영표를 저장했어요. 모두에게 보여요.");
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
    setScheduleDraft({ id: crypto.randomUUID(), title: "", branch: "공동", scheduleDate: date, assetType: "", manager: "행정마케팅파트", status: "approval_pending", notes: "", delayedReason: "", revisedDueDate: "", linkedRequestId: null, demo: demoMode });
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

    <WeeklyStrip plan={plan} canManage={canManage} onEdit={() => setPlanOpen(true)} />

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

    <ProductionScheduleView monthCursor={monthCursor} setMonthCursor={setMonthCursor} selectedDate={selectedDate} setSelectedDate={setSelectedDate} schedules={schedules.filter((item) => item.status !== "completed")} requests={requests.filter((item) => isOpen(item.status))} plan={plan} priority={currentPriority} canManage={canManage} onPriority={savePriority} onOpenSchedule={(item) => setScheduleDraft({ ...item })} onOpenRequest={(item) => setManaged({ ...item })} onNewSchedule={openNewSchedule} />

    {/* 캠퍼스별 현황 */}
    <Card className="rounded-2xl py-0"><CardContent className="p-4 md:p-5">
      <h2 className="font-semibold">{selectedMonthKey.replace("-", "년 ")}월 캠퍼스별 현황</h2>
      <p className="mt-1 text-sm text-muted-foreground">카드를 누르면 위 목록이 그 캠퍼스 요청만 보여줍니다. '진행 중'은 완료 전 모든 건(지연 포함)이라 네 칸을 더하면 위 '진행 중 전체'와 같아요.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">{campusSummary.map((item) => <button key={item.campus} type="button" onClick={() => { setBranchFilter(item.campus); setStatusFilter("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`rounded-xl border p-3 text-left hover:bg-muted/40 ${branchFilter === item.campus ? "border-primary bg-primary/5" : ""}`}>
        <span className="flex items-center gap-1.5 font-semibold"><CampusDot branch={item.campus} />{item.campus === "공동" ? "공동 작업" : `${short[item.campus]}캠퍼스`}</span>
        <span className="mt-2 grid grid-cols-4 gap-1 text-center text-[12px] text-muted-foreground">
          <span><b className="block text-base text-foreground tabular-nums">{item.requested}</b>이달 요청</span>
          <span><b className="block text-base text-foreground tabular-nums">{item.producing}</b>진행 중</span>
          <span><b className="block text-base text-foreground tabular-nums">{item.completed}</b>완료</span>
          <span><b className={`block text-base tabular-nums ${item.delayed ? "text-rose-600" : "text-foreground"}`}>{item.delayed}</b>지연</span>
        </span>
      </button>)}</div>
    </CardContent></Card>

    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>새 제작 요청</DialogTitle><DialogDescription>요청하면 '승인 대기'로 등록되고, 관리자가 담당자를 정해 승인합니다. 참고 이미지는 최대 10장까지 첨부할 수 있어요.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <RequestField label="제작물 제목" name="title" placeholder="예: 겨울특강 모집 현수막" required />
          <RequestSelect label="캠퍼스" name="branch" items={campuses.map((value) => [value, value === "공동" ? "공동 작업 (여러 캠퍼스)" : value])} defaultValue={myCampus()} />
          <RequestField label="요청자" name="requester" defaultValue={myName()} placeholder="원장명 또는 담당자" required />
          <RequestField label="제작물 종류" name="assetType" placeholder="현수막, 배너, 카드뉴스" required />
          <div className="space-y-2"><RequestField label="희망 완료일" name="desiredDate" type="date" min={todayStr()} required onChange={(e) => setDueDraft(e.target.value)} />{dueDraft && planFor(plan, dueDraft) && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">📌 이 날 제작실은 <b>{planFor(plan, dueDraft)}</b> 일정이에요. 다른 작업은 하루 이틀 늦어질 수 있어요.</p>}</div>
          <RequestField label="규격·수량" name="specifications" placeholder="예: A2 2장 / 1080×1350px" />
        </div>
        <RequestText label="사용 목적과 채널" name="purpose" placeholder="예: 인스타그램 피드 + 원내 게시" />
        <RequestText label="필수 문구" name="requiredCopy" placeholder="꼭 들어가야 하는 문구, 날짜, 연락처" />
        <div className="space-y-2"><Label>레퍼런스 이미지 <span className="font-normal text-muted-foreground">(합쳐서 최대 10장)</span></Label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPickerOpen(true)} disabled={picked.length + files.length >= 10} className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-dashed border-primary/50 bg-primary/5 text-sm font-medium text-primary disabled:opacity-50"><Images className="mb-1.5 size-5" />제작물에서 가져오기</button>
            <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"><ImagePlus className="mb-1.5 size-5" />{files.length ? `내 사진 ${files.length}장` : "내 사진 올리기"}<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, Math.max(0, 10 - picked.length)))} /></label>
          </div>
          {picked.length > 0 && <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{picked.map((r) => <div key={r.key} className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted"><img src={r.src} alt={r.name} className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[10px] text-white">{r.assetTitle}</span><button type="button" aria-label="레퍼런스 빼기" onClick={() => setPicked((cur) => cur.filter((x) => x.key !== r.key))} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"><X className="size-3.5" /></button></div>)}</div>}
        </div>
        <RequestField label="참고 자료 Google Drive 링크" name="driveUrl" type="url" placeholder="원본 사진·로고 폴더 링크 (선택)" />
        <RequestText label="추가 요청사항" name="notes" />
        <DialogFooter className="gap-2"><Button type="button" variant="outline" className="h-11 sm:h-10" onClick={() => setFormOpen(false)}>취소</Button><Button className="h-11 sm:h-10" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Send />}요청 등록</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>

    <MarketingPicker open={pickerOpen} onOpenChange={setPickerOpen} max={Math.max(0, 10 - files.length)} picked={picked} onDone={setPicked} />
    <RequestDialog item={managed} setItem={setManaged} canManage={canManage} saving={saving} onSave={saveWorkflow} onDelete={deleteRequest} onOpenMarketing={onOpenMarketing} onEditOwn={editOwn} onAddProgress={addProgress} onComplete={(item) => setCompleting(item)} />
    <ScheduleDialog item={scheduleDraft} setItem={setScheduleDraft} canManage={canManage} saving={saving} onSave={saveSchedule} onDelete={deleteSchedule} exists={!!scheduleDraft && schedules.some((s) => s.id === scheduleDraft.id)} />
    <WeeklyPlanDialog open={planOpen} onOpenChange={setPlanOpen} plan={plan} saving={saving} onSave={savePlan} />
    <CompleteDialog item={completing} onClose={() => setCompleting(null)} onDone={(updated, assetId) => {
      setRequests((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSchedules((items) => items.map((s) => s.linkedRequestId === updated.id ? { ...s, status: "completed" } : s));
      setCompleting(null); setManaged(null);
      if (assetId) onOpenMarketing(assetId);
    }} />
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
      <span className="mt-1 flex items-center justify-between gap-2 text-[12px] text-muted-foreground"><span>담당 {item.assignee || "미정"}</span>{!item.demo && <ReadBadge collection="productionRequests" id={item.id} interactive={false} />}</span>
    </span>
  </button>;
}

function ProductionScheduleView({ monthCursor, setMonthCursor, selectedDate, setSelectedDate, schedules, requests, plan, priority, canManage, onPriority, onOpenSchedule, onOpenRequest, onNewSchedule }: { monthCursor: Date; setMonthCursor: React.Dispatch<React.SetStateAction<Date>>; selectedDate: string; setSelectedDate: (date: string) => void; schedules: ProductionSchedule[]; requests: ProductionRequest[]; plan: WeeklyPlan; priority: string; canManage: boolean; onPriority: (branch: string) => void; onOpenSchedule: (item: ProductionSchedule) => void; onOpenRequest: (item: ProductionRequest) => void; onNewSchedule: (date: string) => void }) {
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
      <div><div className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" /><h2 className="font-semibold">주요 일정</h2></div><p className="mt-1 text-sm text-muted-foreground">{canManage ? "달력의 일정을 누르면 바로 수정·삭제, 빈 날짜를 누르면 바로 일정 추가가 돼요." : "날짜를 누르면 그날 일정과 마감 요청을 아래에서 볼 수 있어요."} 완료된 건은 달력에서 빠지고 '완료' 목록에 남아요.</p></div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/35 px-3 py-2"><span className="text-sm text-muted-foreground">이번 달 우선 캠퍼스</span>{canManage ? <Select value={priority} onValueChange={onPriority}><SelectTrigger className="h-8 w-24 bg-background"><SelectValue /></SelectTrigger><SelectContent>{ROTATION.map((campus) => <SelectItem key={campus} value={campus}>{short[campus]}</SelectItem>)}</SelectContent></Select> : <Badge>{short[priority]}</Badge>}<span className="flex items-center gap-1.5 text-xs text-muted-foreground"><CampusDot branch="김해" />김해→<CampusDot branch="센텀" />센텀→<CampusDot branch="명지" />명지 순환</span></div>
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
            const focus = planFor(plan, date);
            const pick = () => { if (!day) return; setSelectedDate(date); if (canManage && !ds.length && !dr.length) onNewSchedule(date); };
            return <div key={`${day ?? "empty"}-${index}`} role={day ? "button" : undefined} tabIndex={day ? 0 : -1} aria-label={day ? `${month}월 ${day}일 일정 ${ds.length + dr.length}건${focus ? ` · 제작실 ${focus}` : ""}` : undefined} title={focus ? `제작실: ${focus}` : undefined} onClick={pick} onKeyDown={(event) => { if (day && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); pick(); } }} className={`flex min-h-14 min-w-0 cursor-pointer flex-col items-stretch justify-start border-b border-r p-1 text-left md:min-h-24 md:p-1.5 ${day ? (selected ? "bg-primary/8 ring-2 ring-inset ring-primary/40" : "bg-card hover:bg-muted/30") : "pointer-events-none bg-muted/15"} ${index % 7 === 6 ? "border-r-0" : ""} ${focus ? "border-t-2 border-t-amber-300 dark:border-t-amber-700" : ""}`}>
              {day && <span className={`inline-grid size-6 shrink-0 place-items-center self-center rounded-full text-xs font-semibold md:self-start ${date === todayKey ? "bg-brand text-white" : index % 7 === 0 ? "text-brand" : index % 7 === 6 ? "text-[#2f6fdb]" : "text-foreground"}`}>{day}</span>}
              {/* 제작실 운영표 꼬리표 */}
              {day && focus && <span className="mt-0.5 hidden truncate rounded bg-amber-100/80 px-1 text-[10px] leading-4 font-medium text-amber-900 md:block dark:bg-amber-900/40 dark:text-amber-100">📌 {focus}</span>}
              {/* 휴대폰: 점만 */}
              {(ds.length + dr.length > 0) && <span className="mt-1 flex flex-wrap justify-center gap-0.5 md:hidden">{[...ds.map((item) => ({ id: item.id, color: campusColor(item.branch), square: true })), ...dr.map((item) => ({ id: item.id, color: campusColor(item.branch), square: false }))].slice(0, 4).map((dot) => <span key={dot.id} className={`size-1.5 ${dot.square ? "rounded-[1px]" : "rounded-full"}`} style={{ background: dot.color }} />)}</span>}
              {/* PC: 제목 */}
              <span className="hidden md:block">
                {ds.slice(0, 2).map((item) => <button key={item.id} type="button" onClick={(event) => { event.stopPropagation(); setSelectedDate(date); onOpenSchedule({ ...item }); }} className={`mt-1 block w-full truncate rounded border-l-[3px] px-1.5 py-0.5 text-left text-xs leading-4 hover:brightness-95 ${statusTone[item.status]}`} style={{ borderLeftColor: campusColor(item.branch) }} title={canManage ? "눌러서 수정" : item.title}>{item.title}</button>)}
                {dr.slice(0, 1).map((item) => <button key={item.id} type="button" onClick={(event) => { event.stopPropagation(); setSelectedDate(date); onOpenRequest({ ...item }); }} className="mt-1 block w-full truncate rounded border-l-[3px] bg-brand-soft px-1.5 py-0.5 text-left text-xs leading-4 text-foreground hover:brightness-95" style={{ borderLeftColor: campusColor(item.branch) }}>요청 · {item.title}</button>)}
                {ds.length + dr.length > 3 && <span className="mt-1 block text-[11px]">외 {ds.length + dr.length - 3}건</span>}
              </span>
            </div>;
          })}
        </div>
        {/* 선택한 날 목록 */}
        <div className="mt-3 rounded-xl border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><b className="text-sm">{sm}월 {sd}일{sy !== year ? ` (${sy})` : ""} · {daySchedules.length + dayRequests.length}건</b>{canManage && <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => onNewSchedule(selectedDate)}><Plus className="size-3.5" />일정 추가</Button>}</div>
          {planFor(plan, selectedDate) && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">📌 제작실: <b>{planFor(plan, selectedDate)}</b></p>}
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

function RequestDialog({ item, setItem, canManage, saving, onSave, onDelete, onOpenMarketing, onEditOwn, onAddProgress, onComplete }: { item: ProductionRequest | null; setItem: (item: ProductionRequest | null) => void; canManage: boolean; saving: boolean; onSave: (override?: Partial<ProductionRequest>) => void; onDelete: () => void; onOpenMarketing: (assetId?: string) => void; onEditOwn: (patch: Partial<ProductionRequest>) => void; onAddProgress: (files: File[], caption: string) => void; onComplete: (item: ProductionRequest) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState<Partial<ProductionRequest> | null>(null);
  const [caption, setCaption] = useState("");
  const [viewer, setViewer] = useState<ProgressImage | null>(null);
  useEffect(() => { setConfirmDelete(false); setEditing(null); setCaption(""); if (item && !item.demo) void markRead("productionRequests", item.id); }, [item?.id]);
  if (!item) return null;
  const due = effectiveDue(item);
  const mine = !!item.createdById && item.createdById === getMe()?.id;
  const ownPending = mine && item.status === "approval_pending" && !canManage;
  const stepIndex = item.status === "delayed" ? 1 : flowSteps.indexOf(item.status);
  const quick: { label: string; status: RequestStatus; progress: number } | null = item.status === "approval_pending" ? { label: "승인하고 제작 시작", status: "producing", progress: 45 }
    : item.status === "producing" || item.status === "delayed" ? { label: "시안 완료 · 컨펌 요청", status: "reviewing", progress: 80 }
    : item.status === "reviewing" ? { label: "최종 완료 처리", status: "completed", progress: 100 } : null;
  const progress = item.progressImages ?? [];
  return <Dialog open onOpenChange={(open) => !open && setItem(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader className="text-left"><DialogTitle className="pr-6 leading-7">{item.title}</DialogTitle>{!item.demo && <div><ReadBadge collection="productionRequests" id={item.id} /></div>}<DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="inline-flex items-center gap-1"><CampusDot branch={item.branch} />{branchOf(item.branch) === "공동" ? "공동 작업" : item.branch}</span><span>· 요청 {dotted(item.requestedDate)}</span><span>· 마감 {dotted(due)} {item.status !== "completed" && <b className="text-foreground">{dday(due)}</b>}</span></DialogDescription></DialogHeader>

    {/* 진행 단계 */}
    <div className="rounded-xl border p-3">
      <div className="grid grid-cols-4 gap-1">{flowSteps.map((step, index) => <div key={step} className="text-center"><div className={`mx-auto h-1.5 rounded-full ${index <= stepIndex ? statusBar[item.status === "delayed" && index === 1 ? "delayed" : step] : "bg-muted"}`} /><span className={`mt-1.5 block text-[11px] sm:text-xs ${index === stepIndex ? "font-bold text-foreground" : "text-muted-foreground"}`}>{item.status === "delayed" && index === 1 ? "지연" : statusLabels[step]}</span></div>)}</div>
      <div className="mt-2 flex items-center justify-between text-sm"><Badge className={statusTone[item.status]}>{statusLabels[item.status]}</Badge><span className="text-muted-foreground">작업률 <b className="text-foreground tabular-nums">{item.status === "completed" ? 100 : item.progressPercent}%</b> · 담당 <b className="text-foreground">{item.assignee || "미정"}</b></span></div>
      {item.status === "delayed" && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">지연 사유: {item.delayedReason || "-"} · 변경 완료일 {dotted(item.revisedDueDate)}</p>}
    </div>

    {/* 진행 이미지 */}
    {(progress.length > 0 || (canManage && item.status !== "completed")) && <div className="rounded-xl border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Images className="size-4" />진행 이미지 {progress.length > 0 && <span className="font-normal text-muted-foreground">{progress.length}장</span>}</p>
      {progress.length > 0 ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{[...progress].reverse().map((p, index) => <button key={`${p.key}-${index}`} type="button" onClick={() => setViewer(p)} className="group overflow-hidden rounded-lg border bg-muted text-left">
        <span className="relative block aspect-square">{p.src ? <Image src={p.src} alt={p.caption || p.name || "진행 이미지"} fill unoptimized className="object-cover" /> : null}{index === 0 && <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">최신</span>}</span>
        <span className="block truncate px-1.5 pt-1 text-[11px] font-medium">{p.caption || p.name || "진행 이미지"}</span>
        <span className="block truncate px-1.5 pb-1 text-[10px] text-muted-foreground">{stamp(p.at)}{p.by ? ` · ${p.by}` : ""}</span>
      </button>)}</div> : <p className="text-sm text-muted-foreground">아직 올린 진행 이미지가 없어요.</p>}
      {canManage && item.status !== "completed" && <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="설명 (예: 1차 시안, 문구 수정본)" className="h-11 rounded-xl sm:h-10" maxLength={60} />
        <label className={`inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-primary/50 bg-primary/5 px-4 text-sm font-medium text-primary sm:h-10 ${saving ? "pointer-events-none opacity-50" : ""}`}><Upload className="size-4" />이미지 올리기<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) { onAddProgress(files, caption.trim()); setCaption(""); } }} /></label>
      </div>}
    </div>}

    {item.refAssets?.length ? <div className="flex flex-wrap items-center gap-1.5 text-sm"><span className="text-muted-foreground">참고한 제작물</span>{item.refAssets.map((a) => <button key={a.id} type="button" onClick={() => { setItem(null); onOpenMarketing(a.id); }} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"><Images className="size-3.5" />{a.title}</button>)}</div> : null}
    {item.referenceImages?.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{item.referenceImages.slice(0, 8).map((image, index) => <div key={`${image.src}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-muted"><Image src={image.src} alt={image.name ?? "참고 이미지"} fill unoptimized className="object-cover" /></div>)}</div> : null}

    {editing ? <div className="space-y-3 rounded-xl border-2 border-primary/15 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Pencil className="size-4 text-primary" />요청 고치기</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <RequestField label="제작물 제목" name="editTitle" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
        <RequestField label="제작물 종류" name="editType" value={editing.assetType ?? ""} onChange={(e) => setEditing({ ...editing, assetType: e.target.value })} />
        <RequestField label="희망 완료일" name="editDue" type="date" min={todayStr()} value={editing.desiredDate ?? ""} onChange={(e) => setEditing({ ...editing, desiredDate: e.target.value })} />
        <RequestField label="규격·수량" name="editSpec" value={editing.specifications ?? ""} onChange={(e) => setEditing({ ...editing, specifications: e.target.value })} />
      </div>
      <RequestText label="사용 목적과 채널" name="editPurpose" value={editing.purpose ?? ""} onChange={(e) => setEditing({ ...editing, purpose: e.target.value })} />
      <RequestText label="필수 문구" name="editCopy" value={editing.requiredCopy ?? ""} onChange={(e) => setEditing({ ...editing, requiredCopy: e.target.value })} />
      <RequestText label="추가 요청사항" name="editNotes" value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
      <div className="flex justify-end gap-2"><Button variant="outline" className="h-10" onClick={() => setEditing(null)}>취소</Button><Button className="h-10" disabled={saving || !editing.title?.trim() || !editing.desiredDate} onClick={() => { onEditOwn(editing); setEditing(null); }}>{saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}고친 내용 저장</Button></div>
    </div> : <dl className="grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2">
      <Info label="제작물" value={`${item.assetType} · ${item.specifications || "규격 미입력"}`} />
      <Info label="요청자" value={item.requester} />
      <Info label="사용 목적" value={item.purpose} wide />
      <Info label="필수 문구" value={item.requiredCopy} wide />
      {item.notes && <Info label={canManage ? "메모" : "추가 요청사항·메모"} value={item.notes} wide />}
    </dl>}

    {/* 처리 기록 */}
    {item.history?.length ? <div><p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Clock3 className="size-4" />처리 기록</p><ol className="space-y-1.5 border-l-2 border-border pl-3">{item.history.map((h, index) => <li key={index} className="relative text-sm"><span className={`absolute top-1.5 -left-[17px] size-2.5 rounded-full ${statusBar[h.status] ?? "bg-muted"}`} /><b>{statusLabels[h.status] ?? h.status}</b> <span className="text-muted-foreground">· {stamp(h.at)}{h.by ? ` · ${h.by}` : ""}{h.note ? ` · ${h.note}` : ""}</span></li>)}</ol></div> : null}

    {canManage ? <div className="space-y-4 rounded-xl border-2 border-primary/15 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" />관리자 처리</p>
      {quick && <Button type="button" className="h-11 w-full rounded-xl" disabled={saving} onClick={() => quick.status === "completed" && !item.demo ? onComplete({ ...item }) : onSave({ status: quick.status, progressPercent: Math.max(item.progressPercent, quick.progress) })}><CheckCircle2 />{quick.label}</Button>}
      {quick && <p className="-mt-2 text-center text-xs text-muted-foreground">{quick.status === "completed" ? "완료 창에서 결과 이미지를 올리면 마케팅 제작물과 구글 드라이브에 자동으로 들어가요." : "또는 아래에서 단계·담당자·작업률을 직접 바꾸고 저장하세요."}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>진행 단계</Label><Select value={item.status} onValueChange={(value) => { const status = value as RequestStatus; setItem({ ...item, status, progressPercent: status === "completed" ? 100 : Math.max(item.progressPercent, statusProgress[status]) }); }}><SelectTrigger className="h-11 sm:h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <RequestField label="제작 담당자" name="assignee" value={item.assignee} placeholder="예: 제작실장" onChange={(event) => setItem({ ...item, assignee: event.target.value })} />
      </div>
      <div className="space-y-3"><div className="flex justify-between text-sm"><Label>작업률</Label><b>{item.progressPercent}%</b></div><Slider value={[item.progressPercent]} max={100} step={5} onValueChange={(value) => setItem({ ...item, progressPercent: value[0] ?? 0 })} /></div>
      {item.status === "delayed" && <div className="grid gap-4 sm:grid-cols-2"><RequestField label="변경 완료일" name="revisedDueDate" type="date" value={item.revisedDueDate} onChange={(event) => setItem({ ...item, revisedDueDate: event.target.value })} /><RequestField label="지연 사유" name="delayedReason" value={item.delayedReason} onChange={(event) => setItem({ ...item, delayedReason: event.target.value })} /></div>}
      <RequestField label="Google Drive 완성본 링크" name="driveUrl" type="url" value={item.driveUrl} placeholder="완료 처리하면 자동으로 채워져요" onChange={(event) => setItem({ ...item, driveUrl: event.target.value })} />
      <RequestText label="메모" name="notes" value={item.notes} onChange={(event) => setItem({ ...item, notes: event.target.value })} />
      <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" className={confirmDelete ? "text-rose-600" : "text-muted-foreground"} disabled={saving} onClick={() => { if (confirmDelete) onDelete(); else setConfirmDelete(true); }}><Trash2 className="size-4" />{confirmDelete ? "한 번 더 누르면 삭제돼요" : "요청 삭제"}</Button></div>
    </div> : ownPending ? <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/45 px-3 py-2.5 text-sm text-muted-foreground">
      <span className="flex-1">내 요청이에요. 승인 전이라 고치거나 지울 수 있어요.</span>
      {!editing && <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setEditing({ title: item.title, assetType: item.assetType, desiredDate: item.desiredDate, specifications: item.specifications, purpose: item.purpose, requiredCopy: item.requiredCopy, notes: item.notes })}><Pencil className="size-4" />고치기</Button>}
      <Button type="button" variant="ghost" size="sm" className={`h-9 ${confirmDelete ? "text-rose-600" : ""}`} disabled={saving} onClick={() => { if (confirmDelete) onDelete(); else setConfirmDelete(true); }}><Trash2 className="size-4" />{confirmDelete ? "한 번 더 누르면 삭제" : "지우기"}</Button>
    </div> : <p className="flex items-center gap-1.5 rounded-xl bg-muted/45 px-3 py-2.5 text-sm text-muted-foreground"><Lock className="size-4 shrink-0" />{mine ? "승인된 뒤에는 관리자·제작실장만 바꿀 수 있어요." : "승인과 진행 상태 변경은 관리자·제작실장만 할 수 있어요."}</p>}

    <DialogFooter className="gap-2">
      <Button variant="outline" className="h-11 sm:h-10" onClick={() => setItem(null)}>닫기</Button>
      {item.driveUrl && /^https?:\/\//.test(item.driveUrl) && <Button variant="outline" className="h-11 sm:h-10" asChild><a href={item.driveUrl} target="_blank" rel="noreferrer"><ExternalLink />Drive</a></Button>}
      {item.status === "completed" && <Button variant="outline" className="h-11 sm:h-10" onClick={() => { setItem(null); onOpenMarketing(item.resultAssetId ?? undefined); }}><FileText />제작물 보기</Button>}
      {canManage && <Button className="h-11 sm:h-10" onClick={() => onSave()} disabled={saving}>{saving && <LoaderCircle className="animate-spin" />}저장</Button>}
    </DialogFooter>
    {viewer && <Dialog open onOpenChange={(open) => !open && setViewer(null)}><DialogContent className="sm:max-w-3xl"><DialogHeader className="text-left"><DialogTitle>{viewer.caption || viewer.name || "진행 이미지"}</DialogTitle><DialogDescription>{stamp(viewer.at)}{viewer.by ? ` · ${viewer.by}` : ""}</DialogDescription></DialogHeader>{viewer.src && <img src={viewer.src} alt={viewer.caption || "진행 이미지"} className="max-h-[70vh] w-full rounded-lg object-contain" />}</DialogContent></Dialog>}
  </DialogContent></Dialog>;
}

type DoneImage = { id: string; key?: string; file?: File; src: string; name: string; caption: string; pick: boolean };
function CompleteDialog({ item, onClose, onDone }: { item: ProductionRequest | null; onClose: () => void; onDone: (updated: ProductionRequest, assetId: string | null) => void }) {
  const [images, setImages] = useState<DoneImage[]>([]);
  const [title, setTitle] = useState(""); const [assetType, setAssetType] = useState(""); const [channel, setChannel] = useState(""); const [notes, setNotes] = useState("");
  const [toMarketing, setToMarketing] = useState(true); const [toDrive, setToDrive] = useState(true);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    if (!item) return;
    setTitle(item.title); setAssetType(item.assetType); setChannel(""); setNotes(item.purpose || ""); setToMarketing(true); setToDrive(true); setBusy("");
    // 진행 이미지 중 가장 최근 것들을 기본 후보로 (선택은 직접)
    setImages((item.progressImages ?? []).filter((p) => p.src).map((p, i) => ({ id: `p${i}`, key: p.key, src: p.src!, name: p.name || `진행 이미지 ${i + 1}`, caption: p.caption || "", pick: false })));
  }, [item?.id]);
  if (!item) return null;
  const picked = images.filter((i) => i.pick);
  async function submit() {
    if (!item) return;
    if ((toMarketing || toDrive) && !picked.length) return toast.error("결과 이미지를 한 장 이상 골라 주세요. (이미지 없이 완료하려면 두 체크를 끄세요)");
    setBusy("upload");
    try {
      const done: { key: string; name: string; caption: string }[] = [];
      for (const img of picked) {
        if (img.key) done.push({ key: img.key, name: img.name, caption: img.caption });
        else if (img.file) { const up = await uploadImage(img.file); done.push({ key: up.key, name: up.name, caption: img.caption }); }
      }
      setBusy("save");
      const response = await fetch("/api/production-complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, images: done, title, assetType, branch: item.branch, channel, notes, toMarketing, toDrive }) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; msg?: string; error?: string; assetId?: string | null; drive?: { ok: boolean; url: string | null; reason?: string } };
      if (!response.ok || !data.ok) throw new Error(data.msg ?? data.error ?? "완료 처리하지 못했습니다.");
      const at = new Date().toISOString();
      const updated: ProductionRequest = { ...item, status: "completed", progressPercent: 100, completedAt: at, updatedAt: at, resultAssetId: data.assetId ?? item.resultAssetId, driveUrl: data.drive?.url ?? item.driveUrl, history: [...(item.history ?? []), { status: "completed", at, by: myName(), note: done.length ? `완료 이미지 ${done.length}장` : "완료" }] };
      toast.success(data.assetId && toMarketing ? "완료! 마케팅 제작물에 올렸어요 🎉" : "완료 처리했어요 🎉");
      if (toDrive && done.length) { if (data.drive?.ok) toast.success("구글 드라이브에도 저장했어요."); else toast.warning("구글 드라이브 저장은 실패했어요. (Apps Script 업데이트가 필요할 수 있어요) 이미지는 사이트에 잘 저장됐어요."); }
      onDone(updated, toMarketing && data.assetId ? data.assetId : null);
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(""); }
  }
  return <Dialog open onOpenChange={(open) => !open && !busy && onClose()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader className="text-left"><DialogTitle>🎉 제작 완료 처리</DialogTitle><DialogDescription>결과 이미지를 고르면 마케팅 제작물로 자동 등록되고 구글 드라이브에도 저장돼요. 완료된 건은 달력에서 빠지고 '완료' 목록에 남아요.</DialogDescription></DialogHeader>
    <div className="space-y-2">
      <Label>결과 이미지 <span className="font-normal text-muted-foreground">(눌러서 고르기 · {picked.length}장 선택)</span></Label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((img) => <div key={img.id} className={`overflow-hidden rounded-xl border-2 ${img.pick ? "border-primary" : "border-transparent"} bg-muted`}>
          <button type="button" onClick={() => setImages((list) => list.map((i) => i.id === img.id ? { ...i, pick: !i.pick } : i))} className="relative block aspect-square w-full" aria-pressed={img.pick} aria-label={img.name}>
            <img src={img.src} alt="" className="h-full w-full object-cover" />
            <span className={`absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full border-2 ${img.pick ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/30 text-transparent"}`}><CheckCircle2 className="size-3.5" /></span>
          </button>
          {img.pick && <input value={img.caption} onChange={(e) => setImages((list) => list.map((i) => i.id === img.id ? { ...i, caption: e.target.value } : i))} placeholder="이름 (예: 시안 1)" maxLength={40} className="w-full border-t bg-background px-1.5 py-1 text-xs outline-none" />}
        </div>)}
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center text-xs text-muted-foreground"><ImagePlus className="mb-1 size-5" />완성본 올리기<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { const files = Array.from(e.target.files ?? []).slice(0, 20); e.target.value = ""; setImages((list) => [...list, ...files.map((file, n) => ({ id: crypto.randomUUID(), file, src: URL.createObjectURL(file), name: file.name, caption: `시안 ${list.filter((i) => i.pick).length + n + 1}`, pick: true }))]); }} /></label>
      </div>
      {images.some((i) => i.key) && <p className="text-xs text-muted-foreground">위에 보이는 건 그동안 올린 진행 이미지예요. 최종본만 골라 주세요.</p>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <RequestField label="제작물 이름" name="doneTitle" value={title} onChange={(e) => setTitle(e.target.value)} />
      <RequestField label="종류" name="doneType" value={assetType} onChange={(e) => setAssetType(e.target.value)} />
      <RequestField label="사용 채널 (선택)" name="doneChannel" value={channel} placeholder="예: 인스타그램, 현수막" onChange={(e) => setChannel(e.target.value)} />
      <div className="space-y-2"><Label>캠퍼스</Label><p className="flex h-11 items-center gap-1.5 rounded-xl border bg-muted/40 px-3 text-sm sm:h-9"><CampusDot branch={item.branch} />{branchOf(item.branch) === "공동" ? "공동 작업" : item.branch}</p></div>
    </div>
    <RequestText label="설명" name="doneNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
    <div className="space-y-2 rounded-xl bg-muted/45 p-3 text-sm">
      <label className="flex items-center gap-2"><input type="checkbox" checked={toMarketing} onChange={(e) => setToMarketing(e.target.checked)} className="size-4 accent-primary" />마케팅 제작물에 자동 등록 (모두에게 공개)</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={toDrive} onChange={(e) => setToDrive(e.target.checked)} className="size-4 accent-primary" />구글 드라이브 '학원 아카이브 제작물' 폴더에 저장</label>
    </div>
    <DialogFooter className="gap-2">
      <Button variant="outline" className="h-11 sm:h-10" disabled={!!busy} onClick={onClose}>취소</Button>
      <Button className="h-11 sm:h-10" disabled={!!busy} onClick={() => void submit()}>{busy ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}{busy === "upload" ? "이미지 올리는 중…" : busy === "save" ? (toDrive ? "드라이브에 저장 중… (최대 1분)" : "저장 중…") : "완료 처리"}</Button>
    </DialogFooter>
  </DialogContent></Dialog>;
}

/** 이번 주 제작실 일정 띠 (월~일) */
function WeeklyStrip({ plan, canManage, onEdit }: { plan: WeeklyPlan; canManage: boolean; onEdit: () => void }) {
  const today = new Date(todayStr() + "T00:00:00");
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; return { key, d }; });
  const empty = !Object.keys(plan.days).length && !Object.keys(plan.exceptions).length;
  if (empty && !canManage) return null;
  return <Card className="rounded-2xl py-0"><CardContent className="p-4 md:p-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <div><h2 className="font-semibold">📌 이번 주 제작실 일정</h2><p className="mt-0.5 text-xs text-muted-foreground">{empty ? "제작실장이 요일별 작업을 적어 두면 모두에게 보여요." : `요청 마감일을 정할 때 참고해 주세요.${plan.updatedBy ? ` · ${plan.updatedBy} 수정` : ""}`}</p></div>
      {canManage && <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 rounded-lg" onClick={onEdit}><Pencil className="size-3.5" />운영표 편집</Button>}
    </div>
    <div className="-mx-1 grid grid-flow-col auto-cols-[minmax(84px,1fr)] gap-1.5 overflow-x-auto px-1 pb-1">{week.map(({ key, d }) => { const text = planFor(plan, key); const isToday = key === todayStr(); const special = plan.exceptions[key] !== undefined; return <div key={key} className={`rounded-xl border p-2 ${isToday ? "border-primary bg-primary/5" : ""} ${text ? "" : "opacity-70"}`}>
      <p className={`text-xs font-semibold ${d.getDay() === 0 ? "text-brand" : d.getDay() === 6 ? "text-[#2f6fdb]" : "text-muted-foreground"}`}>{WEEKDAYS[d.getDay()]} {d.getMonth() + 1}/{d.getDate()}{isToday && <span className="ml-1 text-primary">오늘</span>}</p>
      <p className={`mt-1 text-[13px] leading-5 font-medium break-keep ${text ? "text-foreground" : "text-muted-foreground"}`}>{text || "—"}</p>
      {special && <span className="mt-1 inline-block rounded bg-amber-100 px-1 text-[10px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">이 날만</span>}
    </div>; })}</div>
  </CardContent></Card>;
}

function WeeklyPlanDialog({ open, onOpenChange, plan, saving, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; plan: WeeklyPlan; saving: boolean; onSave: (plan: WeeklyPlan) => void }) {
  const [days, setDays] = useState<Record<string, string>>({});
  const [exceptions, setExceptions] = useState<[string, string][]>([]);
  const [newDate, setNewDate] = useState(""); const [newText, setNewText] = useState("");
  useEffect(() => { if (!open) return; setDays({ ...plan.days }); setExceptions(Object.entries(plan.exceptions).filter(([d]) => d >= todayStr()).sort()); setNewDate(""); setNewText(""); }, [open]);
  const order = ["1", "2", "3", "4", "5", "6", "0"];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
    <DialogHeader className="text-left"><DialogTitle>제작실 주간 운영표</DialogTitle><DialogDescription>요일마다 주로 하는 작업을 적어 주세요. 달력과 요청서에 모두에게 표시돼요. 비워 두면 표시하지 않아요.</DialogDescription></DialogHeader>
    <div className="space-y-2">{order.map((k) => <div key={k} className="flex items-center gap-2"><span className={`w-8 shrink-0 text-center text-sm font-semibold ${k === "0" ? "text-brand" : k === "6" ? "text-[#2f6fdb]" : ""}`}>{WEEKDAYS[Number(k)]}</span><Input value={days[k] ?? ""} maxLength={40} onChange={(e) => setDays({ ...days, [k]: e.target.value })} placeholder={k === "5" || k === "6" ? "예: 노트 제작 위주" : k === "0" ? "예: 휴무" : "예: 현수막·배너 작업"} className="h-11 rounded-xl sm:h-10" /></div>)}</div>
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-sm font-semibold">특정 날짜만 다르게 <span className="font-normal text-muted-foreground">(예: 출장, 휴무)</span></p>
      {exceptions.map(([d, t], i) => <div key={d} className="flex items-center gap-2 text-sm"><span className="w-24 shrink-0 tabular-nums">{dotted(d).slice(5)} ({WEEKDAYS[new Date(d + "T00:00:00").getDay()]})</span><Input value={t} maxLength={40} onChange={(e) => setExceptions((list) => list.map((x, j) => j === i ? [x[0], e.target.value] : x))} className="h-10 rounded-xl" /><Button type="button" variant="ghost" size="icon" aria-label="빼기" onClick={() => setExceptions((list) => list.filter((_, j) => j !== i))}><X className="size-4" /></Button></div>)}
      <div className="flex flex-col gap-2 sm:flex-row"><Input type="date" min={todayStr()} value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-10 rounded-xl sm:w-40" /><Input value={newText} maxLength={40} onChange={(e) => setNewText(e.target.value)} placeholder="그날 일정 (예: 외부 출장)" className="h-10 rounded-xl" /><Button type="button" variant="outline" className="h-10 shrink-0" disabled={!newDate || !newText.trim()} onClick={() => { setExceptions((list) => [...list.filter(([d]) => d !== newDate), [newDate, newText.trim()] as [string, string]].sort()); setNewDate(""); setNewText(""); }}><Plus className="size-4" />추가</Button></div>
    </div>
    <DialogFooter className="gap-2"><Button variant="outline" className="h-11 sm:h-10" onClick={() => onOpenChange(false)}>취소</Button><Button className="h-11 sm:h-10" disabled={saving} onClick={() => onSave({ days: Object.fromEntries(Object.entries(days).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)), exceptions: Object.fromEntries(exceptions.map(([d, t]) => [d, t.trim()]).filter(([, t]) => t)) })}>{saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}저장</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function Info({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words">{value?.trim() || "미입력"}</dd></div>;
}

function ScheduleDialog({ item, setItem, canManage, saving, onSave, onDelete, exists }: { item: ProductionSchedule | null; setItem: (item: ProductionSchedule | null) => void; canManage: boolean; saving: boolean; onSave: () => void; onDelete: () => void; exists: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setConfirmDelete(false), [item?.id]);
  if (!item) return null;
  if (!canManage) return <Dialog open onOpenChange={(open) => !open && setItem(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
    <DialogHeader className="text-left"><DialogTitle>{item.title}</DialogTitle><DialogDescription>{dotted(item.scheduleDate)} · {item.branch}</DialogDescription></DialogHeader>
    <dl className="grid gap-3 rounded-xl bg-muted/45 p-4 text-sm sm:grid-cols-2"><Info label="상태" value={statusLabels[item.status]} /><Info label="제작물 종류" value={item.assetType} /><Info label="담당자" value={item.manager} />{item.status === "delayed" && <Info label="지연" value={`${item.delayedReason} · 변경일 ${dotted(item.revisedDueDate)}`} />}<Info label="메모" value={item.notes} wide /></dl>
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="size-4" />일정 수정·삭제는 관리자·제작실장만 할 수 있어요.</p>
    <DialogFooter><Button variant="outline" className="h-11 sm:h-10" onClick={() => setItem(null)}>닫기</Button></DialogFooter>
  </DialogContent></Dialog>;
  return <Dialog open onOpenChange={(open) => !open && setItem(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{exists ? "주요 일정 수정" : "주요 일정 추가"}</DialogTitle><DialogDescription>날짜와 진행 상태를 바꾸면 달력에 바로 반영돼요. 완료로 바꾸면 달력에서 빠져요.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><RequestField label="일정 제목" name="scheduleTitle" value={item.title} onChange={(event) => setItem({ ...item, title: event.target.value })} /><RequestField label="일정 날짜" name="scheduleDate" type="date" value={item.scheduleDate} onChange={(event) => setItem({ ...item, scheduleDate: event.target.value })} /><div className="space-y-2"><Label>캠퍼스</Label><Select value={item.branch} onValueChange={(branch) => setItem({ ...item, branch })}><SelectTrigger className="h-11 sm:h-9"><SelectValue /></SelectTrigger><SelectContent>{item.branch === "본사 공통" && <SelectItem value="본사 공통">공동 (예전 본사 공통)</SelectItem>}{campuses.map((campus) => <SelectItem key={campus} value={campus}>{campus === "공동" ? "공동 작업" : campus}</SelectItem>)}</SelectContent></Select></div><RequestField label="제작물 종류" name="scheduleAssetType" value={item.assetType} onChange={(event) => setItem({ ...item, assetType: event.target.value })} /><RequestField label="담당자" name="scheduleManager" value={item.manager} onChange={(event) => setItem({ ...item, manager: event.target.value })} /><div className="space-y-2"><Label>상태</Label><Select value={item.status} onValueChange={(status) => setItem({ ...item, status: status as RequestStatus })}><SelectTrigger className="h-11 sm:h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>{item.status === "delayed" && <div className="grid gap-4 sm:grid-cols-2"><RequestField label="변경 예정일" name="scheduleRevised" type="date" value={item.revisedDueDate} onChange={(event) => setItem({ ...item, revisedDueDate: event.target.value })} /><RequestField label="지연 사유" name="scheduleDelay" value={item.delayedReason} onChange={(event) => setItem({ ...item, delayedReason: event.target.value })} /></div>}<RequestText label="일정 메모" name="scheduleNotes" value={item.notes} onChange={(event) => setItem({ ...item, notes: event.target.value })} /><DialogFooter className="gap-2">{exists && <Button variant="ghost" className={`h-11 sm:mr-auto sm:h-10 ${confirmDelete ? "text-rose-600" : "text-muted-foreground"}`} disabled={saving} onClick={() => { if (confirmDelete) onDelete(); else setConfirmDelete(true); }}><Trash2 className="size-4" />{confirmDelete ? "한 번 더 누르면 삭제돼요" : "일정 삭제"}</Button>}<Button variant="outline" className="h-11 sm:h-10" onClick={() => setItem(null)}>취소</Button><Button className="h-11 sm:h-10" onClick={onSave} disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}일정 저장</Button></DialogFooter></DialogContent></Dialog>;
}

function RequestField({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} className="h-11 rounded-xl sm:h-9" {...props} /></div>; }
function RequestText({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Textarea>) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} className="min-h-24 rounded-xl" {...props} /></div>; }
function RequestSelect({ label, name, items, defaultValue }: { label: string; name: string; items: (readonly [string, string])[]; defaultValue?: string }) { return <div className="space-y-2"><Label>{label}</Label><Select name={name} defaultValue={defaultValue ?? items[0]?.[0]}><SelectTrigger className="h-11 rounded-xl sm:h-9"><SelectValue /></SelectTrigger><SelectContent>{items.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select></div>; }
