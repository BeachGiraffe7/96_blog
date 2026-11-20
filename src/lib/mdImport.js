// 外部 Markdown（尤其是飞书导出）导入前的清洗：
//   1. 飞书把代码块导出成一行行零碎的 `行内代码`，这里拼回 ```c 代码块并按大括号重新缩进
//   2. 去掉飞书多余的反斜杠转义（2\.1、vTaskDelay\(\)）
//   3. 按独立图片行把正文切开，图片交给编辑器的图片模块（文字块里的相对路径图片是显示不出来的）
//   4. 读取飞书导出的 ZIP（带压缩），找出 .md 和图片

// ---------- 1. 代码块 ----------

// 整行只由 `代码片段` 和 ** / * 标记组成，才算飞书的代码碎片行
const isFragmentLine = (s) => {
  const t = s.trim();
  if (!/^(\*{1,2})?`/.test(t)) return false;
  const parts = t.split("`");
  if (parts.length % 2 === 0) return false;
  for (let k = 0; k < parts.length; k += 2) if (!/^[*\s]*$/.test(parts[k])) return false;
  return true;
};

// 只取反引号里的内容，外面的 ** / * 是飞书的加粗斜体标记，丢掉
const fragmentText = (s) => {
  const parts = s.trim().split("`");
  let t = "";
  for (let k = 1; k < parts.length; k += 2) t += parts[k];
  t = t.replace(/\u00a0/g, " ").replace(/\u200b/g, "").replace(/\s+$/, "");
  return /^\s*\.{3,}\s*$/.test(t) ? "// ......" : t;
};

const looksLikeCode = (lines) =>
  lines.length > 1 || /[;{}()=]/.test(lines.join(""));

// 粗略的 C 风格重新缩进：按 { } 计层级，跳过字符串和注释里的括号
export function reindentC(code, unit = "    ") {
  let depth = 0;
  let inBlockComment = false;
  const out = [];
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line) {
      out.push("");
      continue;
    }
    let opens = 0;
    let closes = 0;
    let leadingCloses = 0;
    let seenOther = false;
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const n = line[i + 1];
      if (inBlockComment) {
        if (c === "*" && n === "/") {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (inStr) {
        if (c === "\\") i++;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === "/" && n === "/") break;
      if (c === "/" && n === "*") {
        inBlockComment = true;
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        inStr = c;
        seenOther = true;
        continue;
      }
      if (c === "{") {
        opens++;
        seenOther = true;
      } else if (c === "}") {
        closes++;
        if (!seenOther) leadingCloses++;
      } else if (!/\s/.test(c)) seenOther = true;
    }
    const here = Math.max(0, depth - leadingCloses);
    out.push(unit.repeat(here) + line);
    depth = Math.max(0, depth + opens - closes);
  }
  return out.join("\n");
}

// 宏、预处理指令顶格；其余交给 reindentC
const formatCode = (lines) => {
  const code = lines
    .join("\n")
    .replace(/^\n+|\n+$/g, "")
    .replace(/\n{3,}/g, "\n\n");
  return reindentC(code).replace(/^\s+(#\s*(?:include|define|if|ifdef|ifndef|else|elif|endif|pragma)\b)/gm, "$1");
};

export function rebuildCodeBlocks(md) {
  const lines = md.split("\n");
  const out = [];
  let inFence = false;
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (/^\s*```\s*[\w+-]*\s*$/.test(line)) {
      inFence = !inFence;
      out.push(line);
      i++;
      continue;
    }
    if (inFence || !isFragmentLine(line)) {
      out.push(line);
      i++;
      continue;
    }
    // 收集连续的碎片行，中间最多容忍 2 个空行
    const block = [];
    let j = i;
    while (j < lines.length) {
      if (isFragmentLine(lines[j])) {
        block.push(lines[j]);
        j++;
        continue;
      }
      if (!lines[j].trim()) {
        let k = j;
        while (k < lines.length && !lines[k].trim() && k - j < 2) k++;
        if (k < lines.length && isFragmentLine(lines[k])) {
          j = k;
          continue;
        }
      }
      break;
    }
    const code = block.map(fragmentText);
    let caption = null;
    if (code.length && /^文件[：:]/.test(code[0].trim())) caption = code.shift().trim();
    if (!looksLikeCode(code)) {
      out.push(...lines.slice(i, j));
    } else {
      if (caption) out.push(`**${caption}**`, "");
      out.push("```c", formatCode(code), "```");
    }
    i = j;
  }
  return out.join("\n");
}

// ---------- 2. 反斜杠转义 ----------

// 渲染器不认反斜杠转义，飞书又爱给 . ( ) - 等加反斜杠；代码块里的不动
export function unescapeMarkdown(md) {
  let inFence = false;
  return md
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line
        .split(/(`[^`]*`)/)
        .map((seg, k) =>
          k % 2 ? seg : seg.replace(/\\([.()\-+!#{}<>=_~|:;'"%&,?@$^\\])/g, "$1"),
        )
        .join("");
    })
    .join("\n");
}

export function cleanImportedMarkdown(md) {
  let s = String(md || "").replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  s = rebuildCodeBlocks(s);
  s = unescapeMarkdown(s);
  s = s.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
  return s.trim() + "\n";
}

// ---------- 3. 按图片切块 ----------

// 返回 [{type:'markdown', text}, {type:'image', src, alt}, ...]
export function splitByImages(md) {
  const parts = [];
  let buf = [];
  let inFence = false;
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) parts.push({ type: "markdown", text });
    buf = [];
  };
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const m = !inFence && line.match(/^\s*!\[([^\]]*)\]\(\s*<?([^)>]+?)>?\s*\)\s*$/);
    if (m && !/^(https?:|data:)/i.test(m[2])) {
      flush();
      parts.push({ type: "image", src: m[2], alt: m[1] });
    } else buf.push(line);
  }
  flush();
  return parts;
}

export const imageKey = (src) => {
  let s = String(src || "").split(/[?#]/)[0];
  try {
    s = decodeURIComponent(s);
  } catch {
    /* 保持原样 */
  }
  return s.replace(/\\/g, "/").replace(/^\.\//, "").normalize("NFC");
};

// ---------- 4. 通用 ZIP 读取（支持 deflate） ----------

const MAX_ZIP_TOTAL = 80 * 1024 * 1024;

async function inflateRaw(data) {
  if (typeof DecompressionStream === "undefined")
    throw Error("当前浏览器不支持解压 ZIP，请换新版 Chrome / Edge，或先解压再导入。");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// 从中央目录读（本地头里的大小在流式压缩时可能是 0）
export async function readAnyZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw Error("不是有效的 ZIP 文件。");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  if (count > 400) throw Error("ZIP 里文件太多。");
  const files = [];
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw Error("ZIP 目录已损坏。");
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nl = v.getUint16(p + 28, true);
    const el = v.getUint16(p + 30, true);
    const cl = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nameBytes = bytes.subarray(p + 46, p + 46 + nl);
    let name;
    try {
      name = new TextDecoder(flags & 0x800 ? "utf-8" : "utf-8", { fatal: true }).decode(nameBytes);
    } catch {
      name = new TextDecoder("gb18030").decode(nameBytes); // Windows 自带压缩常用 GBK
    }
    p += 46 + nl + el + cl;
    name = name.replace(/\\/g, "/").normalize("NFC");
    if (name.endsWith("/")) continue;
    if (name.startsWith("/") || name.split("/").some((s) => s === ".." || s === ""))
      throw Error("ZIP 里有不安全的路径。");
    if (name.startsWith("__MACOSX/") || /(^|\/)\.DS_Store$/.test(name)) continue;
    if (flags & 1) throw Error("不支持加密的 ZIP。");
    total += usize;
    if (total > MAX_ZIP_TOTAL) throw Error("ZIP 解压后超过 80MB。");
    const lnl = v.getUint16(local + 26, true);
    const lel = v.getUint16(local + 28, true);
    const start = local + 30 + lnl + lel;
    const raw = bytes.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflateRaw(raw);
    else throw Error(`ZIP 里的 ${name} 用了不支持的压缩方式。`);
    files.push({ path: name, bytes: data });
  }
  return files;
}

const dirOf = (path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "");

// 从解压结果里挑出 Markdown 和它引用的图片
export function pickMarkdownBundle(files) {
  const mds = files.filter((f) => /\.(md|markdown)$/i.test(f.path));
  const images = new Map();
  for (const f of files)
    if (/\.(png|jpe?g|webp|gif)$/i.test(f.path)) images.set(imageKey(f.path), f);
  return mds.map((md) => {
    const dir = dirOf(md.path);
    const find = (src) => {
      const key = imageKey(src);
      return images.get(imageKey(dir + key)) || images.get(key) || null;
    };
    return { path: md.path, bytes: md.bytes, findImage: find };
  });
}
