#!/usr/bin/env node
/**
 * Ayça Takı — otomatik fiyat güncelleyici.
 * Gram gümüş/TL kurunu çeker, her ürünün fiyatını hesaplar ve
 * js/main.js (price) + index.html (JSON-LD offers.price) + pricing.config.json
 * dosyalarını günceller. GitHub Actions ile 2 haftada bir çalışır.
 *
 * Politika: fiyat = round50(gramaj × gram × katsayi + kargo).
 *   - sadeceArtis: gümüş düşerse fiyat sabit kalır (indirim yok).
 *   - artisTavaniOran: tur başına en fazla +%15 artış.
 *
 * Test:
 *   node scripts/update-prices.mjs --dry-run            (yazmadan hesaplar)
 *   SIMULATE_GRAM=95 node scripts/update-prices.mjs --dry-run
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

const round50 = (x) => Math.round(x / 50) * 50;
const trGroup = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function fetchGram(cfg) {
  const sim = process.env.SIMULATE_GRAM;
  if (sim) {
    const g = parseFloat(sim);
    console.log(`(SIMULATE_GRAM) gram gümüş = ${g} TL`);
    return g;
  }
  const src = cfg.gumusKaynak;
  const res = await fetch(src.url, { headers: { "User-Agent": "ayca-taki-price-bot" } });
  if (!res.ok) throw new Error(`Kaynak HTTP ${res.status}`);
  const data = await res.json();
  const raw = data?.[src.anahtar]?.[src.alan];
  if (raw == null) throw new Error(`Kaynakta '${src.anahtar}.${src.alan}' bulunamadı`);
  // TR sayı: "1.234,56" -> 1234.56 ; "84,84" -> 84.84
  const g = parseFloat(String(raw).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(g)) throw new Error(`Kur çözümlenemedi: ${raw}`);
  return g;
}

function computeNew(p, gram, cfg) {
  const candidate = round50(p.gramaj * gram * p.katsayi + cfg.kargo);
  if (candidate <= p.mevcutFiyat) {
    return cfg.sadeceArtis ? p.mevcutFiyat : candidate; // düşürme yalnızca sadeceArtis=false ise
  }
  const cap = round50(p.mevcutFiyat * (1 + cfg.artisTavaniOran));
  return Math.min(candidate, cap);
}

async function main() {
  const cfgPath = join(ROOT, "pricing.config.json");
  const cfg = JSON.parse(await readFile(cfgPath, "utf8"));

  const gram = await fetchGram(cfg);
  const { makulMin, makulMax } = cfg.gumusKaynak;
  if (!(gram >= makulMin && gram <= makulMax)) {
    console.error(`Gram gümüş makul aralık dışında (${gram} ∉ [${makulMin},${makulMax}]). Güncelleme iptal.`);
    process.exit(1);
  }
  console.log(`Gram gümüş: ${gram} TL/g${DRY ? "  [DRY-RUN]" : ""}`);

  const updates = [];
  for (const p of cfg.urunler) {
    const neu = computeNew(p, gram, cfg);
    const changed = neu !== p.mevcutFiyat;
    console.log(`  ${p.id.padEnd(20)} ${String(p.mevcutFiyat).padStart(5)} -> ${String(neu).padStart(5)} ${changed ? "(değişti)" : "(aynı)"}`);
    if (changed) updates.push({ p, neu });
  }

  if (updates.length === 0) {
    console.log("Değişiklik yok. Dosyalar güncellenmedi.");
    return;
  }
  if (DRY) {
    console.log(`[DRY-RUN] ${updates.length} ürün değişecekti; dosyalar yazılmadı.`);
    return;
  }

  // 1) js/main.js — id satırındaki price alanını güncelle
  const mainPath = join(ROOT, "js", "main.js");
  let mainSrc = await readFile(mainPath, "utf8");
  for (const { p, neu } of updates) {
    const line = new RegExp(`(id:\\s*"${reEsc(p.id)}"[^\\n]*?price:\\s*")[^"]*(")`);
    if (!line.test(mainSrc)) throw new Error(`main.js: '${p.id}' için price satırı bulunamadı`);
    mainSrc = mainSrc.replace(line, `$1₺${trGroup(neu)}$2`);
  }
  await writeFile(mainPath, mainSrc);

  // 2) index.html — JSON-LD offers.price (isme göre)
  const htmlPath = join(ROOT, "index.html");
  let html = await readFile(htmlPath, "utf8");
  for (const { p, neu } of updates) {
    const re = new RegExp(`("name":\\s*"${reEsc(p.isim)}"[\\s\\S]*?"price":\\s*")[^"]*(")`);
    if (!re.test(html)) throw new Error(`index.html JSON-LD: '${p.isim}' için price bulunamadı`);
    html = html.replace(re, `$1${neu}$2`);
  }
  await writeFile(htmlPath, html);

  // 3) pricing.config.json — taban fiyatları güncelle
  for (const { p, neu } of updates) p.mevcutFiyat = neu;
  await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + "\n");

  console.log(`${updates.length} ürün güncellendi (main.js, index.html, pricing.config.json).`);
}

main().catch((e) => {
  console.error("HATA:", e.message);
  process.exit(1);
});
