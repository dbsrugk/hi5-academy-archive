/* 캠퍼스별 고정 색 — 모든 화면에서 같은 캠퍼스는 같은 색 */
const fixed: Array<[string, string]> = [
  ["센텀", "#2F6FDB"],
  ["김해", "#1E9468"],
  ["명지", "#E07B16"],
  ["본사", "#7A736B"],
  ["공통", "#7A736B"],
];
const extra = ["#8A5CD1", "#C2457A", "#2B9AA8", "#A0782A", "#5B7A2E", "#B5562F"];

export function campusColor(branch?: string | null) {
  const name = branch ?? "";
  const hit = fixed.find(([key]) => name.includes(key));
  if (hit) return hit[1];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return extra[hash % extra.length];
}

export function campusShort(branch?: string | null) {
  return (branch ?? "").replace(/캠퍼스$/, "").replace(/\s*공통$/, "") || "미지정";
}

export function CampusDot({ branch, className = "" }: { branch?: string | null; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${className}`} style={{ background: campusColor(branch) }} />;
}

export function CampusLabel({ branch, text }: { branch?: string | null; text?: string }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CampusDot branch={branch} />{text ?? campusShort(branch)}</span>;
}
