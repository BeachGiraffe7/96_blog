import { useEffect, useRef, useState, useMemo } from "react";
import { getPdfjs } from "../../lib/importDocs";
import {
  sandboxHTML,
  inspectHTML,
  formatSize,
} from "../../lib/article/article";
import { downloadBlob } from "../../lib/article/zip";
const rawDownload = (a) =>
  downloadBlob(
    new Blob([a.bytes], { type: "application/octet-stream" }),
    a.name,
  );
export function PDFBlock({ asset, page: initial = 1, onPageChange }) {
  const box = useRef(),
    canvas = useRef(),
    renderRef = useRef(),
    [doc, setDoc] = useState(null),
    [page, setPage] = useState(initial),
    [width, setWidth] = useState(600),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    if (initial !== page) setPage(initial);
  }, [initial]);
  useEffect(() => {
    const observer = new ResizeObserver((es) =>
      setWidth(Math.max(180, es[0].contentRect.width)),
    );
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let stopped = false,
      task;
    const dispose = () => {
      try {
        task?.destroy()?.catch(() => {});
      } catch {}
    };
    setError("");
    setBusy(true);
    setDoc(null);
    getPdfjs()
      .then((lib) => {
        if (stopped) return;
        task = lib.getDocument({
          data: new Uint8Array(asset.bytes.slice(0)),
          isEvalSupported: false,
        });
        return task.promise;
      })
      .then((d) => {
        if (!d) return;
        if (stopped) dispose();
        else {
          setDoc(d);
          setPage((p) => Math.max(1, Math.min(p, d.numPages)));
        }
      })
      .catch((e) => {
        if (!stopped) {
          setError(
            /password/i.test(e.message)
              ? "该PDF已加密，请先解密后导入。"
              : "PDF预览未成功，可下载原文件查看。",
          );
          setBusy(false);
        }
      });
    return () => {
      stopped = true;
      renderRef.current?.cancel();
      dispose();
    };
  }, [asset.id]);
  useEffect(() => {
    if (!doc) return;
    let stop = false;
    setBusy(true);
    setError("");
    const run = async () => {
      try {
        const p = await doc.getPage(Math.min(page, doc.numPages));
        if (stop || !canvas.current) return;
        renderRef.current?.cancel();
        const base = p.getViewport({ scale: 1 }),
          v = p.getViewport({
            scale: Math.max(0.1, ((width - 2) * zoom) / base.width),
          }),
          dpr = Math.min(window.devicePixelRatio || 1, 2),
          c = canvas.current;
        c.width = Math.ceil(v.width * dpr);
        c.height = Math.ceil(v.height * dpr);
        c.style.width = `${v.width}px`;
        c.style.height = `${v.height}px`;
        const r = p.render({
          canvasContext: c.getContext("2d"),
          viewport: v,
          transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0],
        });
        renderRef.current = r;
        await r.promise;
        if (!stop) setBusy(false);
      } catch (e) {
        if (!stop && e.name !== "RenderingCancelledException") {
          setError("此页预览失败，请尝试其他页或下载原文件。");
          setBusy(false);
        }
      }
    };
    run();
    return () => {
      stop = true;
      renderRef.current?.cancel();
    };
  }, [doc, page, width, zoom]);
  const change = (n) => {
    const p = Math.min(doc?.numPages || 1, Math.max(1, n));
    setPage(p);
    onPageChange?.(p);
  };
  return (
    <div className="pdf-viewer" ref={box}>
      <div className="asset-top">
        <div>
          <strong>PDF 原版阅读</strong>
          <span>{formatSize(asset.size)} · 保留图表与排版</span>
        </div>
        <button onClick={() => rawDownload(asset)}>下载原文件</button>
      </div>
      <div className="pdf-controls">
        <button disabled={!doc || page <= 1} onClick={() => change(page - 1)}>
          上一页
        </button>
        <label>
          第{" "}
          <select
            aria-label="PDF页码"
            value={page}
            disabled={!doc}
            onChange={(e) => change(Number(e.target.value))}
          >
            {Array.from({ length: doc?.numPages || 1 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>{" "}
          / {doc?.numPages || "…"} 页
        </label>
        <button
          disabled={!doc || page >= doc.numPages}
          onClick={() => change(page + 1)}
        >
          下一页
        </button>
        <button
          disabled={!doc}
          onClick={() => setZoom((z) => (z === 1 ? 1.75 : 1))}
        >
          {zoom === 1 ? "放大阅读" : "适合宽度"}
        </button>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div
        className={`pdf-canvas-area ${zoom > 1 ? "zoomed" : ""}`}
        aria-busy={busy}
      >
        {busy && <span className="loading">正在渲染PDF…</span>}
        <canvas ref={canvas} aria-label={`PDF第${page}页`} />
      </div>
    </div>
  );
}
export function HTMLBlock({ asset, assets, urls, onNavigate }) {
  const [enabled, setEnabled] = useState(false),
    [height, setHeight] = useState(720),
    frame = useRef();
  const info = useMemo(() => inspectHTML(asset, assets), [asset, assets]);
  const content = useMemo(
    () => (enabled ? sandboxHTML(asset, assets, urls) : ""),
    [enabled, asset, assets, urls],
  );
  useEffect(() => {
    const receive = (e) => {
      if (
        e.source !== frame.current?.contentWindow ||
        e.data?.channel !== "article-module-v1"
      )
        return;
      if (e.data.type === "resize" && Number.isFinite(e.data.height))
        setHeight(Math.max(360, Math.min(1800, e.data.height)));
      if (e.data.type === "asset" && assets[e.data.id])
        onNavigate?.(
          e.data.id,
          Math.max(1, Math.min(10000, Number(e.data.page) || 1)),
        );
    };
    addEventListener("message", receive);
    return () => removeEventListener("message", receive);
  }, [assets, onNavigate]);
  return (
    <div className="html-module">
      <div className="asset-top">
        <div>
          <strong>交互 HTML 模块</strong>
          <span>{asset.name} · 隔离运行，不访问文章页面数据</span>
        </div>
        <button onClick={() => rawDownload(asset)}>下载原网页</button>
      </div>
      {info.unresolved.length > 0 && (
        <p className="module-warning">
          未关联的本地文件：{info.unresolved.join("、")}
          。可在附件信息中填写“网页引用别名”。
        </p>
      )}
      {info.remote.length > 0 && (
        <p className="module-warning">
          检测到{info.remote.length}
          个外部链接/资源。模块阻止外部资源加载和网络请求，依赖CDN的功能可能不可用。
        </p>
      )}
      {enabled ? (
        <>
          <div className="module-controls">
            <span>交互已启用 · 本地存储可能受隔离限制，建议导出记录</span>
            <button onClick={() => setEnabled(false)}>暂停交互</button>
          </div>
          <iframe
            ref={frame}
            title={asset.name}
            srcDoc={content}
            sandbox="allow-scripts allow-downloads"
            referrerPolicy="no-referrer"
            style={{ height }}
          />
        </>
      ) : (
        <div className="module-start">
          <span className="module-symbol">↔</span>
          <h3>把实验留在文章里</h3>
          <p>
            保留按钮、输入和计算。点击后才运行网页脚本；无同源权限；阻止网络请求、外部资源加载和弹窗。
          </p>
          <button className="primary" onClick={() => setEnabled(true)}>
            启用交互
          </button>
        </div>
      )}
    </div>
  );
}
