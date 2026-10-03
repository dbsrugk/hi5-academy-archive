import { useEffect, useRef } from "react";

/* 팝업이 열리면 브라우저 기록을 하나 쌓아서, 뒤로가기(휴대폰 뒤로 버튼 포함)로 팝업이 닫히게 한다.
   화면의 X·취소 버튼으로 닫으면 쌓아둔 기록을 함께 정리한다. */
export function useBackClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  const idRef = useRef(`dlg-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const id = idRef.current;
    window.history.pushState({ ...(window.history.state ?? {}), __dlg: id }, "");
    let closedByBack = false;
    const onPop = () => {
      if (window.history.state?.__dlg !== id) { closedByBack = true; closeRef.current(); }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closedByBack && window.history.state?.__dlg === id) window.history.back();
    };
  }, [open]);
}
