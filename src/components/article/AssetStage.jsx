import { useLayoutEffect, useRef } from "react";

let scrollLocks = 0;
let previousOverflow = "";
function lockPageScroll() {
  if (scrollLocks++ === 0) {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }
  return () => {
    if (--scrollLocks === 0)
      document.documentElement.style.overflow = previousOverflow;
  };
}

/** One persistent DOM tree: expanding must not reload an HTML experiment. */
export default function AssetStage({
  kind,
  name,
  expanded,
  onClose,
  onDownload,
  returnFocus,
  children,
}) {
  const stage = useRef(null);
  useLayoutEffect(() => {
    if (!expanded) return;
    const el = stage.current;
    const opener = returnFocus?.current || document.activeElement;
    // Inline is a non-modal open dialog. Promote the SAME element to the top layer.
    el.close();
    el.showModal();
    const unlock = lockPageScroll();
    return () => {
      el.close();
      el.setAttribute("open", "");
      unlock();
      // Wait until React reveals the inline trigger again before restoring focus.
      queueMicrotask(() => {
        if (opener?.isConnected && !document.querySelector("dialog:modal"))
          opener.focus({ preventScroll: true });
      });
    };
  }, [expanded, returnFocus]);
  return (
    <dialog
      ref={stage}
      open
      className={`asset-stage${expanded ? " is-expanded" : ""}`}
      role={expanded ? "dialog" : "group"}
      aria-modal={expanded || undefined}
      aria-label={`${kind}大窗口：${name}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (!expanded || e.target !== stage.current) return;
        const r = stage.current.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          onClose();
      }}
    >
      <div className="asset-stage-heading" hidden={!expanded}>
        <div>
          <strong>
            {kind === "PDF" ? "PDF 大窗口阅读" : "HTML 交互大窗口"}
          </strong>
          <span title={name}>{name}</span>
        </div>
        <div className="asset-stage-actions">
          <button
            type="button"
            onClick={onDownload}
            aria-label={kind === "PDF" ? "下载原文件" : "下载原网页"}
          >
            下载
          </button>
          <button type="button" onClick={onClose} aria-label="关闭大窗口">
            关闭窗口 ×
          </button>
        </div>
      </div>
      <div className="asset-stage-content">{children}</div>
    </dialog>
  );
}
