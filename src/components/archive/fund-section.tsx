"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, FileCheck2, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FundTransaction = {
  id: string;
  transactionDate: string;
  category: string;
  description: string;
  income: number;
  expense: number;
  balance: number;
  receiptUrl: string | null;
};

type FundData = {
  accountLabel: string;
  currentBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  transactions: FundTransaction[];
  demo?: boolean;
};

const won = new Intl.NumberFormat("ko-KR");

export function FundSection() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<FundData | null>(null);
  const [period, setPeriod] = useState("all");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    fetch("/api/fund/session", { cache: "no-store" })
      .then(async (response) => (await response.json()) as { authenticated?: boolean })
      .then((result) => setAuthenticated(Boolean(result.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) { setData(null); return; }
    fetch("/api/fund", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) { setAuthenticated(false); return null; }
        if (!response.ok) throw new Error("기금 내역을 불러오지 못했습니다.");
        return response.json() as Promise<FundData>;
      })
      .then((result) => { if (result) setData(result); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "기금 내역을 불러오지 못했습니다."));
    const timer = window.setTimeout(() => void lock(false), 30 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [authenticated]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter((item) => (period === "all" || item.transactionDate.startsWith(period)) && (category === "all" || item.category === category));
  }, [category, data, period]);

  const periods = useMemo(() => Array.from(new Set(data?.transactions.map((item) => item.transactionDate.slice(0, 7)) ?? [])), [data]);
  const categories = useMemo(() => Array.from(new Set(data?.transactions.map((item) => item.category) ?? [])), [data]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/fund/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json() as { authenticated?: boolean; error?: string };
      if (!response.ok || !result.authenticated) throw new Error(result.error ?? "기금 내역을 열지 못했습니다.");
      setPassword("");
      setAuthenticated(true);
      toast.success("제작실 기금 내역을 열었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "기금 내역을 열지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function lock(showToast = true) {
    await fetch("/api/fund/logout", { method: "POST" }).catch(() => undefined);
    setAuthenticated(false);
    setData(null);
    if (showToast) toast.success("제작실 기금을 잠갔습니다.");
  }

  if (authenticated === null) return <div className="grid min-h-[460px] place-items-center text-primary"><LoaderCircle className="size-7 animate-spin" /></div>;

  if (!authenticated) {
    return <div className="grid min-h-[560px] place-items-center"><Card className="w-full max-w-md rounded-3xl border-border/80 px-2 py-2 shadow-[0_28px_80px_rgba(38,33,28,0.12)]"><CardContent className="p-7 text-center sm:p-9"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="size-7" /></div><h2 className="mt-6 text-2xl font-semibold">제작실 기금</h2><p className="mt-3 leading-7 text-muted-foreground">계좌와 입출금 내역은 별도 비밀번호로 보호됩니다.</p><form className="mt-7 space-y-4 text-left" onSubmit={login}><div className="space-y-2"><Label htmlFor="fund-password">기금 비밀번호</Label><div className="relative"><Input id="fund-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호 입력" className="h-12 rounded-xl pr-11" autoComplete="current-password" required /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></div></div><Button className="h-12 w-full rounded-xl" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}기금 내역 열기</Button></form><div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" />인증 후 30분이 지나면 자동으로 잠깁니다.</div></CardContent></Card></div>;
  }

  if (!data) return <div className="grid min-h-[460px] place-items-center text-primary"><LoaderCircle className="size-7 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-[0_10px_35px_rgba(38,33,28,0.06)] sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold">{data.accountLabel}</p>{data.demo && <Badge variant="secondary" className="rounded-full">샘플 데이터</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">민감한 계좌 정보는 현재 인증 세션에서만 표시됩니다.</p></div><Button variant="outline" className="rounded-xl" onClick={() => void lock()}><LockKeyhole className="size-4" />잠금</Button></div>

      <div className="grid gap-3 md:grid-cols-3">
        <FundSummary label="현재 잔액" value={`${won.format(data.currentBalance)}원`} icon={WalletCards} tone="indigo" />
        <FundSummary label="이번 달 입금" value={`${won.format(data.monthlyIncome)}원`} icon={ArrowDownLeft} tone="green" />
        <FundSummary label="이번 달 지출" value={`${won.format(data.monthlyExpense)}원`} icon={ArrowUpRight} tone="orange" />
      </div>

      <Card className="rounded-2xl border-border/80 py-0"><CardContent className="flex flex-wrap items-center gap-2 p-4"><Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="전체 기간" /></SelectTrigger><SelectContent><SelectItem value="all">전체 기간</SelectItem>{periods.map((item) => <SelectItem key={item} value={item}>{item.replace("-", "년 ")}월</SelectItem>)}</SelectContent></Select><Select value={category} onValueChange={setCategory}><SelectTrigger className="w-48 rounded-xl"><SelectValue placeholder="전체 구분" /></SelectTrigger><SelectContent><SelectItem value="all">전체 구분</SelectItem>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={() => { setPeriod("all"); setCategory("all"); }}>필터 초기화</Button></CardContent></Card>

      <Card className="overflow-hidden rounded-2xl border-border/80 py-0"><Table><TableHeader><TableRow className="bg-muted/55"><TableHead>날짜</TableHead><TableHead>구분</TableHead><TableHead>내용</TableHead><TableHead className="text-right">입금</TableHead><TableHead className="text-right">지출</TableHead><TableHead className="text-right">잔액</TableHead><TableHead className="text-center">증빙</TableHead></TableRow></TableHeader><TableBody>{filtered.map((item) => <TableRow key={item.id}><TableCell>{item.transactionDate.replaceAll("-", ".")}</TableCell><TableCell><Badge variant="outline" className="rounded-full">{item.category}</Badge></TableCell><TableCell className="min-w-56 whitespace-normal font-medium">{item.description}</TableCell><TableCell className="text-right text-emerald-700 dark:text-emerald-300">{item.income ? `+${won.format(item.income)}` : "—"}</TableCell><TableCell className="text-right text-orange-700 dark:text-orange-300">{item.expense ? `-${won.format(item.expense)}` : "—"}</TableCell><TableCell className="text-right font-semibold">{won.format(item.balance)}</TableCell><TableCell className="text-center">{item.receiptUrl ? <Button size="icon-sm" variant="ghost" asChild><a href={item.receiptUrl} target="_blank" rel="noreferrer" aria-label="증빙 열기"><FileCheck2 className="size-4" /></a></Button> : <span className="text-muted-foreground">—</span>}</TableCell></TableRow>)}</TableBody></Table>{!filtered.length && <div className="grid min-h-48 place-items-center text-muted-foreground">표시할 기금 내역이 없습니다.</div>}</Card>
    </div>
  );
}

function FundSummary({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof WalletCards; tone: "indigo" | "green" | "orange" }) {
  const tones = { indigo: "bg-primary/10 text-primary", green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" };
  return <Card className="rounded-2xl border-border/80 py-0"><CardContent className="flex items-center gap-4 p-5"><div className={`grid size-11 place-items-center rounded-2xl ${tones[tone]}`}><Icon className="size-5" /></div><div><p className="text-sm text-muted-foreground">{label}</p><strong className="mt-1 block text-xl md:text-2xl">{value}</strong></div></CardContent></Card>;
}
