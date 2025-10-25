#!/usr/bin/env node

/**
 * Simple validation script to verify the API endpoint structure
 * This does not require actual Shopify credentials
 */

const fs = require('fs');
const path = require('path');

console.log('Validating API endpoint...\n');

// Check if the file exists
const apiFile = path.join(__dirname, 'api', 'create-product.ts');
if (!fs.existsSync(apiFile)) {
  console.error('❌ api/create-product.ts not found!');
  process.exit(1);
}
console.log('✅ api/create-product.ts exists');

// Read the file content
const content = fs.readFileSync(apiFile, 'utf8');

// Validation checks
const checks = [
  {
    name: 'POST method validation',
    pattern: /req\.method\s*!==\s*['"]POST['"]/,
  },
  {
    name: 'X-CT-Auth header check',
    pattern: /['"]x-ct-auth['"]/i,
  },
  {
    name: 'CT_SHARED_SECRET environment variable',
    pattern: /process\.env\.CT_SHARED_SECRET/,
  },
  {
    name: 'SHOPIFY_STORE environment variable',
    pattern: /process\.env\.SHOPIFY_STORE/,
  },
  {
    name: 'SHOPIFY_ADMIN_TOKEN environment variable',
    pattern: /process\.env\.SHOPIFY_ADMIN_TOKEN/,
  },
  {
    name: 'SHOPIFY_API_VERSION environment variable',
    pattern: /process\.env\.SHOPIFY_API_VERSION/,
  },
  {
    name: '401 Unauthorized response',
    pattern: /status\(401\)/,
  },
  {
    name: '500 error response',
    pattern: /status\(500\)/,
  },
  {
    name: 'ok:true success response',
    pattern: /ok:\s*true/,
  },
  {
    name: 'Native fetch usage',
    pattern: /fetch\(/,
  },
  {
    name: 'Inventory handling',
    pattern: /inventory/i,
  },
  {
    name: 'Cost handling',
    pattern: /cost/i,
  },
  {
    name: 'Shopify REST API endpoint',
    pattern: /\/admin\/api\//,
  },
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  if (check.pattern.test(content)) {
    console.log(`✅ ${check.name}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
    failed++;
  }
});

console.log(`\n${passed}/${checks.length} checks passed`);

if (failed > 0) {
  console.error('\nSome validation checks failed!');
  process.exit(1);
}

console.log('\n✅ All validation checks passed!');
console.log('\nNote: This validation only checks the code structure.');
console.log('Full testing requires actual Shopify credentials.');
