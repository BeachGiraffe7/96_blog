// Parse and edit the exact same blocks. Comment examples must never become entries.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const normText = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim();
const withoutComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");
function momentBlocks(raw) {
  const source = String(raw || "");
  // Keep byte/character positions and line breaks while hiding commented headings.
  const mask = source.replace(/<!--[\s\S]*?-->/g, (c) =>
    c.replace(/[^\r\n]/g, " "),
  );
  const headings = [...mask.matchAll(/^##[ \t]+[^\r\n]*/gm)];
  return headings.map((h, i) => {
    const start = h.index,
      end = headings[i + 1]?.index ?? source.length;
    const block = withoutComments(source.slice(start, end));
    const lines = block.split(/\r?\n/);
    const [date, mood] = lines
      .shift()
      .replace(/^##\s+/, "")
      .trim()
      .split("|")
      .map((s) => s.trim());
    return {
      start,
      end,
      date,
      mood: mood || "平静",
      text: normText(lines.join(" ")),
    };
  });
}
export function parseMoments(raw) {
  return momentBlocks(raw)
    .filter((m) => DATE_RE.test(m.date) && m.text)
    .map(({ date, mood, text }) => ({ date, mood, text }));
}
export const momentKey = (m) =>
  JSON.stringify([m.date, m.mood || "平静", normText(m.text)]);
export function removeMomentBlock(raw, target) {
  const source = String(raw || "");
  const hits = momentBlocks(source).filter(
    (m) =>
      m.date === target.date &&
      normText(m.text) === normText(target.text) &&
      (!target.mood || m.mood === target.mood),
  );
  if (!hits.length) return null;
  if (hits.length > 1)
    throw new Error(
      "发现内容完全相同的重复碎碎念，请在仓库核对后再删除，避免删错。",
    );
  const { start, end } = hits[0];
  return source.slice(0, start) + source.slice(end);
}
