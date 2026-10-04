"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, CalendarClock, CheckCircle2, CircleDashed, Download, ExternalLink, History, Link2, Newspaper, Plus, RotateCcw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CampusDot } from "@/lib/campus";

import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Role = "staff" | "admin";
type NoticeType = "안내" | "신규" | "변경" | "마감 임박";
type Requirement = { id: string; year: number; title: string; category: string; scope: "campus" | "individual"; dueDate: string; description: string; target?: string; frequency?: string; officialUrl?: string; courseUrl?: string; sourceName?: string; officialCheckedAt?: string; noticeType?: NoticeType; mandatory: boolean };
type Participant = { id?: string; name: string; position: string; completedAt: string; certificateName?: string | null };
type SubmissionStatus = "draft" | "submitted" | "under_review" | "completed" | "revision_requested";
type Submission = { id: string; requirementId: string; branch: string; completionDate: string; status: SubmissionStatus; notes: string; submittedBy: string; certificateName?: string | null; certificateUrl?: string | null; reviewNote?: string; deletedAt?: string | null; deletedBy?: string | null; participants: Participant[]; demo?: boolean };
type ActivityLog = { id: string; submissionId: string; action: "created" | "trashed" | "restored" | "permanently_deleted"; actor: string; detail: string; createdAt: string };

const campuses = ["센텀캠퍼스", "김해캠퍼스", "명지캠퍼스"];
const short: Record<string, string> = { 센텀캠퍼스: "센텀", 김해캠퍼스: "김해", 명지캠퍼스: "명지" };
const checkedAt = "2026-09-22";

const demoRequirements: Requirement[] = [
  { id: "req-child-abuse", year: 2026, title: "아동학대 신고의무자 교육", category: "신고의무자 교육", scope: "individual", dueDate: "2026-12-31", description: "학생을 지도하거나 상담하는 인력의 적용 여부와 인정 과정을 공식 안내에서 확인한 뒤 이수합니다.", target: "신고의무자에 해당하는 원장·강사·종사자", frequency: "연 1회", officialUrl: "https://www.pen.go.kr/main/na/ntt/selectNttInfo.do?mi=30397&nttSn=1137950", courseUrl: "https://edu.kohi.or.kr/", sourceName: "부산광역시교육청·한국보건복지인재원", officialCheckedAt: checkedAt, noticeType: "마감 임박", mandatory: true },
  { id: "req-emergency", year: 2026, title: "긴급복지 신고의무자 교육", category: "신고의무자 교육", scope: "individual", dueDate: "2026-12-31", description: "교육 결과 제출 여부와 인정되는 교육기관은 관할 교육지원청 공지를 우선 확인합니다.", target: "긴급복지지원법상 신고의무자 해당 인력", frequency: "연 1회", officialUrl: "https://ghedu.gne.go.kr/ghedu/main.do", courseUrl: "https://edu.kohi.or.kr/", sourceName: "김해교육지원청·한국보건복지인재원", officialCheckedAt: checkedAt, noticeType: "안내", mandatory: true },
  { id: "req-disability-abuse", year: 2026, title: "장애인학대 신고의무자 교육", category: "신고의무자 교육", scope: "individual", dueDate: "2026-12-31", description: "장애인학대 및 장애인 대상 성범죄 신고의무자 해당 여부를 확인하고 증빙을 보관합니다.", target: "장애인복지법상 신고의무자 해당 인력", frequency: "연 1회", officialUrl: "https://www.naapd.or.kr/", courseUrl: "https://edu.kohi.or.kr/", sourceName: "중앙장애인권익옹호기관", officialCheckedAt: checkedAt, noticeType: "안내", mandatory: true },
  { id: "req-sexual-harassment", year: 2026, title: "성희롱 예방교육", category: "직원 교육", scope: "individual", dueDate: "2026-12-31", description: "직원이 교육을 이수한 뒤 캠퍼스별 증빙 파일을 등록해 완료 여부를 관리합니다.", target: "캠퍼스 소속 직원", frequency: "연 1회", officialUrl: "https://www.moel.go.kr/", sourceName: "고용노동부", officialCheckedAt: checkedAt, noticeType: "신규", mandatory: true },
];

const demoSubmissions: Submission[] = [
  { id: "sub-1", requirementId: "req-child-abuse", branch: "센텀캠퍼스", completionDate: "2026-08-28", status: "completed", notes: "전 직원 이수 완료", submittedBy: "센텀 원장", certificateName: "센텀_아동학대신고의무자교육.zip", participants: [{ name: "김도윤", position: "원장", completedAt: "2026-08-28" }, { name: "이서연", position: "전임", completedAt: "2026-08-28" }], demo: true },
  { id: "sub-2", requirementId: "req-emergency", branch: "김해캠퍼스", completionDate: "2026-09-10", status: "completed", notes: "캠퍼스 이수증 등록", submittedBy: "김해 원장", certificateName: "김해_긴급복지신고의무자교육.pdf", participants: [{ name: "박지호", position: "원장", completedAt: "2026-09-10" }], demo: true },
  { id: "sub-3", requirementId: "req-sexual-harassment", branch: "명지캠퍼스", completionDate: "2026-09-15", status: "completed", notes: "전 직원 이수", submittedBy: "명지 원장", certificateName: "명지_성희롱예방교육.pdf", participants: [{ name: "최은정", position: "원장", completedAt: "2026-09-15" }], demo: true },
];
const retiredRequirementTitles = new Set(["학원 설립·운영자 및 종사자 연수", "개인정보 보호교육", "산업안전보건교육 적용 여부 확인", "소방안전 점검 및 훈련"]);

function isSubmissionComplete(submission: Submission) {
  return submission.status === "completed" || Boolean(submission.certificateName);
}

function daysUntil(date: string) {
  const due = new Date(`${date}T23:59:59+09:00`).getTime();
  return Math.ceil((due - Date.now()) / 86400000);
}

function mergeById<T extends { id: string }>(server: T[], demo: T[]) {
  const map = new Map<string, T>();
  [...demo, ...server].forEach((item) => map.set(item.id, item));
  return [...map.values()];
}

export function ComplianceSection({ role, demoMode }: { role: Role; demoMode: boolean }) {
  const [requirements, setRequirements] = useState(demoRequirements);
  const [submissions, setSubmissions] = useState(demoSubmissions);
  const [trashed, setTrashed] = useState<Submission[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [campus, setCampus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const canManage = role === "admin" || demoMode;

  useEffect(() => {
    fetch("/api/compliance", { cache: "no-store" })
      .then(async (response): Promise<{ requirements?: Requirement[]; submissions?: Submission[]; trashed?: Submission[]; logs?: ActivityLog[] }> => response.ok ? response.json() as Promise<{ requirements?: Requirement[]; submissions?: Submission[]; trashed?: Submission[]; logs?: ActivityLog[] }> : {})
      .then((data) => { setRequirements(mergeById(data.requirements ?? [], demoRequirements).filter((item) => !retiredRequirementTitles.has(item.title))); setSubmissions(mergeById(data.submissions ?? [], demoSubmissions)); setTrashed(data.trashed ?? []); setLogs(data.logs ?? []); })
      .catch(() => undefined);
  }, []);

  const visibleSubmissions = campus === "all" ? submissions : submissions.filter((item) => item.branch === campus);
  const completedKeys = new Set(visibleSubmissions.filter(isSubmissionComplete).map((item) => `${item.requirementId}:${item.branch}`));
  const completed = completedKeys.size;
  const totalTargets = requirements.length * (campus === "all" ? campuses.length : 1);
  const completionRate = totalTargets ? Math.round(completed / totalTargets * 100) : 0;
  const incompleteCount = Math.max(0, totalTargets - completed);
  const dueSoon = requirements.filter((requirement) => { const days = daysUntil(requirement.dueDate); return days >= 0 && days <= 60 && campuses.some((branch) => !submissions.some((submission) => submission.requirementId === requirement.id && submission.branch === branch && isSubmissionComplete(submission))); }).length;
  const notices = useMemo(() => [...requirements].sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate)).slice(0, 4), [requirements]);

  async function moveToTrash() {
    if (!deleteTarget) return;
    const item = deleteTarget;
    if (!item.demo && !demoMode) {
      const response = await fetch(`/api/compliance/${item.id}`, { method: "DELETE" });
      if (!response.ok) return toast.error("이수증을 휴지통으로 옮기지 못했습니다.");
    }
    const deletedAt = new Date().toISOString();
    setSubmissions((items) => items.filter((submission) => submission.id !== item.id));
    setTrashed((items) => [{ ...item, deletedAt, deletedBy: "관리자" }, ...items]);
    setLogs((items) => [{ id: crypto.randomUUID(), submissionId: item.id, action: "trashed", actor: "관리자", detail: `${item.branch} · ${item.certificateName ?? "이수증"}`, createdAt: deletedAt }, ...items]);
    setDeleteTarget(null); toast.success("휴지통으로 이동했습니다. 관리자 화면에서 복원할 수 있습니다.");
  }

  async function restore(item: Submission) {
    if (!item.demo && !demoMode) {
      const response = await fetch(`/api/compliance/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "restore" }) });
      if (!response.ok) return toast.error("복원하지 못했습니다.");
    }
    setTrashed((items) => items.filter((submission) => submission.id !== item.id));
    setSubmissions((items) => [{ ...item, deletedAt: null, deletedBy: null }, ...items]);
    toast.success("이수증 기록을 복원했습니다.");
  }

  async function permanentlyDelete(item: Submission) {
    if (!window.confirm("이 기록을 영구 삭제할까요? 이후에는 복구할 수 없습니다.")) return;
    if (!item.demo && !demoMode) {
      const response = await fetch(`/api/compliance/${item.id}?permanent=true`, { method: "DELETE" });
      if (!response.ok) return toast.error("영구 삭제하지 못했습니다.");
    }
    setTrashed((items) => items.filter((submission) => submission.id !== item.id));
    toast.success("휴지통에서 영구 삭제했습니다.");
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2"><Button size="sm" variant={campus === "all" ? "default" : "outline"} className="rounded-full" onClick={() => setCampus("all")}>3개 통합</Button>{campuses.map((item) => <Button key={item} size="sm" variant={campus === item ? "default" : "outline"} className="rounded-full" onClick={() => setCampus(item)}><CampusDot branch={item} />{short[item]}</Button>)}</div><div className="flex flex-wrap gap-2"><Button variant="outline" className="rounded-xl" asChild><a href="./templates/mandatory-group-training-record.docx" download><Download />집합교육 양식</a></Button><Button className="rounded-xl" onClick={() => setFormOpen(true)}><Plus />이수 결과 작성</Button></div></div>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><AlertTriangle className="mr-2 inline size-4" />교육 대상과 의무 여부는 캠퍼스 소재지, 인원 및 담당 업무에 따라 달라질 수 있습니다. 등록된 링크에서 최신 공식 공지를 확인한 뒤 이수해 주세요.</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary label="전체 완료율" value={`${completionRate}%`} icon={CheckCircle2} tone="green" /><Summary label="미완료" value={`${incompleteCount}건`} icon={CircleDashed} tone="blue" /><Summary label="60일 내 마감" value={`${dueSoon}건`} icon={AlertTriangle} tone="amber" /><Summary label="올해 관리 항목" value={`${requirements.length}개`} icon={CalendarClock} tone="indigo" /></div>
    <NoticeBoard requirements={notices} />
    <Tabs defaultValue="dashboard"><div className="-mx-1 overflow-x-auto px-1 pb-1"><TabsList className="w-max"><TabsTrigger value="dashboard">연간 현황</TabsTrigger><TabsTrigger value="requirements">이수 항목</TabsTrigger><TabsTrigger value="forms">집합교육 양식</TabsTrigger><TabsTrigger value="submissions">이수증 기록</TabsTrigger>{canManage && <TabsTrigger value="admin">관리자</TabsTrigger>}</TabsList></div>
      <TabsContent value="dashboard" className="mt-4"><Dashboard requirements={requirements} submissions={submissions} campus={campus} /></TabsContent>
      <TabsContent value="requirements" className="mt-4"><RequirementCards requirements={requirements} /></TabsContent>
      <TabsContent value="forms" className="mt-4"><TrainingFormLibrary onSubmit={() => setFormOpen(true)} /></TabsContent>
      <TabsContent value="submissions" className="mt-4"><SubmissionTable submissions={visibleSubmissions} requirements={requirements} canDelete={canManage} onDelete={setDeleteTarget} /></TabsContent>
      {canManage && <TabsContent value="admin" className="mt-4"><AdminPanel requirements={requirements} submissions={submissions} trashed={trashed} logs={logs} onRestore={restore} onPermanentDelete={permanentlyDelete} /></TabsContent>}
    </Tabs>
    <ComplianceFormV2 open={formOpen} setOpen={setFormOpen} requirements={requirements} demoMode={demoMode} onCreated={(item) => setSubmissions((items) => [item, ...items])} />
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>이수증 기록을 휴지통으로 옮길까요?</AlertDialogTitle><AlertDialogDescription>{deleteTarget && `${short[deleteTarget.branch] ?? deleteTarget.branch} · ${requirements.find((item) => item.id === deleteTarget.requirementId)?.title ?? "이수 항목"} · ${deleteTarget.certificateName ?? "첨부 파일"}`}<br />해당 항목은 미완료로 표시되며 관리자 화면에서 다시 복원할 수 있습니다.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={moveToTrash}>휴지통으로 이동</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function TrainingFormLibrary({ onSubmit }: { onSubmit: () => void }) {
  return <Card className="rounded-2xl"><CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpenCheck /></div><div><h3 className="font-semibold">법정 의무교육 집합교육 기록 양식</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">교육 실시 계획, 참석자 서명, 교육일지, 결과보고와 사진 첨부란을 한 문서에 정리했습니다. 캠퍼스별 작성본이나 이수증을 올리면 해당 항목이 즉시 완료로 표시됩니다.</p><ol className="mt-3 list-inside list-decimal space-y-1 text-sm"><li>양식을 내려받아 교육 내용과 참석자를 작성합니다.</li><li>서명과 증빙 사진을 포함해 DOCX 또는 PDF로 저장합니다.</li><li>이수 결과 작성에서 파일을 올리면 완료 처리됩니다.</li></ol></div></div><div className="flex flex-col gap-2"><Button asChild><a href="./templates/mandatory-group-training-record.docx" download><Download />DOCX 내려받기</a></Button><Button variant="outline" onClick={onSubmit}><Upload />작성본 올리기</Button></div></CardContent></Card>;
}

function NoticeBoard({ requirements }: { requirements: Requirement[] }) {
  return <Card className="gap-0 overflow-hidden rounded-2xl py-0"><CardHeader className="border-b bg-muted/35 py-4 [.border-b]:pb-4"><div className="flex items-center gap-2"><Newspaper className="size-5 text-brand" /><CardTitle className="text-base">최신 이수 안내</CardTitle></div></CardHeader><CardContent className="divide-y p-0">{requirements.map((requirement) => { const days = daysUntil(requirement.dueDate); const label = days < 0 ? "기한 확인" : days === 0 ? "D-DAY" : `D-${days}`; return <div key={requirement.id} className="grid gap-3 p-4 md:grid-cols-[auto_1fr_auto] md:items-center"><Badge className={`min-w-14 justify-center rounded-full font-semibold ${requirement.noticeType === "신규" || requirement.noticeType === "변경" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300" : days < 0 ? "bg-muted text-muted-foreground hover:bg-muted" : days <= 7 ? "bg-red-600 text-white hover:bg-red-600" : days <= 30 ? "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300" : days <= 60 ? "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300" : "bg-secondary text-secondary-foreground hover:bg-secondary"}`}>{requirement.noticeType === "신규" || requirement.noticeType === "변경" ? requirement.noticeType : label}</Badge><div><p className="font-medium">{requirement.title}</p><p className="mt-1 text-sm text-muted-foreground">{requirement.sourceName || "공식 안내"} · 마감 {requirement.dueDate.replaceAll("-", ".")}</p></div><OfficialLinks requirement={requirement} /></div>; })}</CardContent></Card>;
}

function Dashboard({ requirements, submissions, campus }: { requirements: Requirement[]; submissions: Submission[]; campus: string }) {
  const visibleCampuses = campuses.filter((item) => campus === "all" || campus === item);
  return <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">2026년 캠퍼스별 이수 현황</CardTitle></CardHeader><CardContent><div className="mb-5 grid gap-4 md:grid-cols-3">{visibleCampuses.map((item) => { const completedIds = new Set(submissions.filter((submission) => submission.branch === item && isSubmissionComplete(submission)).map((submission) => submission.requirementId)); const count = requirements.filter((requirement) => completedIds.has(requirement.id)).length; const percent = requirements.length ? Math.round(count / requirements.length * 100) : 0; return <div key={item} className="rounded-2xl bg-muted/55 p-4"><div className="flex justify-between"><b>{short[item]}캠퍼스</b><span>{count}/{requirements.length}</span></div><Progress value={percent} className="mt-3" /><p className="mt-2 text-sm text-muted-foreground">완료율 {percent}%</p></div>; })}</div><div className="overflow-x-auto"><Table className="min-w-[680px]"><TableHeader><TableRow><TableHead className="min-w-64">이수 항목</TableHead><TableHead>마감일</TableHead>{visibleCampuses.map((item) => <TableHead key={item}>{short[item]}</TableHead>)}</TableRow></TableHeader><TableBody>{requirements.map((requirement) => <TableRow key={requirement.id}><TableCell><p className="font-medium">{requirement.title}</p><p className="mt-1 text-xs text-muted-foreground">직원별 · {requirement.frequency || "연 1회"}</p></TableCell><TableCell>{requirement.dueDate.slice(5).replace("-", ".")}</TableCell>{visibleCampuses.map((item) => { const completed = submissions.some((submission) => submission.requirementId === requirement.id && submission.branch === item && isSubmissionComplete(submission)); return <TableCell key={item}><Status completed={completed} /></TableCell>; })}</TableRow>)}</TableBody></Table></div></CardContent></Card>;
}

function RequirementCards({ requirements }: { requirements: Requirement[] }) {
  return <div className="grid gap-4 lg:grid-cols-2">{requirements.map((requirement) => <Card key={requirement.id} className="rounded-2xl"><CardContent className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Badge variant="secondary">{requirement.category}</Badge>{requirement.mandatory ? <Badge>관리 필수</Badge> : <Badge variant="outline">적용 대상 확인</Badge>}</div><h3 className="mt-3 text-lg font-semibold">{requirement.title}</h3></div><span className="text-sm font-semibold text-primary">{requirement.dueDate.replaceAll("-", ".")}까지</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{requirement.description}</p><dl className="mt-4 grid gap-2 rounded-xl bg-muted/50 p-4 text-sm"><div className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-muted-foreground">대상</dt><dd>{requirement.target || "공식 안내 확인"}</dd></div><div className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-muted-foreground">주기</dt><dd>{requirement.frequency || "공식 안내 확인"}</dd></div><div className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-muted-foreground">출처</dt><dd>{requirement.sourceName || "공식 기관"}</dd></div></dl><div className="mt-4"><OfficialLinks requirement={requirement} /></div>{requirement.officialCheckedAt && <p className="mt-3 text-xs text-muted-foreground">공식 링크 확인일 {requirement.officialCheckedAt}</p>}</CardContent></Card>)}</div>;
}

function OfficialLinks({ requirement }: { requirement: Requirement }) {
  return <div className="flex flex-wrap gap-2">{requirement.officialUrl && <Button size="sm" variant="outline" asChild><a href={requirement.officialUrl} target="_blank" rel="noreferrer"><Link2 />공식 안내</a></Button>}{requirement.courseUrl && <Button size="sm" asChild><a href={requirement.courseUrl} target="_blank" rel="noreferrer">교육받기<ExternalLink /></a></Button>}</div>;
}

function SubmissionTable({ submissions, requirements, canDelete, onDelete }: { submissions: Submission[]; requirements: Requirement[]; canDelete: boolean; onDelete: (item: Submission) => void }) {
  const visible = submissions.filter((item) => requirements.some((requirement) => requirement.id === item.requirementId));
  return <Card className="overflow-x-auto rounded-2xl py-0"><Table className="min-w-[920px]"><TableHeader><TableRow className="bg-muted/50"><TableHead>항목</TableHead><TableHead>캠퍼스</TableHead><TableHead>이수일</TableHead><TableHead>작성자</TableHead><TableHead>인원</TableHead><TableHead>이수증</TableHead><TableHead>상태</TableHead>{canDelete && <TableHead className="w-16" />}</TableRow></TableHeader><TableBody>{visible.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{requirements.find((requirement) => requirement.id === item.requirementId)?.title ?? "이수 항목"}</TableCell><TableCell><span className="inline-flex items-center gap-1.5"><CampusDot branch={item.branch} />{short[item.branch]}</span></TableCell><TableCell>{item.completionDate}</TableCell><TableCell>{item.submittedBy}</TableCell><TableCell>{item.participants.length ? `${item.participants.length}명` : "공통"}</TableCell><TableCell>{item.certificateName ? item.certificateUrl ? <a href={item.certificateUrl} className="text-primary underline underline-offset-4">{item.certificateName}</a> : <span className="text-primary">{item.certificateName}</span> : "미첨부"}</TableCell><TableCell><Status completed={isSubmissionComplete(item)} /></TableCell>{canDelete && <TableCell><Button type="button" size="icon" variant="ghost" aria-label="이수증 휴지통으로 이동" onClick={() => onDelete(item)}><Trash2 className="size-4" /></Button></TableCell>}</TableRow>)}</TableBody></Table>{!visible.length && <div className="p-8 text-center text-sm text-muted-foreground">등록된 이수증이 없습니다.</div>}</Card>;
}

function AdminPanel({ requirements, submissions, trashed, logs, onRestore, onPermanentDelete }: { requirements: Requirement[]; submissions: Submission[]; trashed: Submission[]; logs: ActivityLog[]; onRestore: (item: Submission) => void; onPermanentDelete: (item: Submission) => void }) {
  const missingByCampus = campuses.map((branch) => {
    const completed = new Set(submissions.filter((item) => item.branch === branch && isSubmissionComplete(item)).map((item) => item.requirementId));
    return { branch, missing: requirements.filter((item) => !completed.has(item.id)).length };
  });
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-3">{missingByCampus.map((item) => <Card key={item.branch} className="rounded-2xl"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{short[item.branch]}캠퍼스 미완료</p><p className="mt-1 text-2xl font-bold">{item.missing}건</p></div><Badge variant={item.missing ? "destructive" : "secondary"}>{item.missing ? "확인 필요" : "모두 완료"}</Badge></CardContent></Card>)}</div>
    <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trash2 className="size-4" />휴지통</CardTitle><CardDescription>삭제한 기록은 이곳에 보관됩니다. 복원하거나 영구 삭제할 수 있습니다.</CardDescription></CardHeader><CardContent className="space-y-2">{trashed.length ? trashed.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium">{requirements.find((requirement) => requirement.id === item.requirementId)?.title ?? "이수 항목"}</p><p className="text-sm text-muted-foreground">{short[item.branch]} · {item.certificateName ?? "첨부 파일 없음"} · 삭제 {item.deletedAt?.slice(0,10)}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => onRestore(item)}><RotateCcw />복원</Button><Button size="sm" variant="destructive" onClick={() => onPermanentDelete(item)}><Trash2 />영구 삭제</Button></div></div>) : <p className="rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">휴지통이 비어 있습니다.</p>}</CardContent></Card>
    <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="size-4" />최근 관리자 기록</CardTitle></CardHeader><CardContent className="space-y-2">{logs.length ? logs.slice(0,10).map((log) => <div key={log.id} className="flex items-center justify-between gap-4 border-b py-2 last:border-0"><div><p className="text-sm font-medium">{log.actor} · {log.detail ?? log.action}</p><p className="text-xs text-muted-foreground">{log.createdAt.slice(0,16).replace("T", " ")}</p></div><Badge variant="outline">{{ created: "등록", trashed: "휴지통", restored: "복원", permanently_deleted: "영구 삭제" }[log.action]}</Badge></div>) : <p className="text-sm text-muted-foreground">아직 관리자 기록이 없습니다.</p>}</CardContent></Card>
  </div>;
}

function ComplianceForm({ open, setOpen, requirements, demoMode, role, onCreated }: { open: boolean; setOpen: (value: boolean) => void; requirements: Requirement[]; demoMode: boolean; role: Role; onCreated: (item: Submission) => void }) {
  const [requirementId, setRequirementId] = useState(requirements[0]?.id ?? "");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const requirement = requirements.find((item) => item.id === requirementId);

  useEffect(() => { if (!requirements.some((item) => item.id === requirementId)) setRequirementId(requirements[0]?.id ?? ""); }, [requirementId, requirements]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      let certificateKey: string | null = null;
      let certificateName: string | null = file?.name ?? null;
      if (!demoMode && file) {
        const upload = new FormData(); upload.set("file", file); upload.set("purpose", "certificate");
        const response = await fetch("/api/uploads", { method: "POST", body: upload });
        const data = await response.json() as { key?: string; name?: string; error?: string };
        if (!response.ok || !data.key) throw new Error(data.error ?? "이수증 업로드 실패");
        certificateKey = data.key; certificateName = data.name ?? file.name;
      }
      const payload = { requirementId, branch: String(form.get("branch")), completionDate: String(form.get("date")), submittedBy: String(form.get("writer")), notes: String(form.get("notes")), status: "submitted" as const, certificateKey, certificateName, participants };
      if (demoMode) { onCreated({ id: crypto.randomUUID(), ...payload, participants, demo: true }); toast.success("체험판 제출 기록에 추가했습니다. 실제 파일은 저장되지 않았습니다."); }
      else { const response = await fetch("/api/compliance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json() as { id?: string; error?: string }; if (!response.ok || !data.id) throw new Error(data.error ?? "제출 실패"); onCreated({ id: data.id, ...payload, participants }); toast.success(role === "admin" ? "검토 대기 상태로 저장했습니다." : "본사 검토용으로 제출했습니다."); }
      setOpen(false); setParticipants([]); setFile(null);
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>이수 결과 작성</DialogTitle><DialogDescription>캠퍼스별 이수 결과와 증빙 파일을 제출합니다. 제출 완료 후 본사 검토를 거쳐 이수 완료로 처리됩니다.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="이수 항목"><Select value={requirementId} onValueChange={setRequirementId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{requirements.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></Field><Field label="캠퍼스"><Select name="branch" defaultValue="센텀캠퍼스"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{campuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="이수일"><Input name="date" type="date" required /></Field><Field label="작성자"><Input name="writer" required placeholder="원장 또는 담당자" /></Field></div>{requirement?.scope === "individual" && <div className="space-y-3"><div className="flex justify-between"><Label>직원별 이수자</Label><Button type="button" size="sm" variant="outline" onClick={() => setParticipants((items) => [...items, { name: "", position: "", completedAt: "" }])}><Plus />이수자 추가</Button></div>{participants.length === 0 ? <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">이수자를 추가하면 직원별 완료 여부를 함께 관리할 수 있습니다.</div> : participants.map((item, index) => <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-3"><Input value={item.name} placeholder="이름" onChange={(e) => setParticipants((items) => items.map((p,i)=>i===index?{...p,name:e.target.value}:p))} /><Input value={item.position} placeholder="직책" onChange={(e) => setParticipants((items) => items.map((p,i)=>i===index?{...p,position:e.target.value}:p))} /><Input value={item.completedAt} type="date" onChange={(e) => setParticipants((items) => items.map((p,i)=>i===index?{...p,completedAt:e.target.value}:p))} /></div>)}</div>}<Field label="이수증·집합교육 기록"><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"><Upload className="mb-2" />{file?.name ?? "DOCX, PDF 또는 이미지 파일 선택"}<input type="file" className="sr-only" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></Field><Field label="메모"><Textarea name="notes" rows={3} placeholder="미이수자, 보완 예정 내용 등을 기록하세요." /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button><Button disabled={saving}>{saving ? "제출 중…" : "본사 검토 요청"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ComplianceFormV2({ open, setOpen, requirements, demoMode, onCreated }: { open: boolean; setOpen: (value: boolean) => void; requirements: Requirement[]; demoMode: boolean; onCreated: (item: Submission) => void }) {
  const [requirementId, setRequirementId] = useState(requirements[0]?.id ?? "");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!requirements.some((item) => item.id === requirementId)) setRequirementId(requirements[0]?.id ?? ""); }, [requirementId, requirements]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return toast.error("완료 처리를 위해 이수증 또는 작성본을 첨부해 주세요.");
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      let certificateKey: string | null = null;
      let certificateName: string | null = file.name;
      if (!demoMode) {
        const upload = new FormData(); upload.set("file", file); upload.set("purpose", "certificate");
        const response = await fetch("/api/uploads", { method: "POST", body: upload });
        const data = await response.json() as { key?: string; name?: string; error?: string };
        if (!response.ok || !data.key) throw new Error(data.error ?? "이수증 업로드 실패");
        certificateKey = data.key; certificateName = data.name ?? file.name;
      }
      const payload = { requirementId, branch: String(form.get("branch")), completionDate: String(form.get("date")), submittedBy: String(form.get("writer")), notes: String(form.get("notes")), status: "completed" as const, certificateKey, certificateName, participants };
      if (demoMode) {
        onCreated({ id: crypto.randomUUID(), ...payload, participants, demo: true });
        toast.success("파일을 올려 이수 항목을 완료로 변경했습니다.");
      } else {
        const response = await fetch("/api/compliance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json() as { id?: string; error?: string };
        if (!response.ok || !data.id) throw new Error(data.error ?? "저장 실패");
        onCreated({ id: data.id, ...payload, participants });
        toast.success("이수증을 저장하고 완료 처리했습니다.");
      }
      setOpen(false); setParticipants([]); setFile(null);
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>이수 결과 작성</DialogTitle><DialogDescription>이수증이나 집합교육 작성본을 올리면 해당 캠퍼스의 항목이 즉시 완료로 표시됩니다.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="이수 항목"><Select value={requirementId} onValueChange={setRequirementId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{requirements.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></Field><Field label="캠퍼스"><Select name="branch" defaultValue="센텀캠퍼스"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{campuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="이수일"><Input name="date" type="date" required /></Field><Field label="작성자"><Input name="writer" required placeholder="원장 또는 담당자" /></Field></div><div className="space-y-3"><div className="flex justify-between"><Label>직원별 이수자</Label><Button type="button" size="sm" variant="outline" onClick={() => setParticipants((items) => [...items, { name: "", position: "", completedAt: "" }])}><Plus />이수자 추가</Button></div>{participants.length === 0 ? <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">필요한 경우 직원별 이수자를 추가할 수 있습니다.</div> : participants.map((item, index) => <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-3"><Input value={item.name} placeholder="이름" onChange={(event) => setParticipants((items) => items.map((participant, itemIndex) => itemIndex === index ? { ...participant, name: event.target.value } : participant))} /><Input value={item.position} placeholder="직책" onChange={(event) => setParticipants((items) => items.map((participant, itemIndex) => itemIndex === index ? { ...participant, position: event.target.value } : participant))} /><Input value={item.completedAt} type="date" onChange={(event) => setParticipants((items) => items.map((participant, itemIndex) => itemIndex === index ? { ...participant, completedAt: event.target.value } : participant))} /></div>)}</div><Field label="이수증·집합교육 기록"><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"><Upload className="mb-2" />{file?.name ?? "DOCX, PDF 또는 이미지 파일 선택"}<input type="file" required className="sr-only" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label></Field><Field label="메모"><Textarea name="notes" rows={3} placeholder="참석자 또는 교육 내용을 기록하세요." /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button><Button disabled={saving}>{saving ? "저장 중…" : "완료로 저장"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function Status({ completed }: { completed: boolean }) { return completed ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">완료</Badge> : <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">미완료</Badge>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Summary({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof ShieldCheck; tone: "green" | "blue" | "amber" | "indigo" }) { const tones = { green: "bg-emerald-100 text-emerald-700", blue: "bg-sky-100 text-sky-700", amber: "bg-amber-100 text-amber-700", indigo: "bg-primary/10 text-primary" }; return <Card className="rounded-2xl py-0"><CardContent className="flex items-center gap-4 p-5"><div className={`grid size-11 place-items-center rounded-2xl ${tones[tone]}`}><Icon /></div><div><p className="text-sm text-muted-foreground">{label}</p><strong className="text-2xl">{value}</strong></div></CardContent></Card>; }
