// 极简 C/C++ 代码高亮：只分注释、字符串、关键字、数字、函数调用、宏/常量几类，不引第三方库。
// 返回 [{t: 类别或"", v: 文本}]，由渲染器包成 <span>，不拼 HTML，避免注入。

const KEYWORDS = new Set(
  (
    "auto break case char const continue default do double else enum extern float for goto if inline int long " +
    "register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while " +
    "bool true false NULL nullptr class public private protected namespace using template typename new delete this " +
    "uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t size_t " +
    "BaseType_t UBaseType_t TickType_t TaskHandle_t QueueHandle_t SemaphoreHandle_t StackType_t"
  ).split(" "),
);

export const HIGHLIGHT_LANGS = new Set(["c", "cpp", "c++", "h", "hpp", "cc", "arduino", "ino"]);

const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#[ \t]*\w+)|(\b0[xX][0-9a-fA-F]+[uUlL]*\b|\b\d+(?:\.\d+)?[uUlLfF]*\b)|(\b[A-Za-z_]\w*\b)/gm;

export function highlightC(code) {
  const out = [];
  let last = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code)) !== null) {
    if (m.index > last) out.push({ t: "", v: code.slice(last, m.index) });
    const v = m[0];
    let t = "";
    if (m[1]) t = "com";
    else if (m[2]) t = "str";
    else if (m[3]) t = "pre";
    else if (m[4]) t = "num";
    else if (KEYWORDS.has(v)) t = "kw";
    else if (/^\s*\(/.test(code.slice(m.index + v.length))) t = "fn";
    else if (/^[A-Z][A-Z0-9_]{2,}$/.test(v)) t = "mac";
    out.push({ t, v });
    last = m.index + v.length;
  }
  if (last < code.length) out.push({ t: "", v: code.slice(last) });
  return out;
}
