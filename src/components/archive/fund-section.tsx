"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, FileCheck2, LoaderCircle, LockKeyhole, Paperclip, Pencil, Plus, Trash2, Upload, WalletCards, X } from "lucide-react";
import { toast } from "sonner";

import { fundApi } from "@/archive-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FUND_CATEGORIES, type ParsedFundRow } from "./fund-excel";

type FundTransaction = {
  id: string;
  transactionDate: string;
  category: string;
  description: string;
  memo: string;
  income: number;
  expense: number;
  balance: number;
  receiptKey: string | null;
  receiptUrl: string | null;
};

type FundData = {
  accountLabel: string;
  currentBalance: number;
  month: string;
  monthlyIncome: number;
  monthlyExpense: number;
  transactions: FundTransaction[];
  demo?: boolean;
};

type Draft = { id?: string; kind: "in" | "out"; transactionDate: string; category: string; description: string; memo: string; income: string; expense: string; receiptKey: string | null; receiptUrl: string | null };
type ImportRow = ParsedFundRow & { id: string; duplicate: boolean };

const won = new Intl.NumberFormat("ko-KR");
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const digits = (v: string) => v.replace(/[^0-9]/g, "");
const money = (v: string) => (digits(v) ? won.format(Number(digits(v))) : "");

export function FundSection() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(fundApi.isUnlocked());
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [data, setData] = useState<FundData | null>(null);
  const [reload, setReload] = useState(0);
  const [period, setPeriod] = useState("all");
  const [category, setCategory] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState<{ name: string; rows: ImportRow[] } | null>(null);
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/fund/session", { cache: "no-store" })
      .then(async (response) => (await response.json()) as { authenticated?: boolean })
      .then((result) => setAuthenticated(Boolean(result.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  // 10분 동안 안 쓰면 다시 잠금
  useEffect(() => {
    if (!unlocked) return;
    const t = setInterval(() => { if (!fundApi.isUnlocked()) { setUnlocked(false); setData(null); toast.info("10분 동안 쓰지 않아 기금 화면을 잠갔어요."); } }, 20_000);
    return () => clearInterval(t);
  }, [unlocked]);
  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!/^[0-9]{4}$/.test(pin)) { setPinMsg("비밀번호 숫자 4자리를 입력해 주세요."); return; }
    setPinBusy(true); setPinMsg("");
    try { await fundApi.unlock(pin); setPin(""); setUnlocked(true); }
    catch (error) { setPinMsg(error instanceof Error ? error.message : "비밀번호를 확인해 주세요."); setPin(""); }
    finally { setPinBusy(false); }
  }

  useEffect(() => {
    if (!authenticated || !unlocked) { setData(null); return; }
    let stale = false;
    fetch("/api/fund", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) { setAuthenticated(false); return null; }
        if (response.status === 423) { fundApi.lock(); setUnlocked(false); return null; }
        if (!response.ok) throw new Error("기금 내역을 불러오지 못했습니다.");
        return response.json() as Promise<FundData>;
      })
      .then((result) => { if (result && !stale) setData(result); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "기금 내역을 불러오지 못했습니다."));
    return () => { stale = true; };
  }, [authenticated, unlocked, reload]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter((item) => (period === "all" || item.transactionDate.startsWith(period)) && (category === "all" || item.category === category));
  }, [category, data, period]);

  const periods = useMemo(() => Array.from(new Set(data?.transactions.map((item) => item.transactionDate.slice(0, 7)) ?? [])), [data]);
  const categories = useMemo(() => Array.from(new Set(data?.transactions.map((item) => item.category) ?? [])), [data]);
  const filteredTotals = useMemo(() => ({ income: filtered.reduce((s, t) => s + t.income, 0), expense: filtered.reduce((s, t) => s + t.expense, 0) }), [filtered]);

  async function template() {
    setBusy("template");
    try { await (await import("./fund-excel")).downloadFundTemplate(); toast.success("양식을 내려받았어요. '기금 내역' 시트에 적어서 올려 주세요."); }
    catch { toast.error("양식을 만들지 못했어요."); } finally { setBusy(""); }
  }
  async function pickFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setBusy("parse");
    try {
      const parsed = await (await import("./fund-excel")).parseFundFile(file);
      if (!parsed.length) { toast.error("올린 파일에 적힌 내역이 없어요."); return; }
      const ids = await fundApi.importIds(parsed.filter((r) => !r.error));
      const existing = new Set(data?.transactions.map((t) => t.id));
      let k = 0;
      const rows = parsed.map((r) => { if (r.error) return { ...r, id: "", duplicate: false }; const id = ids[k++]; return { ...r, id, duplicate: existing.has(id) }; });
      setImporting({ name: file.name, rows });
    } catch (error) { toast.error(error instanceof Error ? error.message : "파일을 읽지 못했어요."); } finally { setBusy(""); }
  }
  async function confirmImport() {
    if (!importing) return;
    const rows = importing.rows.filter((r) => !r.error && !r.duplicate);
    setBusy("import");
    try {
      await fundApi.importRows(rows, (done) => setBusy(`import:${done}/${rows.length}`));
      toast.success(`${rows.length}건을 등록했어요.`);
      setImporting(null); setReload((v) => v + 1);
    } catch { toast.error("등록하는 중에 문제가 생겼어요. 다시 올리면 남은 것만 들어가요."); setReload((v) => v + 1); } finally { setBusy(""); }
  }

  if (authenticated === null) return <div className="grid min-h-[460px] place-items-center text-primary"><LoaderCircle className="size-7 animate-spin" /></div>;

  if (!authenticated) {
    return <div className="grid min-h-[460px] place-items-center"><Card className="w-full max-w-md rounded-3xl border-border/80 px-2 py-2"><CardContent className="p-7 text-center sm:p-9"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"><LockKeyhole className="size-7" /></div><h2 className="mt-6 text-2xl font-semibold">제작실 기금</h2><p className="mt-3 leading-7 text-muted-foreground">제작실 기금은 직책이 원장·이사·제작실장인 교직원만 열람할 수 있습니다.</p></CardContent></Card></div>;
  }

  if (!unlocked) {
    return <div className="grid min-h-[460px] place-items-center"><Card className="w-full max-w-md rounded-3xl border-border/80 px-2 py-2"><CardContent className="p-7 text-center sm:p-9">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"><LockKeyhole className="size-7" /></div>
      <h2 className="mt-6 text-2xl font-semibold">제작실 기금 잠금</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">보안을 위해 <b className="text-foreground">로그인 비밀번호 4자리</b>를 한 번 더 입력해 주세요.<br />10분 동안 쓰지 않으면 다시 잠겨요.</p>
      <form className="mt-6 space-y-3" onSubmit={unlock}>
        <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} type="password" inputMode="numeric" autoComplete="current-password" autoFocus maxLength={4} placeholder="••••" aria-label="비밀번호 4자리" className="h-14 rounded-xl text-center text-2xl tracking-[0.6em]" />
        {pinMsg && <p className="text-sm text-rose-600" role="alert">{pinMsg}</p>}
        <Button className="h-12 w-full rounded-xl text-base" disabled={pinBusy || pin.length !== 4}>{pinBusy ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}잠금 풀기</Button>
      </form>
    </CardContent></Card></div>;
  }

  if (!data) return <div className="grid min-h-[460px] place-items-center text-primary"><LoaderCircle className="size-7 animate-spin" /></div>;

  const monthLabel = `${Number(data.month.slice(5, 7))}월`;
  const openNew = () => setDraft({ kind: "out", transactionDate: today(), category: "재료비", description: "", memo: "", income: "", expense: "", receiptKey: null, receiptUrl: null });
  const openEdit = (t: FundTransaction) => setDraft({ id: t.id, kind: t.income && !t.expense ? "in" : "out", transactionDate: t.transactionDate, category: t.category, description: t.description, memo: t.memo, income: t.income ? String(t.income) : "", expense: t.expense ? String(t.expense) : "", receiptKey: t.receiptKey, receiptUrl: t.receiptUrl });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-[0_10px_35px_rgba(38,33,28,0.06)] lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-2"><p className="font-semibold">{data.accountLabel}</p>{data.demo && <Badge variant="secondary" className="rounded-full">샘플 데이터</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">원장·이사·제작실장 계정에서만 표시되는 정보입니다. 잔액은 날짜 순서대로 자동 계산돼요.</p></div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <Button variant="outline" className="h-10 rounded-xl px-3" disabled={!!busy} onClick={template}>{busy === "template" ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}<span><span className="sm:hidden">양식 받기</span><span className="hidden sm:inline">양식 다운로드</span></span></Button>
          <Button variant="outline" className="h-10 rounded-xl px-3" disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === "parse" ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}<span><span className="sm:hidden">올리기</span><span className="hidden sm:inline">양식 업로드</span></span></Button>
          <Button className="h-10 rounded-xl px-3" disabled={!!busy} onClick={openNew}><Plus className="size-4" />추가</Button>
          <Button variant="ghost" className="col-span-3 h-10 rounded-xl px-3 text-muted-foreground sm:col-span-1" onClick={() => { fundApi.lock(); setUnlocked(false); setData(null); }}><LockKeyhole className="size-4" />잠그기</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <FundSummary label="현재 잔액" value={`${won.format(data.currentBalance)}원`} icon={WalletCards} tone="indigo" />
        <FundSummary label={`${monthLabel} 입금`} value={`${won.format(data.monthlyIncome)}원`} icon={ArrowDownLeft} tone="green" />
        <FundSummary label={`${monthLabel} 지출`} value={`${won.format(data.monthlyExpense)}원`} icon={ArrowUpRight} tone="orange" />
      </div>

      <Card className="rounded-2xl border-border/80 py-0"><CardContent className="flex flex-wrap items-center gap-2 p-4">
        <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="전체 기간" /></SelectTrigger><SelectContent><SelectItem value="all">전체 기간</SelectItem>{periods.map((item) => <SelectItem key={item} value={item}>{item.replace("-", "년 ")}월</SelectItem>)}</SelectContent></Select>
        <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="전체 구분" /></SelectTrigger><SelectContent><SelectItem value="all">전체 구분</SelectItem>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        {(period !== "all" || category !== "all") && <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={() => { setPeriod("all"); setCategory("all"); }}>필터 초기화</Button>}
        <p className="w-full text-sm text-muted-foreground sm:ml-auto sm:w-auto">{filtered.length}건 · 입금 <b className="text-emerald-700 dark:text-emerald-300">{won.format(filteredTotals.income)}</b> · 지출 <b className="text-orange-700 dark:text-orange-300">{won.format(filteredTotals.expense)}</b></p>
      </CardContent></Card>

      {!data.transactions.length ? (
        <Card className="rounded-2xl border-dashed py-0"><CardContent className="p-8 text-center"><WalletCards className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-semibold">아직 기금 내역이 없어요</p><p className="mt-2 text-sm leading-6 text-muted-foreground">① <b>양식 다운로드</b> → ② 엑셀에 적기 → ③ <b>양식 업로드</b> 순서로 한 번에 넣거나,<br className="hidden sm:inline" /> <b>+ 추가</b>로 한 건씩 넣을 수 있어요. 처음엔 통장 잔액을 '이월(시작 잔액)'로 넣어 주세요.</p></CardContent></Card>
      ) : <>
        {/* 휴대폰: 카드 목록 */}
        <div className="space-y-2 md:hidden">
          {filtered.map((item) => <button key={item.id} type="button" onClick={() => openEdit(item)} className="flex w-full items-start gap-3 rounded-2xl border border-border/80 bg-card p-3.5 text-left active:bg-muted/40">
            <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${item.income ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"}`}>{item.income ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2"><span className="font-semibold leading-6">{item.description}</span><span className={`shrink-0 font-semibold ${item.income ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300"}`}>{item.income ? `+${won.format(item.income)}` : `-${won.format(item.expense)}`}</span></span>
              <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span className="truncate">{item.transactionDate.replaceAll("-", ".")} · {item.category}{item.memo ? ` · ${item.memo}` : ""}{item.receiptKey ? " · 📎" : ""}</span><span className="shrink-0">잔액 {won.format(item.balance)}</span></span>
            </span>
          </button>)}
        </div>
        {/* 넓은 화면: 표 */}
        <Card className="hidden overflow-hidden rounded-2xl border-border/80 py-0 md:block"><Table><TableHeader><TableRow className="bg-muted/55"><TableHead>날짜</TableHead><TableHead>구분</TableHead><TableHead>내용</TableHead><TableHead className="text-right">입금</TableHead><TableHead className="text-right">지출</TableHead><TableHead className="text-right">잔액</TableHead><TableHead className="text-center">증빙</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{filtered.map((item) => <TableRow key={item.id} className="cursor-pointer" onClick={() => openEdit(item)}><TableCell className="whitespace-nowrap">{item.transactionDate.replaceAll("-", ".")}</TableCell><TableCell><Badge variant="outline" className="rounded-full">{item.category}</Badge></TableCell><TableCell className="min-w-56 whitespace-normal"><span className="font-medium">{item.description}</span>{item.memo && <span className="block text-xs text-muted-foreground">{item.memo}</span>}</TableCell><TableCell className="text-right text-emerald-700 dark:text-emerald-300">{item.income ? `+${won.format(item.income)}` : "—"}</TableCell><TableCell className="text-right text-orange-700 dark:text-orange-300">{item.expense ? `-${won.format(item.expense)}` : "—"}</TableCell><TableCell className="text-right font-semibold">{won.format(item.balance)}</TableCell><TableCell className="text-center" onClick={(e) => e.stopPropagation()}>{item.receiptUrl ? <Button size="icon-sm" variant="ghost" asChild><a href={item.receiptUrl} target="_blank" rel="noreferrer" aria-label="증빙 열기"><FileCheck2 className="size-4" /></a></Button> : <span className="text-muted-foreground">—</span>}</TableCell><TableCell><Pencil className="size-4 text-muted-foreground" aria-label="수정" /></TableCell></TableRow>)}</TableBody></Table></Card>
        {!filtered.length && <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed text-muted-foreground">조건에 맞는 내역이 없습니다.</div>}
      </>}

      <EditDialog draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); setReload((v) => v + 1); }} />
      <ImportDialog data={importing} busy={busy} onClose={() => !busy.startsWith("import") && setImporting(null)} onConfirm={confirmImport} />
    </div>
  );
}

function EditDialog({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Draft | null>(draft);
  const [saving, setSaving] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const receiptRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setForm(draft); setConfirmDelete(false); }, [draft]);
  if (!form) return <Dialog open={false} />;
  const set = (patch: Partial<Draft>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const kind = form.kind;
  const amount = kind === "in" ? form.income : form.expense;
  const setKind = (k: "in" | "out") => set(k === "in" ? { kind: k, income: amount, expense: "" } : { kind: k, expense: amount, income: "" });
  const setAmount = (v: string) => set(kind === "in" ? { income: digits(v), expense: "" } : { expense: digits(v), income: "" });
  const cats = Array.from(new Set([...FUND_CATEGORIES, form.category].filter(Boolean)));

  async function save() {
    if (!form) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.transactionDate)) { toast.error("날짜를 확인해 주세요."); return; }
    if (!Number(digits(amount))) { toast.error("금액을 적어 주세요."); return; }
    setSaving("save");
    try {
      await fundApi.save({ id: form.id, transactionDate: form.transactionDate, category: form.category, description: form.description.trim() || form.category, memo: form.memo.trim(), income: Number(digits(form.income)) || 0, expense: Number(digits(form.expense)) || 0, receiptKey: form.receiptKey });
      toast.success(form.id ? "고쳤어요." : "추가했어요.");
      onSaved();
    } catch { toast.error("저장하지 못했어요."); } finally { setSaving(""); }
  }
  async function remove() {
    if (!form?.id) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving("delete");
    try { await fundApi.remove(form.id); toast.success("삭제했어요."); onSaved(); } catch { toast.error("삭제하지 못했어요."); } finally { setSaving(""); }
  }
  async function attach(file: File | undefined) {
    if (receiptRef.current) receiptRef.current.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("20MB 이하 파일만 올릴 수 있어요."); return; }
    setSaving("receipt");
    try { const key = await fundApi.uploadReceipt(file); set({ receiptKey: key, receiptUrl: URL.createObjectURL(file) }); toast.success("영수증을 붙였어요. 저장을 눌러야 반영돼요."); }
    catch { toast.error("영수증을 올리지 못했어요."); } finally { setSaving(""); }
  }

  return <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto rounded-2xl">
      <DialogHeader className="text-left"><DialogTitle>{form.id ? "기금 내역 고치기" : "기금 내역 추가"}</DialogTitle><DialogDescription>잔액은 저장하면 자동으로 다시 계산돼요.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          {(["in", "out"] as const).map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`h-10 rounded-lg text-sm font-semibold transition ${kind === k ? (k === "in" ? "bg-emerald-600 text-white" : "bg-orange-600 text-white") : "text-muted-foreground"}`}>{k === "in" ? "입금" : "지출"}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor="fund-date">날짜</Label><Input id="fund-date" type="date" value={form.transactionDate} onChange={(e) => set({ transactionDate: e.target.value })} className="h-11 rounded-xl" /></div>
          <div className="space-y-2"><Label htmlFor="fund-amount">금액 (원)</Label><Input id="fund-amount" inputMode="numeric" value={money(amount)} onChange={(e) => setAmount(e.target.value)} placeholder="48,000" className="h-11 rounded-xl text-right font-semibold" /></div>
        </div>
        <div className="space-y-2"><Label>구분</Label><div className="flex flex-wrap gap-1.5">{cats.map((c) => <button key={c} type="button" onClick={() => set({ category: c })} className={`rounded-full border px-3 py-1.5 text-sm ${form.category === c ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{c}</button>)}</div></div>
        <div className="space-y-2"><Label htmlFor="fund-desc">내용</Label><Input id="fund-desc" value={form.description} maxLength={200} onChange={(e) => set({ description: e.target.value })} placeholder="예) 폼보드 20장" className="h-11 rounded-xl" /></div>
        <div className="space-y-2"><Label htmlFor="fund-memo">메모 <span className="font-normal text-muted-foreground">(선택)</span></Label><Input id="fund-memo" value={form.memo} maxLength={300} onChange={(e) => set({ memo: e.target.value })} placeholder="예) 다이소 / 카드 결제" className="h-11 rounded-xl" /></div>
        <div className="space-y-2"><Label>영수증 <span className="font-normal text-muted-foreground">(선택)</span></Label>
          {form.receiptKey ? <div className="flex items-center gap-2 rounded-xl border p-2.5 text-sm"><FileCheck2 className="size-4 text-emerald-600" />{form.receiptUrl ? <a href={form.receiptUrl} target="_blank" rel="noreferrer" className="flex-1 underline underline-offset-2">영수증 보기</a> : <span className="flex-1">영수증 있음</span>}<Button type="button" size="icon-sm" variant="ghost" aria-label="영수증 빼기" onClick={() => set({ receiptKey: null, receiptUrl: null })}><X className="size-4" /></Button></div>
            : <Button type="button" variant="outline" className="h-11 w-full rounded-xl" disabled={!!saving} onClick={() => receiptRef.current?.click()}>{saving === "receipt" ? <LoaderCircle className="size-4 animate-spin" /> : <Paperclip className="size-4" />}영수증 사진·PDF 붙이기</Button>}
          <input ref={receiptRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
        </div>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
          {form.id ? <Button type="button" variant="ghost" className={`h-11 rounded-xl ${confirmDelete ? "bg-rose-600 text-white hover:bg-rose-700 hover:text-white" : "text-rose-600"}`} disabled={!!saving} onClick={remove}>{saving === "delete" ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{confirmDelete ? "한 번 더 누르면 삭제" : "삭제"}</Button> : <span />}
          <Button type="button" className="h-11 rounded-xl sm:min-w-28" disabled={!!saving} onClick={save}>{saving === "save" && <LoaderCircle className="size-4 animate-spin" />}{form.id ? "고친 내용 저장" : "추가하기"}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

function ImportDialog({ data, busy, onClose, onConfirm }: { data: { name: string; rows: ImportRow[] } | null; busy: string; onClose: () => void; onConfirm: () => void }) {
  if (!data) return <Dialog open={false} />;
  const fresh = data.rows.filter((r) => !r.error && !r.duplicate), dup = data.rows.filter((r) => r.duplicate), errors = data.rows.filter((r) => r.error);
  const progress = busy.startsWith("import:") ? busy.slice(7) : "";
  return <Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="flex max-h-[92dvh] max-w-2xl flex-col gap-4 rounded-2xl">
      <DialogHeader className="text-left"><DialogTitle>업로드 미리보기</DialogTitle><DialogDescription className="truncate">{data.name}</DialogDescription></DialogHeader>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40"><p className="text-xs text-emerald-700 dark:text-emerald-300">새로 등록</p><p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{fresh.length}건</p></div>
        <div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">이미 있음 · 건너뜀</p><p className="text-xl font-bold">{dup.length}건</p></div>
        <div className={`rounded-xl p-3 ${errors.length ? "bg-rose-50 dark:bg-rose-950/40" : "bg-muted"}`}><p className={`text-xs ${errors.length ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}>확인 필요 · 제외</p><p className={`text-xl font-bold ${errors.length ? "text-rose-700 dark:text-rose-300" : ""}`}>{errors.length}건</p></div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border">
        <ul className="divide-y text-sm">{data.rows.map((r) => <li key={r.line} className={`flex items-start gap-3 px-3 py-2.5 ${r.error ? "bg-rose-50/60 dark:bg-rose-950/20" : r.duplicate ? "opacity-50" : ""}`}>
          <span className="w-9 shrink-0 pt-0.5 text-xs text-muted-foreground">{r.line}행</span>
          <span className="min-w-0 flex-1"><span className="block font-medium">{r.description}</span><span className="block text-xs text-muted-foreground">{r.transactionDate} · {r.category}{r.memo ? ` · ${r.memo}` : ""}</span>{r.error && <span className="mt-0.5 block text-xs font-semibold text-rose-600">⚠ {r.error}</span>}{r.duplicate && <span className="mt-0.5 block text-xs">이미 등록된 내역</span>}</span>
          <span className={`shrink-0 font-semibold ${r.income ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300"}`}>{r.error ? "" : r.income ? `+${won.format(r.income)}` : `-${won.format(r.expense)}`}</span>
        </li>)}</ul>
      </div>
      {errors.length > 0 && <p className="text-xs leading-5 text-muted-foreground">빨간 줄은 빼고 등록돼요. 엑셀에서 고친 뒤 같은 파일을 다시 올리면 고친 줄만 새로 들어가요.</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="h-11 rounded-xl" disabled={!!progress || busy === "import"} onClick={onClose}>취소</Button>
        <Button className="h-11 rounded-xl" disabled={!fresh.length || busy.startsWith("import")} onClick={onConfirm}>{busy.startsWith("import") ? <><LoaderCircle className="size-4 animate-spin" />등록 중 {progress}</> : `${fresh.length}건 등록하기`}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function FundSummary({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof WalletCards; tone: "indigo" | "green" | "orange" }) {
  const tones = { indigo: "bg-primary/10 text-primary", green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" };
  return <Card className="rounded-2xl border-border/80 py-0"><CardContent className="flex items-center gap-4 p-4 md:p-5"><div className={`grid size-11 place-items-center rounded-2xl ${tones[tone]}`}><Icon className="size-5" /></div><div><p className="text-sm text-muted-foreground">{label}</p><strong className="mt-1 block text-xl md:text-2xl">{value}</strong></div></CardContent></Card>;
}
