# ctgpt

Serverless API for Shopify product creation on Vercel.

## API Endpoints

### POST /api/create-product

Creates a new product in Shopify.

#### Headers
- `X-CT-Auth`: Required. Must match the `CT_SHARED_SECRET` environment variable.

#### Environment Variables
- `CT_SHARED_SECRET`: Shared secret for authentication
- `SHOPIFY_STORE`: Shopify store domain (e.g., `mystore.myshopify.com`)
- `SHOPIFY_ADMIN_TOKEN`: Shopify Admin API access token
- `SHOPIFY_API_VERSION`: Shopify API version (e.g., `2024-01`)

#### Request Body
```json
{
  "title": "Product Title",
  "body_html": "<strong>Product description</strong>",
  "vendor": "Vendor Name",
  "product_type": "Type",
  "tags": ["tag1", "tag2"]
}
```

#### Response
Success (200):
```json
{
  "ok": true,
  "product": {
    "id": 123456789,
    "title": "Product Title",
    ...
  }
}
```

Error (500):
```json
{
  "ok": false,
  "error": "Error message"
}
```

Unauthorized (401):
```json
{
  "ok": false,
  "error": "Unauthorized"
}
```

Method Not Allowed (405):
```json
{
  "ok": false,
  "error": "Method not allowed"
}
```

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in your credentials
4. Deploy to Vercel: `vercel deploy`

## Development

The project uses TypeScript. To check for type errors:
```bash
npm run build
```

## License
ISC
