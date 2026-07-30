# Excel Tech — Website Integration Guide

**For the exceltech.com.bd developer.** Prepared by Excel Tech.

## Goal — stop double data entry

The **Excel Tech POS** (`https://exceltechpos.netlify.app`) is now the **single source of truth** for products and stock. Instead of the owner re-adding products/stock on exceltech.com.bd by hand, the website should **read** products and **live stock** from the POS's public API below.

Result: the owner adds or sells a product in the POS once, and **exceltech.com.bd reflects it automatically** — no manual copying, and stock stays in sync on every sale.

All endpoints are **read-only, public (no auth), CORS-enabled, and free**.

---

## 1) Product catalog

```
GET https://exceltechpos.netlify.app/api/public/products
GET https://exceltechpos.netlify.app/api/public/products?slug=<product-slug>   # one product
```

Returns all **published** products with variants, prices, live stock, image, and description:

```json
{
  "products": [
    {
      "id": "clx123",
      "name": "iPhone 15 Clear Case",
      "slug": "iphone-15-clear-case",
      "type": "STANDARD",
      "brand": "Apple",
      "category": "Cover",
      "warranty": null,
      "description": "Slim transparent case…",
      "imageUrl": "https://…",
      "variants": [
        {
          "id": "clv456",
          "sku": "CASE-IP15-CLR",
          "barcode": null,
          "color": "Clear",
          "size": null,
          "price": 450,
          "mrp": 600,
          "stock": 12,
          "inStock": true
        }
      ]
    }
  ],
  "count": 1,
  "updatedAt": "2026-07-31T09:00:00.000Z"
}
```

- **`price`** = customer price in BDT (online price if set, otherwise retail).
- **`stock`** = live quantity (phones counted by IMEI in stock; accessories by quantity).
- **`sku`** = the stable, unique identifier per variant — use this as your product key.
- Only products the owner has **published** in the POS appear here.

## 2) Live stock (lightweight)

For frequent checks without re-fetching the whole catalog (e.g. refreshing availability, or verifying at checkout):

```
GET  https://exceltechpos.netlify.app/api/public/stock                  # all published
GET  https://exceltechpos.netlify.app/api/public/stock?skus=SKU1,SKU2
POST https://exceltechpos.netlify.app/api/public/stock   { "skus": ["SKU1","SKU2"] }
```

```json
{ "stock": { "CASE-IP15-CLR": 12, "CHRG-SAMS-25W": 0 }, "updatedAt": "…" }
```

---

## How to integrate (custom site)

1. **Product pages** — fetch data from `GET /api/public/products` (server-side is best; cache ~15–60s). Render name, image, description, price, and variants.
2. **Identify products by `sku`** (unique per variant).
3. **Availability** — show/hide "Out of stock" using `stock` / `inStock` (out of stock when `stock === 0`).
4. **Checkout** — re-check `GET /api/public/stock?skus=…` right before placing an order to avoid overselling.
5. **Images & descriptions** come from the POS (`imageUrl`, `description`). If some POS products lack an image, the owner adds it in the POS — that's the one place to maintain them now.

> The website no longer needs its own product/stock database for catalog display — the POS provides it. (You can keep your own tables for anything the POS doesn't cover, e.g. banners, blog, SEO text.)

---

## 3) Search demand tracking (optional but recommended)

So the owner gets a daily report of what customers search on exceltech.com.bd (including searches that returned nothing = what to stock). Add this before `</body>`. It only records a search term — it changes nothing visible and cannot break the site.

```html
<script>
(function () {
  var ENDPOINT = "https://exceltechpos.netlify.app/api/track/search";
  function track(q, results) {
    if (!q || String(q).trim().length < 2) return;
    try {
      navigator.sendBeacon(ENDPOINT, JSON.stringify({
        q: String(q).trim(),
        results: (typeof results === "number" ? results : -1)
      }));
    } catch (e) {}
  }
  window.ExcelTrack = track; // call ExcelTrack(term, resultCount) from your search code
  document.addEventListener("submit", function (e) {
    try {
      var i = e.target.querySelector('input[type=search],input[name=q],input[name=s],input[name=search],input[name=keyword]');
      if (i && i.value) track(i.value, -1);
    } catch (err) {}
  }, true);
})();
</script>
```

**Best:** call `ExcelTrack(term, numberOfResults)` right after your search returns, passing the number of results — that lets the owner see "searched but found nothing," the most useful signal.

---

## 4) AI chat assistant on the site

Add an AI chat bubble (bottom-right) powered by the same assistant as the shop's Messenger/website — it answers product, price, stock, and budget questions, suggests products, and can take orders. **One line**, before `</body>`:

```html
<script src="https://exceltechpos.netlify.app/chat-embed.js" defer></script>
```

Optional customisation — put this **before** the script tag:

```html
<script>
  window.ExcelChatConfig = {
    title: "Excel Tech Assistant",
    subtitle: "Ask about products, price & stock",
    greeting: "Assalamu alaikum! Ask me about any product, price, or stock.",
    brandColor: "#026a40"
  };
</script>
```

The widget is self-contained (no libraries), namespaced (`.etc-` CSS classes, won't clash with the site), and calls `POST /api/shop/agent` (CORS-enabled). Nothing else to wire up.

---

## Notes

- No API keys/secrets are required for these read-only endpoints.
- CORS is open (`*`); it can be locked to `exceltech.com.bd` on request.
- Questions about the API → contact Excel Tech.
