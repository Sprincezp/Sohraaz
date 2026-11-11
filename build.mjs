/**
 * SOHRAAZ — static build (zero dependencies)
 * ==========================================
 * Single source of truth for the site chrome:
 *   partials/header.html  -> injected into every page
 *   partials/footer.html  -> injected into every page
 *   partials/shared.css   -> injected into every page's <style>
 *
 * Pages keep their own body/content; only the marked regions are replaced.
 * Markers in each page:
 *   <!--#region header-->  ... <!--#endregion header-->
 *   <!--#region footer-->  ... <!--#endregion footer-->
 *   <!--#include shared.css-->
 *
 * Usage:  node site-template/build.mjs            (build + report)
 *         node site-template/build.mjs --check    (verify pages are in sync, no write)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const P = (...s) => path.join(here, ...s);
const read = (p) => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s, "utf8");

const PAGES = ["index.html", "sohraaz-full-store-template.html", "sohraaz-story.html"];
const OUT_DIRS = [P("..", "sohraaz-site-upload"), P("..", "sohraaz-repo")];

const headerPartial = read(P("partials", "header.html")).trim();
const footerPartial = read(P("partials", "footer.html")).trim();
const sharedCss = read(P("partials", "shared.css")).trim();

function region(text, name, content) {
  const start = `<!--#region ${name}-->`;
  const end = `<!--#endregion ${name}-->`;
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s === -1 || e === -1) {
    throw new Error(`missing region markers for "${name}"`);
  }
  return text.slice(0, s) + start + "\n" + content + "\n" + end + text.slice(e + end.length);
}

function injectCss(text) {
  const marker = "<!--#include shared.css-->";
  if (!text.includes(marker)) return text;
  return text.replace(marker, `/* ==== shared chrome (build-injected) ==== */\n${sharedCss}`);
}

const checkOnly = process.argv.includes("--check");
let drift = 0;

for (const page of PAGES) {
  const src = read(P(page));
  let out = region(src, "header", headerPartial);
  out = region(out, "footer", footerPartial);
  out = injectCss(out);

  for (const dir of OUT_DIRS) {
    const dest = path.join(dir, page);
    if (checkOnly) {
      const current = fs.existsSync(dest) ? read(dest) : "";
      if (current !== out) {
        drift++;
        console.log(`  DRIFT  ${page}  (${path.basename(dir)} not in sync)`);
      }
    } else {
      write(dest, out);
    }
  }
  console.log(`  built   ${page}  (${(out.length / 1024).toFixed(1)} KB)`);
}

if (checkOnly) {
  console.log(drift === 0 ? "\nAll pages in sync with partials." : `\n${drift} file(s) out of sync — run: node site-template/build.mjs`);
} else {
  console.log(`\nWrote ${PAGES.length} pages x ${OUT_DIRS.length} targets.`);
}
