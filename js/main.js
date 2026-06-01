/* ===== Ayça Takı — site etkileşimleri ===== */

/* ----------------------------------------------------------------
   1) İLETİŞİM — WhatsApp numaranızı buradan değiştirin
      (ülke kodu + numara, boşluksuz; TR: baştaki 0 olmadan 90...)
   ---------------------------------------------------------------- */
const WHATSAPP = "905352370710";

/* ----------------------------------------------------------------
   2) KATEGORİLER — galeri filtre butonları bu listeden üretilir.
      key: ürünlerde kullanılan etiket · label: ekranda görünen ad
   ---------------------------------------------------------------- */
const CATEGORIES = [
  { key: "yuzuk",    label: "Yüzük" },
  { key: "kolye",    label: "Kolye" },
  { key: "kupe",     label: "Küpe" },
  { key: "bileklik", label: "Bileklik & Halhal" },
];

/* ----------------------------------------------------------------
   3) ÜRÜNLER — yeni ürün eklemek için listeye satır ekleyin.
      cat:   yukarıdaki kategorilerden biri (yuzuk/kolye/kupe/bileklik)
      image: images/ klasöründeki dosya yolu (boşsa yer tutucu ikon)
   ---------------------------------------------------------------- */
const PRODUCTS = [
  { name: "İnce Bant Yüzük", cat: "yuzuk",    desc: "Günlük kullanım için sade 925 ayar gümüş yüzük.", price: "₺450", image: "" },
  { name: "Taşlı Yüzük",     cat: "yuzuk",    desc: "Doğal taş detaylı, gösterişli tek parça.",         price: "₺980", image: "" },
  { name: "Zincir Kolye",    cat: "kolye",    desc: "Minimal madalyonlu ince gümüş zincir kolye.",      price: "₺780", image: "" },
  { name: "İsimli Kolye",    cat: "kolye",    desc: "İsteğe özel, el yazısı isimli gümüş kolye.",       price: "₺850", image: "" },
  { name: "Damla Küpe",      cat: "kupe",     desc: "El işçiliğiyle şekillenmiş zarif damla küpeler.",  price: "₺620", image: "" },
  { name: "Halka Küpe",      cat: "kupe",     desc: "Hafif ve şık, her kombine uyan halka küpe.",       price: "₺510", image: "" },
  { name: "Örgü Bileklik",   cat: "bileklik", desc: "Elde örülmüş, ayarlanabilir gümüş bileklik.",      price: "₺540", image: "" },
  { name: "İnce Halhal",     cat: "bileklik", desc: "Yazlık kombinler için narin gümüş halhal.",        price: "₺470", image: "" },
];

/* ----------------------------------------------------------------
   Aşağısı otomatik çalışır — düzenlemeye gerek yok.
   ---------------------------------------------------------------- */

function waLink(message) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
}

const catLabel = (key) => (CATEGORIES.find((c) => c.key === key) || {}).label || "";

// Galeriyi oluştur
const grid = document.getElementById("galleryGrid");
if (grid) {
  grid.innerHTML = PRODUCTS.map((p) => {
    const media = p.image
      ? `<div class="product-img"><img src="${p.image}" alt="${p.name}" loading="lazy" /></div>`
      : `<div class="product-img">💍</div>`;
    const msg = `Merhaba! "${p.name}" (${p.price}) ürünüyle ilgileniyorum.`;
    return `
      <article class="product" data-cat="${p.cat}">
        ${media}
        <div class="product-body">
          <span class="product-tag">${catLabel(p.cat)}</span>
          <h3>${p.name}</h3>
          <p class="product-desc">${p.desc}</p>
          <div class="product-foot">
            <span class="product-price">${p.price}</span>
            <a class="wa-btn" target="_blank" rel="noopener" href="${waLink(msg)}">Sipariş İçin Yaz</a>
          </div>
        </div>
      </article>`;
  }).join("");
}

// Kategori filtre butonları
const filters = document.getElementById("filters");
if (filters) {
  const buttons = [{ key: "all", label: "Tümü" }, ...CATEGORIES];
  filters.innerHTML = buttons
    .map((b, i) => `<button class="filter-btn${i === 0 ? " active" : ""}" data-filter="${b.key}">${b.label}</button>`)
    .join("");

  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    const key = btn.getAttribute("data-filter");
    filters.querySelectorAll(".filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".product").forEach((card) => {
      const show = key === "all" || card.getAttribute("data-cat") === key;
      card.style.display = show ? "" : "none";
    });
  });
}

// data-wa taşıyan tüm linkleri WhatsApp'a bağla
document.querySelectorAll("[data-wa]").forEach((el) => {
  const msg = el.getAttribute("data-wa-msg") || "Merhaba!";
  el.setAttribute("href", waLink(msg));
  el.setAttribute("target", "_blank");
  el.setAttribute("rel", "noopener");
});

// Mobil menü aç/kapat
const toggle = document.getElementById("navToggle");
const menu = document.getElementById("navMenu");
if (toggle && menu) {
  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  menu.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      menu.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

// Footer yılı
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
