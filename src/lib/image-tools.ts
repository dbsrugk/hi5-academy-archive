/* 사진 확대·다운로드 도구 (사이트 전체에 한 번만 설치)
   - 전체화면 보기와 상세 팝업의 큰 사진: 마우스 휠로 확대·축소(마우스 위치 기준), 확대 상태에서 끌어서 이동, 더블클릭으로 원래 크기
   - 모든 사진: 오른쪽 클릭 → "이미지 다운로드" 메뉴 */

const LOGO = "hi5-logo";

/** 사진 파일 내려받기. Supabase 서명 URL은 download 파라미터로, 사이트 내부 파일은 a[download]로 받는다. */
export function downloadImage(src: string, name?: string) {
  const fileName = safeName(name, src);
  const a = document.createElement("a");
  if (/\/storage\/v1\/object\/sign\//.test(src)) {
    a.href = `${src}${src.includes("?") ? "&" : "?"}download=${encodeURIComponent(fileName)}`;
  } else {
    a.href = src;
    a.download = fileName;
  }
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function safeName(name: string | undefined, src: string) {
  const fromSrc = (() => {
    if (src.startsWith("data:") || src.startsWith("blob:")) return "";
    try { return decodeURIComponent(new URL(src, location.href).pathname.split("/").pop() ?? ""); } catch { return ""; }
  })();
  const ext = /\.[a-z0-9]{2,5}$/i.exec(fromSrc)?.[0] ?? (src.startsWith("data:image/") ? `.${src.slice(11, src.indexOf(";")).replace("jpeg", "jpg").replace("svg+xml", "svg")}` : "");
  let base = (name ?? "").replace(/[\\/:*?"<>|]/g, "").trim();
  if (!base || base === "전체화면") base = fromSrc.replace(/\.[a-z0-9]{2,5}$/i, "") || "image";
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}${ext}`;
}

type ZoomState = { s: number; x: number; y: number; k: string };

export function installImageTools() {
  if (typeof window === "undefined" || (window as { __imageTools?: boolean }).__imageTools) return;
  (window as { __imageTools?: boolean }).__imageTools = true;

  const states = new WeakMap<HTMLImageElement, ZoomState>();
  const imgOf = (target: EventTarget | null) => (target as HTMLElement | null)?.closest?.("img") ?? null;
  // 확대 대상: 전체화면 보기 / 상세 팝업의 큰 사진(누르면 전체화면이 열리는 버튼 안) / 제작 요청 레퍼런스 보기
  const zoomable = (img: HTMLImageElement) => {
    const dialog = img.closest('[data-slot="dialog-content"]');
    if (!dialog) return false;
    return dialog.className.includes("h-[100dvh]") || !!img.closest('button[aria-label*="전체화면으로 보기"]') || !!img.closest("button.aspect-\\[16\\/8\\]") || !!img.closest("[data-zoomable]");
  };
  const apply = (img: HTMLImageElement, q: ZoomState) => {
    img.style.transformOrigin = "0 0";
    img.style.transform = q.s === 1 ? "" : `translate(${q.x}px, ${q.y}px) scale(${q.s})`;
    img.style.cursor = q.s > 1 ? "grab" : "";
    if (img.parentElement) img.parentElement.style.overflow = "hidden";
  };
  const stateOf = (img: HTMLImageElement) => {
    const k = img.currentSrc || img.src;
    let q = states.get(img);
    if (!q || q.k !== k) { q = { s: 1, x: 0, y: 0, k }; states.set(img, q); apply(img, q); }
    return q;
  };

  document.addEventListener("wheel", (event) => {
    const img = imgOf(event.target);
    if (!img || !zoomable(img)) return;
    event.preventDefault();
    const q = stateOf(img);
    const box = img.parentElement!.getBoundingClientRect();
    const px = event.clientX - (box.left + img.offsetLeft);
    const py = event.clientY - (box.top + img.offsetTop);
    const next = Math.min(8, Math.max(1, q.s * (event.deltaY < 0 ? 1.2 : 1 / 1.2)));
    const ratio = next / q.s;
    q.x = px - (px - q.x) * ratio;
    q.y = py - (py - q.y) * ratio;
    q.s = next;
    if (next <= 1.001) { q.s = 1; q.x = 0; q.y = 0; }
    apply(img, q);
  }, { passive: false, capture: true });

  let drag: { img: HTMLImageElement; q: ZoomState; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
  let swallowClick = false;
  document.addEventListener("pointerdown", (event) => {
    const img = imgOf(event.target);
    if (!img || event.button !== 0 || event.pointerType !== "mouse" || !zoomable(img)) return;
    const q = stateOf(img);
    if (q.s <= 1) return;
    event.preventDefault();
    drag = { img, q, sx: event.clientX, sy: event.clientY, ox: q.x, oy: q.y, moved: false };
    img.style.cursor = "grabbing";
  }, true);
  window.addEventListener("pointermove", (event) => {
    if (!drag) return;
    if (Math.abs(event.clientX - drag.sx) + Math.abs(event.clientY - drag.sy) > 4) drag.moved = true;
    drag.q.x = drag.ox + event.clientX - drag.sx;
    drag.q.y = drag.oy + event.clientY - drag.sy;
    apply(drag.img, drag.q);
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.moved) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 0); }
    apply(drag.img, drag.q);
    drag = null;
  });
  // 끌어서 옮긴 뒤 손을 뗄 때 전체화면이 열리지 않게
  document.addEventListener("click", (event) => { if (swallowClick) { event.preventDefault(); event.stopPropagation(); swallowClick = false; } }, true);
  document.addEventListener("dblclick", (event) => {
    const img = imgOf(event.target);
    if (!img || !zoomable(img)) return;
    const q = stateOf(img);
    q.s = 1; q.x = 0; q.y = 0;
    apply(img, q);
  }, true);

  // 오른쪽 클릭 메뉴
  let menu: HTMLDivElement | null = null;
  const closeMenu = () => { menu?.remove(); menu = null; };
  document.addEventListener("contextmenu", (event) => {
    closeMenu();
    const img = imgOf(event.target);
    if (!img || !img.src || img.src.includes(LOGO)) return;
    event.preventDefault();
    const src = img.currentSrc || img.src;
    const name = img.dataset.downloadName || img.alt;
    const host = img.closest<HTMLElement>('[data-slot="dialog-content"]');
    const el = document.createElement("div");
    el.setAttribute("data-image-menu", "");
    let x = event.clientX, y = event.clientY, position = "fixed";
    if (host) { // 팝업 안에서는 팝업 기준 위치 (팝업 밖을 누른 것으로 처리돼 팝업이 닫히지 않게)
      const box = host.getBoundingClientRect();
      x = event.clientX - box.left + host.scrollLeft; y = event.clientY - box.top + host.scrollTop; position = "absolute";
    }
    el.style.cssText = `position:${position};left:${x}px;top:${y}px;z-index:2147483647;background:#fff;color:#141413;border:1px solid rgba(0,0,0,.12);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:4px;min-width:160px;font-size:14px;pointer-events:auto`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "⤓  이미지 다운로드";
    button.style.cssText = "display:block;width:100%;text-align:left;padding:8px 10px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;cursor:pointer";
    button.onmouseenter = () => { button.style.background = "rgba(0,0,0,.06)"; };
    button.onmouseleave = () => { button.style.background = "none"; };
    button.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeMenu(); downloadImage(src, name); };
    el.appendChild(button);
    (host ?? document.body).appendChild(el);
    menu = el;
  });
  const outside = (event: Event) => { if (menu && !(event.target as HTMLElement | null)?.closest?.("[data-image-menu]")) closeMenu(); };
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("wheel", outside, true);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && menu) { event.stopImmediatePropagation(); closeMenu(); } }, true);
}
