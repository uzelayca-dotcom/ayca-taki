# Ayça Takı — Statik Vitrin Sitesi

El yapımı gümüş takılar için sade, statik bir vitrin/katalog sitesi. Sipariş ve
iletişim WhatsApp üzerinden yürür. Kurulum gerektirmez — saf HTML/CSS/JS.

## Nasıl açılır?

En kolayı: `index.html` dosyasına çift tıklayın, tarayıcıda açılır.

Yerel sunucu ile (önerilir, görsel yolları daha sağlıklı çalışır):

```bash
cd websitem
python3 -m http.server 8000
# Tarayıcıda: http://localhost:8000
```

## Dosya yapısı

```
websitem/
├── index.html        # Sayfanın tüm bölümleri
├── css/style.css     # Tasarım / renkler
├── js/main.js        # Ürünler + iletişim bilgileri burada
└── images/           # Ürün fotoğrafları
```

## Düzenleme rehberi

Çoğu değişiklik **`js/main.js`** dosyasının en üstünden yapılır:

- **WhatsApp numarası** — `WHATSAPP` satırı (ülke kodu + numara, boşluksuz; TR: `90...`).
- **Ürünler** — `PRODUCTS` listesi. Yeni ürün eklemek için listeye bir satır ekleyin;
  silmek için satırı kaldırın. Her ürünün alanları:
  - `cat`: kategori (`yuzuk` / `kolye` / `kupe` / `bileklik`) — galeri filtresi buna göre çalışır.
  - `image`: `images/` klasöründeki dosya yolu (boş bırakılırsa yer tutucu ikon gösterilir).
- **Kategoriler** — `CATEGORIES` listesi. Filtre butonlarının adlarını buradan değiştirebilirsiniz.

Metinler (başlık, "Hakkımda" yazısı, "Kargo & Teslimat" bilgileri, "Müşteri Yorumları")
**`index.html`** içinden; renkler **`css/style.css`** içindeki en üstteki `:root`
değişkenlerinden değiştirilir.

## Yayınlama

Tamamen statik olduğu için ücretsiz servislerle yayınlanabilir:

- **GitHub Pages** — repoyu yükleyin, Settings → Pages bölümünden yayınlayın.
- **Netlify / Vercel** — klasörü sürükle-bırak yapın.

## Notlar

Bu site online ödeme içermez (vitrin/katalog). İleride sepet ve ödeme istenirse
Shopify gibi bir e-ticaret servisi ayrı bir adım olarak eklenebilir.
