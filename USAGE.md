# API Usage Examples

## POST /api/create-product

This endpoint creates a new product in Shopify with support for inventory and cost management.

### Authentication

All requests must include the `X-CT-Auth` header with the value matching `CT_SHARED_SECRET` environment variable.

```bash
curl -X POST https://your-app.vercel.app/api/create-product \
  -H "Content-Type: application/json" \
  -H "X-CT-Auth: your-secret-key" \
  -d '{"title": "New Product"}'
```

### Example 1: Simple Product

Create a basic product with just a title:

```bash
curl -X POST https://your-app.vercel.app/api/create-product \
  -H "Content-Type: application/json" \
  -H "X-CT-Auth: your-secret-key" \
  -d '{
    "title": "Simple T-Shirt"
  }'
```

### Example 2: Product with Details

Create a product with full details:

```bash
curl -X POST https://your-app.vercel.app/api/create-product \
  -H "Content-Type: application/json" \
  -H "X-CT-Auth: your-secret-key" \
  -d '{
    "title": "Premium T-Shirt",
    "body_html": "<p>High quality cotton t-shirt</p>",
    "vendor": "My Brand",
    "product_type": "Apparel"
  }'
```

### Example 3: Product with Variants, Inventory, and Cost

Create a product with variant pricing, cost, and inventory:

```bash
curl -X POST https://your-app.vercel.app/api/create-product \
  -H "Content-Type: application/json" \
  -H "X-CT-Auth: your-secret-key" \
  -d '{
    "title": "Premium T-Shirt",
    "body_html": "<p>High quality cotton t-shirt</p>",
    "vendor": "My Brand",
    "product_type": "Apparel",
    "variants": [
      {
        "price": "29.99",
        "cost": "12.50",
        "inventory_quantity": 100
      }
    ]
  }'
```

### Success Response (200)

```json
{
  "ok": true,
  "product": {
    "id": 8234567890,
    "title": "Premium T-Shirt",
    "body_html": "<p>High quality cotton t-shirt</p>",
    "vendor": "My Brand",
    "product_type": "Apparel",
    "variants": [
      {
        "id": 43210987,
        "price": "29.99",
        "inventory_quantity": 100
      }
    ]
  }
}
```

### Error Responses

**401 Unauthorized** - Missing or invalid X-CT-Auth header:
```json
{
  "ok": false,
  "error": "Unauthorized"
}
```

**405 Method Not Allowed** - Using GET instead of POST:
```json
{
  "ok": false,
  "error": "Method not allowed"
}
```

**400 Bad Request** - Missing required product data:
```json
{
  "ok": false,
  "error": "Missing required product data (title)"
}
```

**500 Internal Server Error** - Shopify API error or missing configuration:
```json
{
  "ok": false,
  "error": "Failed to create product: [error details]"
}
```

## Environment Variables Setup

Before deploying, configure these environment variables in your Vercel project:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SHOPIFY_STORE` | Your Shopify store domain | `your-store.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | Shopify Admin API access token | `shpat_xxxxxxxxxxxxx` |
| `SHOPIFY_API_VERSION` | Shopify API version (optional) | `2024-01` |
| `CT_SHARED_SECRET` | Secret key for API authentication | `your-secure-random-key` |

## Testing Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your credentials (copy from `.env.example`):
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

4. Run locally:
   ```bash
   vercel dev
   ```

5. Test the endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/create-product \
     -H "Content-Type: application/json" \
     -H "X-CT-Auth: your-secret-key" \
     -d '{"title": "Test Product"}'
   ```

## Features

- ✅ POST-only endpoint with method validation
- ✅ Secure authentication via X-CT-Auth header
- ✅ Shopify product creation via REST API
- ✅ Automatic inventory level management
- ✅ Automatic variant cost updates
- ✅ Native fetch API (no external HTTP libraries)
- ✅ Full TypeScript support
- ✅ Comprehensive error handling
- ✅ Node 20 runtime
