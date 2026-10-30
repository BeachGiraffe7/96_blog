export function headingGenerator() {
  const seen = new Map();
  return (text) => {
    const base =
      String(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "") || "section";
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}
export function articleToc(doc) {
  const out = [];
  for (const b of doc.blocks) {
    if (b.type !== "markdown") {
      if (b.title) out.push({ level: 2, text: b.title, id: `block-${b.id}` });
      continue;
    }
    let code = false;
    const next = headingGenerator();
    for (const line of b.text.split("\n")) {
      if (line.trim().startsWith("```")) {
        code = !code;
        continue;
      }
      if (code) continue;
      const m = line.match(/^(#{1,6})\s+(.*)$/);
      if (!m) continue;
      const text = m[2].replace(/\s*#*\s*$/, ""),
        level = Math.min(4, Math.max(2, m[1].length)),
        id = b.id + "-" + next(text);
      if (level <= 3) out.push({ level, text: text.replace(/[`*_]/g, ""), id });
    }
  }
  return out;
}
