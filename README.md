# ctgpt

Serverless functions for Shopify product management.

## API Endpoints

### POST /api/create-product

Create a new product in Shopify with inventory and cost management.

#### Authentication
Requires `X-CT-Auth` header matching the `CT_SHARED_SECRET` environment variable.

#### Environment Variables
- `SHOPIFY_STORE` - Your Shopify store domain (e.g., `your-store.myshopify.com`)
- `SHOPIFY_ADMIN_TOKEN` - Shopify Admin API access token
- `SHOPIFY_API_VERSION` - Shopify API version (default: `2024-01`)
- `CT_SHARED_SECRET` - Shared secret for API authentication

#### Request Body
```json
{
  "title": "Product Name",
  "body_html": "Product description",
  "vendor": "Vendor Name",
  "product_type": "Type",
  "variants": [
    {
      "price": "19.99",
      "cost": "10.00",
      "inventory_quantity": 100
    }
  ]
}
```

#### Response
Success (200):
```json
{
  "ok": true,
  "product": {
    "id": 123456789,
    "title": "Product Name",
    ...
  }
}
```

Error (401/500):
```json
{
  "ok": false,
  "error": "Error message"
}
```

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials
2. Deploy to Vercel or run locally with `vercel dev`

## Development

```bash
npm install
npm run type-check
```