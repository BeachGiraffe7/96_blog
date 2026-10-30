// 把 Markdown / Word / PDF / HTML 统一转成 Markdown
//
// 解析库都是「用到才加载」：不导入 PDF 就不会下载 pdfjs（约 1MB），
// 写作页本身也是懒加载路由，读者永远碰不到这些代码。

import { htmlToMarkdown } from "./htmlToMarkdown.js";

export const IMPORT_ACCEPT = ".md,.markdown,.txt,.html,.htm,.docx,.pdf";
export const IMPORT_HINT =
  "支持 Markdown / Word(.docx) / PDF / HTML，可一次选多个";

const ext = (name) =>
  String(name || "")
    .toLowerCase()
    .match(/\.[a-z0-9]+$/)?.[0] || "";

const CJK = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/;

// 文章本身已有一级标题，渲染器还会跳过所有 h1，
// 所以外部文档的标题整体降一级，否则导入后标题会整行消失
const demoteHeadings = (md) => {
  const out = [];
  let inCode = false;
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      out.push(line);
      continue;
    }
    out.push(
      inCode
        ? line
        : line.replace(
            /^(#{1,6}) /,
            (m, h) => `${"#".repeat(Math.min(4, h.length + 1))} `,
          ),
    );
  }
  return out.join("\n");
};

// 图片转成 base64 后体积会炸，替换成轻量渲染器可见的文字提示
const stripInlineImages = (md) =>
  md
    .replace(
      /!\[([^\]]*)\]\(\s*data:[^)]*\)/gi,
      (_, alt) => `> 文档内图片需单独上传${alt ? `：${alt}` : ""}`,
    )
    .replace(
      /<img[^>]*src=["']data:[^"']*["'][^>]*>/gi,
      "> 文档内图片需单独上传。",
    );

// 动态 import 失败（网络抖动、部署后旧页面）重试几次：这类错误重试通常就能过
const isModuleLoadError = (e) =>
  /dynamically imported module|module script failed|Failed to fetch|NetworkError/i.test(
    String(e && e.message),
  );

async function loadWithRetry(loader, label) {
  let last;
  for (let i = 0; i < 3; i += 1) {
    try {
      return await loader();
    } catch (e) {
      last = e;
      if (!isModuleLoadError(e)) throw e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error(
    `${label}没下载下来（网络中断或刚部署完缓存还旧）——再点一次导入，或刷新页面重试`,
  );
}

// ---------- Word ----------

async function docxToMarkdown(file) {
  const mammoth = await loadWithRetry(() => import("mammoth"), "Word 解析器");
  const mod = mammoth.default || mammoth;
  const { value: html } = await mod.convertToHtml({
    arrayBuffer: await file.arrayBuffer(),
  });
  const warnings = [];
  if (/data:image/i.test(html || ""))
    warnings.push("文档里的图片无法自动上传，已留下文字提示");
  return {
    markdown: demoteHeadings(stripInlineImages(htmlToMarkdown(html || ""))),
    warnings,
  };
}

// ---------- PDF ----------

let pdfjsPromise = null;
export async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await loadWithRetry(
        () => import("pdfjs-dist"),
        "PDF 解析器",
      );
      const worker = await loadWithRetry(
        () => import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        "PDF worker",
      );
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })().catch((e) => {
      pdfjsPromise = null; // 失败就清缓存，下次还能重试
      throw e;
    });
  }
  return pdfjsPromise;
}

// 把一页的文字块按纵坐标聚成行；PDF 的 y 轴朝上，行要倒序
export function rowsFromItems(items) {
  const rows = [];
  for (const item of items) {
    const str = item.str;
    if (!str || !str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const h = Math.abs(item.transform[3]) || item.height || 10;
    let row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, h * 0.35));
    if (!row) {
      row = { y, parts: [], size: 0 };
      rows.push(row);
    }
    row.size = Math.max(row.size, h);
    row.parts.push({ x, w: item.width || 0, s: str });
  }

  rows.sort((a, b) => b.y - a.y);
  for (const row of rows) {
    row.parts.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = null;
    for (const p of row.parts) {
      // 只在「两边都是西文」时才补空格，否则中文会被拆出空格
      if (
        prevEnd != null &&
        p.x - prevEnd > 2 &&
        /[A-Za-z0-9]$/.test(text) &&
        /^[A-Za-z0-9]/.test(p.s)
      ) {
        text += " ";
      }
      text += p.s;
      prevEnd = p.x + p.w;
    }
    row.text = text.replace(/\s+/g, " ").trim();
  }
  return rows.filter((r) => r.text);
}

// 行距明显变大的地方断段，否则视为同一段（中文直接拼，西文补空格）
export function rowsToMarkdown(rows) {
  if (!rows.length) return "";

  // 用「下四分位」当正文行距基准：中位数会把段间距也算进去，
  // 导致阈值偏高、段落被并成一大坨
  const gaps = [];
  for (let i = 1; i < rows.length; i += 1) gaps.push(rows[i - 1].y - rows[i].y);
  const sorted = [...gaps].sort((a, b) => a - b);
  const base = sorted.length
    ? sorted[Math.floor((sorted.length - 1) * 0.25)]
    : 0;
  const threshold = Math.max(base * 1.4, base + 1.5);

  // 字号明显大于正文、且不长的行，当作小标题（用 ### 避免和文章标题抢层级）
  const sizes = rows.map((r) => r.size || 0).sort((a, b) => a - b);
  const bodySize = sizes[Math.floor((sizes.length - 1) / 2)] || 0;
  const isHeading = (row) =>
    bodySize > 0 && (row.size || 0) >= bodySize * 1.22 && row.text.length <= 40;

  const paras = [];
  let cur = rows[0].text;
  if (isHeading(rows[0])) cur = `### ${cur}`;
  let justHeading = isHeading(rows[0]);

  for (let i = 1; i < rows.length; i += 1) {
    const gap = rows[i - 1].y - rows[i].y;
    const heading = isHeading(rows[i]);
    if (heading || justHeading || gap > threshold) {
      paras.push(cur);
      cur = heading ? `### ${rows[i].text}` : rows[i].text;
    } else {
      const prev = cur.slice(-1);
      const next = rows[i].text[0];
      cur =
        CJK.test(prev) || CJK.test(next)
          ? cur + rows[i].text
          : `${cur} ${rows[i].text}`;
    }
    justHeading = heading;
  }
  paras.push(cur);

  return paras
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

const withTimeout = (promise, ms, message) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });

async function pdfToMarkdown(file) {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  });
  let doc;
  try {
    doc = await withTimeout(
      task.promise,
      90000,
      "PDF解析超时，请改用PDF原件模块。",
    );
    const blocks = [];
    let chars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await withTimeout(
        doc.getPage(p),
        30000,
        `PDF第${p}页读取超时。`,
      );
      try {
        const content = await withTimeout(
          page.getTextContent(),
          30000,
          `PDF第${p}页取字超时。`,
        );
        const rows = rowsFromItems(content.items);
        chars += rows.reduce((s, r) => s + r.text.length, 0);
        const md = rowsToMarkdown(rows);
        if (md) blocks.push(md);
      } finally {
        page.cleanup();
      }
    }
    const warnings = [
      "仅提取文字：分栏、表格、代码与图文顺序可能不准。要保留原样，请使用PDF模块。",
    ];
    if (chars < doc.numPages * 40)
      warnings.push("文字很少，可能为扫描版，需要OCR；本工具不包含OCR。");
    if (doc.numPages > 1)
      warnings.push(`共${doc.numPages}页，排版和图片不会保留。`);
    return { markdown: blocks.join("\n\n"), warnings };
  } finally {
    await task.destroy();
  }
}

// ---------- 入口 ----------

const MAX_BYTES = 40 * 1024 * 1024;

export async function fileToMarkdown(file) {
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} 超过 40MB，先拆分或压缩一下`);
  }

  const e = ext(file.name);
  if (e === ".pdf") return pdfToMarkdown(file);
  if (e === ".docx") return docxToMarkdown(file);
  if (e === ".html" || e === ".htm") {
    const { text, warnings } = await decodeFileText(file);
    const interactive = /<(script|input|select|button)\b/i.test(text);
    return {
      markdown: demoteHeadings(htmlToMarkdown(text)),
      warnings: [
        ...warnings,
        ...(interactive
          ? ["这是交互网页；提取文字会丢失交互，建议使用文章编排器的HTML模块。"]
          : []),
      ],
    };
  }
  if (e === ".md" || e === ".markdown" || e === ".txt") {
    const { text, warnings } = await decodeFileText(file);
    return { markdown: text, warnings };
  }
  throw new Error(`暂不支持 ${e || "这种"} 格式`);
}

export async function decodeFileText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const warnings = [];
  let text;
  if (bytes[0] === 255 && bytes[1] === 254)
    text = new TextDecoder("utf-16le").decode(bytes);
  else if (bytes[0] === 254 && bytes[1] === 255)
    text = new TextDecoder("utf-16be").decode(bytes);
  else {
    text = new TextDecoder("utf-8").decode(bytes);
    if (text.includes("\uFFFD")) {
      try {
        text = new TextDecoder("gb18030", { fatal: true }).decode(bytes);
        warnings.push("已按GB18030兼容编码读取，请核对少数字符。");
      } catch {
        warnings.push("部分字符编码无法确定，请转为UTF-8后重试。");
      }
    }
  }
  return { text: text.replace(/^\uFEFF/, ""), warnings };
}
