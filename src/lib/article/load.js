import {
  readAsset,
  assetPath,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from "./article.js";
const idOK = (id) =>
  typeof id === "string" &&
  /^[A-Za-z0-9][\w-]{0,79}$/.test(id) &&
  !["constructor", "prototype", "__proto__"].includes(id);
export function validateManifest(m) {
  if (
    m?.schemaVersion !== 1 ||
    !m.meta ||
    !Array.isArray(m.blocks) ||
    m.blocks.length > 200 ||
    !Array.isArray(m.assets) ||
    m.assets.length > 100
  )
    throw Error("组合文章格式或版本不支持。");
  const ids = new Set(),
    byId = new Map();
  let total = 0;
  for (const a of m.assets) {
    if (
      !idOK(a.id) ||
      ids.has(a.id) ||
      !["pdf", "html", "image"].includes(a.type) ||
      a.path !== assetPath(a) ||
      !Number.isInteger(a.size) ||
      a.size < 1 ||
      a.size > MAX_FILE_BYTES
    )
      throw Error("附件清单不合法。");
    ids.add(a.id);
    byId.set(a.id, a);
    total += a.size;
  }
  if (total > MAX_TOTAL_BYTES) throw Error("文章附件总量过大。");
  const blocks = new Set();
  for (const b of m.blocks) {
    if (
      !idOK(b.id) ||
      blocks.has(b.id) ||
      !["markdown", "pdf", "html", "image"].includes(b.type)
    )
      throw Error("正文模块不合法。");
    blocks.add(b.id);
    if (b.type === "markdown") {
      if (typeof b.text !== "string" || b.text.length > 2e6)
        throw Error("正文文字过大。");
    } else if (byId.get(b.assetId)?.type !== b.type)
      throw Error("附件缺失或类型不匹配。");
  }
  return m;
}
export async function readLimited(response, max) {
  if (!response.ok) throw Error(`文章资源读取失败（${response.status}）。`);
  if (Number(response.headers.get("content-length") || 0) > max)
    throw Error("文章资源超出大小限制。");
  if (!response.body) {
    const b = await response.arrayBuffer();
    if (b.byteLength > max) throw Error("文章资源超出大小限制。");
    return b;
  }
  const reader = response.body.getReader(),
    chunks = [];
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > max) {
        await reader.cancel();
        throw Error("文章资源超出大小限制。");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(n);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result.buffer;
}
export async function hydrateManifest(manifest, fetchBytes) {
  const m = validateManifest(manifest),
    assets = Object.create(null);
  // Sequential keeps peak memory/request load bounded on phones.
  for (const item of m.assets) {
    const bytes = await fetchBytes(item.path, item.size);
    if (bytes.byteLength !== item.size)
      throw Error("附件大小与清单不一致，请刷新后重试。");
    const a = await readAsset({
      name: item.name,
      size: bytes.byteLength,
      arrayBuffer: async () => bytes,
    });
    if (a.type !== item.type) throw Error("附件实际类型与清单不一致。");
    assets[item.id] = {
      ...a,
      id: item.id,
      aliases: String(item.aliases || "").slice(0, 500),
    };
  }
  const meta = Object.fromEntries(
    ["title", "slug", "category", "series", "tags", "excerpt"].map((k) => [
      k,
      String(m.meta[k] || "").slice(0, 1000),
    ]),
  );
  return { doc: { schemaVersion: 1, meta, blocks: m.blocks }, assets };
}
export async function loadPublicArticle(slug, signal) {
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) throw Error("文章网址不合法。");
  const base = `/articles/${slug}/`;
  const raw = await readLimited(
    await fetch(base + "article.json", { signal, redirect: "error" }),
    2 * 1024 * 1024,
  );
  const manifest = JSON.parse(new TextDecoder().decode(raw));
  if (manifest?.meta?.slug !== slug) throw Error("文章网址与清单不一致。");
  return hydrateManifest(manifest, async (path, size) =>
    readLimited(
      await fetch(base + path, { signal, redirect: "error" }),
      Math.min(size, MAX_FILE_BYTES),
    ),
  );
}
