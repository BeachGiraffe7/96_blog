import React from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import Markdown from "../../components/article/Markdown";
import {
  escapeHTML as esc,
  assetPath,
  articleManifest,
  sandboxHTML,
} from "./article";
import { zipFiles } from "./zip";
const b64 = (bytes) => {
  let s = "";
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 32768)
    s += String.fromCharCode(...b.subarray(i, i + 32768));
  return btoa(s);
};
const css = `*{box-sizing:border-box}body{margin:0;background:#fbf8f7;color:#302d32;font:16px/1.8 system-ui,-apple-system,'Noto Sans SC',sans-serif}main{max-width:1000px;margin:auto;padding:48px 24px}header{border-bottom:1px solid #e4dfe2;padding-bottom:24px;margin-bottom:32px}h1{font-size:34px;line-height:1.25;overflow-wrap:anywhere}h2{font-size:25px;margin:28px 0 12px}h3{font-size:20px}.meta,.muted{color:#68616b;font-size:14px}section{margin:28px 0}.module{border:1px solid #ded8dd;border-radius:12px;background:white;overflow:hidden}.bar{display:flex;gap:12px;justify-content:space-between;align-items:center;padding:12px 18px;background:#f7f3f5;flex-wrap:wrap}.bar a{font-size:14px}iframe{width:100%;border:0;display:block}.pdf{height:680px}.start{padding:36px;text-align:center}.start p{font-size:14px;color:#68616b}button{min-height:44px;padding:10px 20px;border-radius:8px;border:1px solid #a64b68;background:#a64b68;color:white;font:inherit;cursor:pointer}a{color:#8c3c59;overflow-wrap:anywhere}img{max-width:100%;height:auto}pre{overflow:auto;background:#23252a;color:#fff;padding:20px;border-radius:8px}code{font-family:Consolas,monospace}blockquote{border-left:3px solid #b07188;padding:8px 18px;background:#f7eff3;margin-left:0}.md-table-wrap{overflow:auto}table{border-collapse:collapse;min-width:300px;width:100%}td,th{padding:8px 12px;border:1px solid #ddd}.md-figure{margin:20px 0}figcaption{font-size:14px;color:#68616b}footer{font-size:14px;color:#68616b;border-top:1px solid #ddd;padding-top:20px;margin-top:40px}@media(max-width:600px){main{padding:28px 18px}h1{font-size:28px}.pdf{height:480px}.start{padding:24px 18px}}@media(prefers-color-scheme:dark){body{background:#191919;color:#f5f2f5}.module{background:#222;border-color:#555}.bar{background:#2b272b}.meta,.muted,.start p,footer{color:#c7c0c7}a{color:#e7a2be}blockquote{background:#30252c}}`;
export function exportArticle(doc, assets) {
  const manifest = articleManifest(doc, assets),
    imageURLs = Object.fromEntries(
      Object.values(assets)
        .filter((a) => a.type === "image")
        .map((a) => [a.id, `data:${a.mime};base64,${b64(a.bytes)}`]),
    );
  const sections = doc.blocks
    .map((b) => {
      const a = assets[b.assetId];
      if (b.type === "markdown")
        return `<section>${renderToStaticMarkup(<Markdown source={b.text} idPrefix={b.id + "-"} />)}</section>`;
      if (!a) return "";
      const path = assetPath(a),
        id = `asset-${a.id}`;
      if (b.type === "image")
        return `<section id="${id}"><figure><img src="${esc(path)}" alt="${esc(b.alt || a.name)}"><figcaption>${esc(b.alt || "")}</figcaption></figure></section>`;
      const title = esc(b.title || a.name);
      if (b.type === "pdf")
        return `<section id="${id}" class="module" data-asset-id="${a.id}"><div class="bar"><strong>${title}</strong><a href="${esc(path)}" download="${esc(a.name)}">下载PDF</a></div><iframe title="${title}" class="pdf" src="${esc(path)}#page=${b.page || 1}" loading="lazy"></iframe><p class="muted" style="padding:0 18px">若浏览器不显示PDF，请使用下载按钮。</p></section>`;
      const html = sandboxHTML(a, assets, imageURLs);
      return `<section id="${id}" class="module" data-asset-id="${a.id}"><div class="bar"><strong>${title}</strong><a href="${esc(path)}" download="${esc(a.name)}">下载原网页</a></div><div class="start"><h3>交互实验模块</h3><p>隔离运行；阻止网络请求、外部资源加载和弹窗。本机存储可能受限，可导出实验记录。</p><button class="start-module">启用交互</button></div><iframe title="${title}" data-srcdoc="${esc(html)}" sandbox="allow-scripts allow-downloads" referrerpolicy="no-referrer" hidden style="display:none;height:720px"></iframe></section>`;
    })
    .join("\n");
  const script = `document.querySelectorAll('.start-module').forEach(b=>b.onclick=()=>{const box=b.closest('section'),f=box.querySelector('iframe');f.srcdoc=f.dataset.srcdoc;f.hidden=false;f.style.display='block';box.querySelector('.start').hidden=true});addEventListener('message',e=>{const f=[...document.querySelectorAll('iframe[data-srcdoc]')].find(x=>x.contentWindow===e.source);if(!f||e.data?.channel!=='article-module-v1')return;if(e.data.type==='resize'&&Number.isFinite(e.data.height))f.style.height=Math.max(360,Math.min(1800,e.data.height))+'px';if(e.data.type==='asset'){const box=[...document.querySelectorAll('[data-asset-id]')].find(x=>x.dataset.assetId===e.data.id);if(!box)return;const pdf=box.querySelector('iframe.pdf');if(pdf){const p=Math.max(1,Math.min(10000,Number(e.data.page)||1));const next=pdf.cloneNode();next.src=pdf.src.split('#')[0]+'#page='+p;pdf.replaceWith(next)}box.scrollIntoView({behavior:'smooth',block:'start'})}});`;
  const index = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(doc.meta.title)}</title><style>${css}</style><body><main><header><p class="meta">${esc([doc.meta.category, doc.meta.series].filter(Boolean).join(" / "))}</p><h1>${esc(doc.meta.title)}</h1>${doc.meta.excerpt ? `<p>${esc(doc.meta.excerpt)}</p>` : ""}<p class="meta">${esc(doc.meta.tags || "")}</p></header>${sections}<footer>正文、PDF与交互模块属于同一篇文章。HTML脚本仅在隔离框架中按需运行。</footer></main><script>${script}</script></body></html>`;
  const md =
    `# ${doc.meta.title}\n\n` +
    doc.blocks
      .map((b) =>
        b.type === "markdown"
          ? b.text
          : `[${b.title || assets[b.assetId]?.name || "附件"}](${assets[b.assetId] ? assetPath(assets[b.assetId]) : ""})`,
      )
      .join("\n\n");
  const guide = `# 发布包说明\n\n打开 index.html 查看整篇文章。保持 assets 文件夹与 index.html 同级。部分浏览器对本地PDF内嵌有限制，可下载PDF，或通过静态服务器预览。\n\n- article.json：v1结构化正文与附件清单，供宿主编辑器接入。\n- article.md：纯Markdown降级备份，附件为链接；不保留内嵌交互。\n- assets：原始附件。HTML加.txt后缀，避免在同源站点被当页面直接执行。\n\n此包不包含登录、上传API或GitHub发布凭据。导出成功不等于线上发布成功。线上请使用独立附件域、正确MIME、内容安全策略与原子提交。\n`;
  const entries = [
    ["index.html", index],
    ["article.json", JSON.stringify(manifest, null, 2)],
    ["article.md", md],
    ["发布说明.md", guide],
    ...Object.values(assets).map((a) => [assetPath(a), a.bytes]),
  ];
  return zipFiles(entries);
}
