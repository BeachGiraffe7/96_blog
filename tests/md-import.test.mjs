import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import {
  cleanImportedMarkdown,
  splitByImages,
  reindentC,
  readAnyZip,
  pickMarkdownBundle,
} from "../src/lib/mdImport.js";
import { highlightC } from "../src/lib/article/highlight.js";

const FEISHU = [
  "# 2\\.1 FreeRTOS总图",
  "",
  "调用 vTaskStartScheduler\\(\\) 启动调度器：",
  "",
  "**`int `****`main`**`(`**`void`**`)`",
  "",
  "`{`",
  "",
  "```//先创建任务`",
  "",
  "`int ``*``arr ``= ``NULL``;`",
  "",
  "``**`while`**` (1)`",
  "",
  "`{`",
  "",
  "`}`",
  "",
  "`}`",
  "",
  "后面的正文 `inline` 不应变成代码块。",
  "",
  "![image\\.png](图片和附件/image%201.png)",
  "",
  "结尾",
].join("\n");

test("飞书代码碎片拼回带缩进的 C 代码块，指针星号保留", () => {
  const md = cleanImportedMarkdown(FEISHU);
  assert.match(md, /^# 2\.1 FreeRTOS总图/);
  assert.match(md, /vTaskStartScheduler\(\)/);
  assert.match(
    md,
    /```c\nint main\(void\)\n\{\n    \/\/先创建任务\n    int \*arr = NULL;\n    while \(1\)\n    \{\n    \}\n\}\n```/,
  );
  assert.match(md, /后面的正文 `inline` 不应变成代码块。/);
});

test("按独立图片行切块，图片路径保留给配对", () => {
  const parts = splitByImages(cleanImportedMarkdown(FEISHU));
  const img = parts.find((p) => p.type === "image");
  assert.equal(img.src, "图片和附件/image%201.png");
  assert.equal(parts.at(-1).text, "结尾");
});

test("代码块里的图片语法不会被切走", () => {
  const parts = splitByImages("```md\n![a](b.png)\n```");
  assert.equal(parts.length, 1);
});

test("reindentC 忽略字符串和注释里的大括号", () => {
  assert.equal(
    reindentC('if (a) {\nputs("{");\n// }\n}'),
    'if (a) {\n    puts("{");\n    // }\n}',
  );
});

function makeZip(entries) {
  const enc = new TextEncoder();
  const locals = [], central = [];
  let off = 0;
  for (const [name, data, deflate] of entries) {
    const nb = enc.encode(name);
    const body = deflate ? deflateRawSync(data) : data;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(deflate ? 8 : 0, 8);
    lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(deflate ? 8 : 0, 10);
    ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28);
    ch.writeUInt32LE(off, 42);
    locals.push(lh, nb, body); central.push(ch, nb);
    off += 30 + nb.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}

test("读取带压缩的飞书导出 ZIP 并配对图片", async () => {
  const png = Buffer.from([137, 80, 78, 71, 1, 2, 3]);
  const zip = makeZip([
    ["笔记/2.1 总图.md", Buffer.from("![x](图片和附件/image%201.png)"), true],
    ["笔记/图片和附件/image 1.png", png, true],
    ["__MACOSX/._junk", Buffer.from("x"), false],
  ]);
  const files = await readAnyZip(zip);
  assert.equal(files.length, 2);
  const [b] = pickMarkdownBundle(files);
  const hit = b.findImage("图片和附件/image%201.png");
  assert.deepEqual([...hit.bytes], [...png]);
});

test("ZIP 拒绝目录穿越", async () => {
  const zip = makeZip([["../evil.md", Buffer.from("x"), false]]);
  await assert.rejects(readAnyZip(zip), /不安全/);
});

test("C 高亮分出关键字、函数、注释、字符串", () => {
  const tk = highlightC('int main(void) { puts("hi"); // c\n}');
  const kinds = Object.fromEntries(tk.filter((t) => t.t).map((t) => [t.v, t.t]));
  assert.equal(kinds.int, "kw");
  assert.equal(kinds.main, "fn");
  assert.equal(kinds['"hi"'], "str");
  assert.equal(kinds["// c"], "com");
});
