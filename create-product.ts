// api/create-product.ts
// Vercel serverless function to create Shopify products from GPT.
// Uses Shopify REST Admin API. Handles: product create, images (via URLs), and inventory set at primary location.

import { IncomingMessage, ServerResponse } from "http";

// Helper: read request body
async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req: any, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    // Basic shared-secret guard so only you (or your GPT tool) can call it
    const provided = req.headers["x-ct-auth"];
    const expected = process.env.CT_SHARED_SECRET;
    if (!expected || provided !== expected) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // e.g. chickentoday.myshopify.com
    const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN; // Admin API access token
    const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

    if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Missing SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN env vars" }));
      return;
    }

    const body = await readBody(req);
    // Expected payload shape (minimal):
    // {
    //   "title": "Fresh Halal Whole Chicken — Same-Day",
    //   "body_html": "<p>Same-day fresh, halal...</p>",
    //   "vendor": "ChickenToday",
    //   "product_type": "Poultry",
    //   "tags": ["halal","fresh","same-day","chicken"],
    //   "images": [{"src":"https://.../image1.jpg","alt":"..."}],
    //   "variants": [{
    //      "price":"24.99","sku":"CT-WHOLE-CHICKEN-001","inventory_quantity":25,
    //      "requires_shipping":true,"taxable":true,"weight":3.25,"weight_unit":"lb","cost":"15.00"
    //   }]
    // }

    const {
      title,
      body_html,
      vendor,
      product_type,
      tags,
      images,
      variants
    } = body || {};

    if (!title || !variants || !Array.isArray(variants) || variants.length === 0) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "title and at least one variant are required" }));
      return;
    }

    // 1) Get primary location for inventory
    const locResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/locations.json`, {
      headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN }
    });
    if (!locResp.ok) {
      const t = await locResp.text();
      throw new Error(`Failed to fetch locations: ${locResp.status} ${t}`);
    }
    const locData = await locResp.json();
    const location = (locData?.locations || []).find((l:any) => l.active) || (locData.locations?.[0]);
    if (!location) throw new Error("No Shopify locations found on this store.");
    const location_id = location.id;

    // 2) Create the product (images by URL if provided)
    const productPayload:any = {
      product: {
        title,
        body_html: body_html || "",
        vendor: vendor || "ChickenToday",
        product_type: product_type || "Poultry",
        tags: Array.isArray(tags) ? tags.join(",") : (tags || ""),
        images: images || [],
        variants: variants.map((v:any) => ({
          price: v.price,
          sku: v.sku,
          inventory_management: "shopify",
          requires_shipping: v.requires_shipping !== false,
          taxable: v.taxable !== false,
          weight: v.weight ?? undefined,
          weight_unit: v.weight_unit ?? "lb",
          compare_at_price: v.compare_at_price ?? undefined,
          barcode: v.barcode ?? undefined,
          // 'cost' is managed via InventoryItem cost - REST does not set cost here directly.
          // We'll set inventory and cost after product is created.
        }))
      }
    };

    const prodResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(productPayload)
    });

    const prodText = await prodResp.text();
    if (!prodResp.ok) {
      throw new Error(`Product create failed: ${prodResp.status} ${prodText}`);
    }
    const prodData = JSON.parse(prodText);
    const product = prodData.product;
    const createdVariants = product?.variants || [];

    // 3) Set inventory quantities (and cost) per variant
    // Need inventory_item_id from each created variant.
    for (let i = 0; i < createdVariants.length; i++) {
      const created = createdVariants[i];
      const requested = variants[i];

      if (typeof requested?.inventory_quantity === "number") {
        const invSetResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/inventory_levels/set.json`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            location_id,
            inventory_item_id: created.inventory_item_id,
            available: requested.inventory_quantity
          })
        });
        if (!invSetResp.ok) {
          const t = await invSetResp.text();
          console.warn("Inventory set failed", t);
        }
      }

      // Set cost on inventory item if provided (requires cost field via InventoryItem API)
      if (requested?.cost) {
        const invItemResp = await fetch(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/inventory_items/${created.inventory_item_id}.json`, {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ inventory_item: { id: created.inventory_item_id, cost: requested.cost } })
        });
        if (!invItemResp.ok) {
          const t = await invItemResp.text();
          console.warn("Setting cost failed", t);
        }
      }
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      ok: true,
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        admin_url: `https://${SHOPIFY_STORE}/admin/products/${product.id}`
      }
    }));
  } catch (err:any) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err?.message || "Unexpected error" }));
  }
}
