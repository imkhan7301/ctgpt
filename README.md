# GPT → Shopify (Vercel Serverless)

Create Shopify products directly from GPT (or any client) by calling a single HTTPS endpoint.

## One-time Setup (10 minutes)

1. **Create a Custom App in Shopify Admin**
   - Shopify Admin → Apps → Develop apps → Create app.
   - Configure Admin API scopes:
     - `write_products`, `read_products`
     - `read_locations`
     - `write_inventory`, `read_inventory`
   - Install the app and copy the **Admin API access token**.

2. **Deploy to Vercel**
   - Install Vercel CLI: `npm i -g vercel`
   - `vercel login`
   - `vercel`
   - When prompted, select this folder.

3. **Add Environment Variables (Vercel → Settings → Environment Variables)**
   - `SHOPIFY_STORE` → e.g. `chickentoday.myshopify.com`
   - `SHOPIFY_ADMIN_TOKEN` → Admin API access token from step 1
   - `CT_SHARED_SECRET` → a long random string only you know
   - (optional) `SHOPIFY_API_VERSION` → default `2024-10`

4. **Protect the endpoint**
   - Calls must include header: `X-CT-Auth: <your CT_SHARED_SECRET>`

## Call It

`POST https://<your-vercel-deployment>/api/create-product`

**Headers**
- `Content-Type: application/json`
- `X-CT-Auth: <your CT_SHARED_SECRET>`

**Body (example)**
```json
{
  "title": "Fresh Halal Whole Chicken — Same-Day",
  "body_html": "<p>Same-day fresh, halal. Never frozen. Eco-friendly pack.</p>",
  "vendor": "ChickenToday",
  "product_type": "Poultry",
  "tags": ["halal","fresh","same-day","chicken"],
  "images": [
    { "src": "https://example.com/chicken.jpg", "alt": "Fresh halal chicken" }
  ],
  "variants": [{
    "price": "24.99",
    "sku": "CT-WHOLE-CHICKEN-001",
    "inventory_quantity": 25,
    "requires_shipping": true,
    "taxable": true,
    "weight": 3.25,
    "weight_unit": "lb",
    "cost": "15.00"
  }]
}
```

**Response**
```json
{
  "ok": true,
  "product": {
    "id": 1234567890,
    "title": "Fresh Halal Whole Chicken — Same-Day",
    "handle": "fresh-halal-whole-chicken-same-day",
    "status": "active",
    "admin_url": "https://chickentoday.myshopify.com/admin/products/1234567890"
  }
}
```

## Use with GPT
Once deployed, you can give GPT the endpoint + secret and then simply say:
> "Create a product titled 'Fresh Halal Thighs — 2 lb Pack' at $12.99, cost $15 base per chicken is a separate metric, inventory 40, add tags 'halal,fresh,thighs', and this image URL: ..."

GPT can then format the JSON and (via a connected action or your curl) hit the endpoint, and the product will appear in Shopify immediately.

## Notes
- Inventory is set at your store's *primary active location* automatically.
- Costs are written to the Inventory Item for each variant when provided.
- For multiple variants (e.g., weights), add more objects in `variants`.
- This REST approach keeps things simple; you can switch to GraphQL later if you prefer.
