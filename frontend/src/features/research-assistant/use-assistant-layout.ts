import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Keep the composer and latest response inside the visible (keyboard-safe) viewport. */
export function useAssistantLayout(
  open: boolean,
  signedIn: boolean,
  question: string,
  hasMessages: boolean,
) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const conversationContent = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const savedScrollTop = useRef(0);

  useLayoutEffect(() => {
    if (!panel || !open || !signedIn) return;
    const textarea = composer.current;
    if (!textarea) return;
    const resize = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 24;
      // Reset first so deleting text also shrinks the composer. Do not size to the placeholder.
      textarea.style.height = `${lineHeight}px`;
      const contentHeight = textarea.value ? textarea.scrollHeight : lineHeight;
      const height = Math.min(Math.max(contentHeight, lineHeight), lineHeight * 4);
      textarea.style.height = `${height}px`;
      textarea.style.overflowY = contentHeight > height ? "auto" : "hidden";
      textarea.closest("form")?.setAttribute("data-expanded", String(height > lineHeight));
    };
    resize();
    let width = panel.clientWidth;
    const observer = new ResizeObserver(() => {
      if (panel.clientWidth !== width) {
        width = panel.clientWidth;
        resize();
      }
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [panel, open, signedIn, question]);

  useEffect(() => {
    if (!panel || !open) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport?.height ?? window.innerHeight;
        panel.style.setProperty("--ra-viewport-height", `${height}px`);
        panel.style.setProperty("--ra-viewport-offset", `${viewport?.offsetTop ?? 0}px`);
        panel.dataset["shortViewport"] = String(height < 500);
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [panel, open]);

  useEffect(() => {
    const area = scrollArea.current;
    const content = conversationContent.current;
    if (!panel || !open || !area || !content) return;
    area.scrollTop = hasMessages
      ? followLatest.current
        ? area.scrollHeight
        : savedScrollTop.current
      : 0;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (hasMessages && followLatest.current) area.scrollTop = area.scrollHeight;
      });
    });
    // Observe both: messages/review cards grow, while typing and keyboards shrink the viewport.
    observer.observe(area);
    observer.observe(content);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [panel, open, signedIn, hasMessages]);

  function onConversationScroll() {
    const area = scrollArea.current;
    if (!area) return;
    savedScrollTop.current = area.scrollTop;
    followLatest.current = area.scrollHeight - area.scrollTop - area.clientHeight < 64;
  }

  return {
    setPanel,
    composer,
    scrollArea,
    conversationContent,
    followLatest,
    onConversationScroll,
  };
}
