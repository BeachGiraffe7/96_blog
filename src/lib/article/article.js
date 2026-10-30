/** Article v1. Raw PDF/HTML assets are intentionally NOT flattened into Markdown. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
export const ACCEPT_ARTICLE =
  ".md,.markdown,.txt,.docx,.pdf,.html,.htm,.png,.jpg,.jpeg,.webp,.gif";
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const formatSize = (n) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
export const escapeHTML = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const safeName = (name) =>
  String(name || "file")
    .normalize("NFC")
    .replace(/[\\/\x00-\x1f<>:"|?*]/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 140) || "file";
export function emptyArticle() {
  return {
    schemaVersion: 1,
    meta: {
      title: "",
      slug: "",
      category: "嵌入式",
      series: "",
      tags: "",
      excerpt: "",
    },
    blocks: [{ id: uid(), type: "markdown", text: "" }],
  };
}
export function validateArticle(doc, assets) {
  const problems = [];
  if (!doc.meta.title.trim()) problems.push("请填写文章标题。");
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(doc.meta.slug))
    problems.push("网址尾段需为2–80位小写字母、数字或连字符。");
  if (!doc.blocks.some((b) => b.type !== "markdown" || b.text.trim()))
    problems.push("文章还没有内容。");
  for (const b of doc.blocks)
    if (b.type !== "markdown" && !assets[b.assetId])
      problems.push(`有${b.type}模块缺少附件，请重新导入。`);
  return [...new Set(problems)];
}
export async function readAsset(file) {
  if (file.size > MAX_FILE_BYTES)
    throw Error(`${file.name}超过20MB，请先压缩或拆分。`);
  const bytes = await file.arrayBuffer(),
    name = safeName(file.name),
    ext = name.split(".").pop().toLowerCase();
  let type, mime;
  if (ext === "pdf") {
    if (new TextDecoder().decode(bytes.slice(0, 1024)).indexOf("%PDF-") < 0)
      throw Error("这不是有效的PDF文件。");
    type = "pdf";
    mime = "application/pdf";
  } else if (["html", "htm"].includes(ext)) {
    type = "html";
    mime = "text/html";
  } else if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    const u = new Uint8Array(bytes);
    const valid =
      (ext === "png" && u[0] === 137 && u[1] === 80) ||
      (ext === "gif" && u[0] === 71 && u[1] === 73) ||
      (["jpg", "jpeg"].includes(ext) && u[0] === 255 && u[1] === 216) ||
      (ext === "webp" &&
        new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP");
    if (!valid) throw Error("图片内容与扩展名不符，请使用PNG/JPG/WebP/GIF。");
    type = "image";
    mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
  } else throw Error("该文件应选择“提取文字”导入。");
  return {
    id: uid(),
    name,
    aliases: "",
    type,
    mime,
    size: bytes.byteLength,
    bytes,
  };
}
export function assetPath(a) {
  return `assets/${a.id}-${safeName(a.name)}${a.type === "html" ? ".txt" : ""}`;
}
export function decodeText(bytes) {
  const u = new Uint8Array(bytes);
  if (u[0] === 255 && u[1] === 254)
    return new TextDecoder("utf-16le").decode(u);
  if (u[0] === 254 && u[1] === 255)
    return new TextDecoder("utf-16be").decode(u);
  let s = new TextDecoder("utf-8").decode(u);
  if (s.includes("\uFFFD")) {
    try {
      s = new TextDecoder("gb18030", { fatal: true }).decode(u);
    } catch {}
  }
  return s.replace(/^\uFEFF/, "");
}
const fileName = (v) => {
  try {
    return decodeURIComponent(v.split(/[?#]/)[0].split("/").pop());
  } catch {
    return v;
  }
};
export function resolveAsset(href, assets) {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return null;
  const name = fileName(href);
  const hits = Object.values(assets).filter((a) =>
    [
      a.name,
      ...String(a.aliases || "")
        .split(/[,，\n]/)
        .map((s) => s.trim()),
    ].includes(name),
  );
  return hits.length === 1 ? hits[0] : null;
}
export function inspectHTML(asset, assets) {
  const doc = new DOMParser().parseFromString(
    decodeText(asset.bytes),
    "text/html",
  );
  const unresolved = [],
    remote = [];
  for (const n of doc.querySelectorAll("[src],a[href],link[href]")) {
    const url = n.getAttribute("src") || n.getAttribute("href") || "";
    if (/^(https?:|\/\/)/i.test(url)) {
      remote.push(url);
      continue;
    }
    if (!url || /^(#|data:|blob:|mailto:|tel:|javascript:)/i.test(url))
      continue;
    if (!resolveAsset(url, assets)) unresolved.push(url);
  }
  return { unresolved: [...new Set(unresolved)], remote: [...new Set(remote)] };
}
/** Opaque sandbox; deny fetch/subresources/forms/popups. Self-navigation is not a complete network firewall. */
export function sandboxHTML(asset, assets, urls = {}) {
  const doc = new DOMParser().parseFromString(
    decodeText(asset.bytes),
    "text/html",
  );
  doc.querySelectorAll("base,meta[http-equiv]").forEach((n) => n.remove());
  for (const n of doc.querySelectorAll("[src],link[href]")) {
    const attr = n.hasAttribute("src") ? "src" : "href";
    const a = resolveAsset(n.getAttribute(attr), assets);
    if (a?.type === "image" && urls[a.id]) n.setAttribute(attr, urls[a.id]);
  }
  for (const n of doc.querySelectorAll("a[href]")) {
    const href = n.getAttribute("href");
    const a = resolveAsset(href, assets);
    if (a) {
      n.setAttribute("data-article-asset", a.id);
      n.setAttribute(
        "data-article-page",
        String(Number(href.match(/#page=(\d+)/)?.[1]) || 1),
      );
      n.setAttribute("href", "#article-attachment");
      n.removeAttribute("target");
    }
  }
  const csp = doc.createElement("meta");
  csp.httpEquiv = "Content-Security-Policy";
  csp.content =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  doc.head.prepend(csp);
  const bridge = doc.createElement("script");
  bridge.textContent = `(()=>{const send=(v)=>parent.postMessage({channel:'article-module-v1',...v},'*');let last=0;const resize=()=>{const h=Math.max(360,Math.min(1800,Math.ceil(Math.max(document.body.scrollHeight,document.body.getBoundingClientRect().height))));if(Math.abs(last-h)>3){last=h;send({type:'resize',height:h})}};addEventListener('load',resize);new ResizeObserver(resize).observe(document.body);document.addEventListener('click',e=>{const a=e.target.closest('a[data-article-asset]');if(a){e.preventDefault();send({type:'asset',id:a.dataset.articleAsset,page:Number(a.dataset.articlePage)||1})}})})();`;
  doc.body.append(bridge);
  return "<!doctype html>\n" + doc.documentElement.outerHTML;
}
export function articleManifest(doc, assets) {
  return {
    ...doc,
    assets: Object.values(assets).map(
      ({ id, name, aliases, type, mime, size }) => ({
        id,
        name,
        aliases,
        type,
        mime,
        size,
        path: assetPath(assets[id]),
      }),
    ),
  };
}
