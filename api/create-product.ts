import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ShopifyProduct {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  variants?: ShopifyVariant[];
}

interface ShopifyVariant {
  id?: number;
  price?: string;
  cost?: string;
  inventory_quantity?: number;
  inventory_item_id?: number;
}

interface ShopifyProductResponse {
  product: ShopifyProduct;
}

interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
}

interface ProductRequestBody {
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  variants?: Array<{
    price?: string;
    cost?: string;
    inventory_quantity?: number;
  }>;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Verify authentication header
  const authHeader = req.headers['x-ct-auth'] as string;
  const sharedSecret = process.env.CT_SHARED_SECRET;

  if (!authHeader || !sharedSecret || authHeader !== sharedSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  // Validate required environment variables
  const shopifyStore = process.env.SHOPIFY_STORE;
  const shopifyAdminToken = process.env.SHOPIFY_ADMIN_TOKEN;
  const shopifyApiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

  if (!shopifyStore || !shopifyAdminToken) {
    return res.status(500).json({
      ok: false,
      error: 'Missing required Shopify configuration'
    });
  }

  try {
    const productData: ProductRequestBody = req.body;

    if (!productData || !productData.title) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required product data (title)'
      });
    }

    // Create product in Shopify
    const shopifyUrl = `https://${shopifyStore}/admin/api/${shopifyApiVersion}/products.json`;
    
    const createResponse = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyAdminToken
      },
      body: JSON.stringify({ product: productData })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      return res.status(500).json({
        ok: false,
        error: `Failed to create product: ${errorText}`
      });
    }

    const createdProduct: ShopifyProductResponse = await createResponse.json();
    const product = createdProduct.product;

    // Handle inventory and cost updates for variants
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        const requestVariant = productData.variants?.find((v, index) => 
          index === product.variants!.indexOf(variant)
        );

        if (!requestVariant) continue;

        // Update cost if provided
        if (requestVariant.cost && variant.id) {
          const variantUrl = `https://${shopifyStore}/admin/api/${shopifyApiVersion}/variants/${variant.id}.json`;
          
          await fetch(variantUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': shopifyAdminToken
            },
            body: JSON.stringify({
              variant: {
                id: variant.id,
                cost: requestVariant.cost
              }
            })
          });
        }

        // Update inventory if provided and inventory_item_id exists
        if (
          requestVariant.inventory_quantity !== undefined &&
          variant.inventory_item_id
        ) {
          // First, get the location ID
          const locationsUrl = `https://${shopifyStore}/admin/api/${shopifyApiVersion}/locations.json`;
          const locationsResponse = await fetch(locationsUrl, {
            headers: {
              'X-Shopify-Access-Token': shopifyAdminToken
            }
          });

          if (locationsResponse.ok) {
            const locationsData: { locations: Array<{ id: number }> } = await locationsResponse.json();
            const primaryLocation = locationsData.locations[0];

            if (primaryLocation) {
              // Set inventory level
              const inventoryUrl = `https://${shopifyStore}/admin/api/${shopifyApiVersion}/inventory_levels/set.json`;
              
              await fetch(inventoryUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Shopify-Access-Token': shopifyAdminToken
                },
                body: JSON.stringify({
                  location_id: primaryLocation.id,
                  inventory_item_id: variant.inventory_item_id,
                  available: requestVariant.inventory_quantity
                })
              });
            }
          }
        }
      }
    }

    // Return success response
    return res.status(200).json({
      ok: true,
      product: product
    });

  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
