// Uncompressed ZIP, UTF-8 names, CRC32. No runtime dependency or network round trip.
const encoder = new TextEncoder();
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function header(size, values) {
  const b = new Uint8Array(size),
    v = new DataView(b.buffer);
  for (const [at, n, bytes] of values)
    bytes === 2 ? v.setUint16(at, n, true) : v.setUint32(at, n, true);
  return b;
}
export function zipFiles(entries) {
  const chunks = [],
    central = [];
  let offset = 0,
    cs = 0;
  for (const [path, value] of entries) {
    const name = encoder.encode(path);
    const data =
      typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
    const c = crc(data);
    const local = header(30, [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x800, 2],
      [14, c, 4],
      [18, data.length, 4],
      [22, data.length, 4],
      [26, name.length, 2],
    ]);
    chunks.push(local, name, data);
    const dir = header(46, [
      [0, 0x02014b50, 4],
      [4, 20, 2],
      [6, 20, 2],
      [8, 0x800, 2],
      [16, c, 4],
      [20, data.length, 4],
      [24, data.length, 4],
      [28, name.length, 2],
      [42, offset, 4],
    ]);
    central.push(dir, name);
    cs += dir.length + name.length;
    offset += local.length + name.length + data.length;
  }
  const end = header(22, [
    [0, 0x06054b50, 4],
    [8, entries.length, 2],
    [10, entries.length, 2],
    [12, cs, 4],
    [16, offset, 4],
  ]);
  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}
export function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
/** Read only this editor's STORE/UTF-8 ZIP format; reject compression, encryption and path traversal. */
export function readArticleZIP(buffer) {
  const bytes = new Uint8Array(buffer),
    v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    result = [];
  let off = 0,
    total = 0;
  while (off + 4 <= bytes.length && v.getUint32(off, true) === 0x04034b50) {
    if (off + 30 > bytes.length) throw Error("文章包已损坏。");
    const flags = v.getUint16(off + 6, true),
      method = v.getUint16(off + 8, true),
      sum = v.getUint32(off + 14, true),
      size = v.getUint32(off + 18, true),
      raw = v.getUint32(off + 22, true),
      nl = v.getUint16(off + 26, true),
      el = v.getUint16(off + 28, true),
      start = off + 30 + nl + el;
    if (flags & 9 || method !== 0 || size !== raw)
      throw Error(
        "请选择本编辑器原样导出的ZIP，不支持加密或重新压缩的文章包。",
      );
    if (start + size > bytes.length || !nl) throw Error("文章包已截断。");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(off + 30, off + 30 + nl),
    );
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").some((p) => p === ".." || p === "." || p === "") ||
      /[:\x00-\x1f]/.test(name) ||
      result.some((f) => f.path === name)
    )
      throw Error("文章包路径不合法或重复。");
    total += size;
    if (total > 85 * 1024 * 1024 || result.length >= 120)
      throw Error("文章包过大或文件太多。");
    const data = bytes.slice(start, start + size);
    if (crc(data) !== sum) throw Error("附件校验失败，文章包可能已损坏。");
    result.push({ path: name, bytes: data });
    off = start + size;
  }
  if (
    !result.length ||
    off + 4 > bytes.length ||
    v.getUint32(off, true) !== 0x02014b50
  )
    throw Error("不是本编辑器支持的完整文章包。");
  return result;
}
