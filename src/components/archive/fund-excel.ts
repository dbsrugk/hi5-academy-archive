// 제작실 기금 엑셀 양식 만들기·읽기 (exceljs는 필요할 때만 불러온다)
export const FUND_CATEGORIES = ["이월(시작 잔액)", "회비 입금", "재료비", "장비", "인쇄", "기타"];
const HEADERS = ["날짜", "구분", "내용", "입금", "지출", "메모"] as const;

export type ParsedFundRow = { line: number; transactionDate: string; category: string; description: string; income: number; expense: number; memo: string; error?: string };

async function loadExcel() { return (await import("exceljs")).default; }

export async function downloadFundTemplate() {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "하이파이브 아카이브";
  const ws = wb.addWorksheet("기금 내역", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "날짜", key: "date", width: 14, style: { numFmt: "yyyy-mm-dd" } },
    { header: "구분", key: "cat", width: 16 },
    { header: "내용", key: "desc", width: 36 },
    { header: "입금", key: "in", width: 13, style: { numFmt: "#,##0" } },
    { header: "지출", key: "out", width: 13, style: { numFmt: "#,##0" } },
    { header: "메모", key: "memo", width: 24 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.alignment = { vertical: "middle", horizontal: "center" };
  head.height = 22;
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }; });
  for (let r = 2; r <= 501; r++) {
    ws.getCell(`B${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${FUND_CATEGORIES.join(",")}"`], showErrorMessage: false };
    ws.getCell(`A${r}`).dataValidation = { type: "date", operator: "greaterThan", allowBlank: true, formulae: [new Date(2020, 0, 1)], showErrorMessage: true, errorTitle: "날짜", error: "2026-10-06 처럼 날짜로 입력해 주세요." };
  }

  const guide = wb.addWorksheet("작성 안내");
  guide.columns = [{ width: 14 }, { width: 16 }, { width: 36 }, { width: 13 }, { width: 13 }, { width: 24 }];
  const lines = [
    ["📒 제작실 기금 업로드 양식 — 작성 안내"],
    [],
    ["1. '기금 내역' 시트에 한 줄에 거래 하나씩 적어 주세요. (이 안내 시트는 업로드되지 않아요)"],
    ["2. 날짜는 2026-10-06 처럼, 금액은 숫자만 (쉼표·원 없이도 OK)"],
    ["3. 입금이면 '입금' 칸에, 쓴 돈이면 '지출' 칸에 적어요. 잔액은 사이트가 자동 계산해요."],
    ["4. 처음 시작할 때 통장에 있던 돈은 구분 '이월(시작 잔액)'로 입금 칸에 한 줄 넣어 주세요."],
    ["5. 같은 파일을 다시 올려도 이미 들어간 줄은 건너뛰어요. 잘못 넣은 건 사이트에서 고치거나 지울 수 있어요."],
    [],
    ["예시", "", "", "", "", ""],
    ["날짜", "구분", "내용", "입금", "지출", "메모"],
    ["2026-10-01", "이월(시작 잔액)", "10월 시작 잔액", 1200000, "", ""],
    ["2026-10-02", "회비 입금", "명지 10월 제작비", 300000, "", ""],
    ["2026-10-06", "재료비", "폼보드 20장", "", 48000, "다이소"],
  ];
  lines.forEach((l) => guide.addRow(l));
  guide.getRow(1).font = { bold: true, size: 14 };
  guide.getRow(9).font = { bold: true };
  guide.getRow(10).font = { bold: true, color: { argb: "FFFFFFFF" } };
  guide.getRow(10).eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF64748B" } }; });
  [11, 12, 13].forEach((r) => { guide.getRow(r).font = { color: { argb: "FF64748B" } }; guide.getCell(`D${r}`).numFmt = "#,##0"; guide.getCell(`E${r}`).numFmt = "#,##0"; });

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = "제작실기금_업로드양식.xlsx"; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------- 읽기 ----------
const pad = (n: number) => String(n).padStart(2, "0");
function toDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400_000)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  const s = String(v).trim().replace(/\s+/g, "");
  let m = s.match(/^(\d{4})[.\-/년](\d{1,2})[.\-/월](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) return valid(2000 + +m[1], +m[2], +m[3]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  return null;
}
function valid(y: number, mo: number, d: number) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null;
}
function toMoney(v: unknown): number | null {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(Math.abs(v)) : null;
  const s = String(v).replace(/[,\s원₩]/g, "").replace(/^-/, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function cellValue(v: unknown): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.result !== undefined) return o.result;
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return o.text;
  }
  return v;
}
function parseCsv(text: string): unknown[][] {
  const rows: unknown[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export async function parseFundFile(file: File): Promise<ParsedFundRow[]> {
  let grid: unknown[][] = [];
  if (/\.csv$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("euc-kr").decode(buf); // 엑셀에서 저장한 한글 CSV
    grid = parseCsv(text.replace(/^﻿/, ""));
  } else {
    const ExcelJS = await loadExcel();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.getWorksheet("기금 내역") ?? wb.worksheets.find((w) => w.name !== "작성 안내") ?? wb.worksheets[0];
    if (!ws) throw new Error("엑셀 안에 시트가 없어요.");
    ws.eachRow({ includeEmpty: true }, (row, n) => { grid[n - 1] = (row.values as unknown[]).slice(1).map(cellValue); });
  }
  const headIndex = grid.findIndex((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() === "날짜"));
  if (headIndex < 0) throw new Error("'날짜' 칸이 있는 제목 줄을 찾지 못했어요. 사이트에서 받은 양식을 써 주세요.");
  const head = grid[headIndex].map((c) => String(c ?? "").replace(/\s/g, ""));
  const col = Object.fromEntries(HEADERS.map((h) => [h, head.indexOf(h)])) as Record<(typeof HEADERS)[number], number>;
  if (col.입금 < 0 || col.지출 < 0) throw new Error("'입금'·'지출' 칸을 찾지 못했어요. 양식의 제목 줄은 그대로 두세요.");
  const out: ParsedFundRow[] = [];
  for (let i = headIndex + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    const get = (k: (typeof HEADERS)[number]) => (col[k] >= 0 ? r[col[k]] : "");
    const raw = HEADERS.map((h) => String(get(h) ?? "").trim());
    if (raw.every((x) => !x)) continue;
    const date = toDate(get("날짜")), income = toMoney(get("입금")), expense = toMoney(get("지출"));
    const category = String(get("구분") ?? "").trim() || "기타";
    const description = String(get("내용") ?? "").trim() || category;
    let error: string | undefined;
    if (!date) error = "날짜 형식을 확인해 주세요";
    else if (income === null || expense === null) error = "금액은 숫자로 적어 주세요";
    else if (!income && !expense) error = "입금이나 지출 중 하나는 적어 주세요";
    out.push({ line: i + 1, transactionDate: date ?? raw[0], category, description, income: income ?? 0, expense: expense ?? 0, memo: String(get("메모") ?? "").trim(), error });
  }
  return out;
}
