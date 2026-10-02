"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const [logs, setLogs] = useState<Log[]>([]);
  const [who, setWho] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState("");

  const load = useCallback(async (member = who) => {
    setLoading(true);
    try {
      const data = await api("list", { limit: 500, member: member || undefined });
      setMembers(data.members ?? []); setLogs(data.logs ?? []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "불러오지 못했어요."); }
    finally { setLoading(false); }
  }, [who]);

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
  const whoMember = who ? members.find((m) => m.id === who) : null;
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
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{whoMember ? <><b className="text-foreground">{whoMember.campus} {whoMember.name}</b>님의 기록 · <button className="underline underline-offset-2" onClick={() => setWho("")}>전체 보기</button></> : "최근 기록 500건"}</p>
          {logs.length ? (
            <Card className="overflow-hidden rounded-2xl py-0"><div className="overflow-x-auto"><Table>
              <TableHeader><TableRow className="bg-muted/55"><TableHead>시간</TableHead><TableHead>이름</TableHead><TableHead>구분</TableHead><TableHead>내용</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
              <TableBody>{logs.map((l) => <TableRow key={l.id}><TableCell className="whitespace-nowrap text-sm">{fmt(l.at)}</TableCell><TableCell className="whitespace-nowrap">{l.name ?? "—"}</TableCell><TableCell className="whitespace-nowrap"><span className={`text-sm ${l.action === "login_fail" ? "font-medium text-destructive" : ""}`}>{ACTION[l.action] ?? l.action}</span></TableCell><TableCell className="max-w-md truncate text-sm text-muted-foreground">{l.path ?? ""}</TableCell><TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{l.ip ?? ""}</TableCell></TableRow>)}</TableBody>
            </Table></div></Card>
          ) : <Empty text={loading ? "불러오는 중…" : "기록이 없어요."} />}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof UserCheck; label: string; value: string; sub: string }) {
  return <Card className="rounded-2xl py-0"><CardContent className="flex items-center gap-4 p-5"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon className="size-5" /></div><div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p><p className="truncate text-xs text-muted-foreground">{sub}</p></div></CardContent></Card>;
}
function Empty({ text }: { text: string }) {
  return <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed bg-card text-sm text-muted-foreground">{text}</div>;
}
