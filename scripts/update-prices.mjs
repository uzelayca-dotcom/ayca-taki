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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "ayca-taki-price-bot" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function withRetry(fn, tries = 3, delayMs = 2500) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.log(`  deneme ${i}/${tries} başarısız: ${e.message}`);
      if (i < tries) await sleep(delayMs);
    }
  }
  throw lastErr;
}

// Birincil kaynak: truncgil (TR biçimli gram gümüş)
async function truncgilGram(cfg) {
  const src = cfg.gumusKaynak;
  const data = await getJson(src.url);
  const raw = data?.[src.anahtar]?.[src.alan];
  if (raw == null) throw new Error(`'${src.anahtar}.${src.alan}' yok`);
  const g = parseFloat(String(raw).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(g)) throw new Error(`çözümlenemedi: ${raw}`);
  return g;
}

// Yedek kaynak: XAG (USD/ons) × USD/TRY -> gram gümüş TL
async function metalsFxGram() {
  const [xag, fx] = await Promise.all([
    getJson("https://api.gold-api.com/price/XAG"),
    getJson("https://open.er-api.com/v6/latest/USD"),
  ]);
  const usdPerOz = xag?.price;
  const usdTry = fx?.rates?.TRY;
  if (!usdPerOz || !usdTry) throw new Error("XAG veya USD/TRY eksik");
  return (usdPerOz / 31.1035) * usdTry;
}

async function fetchGram(cfg) {
  const sim = process.env.SIMULATE_GRAM;
  if (sim) {
    const g = parseFloat(sim);
    console.log(`(SIMULATE_GRAM) gram gümüş = ${g} TL`);
    return g;
  }
  const { makulMin, makulMax } = cfg.gumusKaynak;
  const sources = [
    { name: "truncgil", run: () => truncgilGram(cfg) },
    { name: "gold-api+er-api", run: () => metalsFxGram() },
  ];
  for (const s of sources) {
    try {
      const g = await withRetry(s.run);
      if (g >= makulMin && g <= makulMax) {
        console.log(`Kaynak: ${s.name} → ${g.toFixed(2)} TL/g`);
        return g;
      }
      console.log(`  ${s.name} makul aralık dışında (${g}), sonraki kaynağa geçiliyor`);
    } catch (e) {
      console.log(`  ${s.name} tümüyle başarısız (${e.message}), sonraki kaynağa geçiliyor`);
    }
  }
  throw new Error("Tüm gümüş kaynakları başarısız");
}

function computeNew(p, gram, cfg) {
  const ek = cfg.ekMaliyetler ? Object.values(cfg.ekMaliyetler).reduce((a, b) => a + b, 0) : 0;
  const vergi = cfg.vergiOran || 0;
  const candidate = round50((p.gramaj * gram * p.katsayi + cfg.kargo + ek) / (1 - vergi));
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
