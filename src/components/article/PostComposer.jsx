import { useState, useEffect, useRef, useMemo } from "react";
import Markdown from "./Markdown";
import ArticleReader from "./ArticleReader";
import { PDFBlock, HTMLBlock } from "./AssetBlocks";
import {
  ACCEPT_ARTICLE,
  emptyArticle,
  uid,
  readAsset,
  formatSize,
  MAX_TOTAL_BYTES,
  validateArticle,
  inspectHTML,
  safeName,
} from "../../lib/article/article";
import { fileToMarkdown } from "../../lib/importDocs";
import { htmlToMarkdown, looksRich } from "../../lib/htmlToMarkdown";
import { loadDraft, saveDraft, clearDraft } from "../../lib/article/drafts";
import { downloadBlob, readArticleZIP } from "../../lib/article/zip";
const samplePDF = new URL("../../samples/05-clock-tree.pdf", import.meta.url)
  .href;
import sampleHTMLSource from "../../samples/04-clock-tree-workbench.html?raw";
const p2 = (n) => String(n).padStart(2, "0");
const autoSlug = () => {
  const d = new Date();
  return `post-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${d.getTime().toString(36).slice(-5)}`;
};
function Dialog({ title, children, onCancel, onConfirm, confirm = "确认" }) {
  const ref = useRef();
  useEffect(() => {
    ref.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Tab") {
        const es = [...ref.current.querySelectorAll("button")];
        if (e.shiftKey && document.activeElement === es[0]) {
          e.preventDefault();
          es.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === es.at(-1)) {
          e.preventDefault();
          es[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>{children}</p>
        <div className="dialog-actions">
          <button onClick={onCancel}>取消</button>
          <button className="primary" onClick={onConfirm}>
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
export default function PostComposer({
  onPublish,
  onPublished,
  publishTarget,
  categoryOptions = [],
  seriesOptions = [],
  draftKey = "current",
  loadPublished,
}) {
  const [doc, setDoc] = useState(emptyArticle),
    [assets, setAssets] = useState({}),
    [active, setActive] = useState(null),
    [view, setView] = useState("edit"),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("正在读取草稿…"),
    [ready, setReady] = useState(false),
    [dialog, setDialog] = useState(null),
    [extract, setExtract] = useState(false);
  const files = useRef(),
    folder = useRef(),
    textareas = useRef({}),
    lock = useRef(false),
    latest = useRef(),
    firstSave = useRef(true),
    didPublish = useRef(false),
    urlsRef = useRef({}),
    [urls, setUrls] = useState({});
  latest.current = { doc, assets, active, ready };
  useEffect(
    () => () => {
      const r = latest.current;
      if (r?.ready && !didPublish.current)
        saveDraft(r.doc, r.assets, draftKey).catch(() => {});
    },
    [draftKey],
  );
  const changeMeta = (key, value) =>
    setDoc((d) => ({
      ...d,
      meta: {
        ...d.meta,
        [key]: value,
        ...(key === "category" ? { series: "" } : {}),
      },
    }));
  useEffect(() => {
    let cancel = false;
    setReady(false);
    setError("");
    loadDraft(draftKey)
      .then(async (r) => {
        if (loadPublished && !r?.doc?.origin?.manifestSha) r = null;
        if (!r && loadPublished) {
          const loaded = await loadPublished();
          r = { ...loaded, savedAt: Date.now() };
        }
        if (cancel) return;
        if (r?.doc?.schemaVersion === 1) {
          setDoc(r.doc);
          setAssets(r.assets || {});
          setSaved(
            `已恢复草稿 · ${new Date(r.savedAt).toLocaleTimeString("zh-CN")}`,
          );
        } else setSaved("本机自动保存");
      })
      .catch(() => {
        if (!cancel) {
          setSaved("草稿或文章读取失败，请保留本机备份");
          setError(
            "未能读取草稿或已发布文章，请检查GitHub连接后刷新。不要用空白内容覆盖原文章。",
          );
        }
      })
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [draftKey, loadPublished]);
  useEffect(() => {
    const next = {};
    for (const a of Object.values(assets)) {
      next[a.id] =
        urlsRef.current[a.id] ||
        URL.createObjectURL(new Blob([a.bytes], { type: a.mime }));
    }
    for (const [id, u] of Object.entries(urlsRef.current))
      if (!next[id]) URL.revokeObjectURL(u);
    urlsRef.current = next;
    setUrls(next);
  }, [assets]);
  useEffect(
    () => () => {
      Object.values(urlsRef.current).forEach(URL.revokeObjectURL);
    },
    [],
  );
  useEffect(() => {
    if (!ready) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    setSaved("有更改 · 正在自动保存");
    const t = setTimeout(
      () =>
        !didPublish.current &&
        saveDraft(doc, assets, draftKey)
          .then(() =>
            setSaved(
              `已保存到本机 · ${new Date().toLocaleTimeString("zh-CN")}`,
            ),
          )
          .catch(() => setSaved("保存失败：可能超出存储额度，请立即导出")),
      1000,
    );
    return () => clearTimeout(t);
  }, [doc, assets, ready]);
  useEffect(() => {
    const dirty = saved.startsWith("有更改") || saved.startsWith("保存失败");
    const fn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    if (dirty) addEventListener("beforeunload", fn);
    return () => removeEventListener("beforeunload", fn);
  }, [saved]);
  const problems = useMemo(() => validateArticle(doc, assets), [doc, assets]);
  const htmlIssues = useMemo(
    () =>
      Object.values(assets)
        .filter((a) => a.type === "html")
        .map((a) => ({ asset: a, ...inspectHTML(a, assets) })),
    [assets],
  );
  const words = doc.blocks
    .filter((b) => b.type === "markdown")
    .reduce((n, b) => n + b.text.replace(/\s/g, "").length, 0);
  const patch = (id, changes) =>
    setDoc((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    }));
  const insertBlocks = (blocks, after = latest.current.active) =>
    setDoc((d) => {
      const i = d.blocks.findIndex((b) => b.id === after),
        list = [...d.blocks];
      list.splice(i >= 0 ? i + 1 : list.length, 0, ...blocks);
      return { ...d, blocks: list };
    });
  const addText = () => {
    const b = { id: uid(), type: "markdown", text: "" };
    insertBlocks([b]);
    setActive(b.id);
    requestAnimationFrame(() => textareas.current[b.id]?.focus());
  };
  const move = (id, dir) =>
    setDoc((d) => {
      const a = [...d.blocks],
        i = a.findIndex((b) => b.id === id),
        j = i + dir;
      if (j < 0 || j >= a.length) return d;
      [a[i], a[j]] = [a[j], a[i]];
      return { ...d, blocks: a };
    });
  const remove = (id) => {
    const b = doc.blocks.find((b) => b.id === id);
    const done = () => {
      setDoc((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
      setDialog(null);
    };
    if (b.type === "markdown" && !b.text.trim()) done();
    else
      setDialog({
        title: "移除这个内容块？",
        text: "只移除正文中的展示，原附件仍保留在附件区。此操作会自动保存到本机草稿。",
        action: done,
      });
  };
  async function runImport(list) {
    if (!list.length || lock.current) return;
    lock.current = true;
    setError("");
    setNotice("");
    const after = latest.current.active,
      newAssets = {},
      blocks = [],
      errors = [],
      warnings = [];
    let total = Object.values(latest.current.assets).reduce(
      (n, a) => n + a.size,
      0,
    );
    try {
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        setBusy(`导入 ${i + 1}/${list.length} · ${f.name}`);
        try {
          if (/\.(pdf|html?|png|jpe?g|webp|gif)$/i.test(f.name) && !extract) {
            if (total + f.size > MAX_TOTAL_BYTES)
              throw Error("文章附件总量超过80MB，请减少大文件。");
            const a = await readAsset(f);
            newAssets[a.id] = a;
            total += a.size;
            blocks.push({
              id: uid(),
              type: a.type,
              assetId: a.id,
              title: a.name,
              ...(a.type === "pdf" ? { page: 1 } : {}),
              ...(a.type === "image" ? { alt: "" } : {}),
            });
          } else {
            const r = await fileToMarkdown(f);
            if (r.markdown.trim())
              blocks.push({ id: uid(), type: "markdown", text: r.markdown });
            warnings.push(...r.warnings.map((w) => `${f.name}：${w}`));
          }
        } catch (e) {
          errors.push(`${f.name}：${e.message}`);
        }
      }
      setAssets((a) => ({ ...a, ...newAssets }));
      if (blocks.length) {
        insertBlocks(blocks, after);
        setActive(blocks.at(-1).id);
      }
      setNotice(
        blocks.length
          ? `${blocks.length}个内容块已插入${warnings.length ? "。" + warnings.join("；") : ""}`
          : "",
      );
      if (errors.length) setError(errors.join("；"));
    } finally {
      setBusy("");
      lock.current = false;
    }
  }
  const loadDemo = async () => {
    setDialog(null);
    if (lock.current) return;
    lock.current = true;
    setBusy("载入你的时钟树示例…");
    setError("");
    try {
      const p = await fetch(samplePDF);
      if (!p.ok) throw Error("示例文件读取失败");
      const [a, b] = await Promise.all([
        readAsset(new File([await p.blob()], "STM32时钟树_知识速查册.pdf")),
        readAsset(new File([sampleHTMLSource], "STM32时钟树_配套实验台.html")),
      ]);
      setAssets({ [a.id]: a, [b.id]: b });
      setDoc({
        schemaVersion: 1,
        meta: {
          title: "STM32时钟树：我的理解与动手验证",
          slug: "stm32-clock-notes",
          category: "嵌入式",
          series:
            seriesOptions.find(
              (x) => x.category === "嵌入式" && x.name.includes("STM32"),
            )?.name || "",
          tags: "STM32, 时钟树, 学习笔记",
          excerpt:
            "先看我的理解，再查中文总图，最后在同一篇文章里修改参数、验证时钟。",
        },
        blocks: [
          {
            id: uid(),
            type: "markdown",
            text: "## 学习记录\n\n这是一篇示例文章：我自己的文字、PDF知识册与交互实验台，按学习顺序放在一起。\n\n> PDF保留排版与图片，HTML保留计算功能，不再把两者都压成纯文字。",
          },
          {
            id: uid(),
            type: "pdf",
            assetId: a.id,
            title: "知识速查册与中文时钟树",
            page: 1,
          },
          {
            id: uid(),
            type: "markdown",
            text: "## 动手验证\n\n读完上面的规则后，在下面修改PLL参数。实验台里的“打开PDF中文总图”会返回本文的PDF第2页。",
          },
          { id: uid(), type: "html", assetId: b.id, title: "时钟树配套实验台" },
          {
            id: uid(),
            type: "markdown",
            text: "## 我的结论\n\n在这里补充自己的观察，例如：主频正确，不代表每一条外设分支都正确。",
          },
        ],
      });
      setView("split");
      setNotice("已载入示例。现在可以改写文字、调整块顺序，或启用交互预览。");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
      lock.current = false;
    }
  };
  const requestDemo = () =>
    doc.blocks.some((b) => b.type !== "markdown" || b.text.trim())
      ? setDialog({
          title: "用示例替换当前草稿？",
          text: "当前文章将被替换。若要保留，请先导出文章发布包。",
          action: loadDemo,
        })
      : loadDemo();
  const saveNow = async () => {
    try {
      await saveDraft(doc, assets, draftKey);
      setSaved(`已保存到本机 · ${new Date().toLocaleTimeString("zh-CN")}`);
      setNotice("正文和原始附件已保存在当前浏览器。换设备前请导出发布包。");
    } catch {
      setError("本机草稿保存失败，请先导出文章包，避免丢失内容。");
    }
  };
  const doExport = async () => {
    setError("");
    if (problems.length) {
      setError("导出前请处理：" + problems.join(" "));
      return;
    }
    setBusy("正在打包正文与原始附件…");
    try {
      const { exportArticle } = await import("../../lib/article/exportArticle");
      const blob = exportArticle(doc, assets);
      if (blob.size > 85 * 1024 * 1024)
        throw Error("生成的文章包超过85MB，请减少嵌入图片或HTML模块后再导出。");
      downloadBlob(blob, `${doc.meta.slug}-article.zip`);
      setNotice(
        "发布包已导出，包含整篇文章、原附件和可回导的article.json。未向线上网站发布。",
      );
    } catch (e) {
      setError(`导出失败：${e.message}`);
    } finally {
      setBusy("");
    }
  };
  const doPublish = async () => {
    setDialog(null);
    if (lock.current) return;
    setError("");
    if (problems.length) {
      setError("发布前请处理：" + problems.join(" "));
      return;
    }
    if (!onPublish) {
      setError("请先连接GitHub再发布，草稿可继续编辑和导出。");
      return;
    }
    lock.current = true;
    setBusy("准备完整文章提交…");
    try {
      await saveDraft(doc, assets, draftKey);
      const result = await onPublish(doc, assets, setBusy);
      didPublish.current = true;
      try {
        await saveDraft(doc, assets, "published:" + doc.meta.slug);
        await clearDraft(draftKey);
      } catch {}
      onPublished?.(result);
    } catch (e) {
      setError(
        e.message || "发布失败，草稿与附件仍在本机，请不要重复创建文章。",
      );
    } finally {
      lock.current = false;
      setBusy("");
    }
  };
  const requestPublish = () => {
    if (problems.length) {
      setError(problems.join(" "));
      return;
    }
    setDialog({
      title: "确认将文章与附件公开提交？",
      text: `提交到 ${publishTarget}，可能自动触发部署。正文、PDF、HTML和图片都将进入公开GitHub仓库。请确认不包含私人资料或密钥。`,
      action: doPublish,
    });
  };
  const restoreFolder = async (list) => {
    if (!list.length || lock.current) return;
    lock.current = true;
    setBusy("恢复文章包…");
    setError("");
    try {
      const manifestFile = list.find((f) => f.name === "article.json");
      if (!manifestFile || manifestFile.size > 2 * 1024 * 1024)
        throw Error("文章包缺少有效的article.json与assets。");
      const m = JSON.parse(await manifestFile.text());
      if (
        m.schemaVersion !== 1 ||
        !Array.isArray(m.blocks) ||
        m.blocks.length > 200 ||
        !Array.isArray(m.assets) ||
        m.assets.length > 100 ||
        !m.meta
      )
        throw Error("文章包结构不正确或版本不支持。");
      const nextAssets = Object.create(null);
      const seen = new Set();
      let total = 0;
      for (const item of m.assets) {
        if (
          typeof item.id !== "string" ||
          !/^[A-Za-z0-9][\w-]{0,79}$/.test(item.id) ||
          ["__proto__", "constructor", "prototype"].includes(item.id) ||
          seen.has(item.id) ||
          !item.path?.startsWith("assets/") ||
          item.path.includes("..")
        )
          throw Error("附件路径或ID不合法。");
        seen.add(item.id);
        const f = list.find((f) =>
          f.webkitRelativePath.endsWith("/" + item.path),
        );
        if (!f) throw Error(`缺少附件：${item.name}`);
        total += f.size;
        if (total > MAX_TOTAL_BYTES) throw Error("文章包附件超过80MB。");
        const a = await readAsset({
          name: safeName(item.name),
          size: f.size,
          arrayBuffer: () => f.arrayBuffer(),
        });
        nextAssets[item.id] = {
          ...a,
          id: item.id,
          aliases: String(item.aliases || "").slice(0, 500),
        };
      }
      const blockIds = new Set();
      const blocks = m.blocks.map((b) => {
        if (
          typeof b.id !== "string" ||
          ["__proto__", "constructor", "prototype"].includes(b.id) ||
          blockIds.has(b.id) ||
          !/^[A-Za-z0-9][\w-]{0,79}$/.test(b.id) ||
          !["markdown", "pdf", "html", "image"].includes(b.type)
        )
          throw Error("正文块格式不支持。");
        blockIds.add(b.id);
        if (b.type === "markdown")
          return {
            id: b.id,
            type: b.type,
            text: String(b.text || "").slice(0, 2e6),
          };
        if (!nextAssets[b.assetId] || nextAssets[b.assetId].type !== b.type)
          throw Error("内容块与附件类型不匹配。");
        return {
          id: b.id,
          type: b.type,
          assetId: b.assetId,
          title: String(b.title || "").slice(0, 300),
          alt: String(b.alt || "").slice(0, 500),
          page: Math.max(1, Number(b.page) || 1),
        };
      });
      const meta = Object.fromEntries(
        ["title", "slug", "category", "series", "tags", "excerpt"].map((k) => [
          k,
          String(m.meta[k] || "").slice(0, 1000),
        ]),
      );
      setDoc({ schemaVersion: 1, meta, blocks });
      setAssets(nextAssets);
      setNotice("已恢复文章与原始附件，可继续编辑。");
    } catch (e) {
      setError("恢复失败：" + e.message);
    } finally {
      setBusy("");
      lock.current = false;
    }
  };
  const restoreArchive = async (file) => {
    if (!file || lock.current) return;
    lock.current = true;
    setBusy("读取文章包…");
    setError("");
    let list;
    try {
      if (file.size > 85 * 1024 * 1024) throw Error("文章包超过85MB。");
      list = readArticleZIP(await file.arrayBuffer()).map((e) => {
        const f = new File([e.bytes], e.path.split("/").pop());
        Object.defineProperty(f, "webkitRelativePath", {
          value: "article/" + e.path,
        });
        return f;
      });
    } catch (e) {
      setError("恢复失败：" + e.message);
    } finally {
      lock.current = false;
      setBusy("");
    }
    if (list) await restoreFolder(list);
  };
  const navigateAsset = (id, page) => {
    const b = latest.current.doc.blocks.find((b) => b.assetId === id);
    if (!b) {
      setNotice("附件已关联，但尚未插入正文。请在附件区点击“插入文章”。");
      return;
    }
    if (b.type === "pdf") patch(b.id, { page });
    requestAnimationFrame(() =>
      document
        .getElementById(`block-${b.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const toolbar = (id, prefix, suffix = "") => {
    const el = textareas.current[id],
      b = doc.blocks.find((b) => b.id === id);
    if (!el || !b) return;
    const s = el.selectionStart,
      e = el.selectionEnd;
    patch(id, {
      text:
        b.text.slice(0, s) +
        prefix +
        b.text.slice(s, e) +
        suffix +
        b.text.slice(e),
    });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, e + prefix.length);
    });
  };
  const renderBlock = (b, reader = false) => {
    const a = assets[b.assetId];
    if (b.type === "markdown")
      return reader ? (
        <Markdown source={b.text} />
      ) : (
        <>
          <div className="text-tools">
            <button onClick={() => toolbar(b.id, "## ")} title="二级标题">
              标题
            </button>
            <button onClick={() => toolbar(b.id, "**", "**")} title="粗体">
              粗体
            </button>
            <button onClick={() => toolbar(b.id, "> ")} title="引用">
              引用
            </button>
            <button
              onClick={() => toolbar(b.id, "\n```c\n", "\n```\n")}
              title="代码块"
            >
              代码
            </button>
          </div>
          <textarea
            ref={(el) => (textareas.current[b.id] = el)}
            className="markdown-input"
            aria-label="正文Markdown"
            placeholder="写下你的理解，也可以粘贴网页或Word富文本…"
            value={b.text}
            onFocus={() => setActive(b.id)}
            onChange={(e) => patch(b.id, { text: e.target.value })}
            onPaste={(e) => {
              const h = e.clipboardData?.getData("text/html");
              if (h && looksRich(h)) {
                const md = htmlToMarkdown(h);
                if (md) {
                  e.preventDefault();
                  const el = e.target,
                    s = el.selectionStart,
                    t = el.selectionEnd;
                  patch(b.id, {
                    text: b.text.slice(0, s) + md + b.text.slice(t),
                  });
                  setNotice(
                    "富文本已转成可编辑Markdown；交互网页请使用“插入文件”。",
                  );
                }
              }
            }}
          />
        </>
      );
    if (!a) return <p role="alert">附件缺失，请重新导入。</p>;
    if (b.type === "pdf")
      return reader ? (
        <PDFBlock
          asset={a}
          page={b.page}
          onPageChange={(page) => patch(b.id, { page })}
        />
      ) : (
        <div className="asset-placeholder">
          <span className="file-type pdf">PDF</span>
          <div>
            <strong>{a.name}</strong>
            <p>保留原始文件 · {formatSize(a.size)} · 读者可翻页查看图表</p>
          </div>
          <button onClick={() => setView("split")}>预览排版</button>
        </div>
      );
    if (b.type === "html")
      return reader ? (
        <HTMLBlock
          asset={a}
          assets={assets}
          urls={urls}
          onNavigate={navigateAsset}
        />
      ) : (
        <div className="asset-placeholder">
          <span className="file-type html">HTML</span>
          <div>
            <strong>{a.name}</strong>
            <p>保留脚本与交互 · 隔离运行 · {formatSize(a.size)}</p>
          </div>
          <button onClick={() => setView("split")}>测试交互</button>
        </div>
      );
    return (
      <figure>
        <img className="article-image" src={urls[a.id]} alt={b.alt || a.name} />
        {reader && b.alt && <figcaption>{b.alt}</figcaption>}
        {!reader && (
          <input
            value={b.alt || ""}
            onChange={(e) => patch(b.id, { alt: e.target.value })}
            aria-label="图片说明"
            placeholder="图片说明 / 替代文字"
          />
        )}
      </figure>
    );
  };
  const reader = (
    <ArticleReader
      doc={doc}
      assets={assets}
      urls={urls}
      onPageChange={(id, page) => patch(id, { page })}
      onNavigate={navigateAsset}
    />
  );
  return (
    <div className="composer">
      <header className="composer-header">
        <div>
          <p className="eyebrow">海滩长颈鹿 / 创作工作台</p>
          <h1>把文字与实验，写成同一篇文章。</h1>
          <p className="save-state" role="status">
            {saved}
          </p>
        </div>
        <div className="header-actions">
          <button onClick={saveNow} disabled={!ready || !!busy}>
            保存草稿
          </button>
          <button
            className="primary"
            onClick={doExport}
            disabled={!ready || !!busy}
          >
            导出文章包 ↗
          </button>
          <button
            className="primary"
            onClick={requestPublish}
            disabled={!onPublish || !ready || !!busy}
          >
            提交发布
          </button>
        </div>
      </header>
      <div className="workspace-banner">
        <span>
          <strong>不再把文件压成文字。</strong>{" "}
          PDF保留排版，HTML保留交互，正文由你编排。
        </span>
        <button onClick={requestDemo} disabled={!!busy || !ready}>
          载入时钟树示例 →
        </button>
      </div>
      {error && (
        <div className="message error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="关闭错误">
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="message notice" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="关闭提示">
            ×
          </button>
        </div>
      )}
      {busy && (
        <div className="message busy" role="status">
          {busy}
        </div>
      )}
      <div className="viewbar">
        <div className="mode-group" aria-label="编辑模式">
          {[
            ["edit", "编写"],
            ["split", "分栏预览"],
            ["read", "读者视图"],
          ].map(([v, l]) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <span>
          {doc.blocks.length}个内容块 · {words}字正文
        </span>
      </div>
      <div className={`compose-grid mode-${view}`}>
        <main className="writing-area">
          {view !== "read" && (
            <>
              <div className="title-editor">
                <label htmlFor="article-title">文章标题</label>
                <input
                  id="article-title"
                  value={doc.meta.title}
                  placeholder="给这次学习起个标题"
                  onChange={(e) => {
                    changeMeta("title", e.target.value);
                    if (!doc.meta.slug) changeMeta("slug", autoSlug());
                  }}
                />
                <label htmlFor="article-excerpt">导读 / 摘要</label>
                <textarea
                  id="article-excerpt"
                  value={doc.meta.excerpt}
                  onChange={(e) => changeMeta("excerpt", e.target.value)}
                  placeholder="告诉读者，这篇笔记能解决什么问题（可选）"
                />
              </div>
              <div className="insert-bar">
                <button onClick={addText}>＋ 文字段落</button>
                <button onClick={() => files.current.click()} disabled={!!busy}>
                  ＋ 插入文件
                </button>
                <label className="extract-option">
                  <input
                    type="checkbox"
                    checked={extract}
                    onChange={(e) => setExtract(e.target.checked)}
                  />
                  仅提取可编辑文字
                </label>
                <input
                  ref={files}
                  type="file"
                  multiple
                  accept={ACCEPT_ARTICLE}
                  hidden
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    await runImport([...input.files]);
                    input.value = "";
                  }}
                />
              </div>
              <div
                className="block-list"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  runImport([...e.dataTransfer.files]);
                }}
              >
                {doc.blocks.map((b, i) => (
                  <section
                    key={b.id}
                    className={`edit-block ${active === b.id ? "active" : ""}`}
                    onFocus={() => setActive(b.id)}
                  >
                    <div className="block-top">
                      <span className="block-kind">
                        {p2(i + 1)} /{" "}
                        {
                          {
                            markdown: "文字段落",
                            pdf: "PDF文档",
                            html: "HTML交互",
                            image: "图片",
                          }[b.type]
                        }
                      </span>
                      <div>
                        <button
                          aria-label={`上移第${i + 1}块`}
                          disabled={i === 0}
                          onClick={() => move(b.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`下移第${i + 1}块`}
                          disabled={i === doc.blocks.length - 1}
                          onClick={() => move(b.id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          aria-label={`移除第${i + 1}块`}
                          onClick={() => remove(b.id)}
                        >
                          移除
                        </button>
                      </div>
                    </div>
                    {b.type !== "markdown" && (
                      <input
                        className="block-title"
                        aria-label="模块标题"
                        value={b.title || ""}
                        onChange={(e) => patch(b.id, { title: e.target.value })}
                        placeholder="模块标题（可选）"
                      />
                    )}
                    {renderBlock(b)}
                  </section>
                ))}
                {!doc.blocks.length && (
                  <div className="empty-canvas">
                    <h2>从一段文字开始</h2>
                    <p>也可以拖入PDF、HTML或图片，让资料成为文章的一部分。</p>
                    <button className="primary" onClick={addText}>
                      添加文字段落
                    </button>
                  </div>
                )}
              </div>
              <div className="insert-end">
                <button onClick={addText}>＋ 继续写一段</button>
                <button onClick={() => files.current.click()}>
                  插入 PDF / HTML / 图片
                </button>
              </div>
            </>
          )}
          {view === "read" && reader}
        </main>
        {view === "split" && (
          <div className="preview-column">
            <div className="preview-heading">
              <strong>读者预览</strong>
              <span>与内容块顺序同步</span>
            </div>
            {reader}
          </div>
        )}
        {view !== "read" && (
          <aside className="composer-sidebar">
            <section className="side-card">
              <h2>文章信息</h2>
              <label>
                分类
                <select
                  value={doc.meta.category}
                  onChange={(e) => changeMeta("category", e.target.value)}
                >
                  {categoryOptions.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                系列（可选）
                <select
                  value={doc.meta.series}
                  onChange={(e) => changeMeta("series", e.target.value)}
                >
                  <option value="">不归入系列</option>
                  {seriesOptions
                    .filter((x) => x.category === doc.meta.category)
                    .map((x) => (
                      <option key={x.name} value={x.name}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                网址尾段
                <input
                  value={doc.meta.slug}
                  onChange={(e) =>
                    changeMeta("slug", e.target.value.toLowerCase())
                  }
                  placeholder="stm32-clock-notes"
                />
              </label>
              <label>
                标签
                <input
                  value={doc.meta.tags}
                  onChange={(e) => changeMeta("tags", e.target.value)}
                  placeholder="STM32, 时钟树"
                />
              </label>
            </section>
            <section className="side-card">
              <h2>发布前检查</h2>
              {problems.length ? (
                <ul className="check-list">
                  {problems.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="check-good">✓ 标题、网址和内容已就绪</p>
              )}
              {htmlIssues.map(({ asset, unresolved, remote }) => (
                <div className="asset-check" key={asset.id}>
                  <strong>{asset.name}</strong>
                  <p>
                    {unresolved.length
                      ? `待关联 ${unresolved.length} 个本地引用`
                      : "✓ 本地文件引用已关联"}
                  </p>
                  {remote.length > 0 && (
                    <p>外部资源 {remote.length} 个，隔离模块默认不加载</p>
                  )}
                </div>
              ))}
              <p className="helper">
                {onPublish
                  ? "正文、目录和附件一次提交；失败不覆盖仓库最新版本。提交后仍需等待部署完成。"
                  : "未连接GitHub也能写作和保存草稿；连接后才可发布。"}
              </p>
            </section>
            <section className="side-card">
              <h2>附件与引用</h2>
              {Object.values(assets).length ? (
                Object.values(assets).map((a) => (
                  <details key={a.id} className="asset-detail">
                    <summary>
                      <span>{a.type.toUpperCase()}</span> {a.name}
                    </summary>
                    <p>{formatSize(a.size)}</p>
                    <label>
                      网页引用别名
                      <input
                        value={a.aliases || ""}
                        placeholder="网页里引用的文件名，多个用逗号"
                        onChange={(e) =>
                          setAssets((s) => ({
                            ...s,
                            [a.id]: { ...s[a.id], aliases: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <button
                      onClick={() => {
                        const b = {
                          id: uid(),
                          type: a.type,
                          assetId: a.id,
                          title: a.name,
                          page: 1,
                        };
                        insertBlocks([b]);
                        setActive(b.id);
                      }}
                    >
                      插入文章
                    </button>
                  </details>
                ))
              ) : (
                <p className="helper">
                  插入文件后会出现在这里。未插入正文但被HTML引用的附件仍会一起导出。
                </p>
              )}
            </section>
            <section className="side-card compact-side">
              <h2>继续编辑已有文章</h2>
              <p className="helper">
                直接选择本工具导出的ZIP，恢复正文与原始附件，无需解压。
              </p>
              <button
                onClick={() =>
                  setDialog({
                    title: "恢复文章包会替换当前草稿",
                    text: "请先导出当前文章以保留备份。确认后选择先前导出的文章ZIP。",
                    action: () => {
                      setDialog(null);
                      folder.current.click();
                    },
                  })
                }
              >
                恢复文章包
              </button>
              <input
                type="file"
                accept=".zip"
                data-restore-archive=""
                hidden
                ref={folder}
                onChange={async (e) => {
                  const input = e.currentTarget;
                  await restoreArchive(input.files[0]);
                  input.value = "";
                }}
              />
            </section>
          </aside>
        )}
      </div>
      {dialog && (
        <Dialog
          title={dialog.title}
          onCancel={() => setDialog(null)}
          onConfirm={dialog.action}
        >
          {dialog.text}
        </Dialog>
      )}
      <footer className="composer-footer">
        草稿只保存在当前浏览器。只有确认发布后才向GitHub上传正文与附件；离开设备前可导出备份。HTML隔离运行。
      </footer>
    </div>
  );
}
