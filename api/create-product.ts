import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Shopify product data interface
 */
interface ShopifyProductData {
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  variants?: Array<{
    price?: string;
    sku?: string;
    inventory_quantity?: number;
  }>;
  [key: string]: unknown;
}

/**
 * Shopify API response interface
 */
interface ShopifyProductResponse {
  product: {
    id: number;
    title: string;
    [key: string]: unknown;
  };
}

/**
 * Vercel serverless function to create a Shopify product
 * POST /api/create-product
 * 
 * Headers:
 * - X-CT-Auth: Must match CT_SHARED_SECRET environment variable
 * 
 * Environment Variables:
 * - CT_SHARED_SECRET: Shared secret for authentication
 * - SHOPIFY_STORE: Shopify store domain (e.g., mystore.myshopify.com)
 * - SHOPIFY_ADMIN_TOKEN: Shopify Admin API access token
 * - SHOPIFY_API_VERSION: Shopify API version (e.g., 2024-01)
 * 
 * Request Body:
 * - product: Shopify product object
 * 
 * Response:
 * - Success: { ok: true, product: {...} }
 * - Error: { ok: false, error: string } with 500 status
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Verify X-CT-Auth header
    const authHeader = req.headers['x-ct-auth'];
    const sharedSecret = process.env.CT_SHARED_SECRET;

    if (!sharedSecret) {
      console.error('CT_SHARED_SECRET environment variable is not set');
      return res.status(500).json({ ok: false, error: 'Server configuration error' });
    }

    if (authHeader !== sharedSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // Get environment variables for Shopify
    const shopifyStore = process.env.SHOPIFY_STORE;
    const shopifyAdminToken = process.env.SHOPIFY_ADMIN_TOKEN;
    const shopifyApiVersion = process.env.SHOPIFY_API_VERSION;

    if (!shopifyStore || !shopifyAdminToken || !shopifyApiVersion) {
      console.error('Missing Shopify environment variables');
      return res.status(500).json({ 
        ok: false, 
        error: 'Server configuration error: Missing Shopify credentials' 
      });
    }

    // Get product data from request body
    const productData = req.body as ShopifyProductData;

    // Validate required fields
    if (!productData || typeof productData !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request body: product data is required'
      });
    }

    if (!productData.title || typeof productData.title !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request body: product title is required'
      });
    }

    // Create Shopify product using Admin API
    const shopifyUrl = `https://${shopifyStore}/admin/api/${shopifyApiVersion}/products.json`;
    
    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyAdminToken,
      },
      body: JSON.stringify({ product: productData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', response.status, errorText);
      return res.status(500).json({ 
        ok: false, 
        error: `Shopify API error: ${response.status} ${response.statusText}` 
      });
    }

    const data = await response.json() as ShopifyProductResponse;
    
    return res.status(200).json({ 
      ok: true, 
      product: data.product 
    });

  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
