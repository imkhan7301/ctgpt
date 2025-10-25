/**
 * Vercel Serverless Function (Node 20)
 * POST /api/create-product
 *
 * - Auth: X-CT-Auth header must match process.env.CT_SHARED_SECRET -> 401 otherwise
 * - Uses env vars:
 *    SHOPIFY_STORE
 *    SHOPIFY_ADMIN_TOKEN
 *    SHOPIFY_API_VERSION
 *    CT_SHARED_SECRET
 *
 * - Creates a Shopify product via REST API (products.json)
 * - After creation, updates inventory levels and inventory item cost where provided in the incoming request.
 * - Uses native fetch (available on Node 20)
 *
 * Request body example (JSON):
 * {
 *   "title": "My product",
 *   "body_html": "<strong>Good</strong>",
 *   "vendor": "Me",
 *   "product_type": "Thing",
 *   "variants": [
 *     { "title": "Default", "sku": "SKU123", "price": "10.00", "inventory_quantity": 5, "cost": "6.50" }
 *   ],
 *   "images": [ { "src": "https://..." } ]
 * }
 *
 * Response:
 * 200: { ok: true, product: { ... } }
 * 401: { ok: false, error: "Unauthorized" }
 * 405: { ok: false, error: "Method Not Allowed" }
 * 500: { ok: false, error: "..." }
 */

import type { NextApiRequest, NextApiResponse } from "next"; // typings only; runtime is typical (req,res)

const {
  SHOPIFY_STORE,
  SHOPIFY_ADMIN_TOKEN,
  SHOPIFY_API_VERSION,
  CT_SHARED_SECRET,
} = process.env;

function getShopHost(): string {
  if (!SHOPIFY_STORE) return "";
  return SHOPIFY_STORE.includes(".myshopify.com")
    ? SHOPIFY_STORE
    : `${SHOPIFY_STORE}.myshopify.com`;
}

function shopifyHeaders() {
  if (!SHOPIFY_ADMIN_TOKEN) return {};
  return {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
  };
}

async function shopifyFetch(
  path: string,
  opts: { method?: string; body?: any } = {}
) {
  const host = getShopHost();
  if (!host) throw new Error("SHOPIFY_STORE env var is not set");
  if (!SHOPIFY_API_VERSION)
    throw new Error("SHOPIFY_API_VERSION env var is not set");
  const url = `https://${host}/admin/api/${SHOPIFY_API_VERSION}${path}`;
  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers: shopifyHeaders(),
  };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }
  const resp = await fetch(url, init);
  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    // non-json response
    throw new Error(`Shopify returned non-JSON response: ${text}`);
  }
  if (!resp.ok) {
    const errBody = json || text;
    throw new Error(`Shopify ${resp.status} ${resp.statusText}: ${JSON.stringify(errBody)}`);
  }
  return json;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only POST allowed
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    // Auth header
    const providedSecret =
      (req.headers["x-ct-auth"] as string) || (req.headers["X-CT-Auth"] as unknown as string);
    if (!CT_SHARED_SECRET || providedSecret !== CT_SHARED_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // Basic env validation
    if (!SHOPIFY_ADMIN_TOKEN || !SHOPIFY_STORE || !SHOPIFY_API_VERSION) {
      return res.status(500).json({
        ok: false,
        error: "SHOPIFY_STORE, SHOPIFY_ADMIN_TOKEN and SHOPIFY_API_VERSION environment variables must be set",
      });
    }

    // Parse body (should be JSON)
    const payload = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "Invalid JSON body" });
    }

    // Create the product. We assume the incoming payload uses Shopify product shape compatible fields.
    const createBody = { product: payload };

    const created = await shopifyFetch("/products.json", { method: "POST", body: createBody });
    const createdProduct = created && created.product ? created.product : null;
    if (!createdProduct) {
      throw new Error("Product creation succeeded but response did not include product");
    }

    // Attempt inventory and cost updates if variants data was provided in the request.
    // We'll map input variants to created variants by sku when possible, otherwise by index.
    const inputVariants: any[] = Array.isArray(payload.variants) ? payload.variants : [];
    const createdVariants: any[] = Array.isArray(createdProduct.variants)
      ? createdProduct.variants
      : [];

    // If there's nothing to update, return success now.
    if (inputVariants.length === 0) {
      return res.status(200).json({ ok: true, product: createdProduct });
    }

    // Get locations -> need a location_id to set inventory levels
    const locationsResp = await shopifyFetch("/locations.json");
    const locations = locationsResp && Array.isArray(locationsResp.locations) ? locationsResp.locations : [];
    if (locations.length === 0) {
      throw new Error("No locations found for store; cannot set inventory levels");
    }
    const locationId = locations[0].id;

    // For each created variant, find matching input variant and perform inventory & cost updates where provided.
    for (let i = 0; i < createdVariants.length; i++) {
      const createdVariant = createdVariants[i];
      // try to match by sku first
      let inputVariant = inputVariants.find((v) => v && v.sku && v.sku === createdVariant.sku);
      if (!inputVariant) {
        inputVariant = inputVariants[i] || null;
      }
      if (!inputVariant) continue; // nothing to update

      const inventoryItemId = createdVariant.inventory_item_id;
      if (!inventoryItemId) {
        // variant has no inventory_item_id - skip
        continue;
      }

      // Inventory update
      if (
        inputVariant.inventory_quantity !== undefined &&
        inputVariant.inventory_quantity !== null
      ) {
        const setBody = {
          location_id: locationId,
          inventory_item_id: inventoryItemId,
          available: Number(inputVariant.inventory_quantity),
        };
        await shopifyFetch("/inventory_levels/set.json", { method: "POST", body: setBody });
      }

      // Cost update (if provided)
      if (inputVariant.cost !== undefined && inputVariant.cost !== null) {
        const costNum = Number(inputVariant.cost);
        if (Number.isFinite(costNum)) {
          // Update inventory_item cost
          const invItemBody = {
            inventory_item: {
              id: inventoryItemId,
              cost: costNum,
            },
          };
          // Use PUT on inventory_items/<id>.json
          await shopifyFetch(`/inventory_items/${inventoryItemId}.json`, {
            method: "PUT",
            body: invItemBody,
          });
        }
      }
    }

    // All done
    return res.status(200).json({ ok: true, product: createdProduct });
  } catch (err: any) {
    console.error("create-product error:", err && err.message ? err.message : err);
    const message = err && err.message ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}