"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, History, RefreshCw, Search, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMe } from "@/archive-api";
import { CampusDot } from "@/lib/campus";

type Member = { id: string; campus: string; title: string; name: string; status: "pending" | "approved" | "rejected" | "suspended"; is_admin: boolean; pledge_at: string | null; last_seen: string | null; created_at: string };
type Log = { id: number; member_id: string | null; name: string | null; action: string; path: string | null; ip: string | null; at: string };

const STATUS: Record<Member["status"], { label: string; tone: string }> = {
  pending: { label: "승인 대기", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  approved: { label: "승인", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  rejected: { label: "거절", tone: "bg-muted text-muted-foreground" },
  suspended: { label: "정지", tone: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};
const ACTION: Record<string, string> = { view: "페이지", open: "열람", login: "로그인", login_fail: "로그인 실패", apply: "가입 신청", admin: "관리 작업" };
const fmt = (t: string | null) => t ? new Date(t).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const online = (t: string | null) => Boolean(t) && Date.now() - new Date(t!).getTime() < 5 * 60000;

async function api(path: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`/api/admin/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.msg ?? data.error ?? "처리하지 못했어요.");
  return data;
}

export function MembersSection() {
  const me = getMe();
  const [tab, setTab] = useState<"pending" | "members" | "logs">("pending");
  const [members, setMembers] = useState<Member[]>([]);
  const [who, setWho] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("list");
      setMembers(data.members ?? []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "불러오지 못했어요."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function update(id: string, patch: Record<string, unknown>) {
    try { await api("set", { id, ...patch }); toast.success("저장했습니다."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "처리하지 못했어요."); }
  }
  async function remove(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); toast.info("한 번 더 누르면 삭제됩니다."); return; }
    setConfirmDelete("");
    try { await api("delete", { id }); toast.success("삭제했습니다."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "처리하지 못했어요."); }
  }

  const pending = members.filter((m) => m.status === "pending");
  const onlineNow = members.filter((m) => m.status === "approved" && online(m.last_seen));
  const rows = tab === "pending" ? pending : members;
  const counts = useMemo(() => ({ approved: members.filter((m) => m.status === "approved").length, admins: members.filter((m) => m.is_admin).length }), [members]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={UserCheck} label="지금 접속 중" value={`${onlineNow.length}명`} sub={onlineNow.map((m) => `${m.campus} ${m.name}`).join(", ") || "없음"} />
        <Stat icon={History} label="승인 대기" value={`${pending.length}건`} sub="가입 신청 후 승인 전" />
        <Stat icon={ShieldCheck} label="승인 회원" value={`${counts.approved}명`} sub={`관리자 ${counts.admins}명`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList><TabsTrigger value="pending">승인 대기 {pending.length}</TabsTrigger><TabsTrigger value="members">회원 {members.length}</TabsTrigger><TabsTrigger value="logs">접속 기록</TabsTrigger></TabsList>
        </Tabs>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />새로고침</Button>
      </div>

      {tab !== "logs" ? (
        rows.length ? (
          <Card className="overflow-hidden rounded-2xl py-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow className="bg-muted/55"><TableHead>캠퍼스</TableHead><TableHead>직책</TableHead><TableHead>이름</TableHead><TableHead>상태</TableHead><TableHead>서약 동의</TableHead><TableHead>최근 접속</TableHead><TableHead className="text-right">관리</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((m) => {
              const self = m.id === me?.id;
              return (
                <TableRow key={m.id}>
                  <TableCell><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CampusDot branch={m.campus} />{m.campus}</span></TableCell>
                  <TableCell>{m.status === "approved" && !self ? <select value={m.title} onChange={(event) => void update(m.id, { title: event.target.value })} className="rounded-lg border bg-background px-2 py-1 text-sm">{["원장", "전임", "행정"].map((t) => <option key={t}>{t}</option>)}</select> : m.title}</TableCell>
                  <TableCell className="whitespace-nowrap"><b>{m.name}</b>{m.is_admin && <Badge className="ml-1.5 rounded-full bg-brand-soft text-brand hover:bg-brand-soft">관리자</Badge>}{self && <span className="ml-1.5 text-xs text-muted-foreground">(나)</span>}</TableCell>
                  <TableCell className="whitespace-nowrap"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[m.status].tone}`}>{STATUS[m.status].label}</span>{online(m.last_seen) && m.status === "approved" && <span className="ml-2 text-xs font-medium text-emerald-600">● 접속 중</span>}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmt(m.pledge_at)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmt(m.last_seen)}</TableCell>
                  <TableCell><div className="flex flex-wrap justify-end gap-1.5">
                    {m.status !== "approved" && <Button size="sm" className="h-8 rounded-lg" onClick={() => void update(m.id, { status: "approved" })}>승인</Button>}
                    {m.status === "pending" && <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => void update(m.id, { status: "rejected" })}>거절</Button>}
                    {m.status === "approved" && !self && <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => void update(m.id, { status: "suspended" })}>정지</Button>}
                    {m.status === "approved" && !self && <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => void update(m.id, { is_admin: !m.is_admin })}>{m.is_admin ? "관리자 해제" : "관리자 지정"}</Button>}
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => { setWho(m.id); setTab("logs"); }}>기록</Button>
                    {!self && m.status !== "approved" && <Button size="sm" variant="ghost" className={`h-8 rounded-lg text-destructive ${confirmDelete === m.id ? "bg-destructive/10" : ""}`} onClick={() => void remove(m.id)}>삭제</Button>}
                  </div></TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table></div></Card>
        ) : <Empty text={loading ? "불러오는 중…" : tab === "pending" ? "승인 대기 중인 신청이 없어요." : "등록된 회원이 없어요."} />
      ) : (
        <LogsPanel members={members} who={who} setWho={setWho} />
      )}
    </div>
  );
}

type Period = "today" | "7d" | "30d" | "all" | "custom";
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
function periodRange(period: Period, from: string, to: string) {
  const today = dayStart(new Date());
  if (period === "today") return { from: today.toISOString() };
  if (period === "7d") return { from: new Date(today.getTime() - 6 * 86400000).toISOString() };
  if (period === "30d") return { from: new Date(today.getTime() - 29 * 86400000).toISOString() };
  if (period === "custom") return { from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined, to: to ? new Date(new Date(`${to}T00:00:00`).getTime() + 86400000).toISOString() : undefined };
  return {};
}
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function LogsPanel({ members, who, setWho }: { members: Member[]; who: string; setWho: (id: string) => void }) {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [campus, setCampus] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const timer = window.setTimeout(() => setQ(input.trim()), 300); return () => window.clearTimeout(timer); }, [input]);
  const filters = useMemo(() => ({ q: q || undefined, action: action || undefined, campus: campus || undefined, member: who || undefined, ...periodRange(period, from, to) }), [q, action, campus, who, period, from, to]);

  const requestRef = useRef(0);
  const fetchPage = useCallback(async (offset: number) => {
    const ticket = ++requestRef.current;
    setLoading(true);
    try {
      const data = await api("logs", { ...filters, limit: 200, offset });
      if (ticket !== requestRef.current) return;
      setLogs((current) => offset ? [...current, ...(data.logs ?? [])] : (data.logs ?? []));
      setTotal(data.total ?? 0);
    } catch (error) { toast.error(error instanceof Error ? error.message : "기록을 불러오지 못했어요."); }
    finally { if (ticket === requestRef.current) setLoading(false); }
  }, [filters]);
  useEffect(() => { void fetchPage(0); }, [fetchPage]);

  async function exportCsv() {
    setExporting(true);
    try {
      const data = await api("logs", { ...filters, limit: 5000, offset: 0 });
      const byId = new Map(members.map((m) => [m.id, m]));
      const rows = [["시간", "캠퍼스", "이름", "구분", "내용", "IP"], ...(data.logs as Log[]).map((l) => [new Date(l.at).toLocaleString("ko-KR"), l.member_id ? byId.get(l.member_id)?.campus ?? "" : "", l.name ?? "", ACTION[l.action] ?? l.action, l.path ?? "", l.ip ?? ""])];
      const blob = new Blob(["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `hi5-access-log_${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success(`${data.logs.length}건을 내려받았어요.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "내려받지 못했어요."); }
    finally { setExporting(false); }
  }

  const campusOf = (l: Log) => l.member_id ? members.find((m) => m.id === l.member_id)?.campus : undefined;
  const sel = "h-10 rounded-xl border border-input bg-background px-3 text-sm";
  const periods: Array<[Period, string]> = [["today", "오늘"], ["7d", "7일"], ["30d", "30일"], ["all", "전체"], ["custom", "직접 선택"]];

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl py-0"><CardContent className="space-y-3 p-4">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="이름, 열람한 자료, IP 검색 (예: 입시설명회)" className="h-10 rounded-xl pl-10" aria-label="접속 기록 검색" /></div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={sel} value={action} onChange={(event) => setAction(event.target.value)} aria-label="구분"><option value="">전체 구분</option>{Object.entries(ACTION).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select className={sel} value={campus} onChange={(event) => setCampus(event.target.value)} aria-label="캠퍼스"><option value="">전체 캠퍼스</option>{["센텀", "김해", "명지"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select className={sel} value={who} onChange={(event) => setWho(event.target.value)} aria-label="사람"><option value="">전체 회원</option>{members.map((m) => <option key={m.id} value={m.id}>{m.campus} {m.name}</option>)}</select>
          <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">{periods.map(([key, label]) => <button key={key} type="button" onClick={() => setPeriod(key)} className={`h-8 rounded-lg px-3 text-sm ${period === key ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"}`}>{label}</button>)}</div>
          {period === "custom" && <div className="flex items-center gap-1.5 text-sm"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={sel} aria-label="시작일" />~<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={sel} aria-label="종료일" /></div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">{loading && !logs.length ? "불러오는 중…" : <>검색 결과 <b className="text-foreground">{total.toLocaleString()}건</b></>}{(q || action || campus || who || period !== "7d") && <button className="ml-3 underline underline-offset-2" onClick={() => { setInput(""); setAction(""); setCampus(""); setWho(""); setPeriod("7d"); }}>필터 초기화</button>}</p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void exportCsv()} disabled={exporting || !total}><Download className="size-4" />{exporting ? "준비 중…" : "CSV 내려받기"}</Button>
        </div>
      </CardContent></Card>
      {logs.length ? (
        <Card className="overflow-hidden rounded-2xl py-0"><div className="overflow-x-auto"><Table>
          <TableHeader><TableRow className="bg-muted/55"><TableHead>시간</TableHead><TableHead>캠퍼스</TableHead><TableHead>이름</TableHead><TableHead>구분</TableHead><TableHead>내용</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
          <TableBody>{logs.map((l) => { const c = campusOf(l); return <TableRow key={l.id}><TableCell className="whitespace-nowrap text-sm">{fmt(l.at)}</TableCell><TableCell className="whitespace-nowrap text-sm">{c ? <span className="inline-flex items-center gap-1.5"><CampusDot branch={c} />{c}</span> : "—"}</TableCell><TableCell className="whitespace-nowrap">{l.member_id ? <button className="hover:underline" onClick={() => setWho(l.member_id!)}>{l.name ?? "—"}</button> : l.name ?? "—"}</TableCell><TableCell className="whitespace-nowrap"><span className={`text-sm ${l.action === "login_fail" ? "font-medium text-destructive" : ""}`}>{ACTION[l.action] ?? l.action}</span></TableCell><TableCell className="max-w-md truncate text-sm text-muted-foreground" title={l.path ?? ""}>{l.path ?? ""}</TableCell><TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{l.ip ?? ""}</TableCell></TableRow>; })}</TableBody>
        </Table></div></Card>
      ) : <Empty text={loading ? "불러오는 중…" : "조건에 맞는 기록이 없어요."} />}
      {logs.length < total && <div className="flex justify-center"><Button variant="outline" className="rounded-xl" disabled={loading} onClick={() => void fetchPage(logs.length)}>{loading ? "불러오는 중…" : `더 보기 (${(total - logs.length).toLocaleString()}건 남음)`}</Button></div>}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof UserCheck; label: string; value: string; sub: string }) {
  return <Card className="rounded-2xl py-0"><CardContent className="flex items-center gap-4 p-5"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon className="size-5" /></div><div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p><p className="truncate text-xs text-muted-foreground">{sub}</p></div></CardContent></Card>;
}
function Empty({ text }: { text: string }) {
  return <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed bg-card text-sm text-muted-foreground">{text}</div>;
}
