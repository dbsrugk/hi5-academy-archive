import { Fragment, type ReactNode } from "react";
import { ArrowRight, ListChecks, MessageSquareQuote } from "lucide-react";

// 회의록 본문을 가볍게 꾸며 보여주는 렌더러
//  ■ 제목 / 1. 제목  → 색 띠가 있는 파트 블록
//  [소제목]          → 소제목 배지
//  • 내용            → 글머리표 (앞쪽 "라벨:"은 자동 굵게)
//  이사님 의견: …     → 강조 박스
//  **굵게**, →       → 굵은 글씨, 색 화살표

type Tone = { bar: string; soft: string; text: string; chip: string; dot: string };
const TONES: Record<string, Tone> = {
  design: { dot: "bg-sky-500", bar: "border-sky-500", soft: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300", chip: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200" },
  anim: { dot: "bg-violet-500", bar: "border-violet-500", soft: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", chip: "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200" },
  kids: { dot: "bg-emerald-500", bar: "border-emerald-500", soft: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" },
  mkt: { dot: "bg-orange-500", bar: "border-orange-500", soft: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", chip: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200" },
  prog: { dot: "bg-teal-500", bar: "border-teal-500", soft: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", chip: "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200" },
  all: { dot: "bg-rose-500", bar: "border-rose-500", soft: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", chip: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200" },
  base: { dot: "bg-stone-400", bar: "border-stone-400", soft: "bg-stone-100 dark:bg-stone-800/50", text: "text-stone-700 dark:text-stone-200", chip: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100" },
};
const CYCLE = ["design", "anim", "kids", "mkt", "prog", "all"];
function toneOf(label: string, index = -1): Tone {
  if (/디자인/.test(label)) return TONES.design;
  if (/애니|칸만화|상황표현/.test(label)) return TONES.anim;
  if (/초중/.test(label)) return TONES.kids;
  if (/마케팅|행정|제작실|홈페이지|명지|센텀|김해|각 캠퍼스/.test(label)) return TONES.mkt;
  if (/프로그램|개발/.test(label)) return TONES.prog;
  if (/전 캠퍼스|원장단|전체/.test(label)) return TONES.all;
  return index >= 0 ? TONES[CYCLE[index % CYCLE.length]] : TONES.base;
}

// **굵게**, → 처리
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*|→)/g).forEach((part, i) => {
    if (!part) return;
    if (part === "→") out.push(<ArrowRight key={i} className="mx-0.5 inline size-4 -translate-y-px text-primary" aria-label="→" />);
    else if (part.startsWith("**") && part.endsWith("**")) out.push(<strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>);
    else out.push(<Fragment key={i}>{part}</Fragment>);
  });
  return out;
}
// 앞쪽 "라벨:" 굵게 (짧은 라벨만)
function labeled(text: string): ReactNode {
  const m = text.match(/^([^:：\n]{1,24}?)([:：])\s(.*)$/s);
  if (m && !/https?$/.test(m[1])) return <><strong className="font-semibold text-foreground">{inline(m[1])}</strong>{m[2]} {inline(m[3])}</>;
  return inline(text);
}

type Block = { title?: string; lines: string[] };
const isHeader = (l: string) => /^■\s*/.test(l) || /^\d+\.\s+\S/.test(l);

export function RichNote({ value }: { value: string }) {
  const blocks: Block[] = [];
  let cur: Block = { lines: [] };
  for (const raw of value.split("\n")) {
    const line = raw.trimEnd();
    if (isHeader(line.trim())) {
      if (cur.title || cur.lines.some(Boolean)) blocks.push(cur);
      cur = { title: line.trim().replace(/^■\s*/, ""), lines: [] };
    } else cur.lines.push(line);
  }
  if (cur.title || cur.lines.some(Boolean)) blocks.push(cur);

  return (
    <div className="space-y-5">
      {blocks.map((b, bi) => {
        const order = blocks.slice(0, bi).filter((x) => x.title).length;
        const tone = b.title ? toneOf(b.title, order) : TONES.base;
        const body = <Lines lines={b.lines} tone={tone} />;
        if (!b.title) return <div key={bi}>{body}</div>;
        return (
          <section key={bi} className={`rounded-2xl border-l-4 ${tone.bar} bg-[var(--archive-panel)]/60 py-4 pr-4 pl-4 sm:pl-5`}>
            <h4 className={`mb-3 text-[17px] font-bold leading-snug ${tone.text}`}>{inline(b.title)}</h4>
            {body}
          </section>
        );
      })}
    </div>
  );
}

function Lines({ lines, tone }: { lines: string[]; tone: Tone }) {
  const items: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = (k: string) => { if (list.length) { items.push(<ul key={k} className="space-y-2.5">{list}</ul>); list = []; } };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) { flush("u" + i); return; }
    const sub = line.match(/^\[(.+)\]$/);
    if (sub) {
      flush("u" + i);
      items.push(<div key={i} className="pt-1"><span className={`inline-block rounded-full px-3 py-1 text-[13px] font-semibold ${tone.chip}`}>{sub[1]}</span></div>);
      return;
    }
    const bullet = line.replace(/^[•·\-]\s*/, "");
    if (/^이사님\s*(의견|:)/.test(bullet) || /^이사님\s*의견/.test(bullet)) {
      list.push(
        <li key={i} className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[15px] text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
          <MessageSquareQuote className="mt-1 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{labeled(bullet)}</span>
        </li>,
      );
      return;
    }
    const numbered = line.match(/^([①-⑳])\s*(.*)$/);
    if (line !== bullet || numbered) {
      list.push(
        <li key={i} className="flex gap-2.5">
          <span className={`mt-[11px] size-1.5 shrink-0 rounded-full ${tone.dot}`} />
          <span>{labeled(bullet)}</span>
        </li>,
      );
      return;
    }
    flush("u" + i);
    if (line.startsWith("→")) items.push(<p key={i} className={`rounded-xl px-3 py-2 font-medium text-foreground ${tone.soft}`}>{inline(line)}</p>);
    else items.push(<p key={i}>{labeled(line)}</p>);
  });
  flush("end");
  return <div className="space-y-3 text-[15px] leading-7 sm:text-base">{items}</div>;
}

// 결정 사항·후속 업무: 앞의 [말머리] 또는 "파트:" 를 색 태그로
export function RichLines({ value, done }: { value: string; done?: boolean }) {
  const lines = value.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <ul className="space-y-2.5 text-[15px] leading-7 sm:text-base">
      {lines.map((line, i) => {
        const m = line.match(/^\[([^\]]{1,16})\]\s*(.*)$/) ?? line.match(/^(디자인|애니|초중등|마케팅|프로그램|행정)\s*[:：]\s*(.*)$/);
        const tag = m?.[1];
        const rest = m ? m[2] : line;
        const tone = toneOf(tag ?? "");
        return (
          <li key={i} className="flex items-start gap-2.5 rounded-xl bg-[var(--archive-panel)]/60 px-3 py-2.5">
            {tag
              ? <span className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[12px] font-bold leading-5 whitespace-nowrap ${tone.chip}`}>{tag}</span>
              : <ListChecks className={`mt-1 size-4 shrink-0 ${done ? "text-emerald-600" : "text-primary"}`} />}
            <span className="min-w-0">{inline(rest)}</span>
          </li>
        );
      })}
    </ul>
  );
}
