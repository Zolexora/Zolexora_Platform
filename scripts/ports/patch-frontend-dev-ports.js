const fs = require('fs');

const updates = [
  { file: 'products/zolexora-tms/apps/tms-web/package.json', search: 'vite --port 3000', replace: 'vite --port 3031' },
  { file: 'products/zolexora-tms/apps/tms-admin/package.json', search: 'vite --port 3001', replace: 'vite --port 3032' },
  { file: 'products/zolexora-engage/apps/web/package.json', search: '--host 0.0.0.0"', replace: '--host 0.0.0.0 --port 3041"' },
  { file: 'products/zolexora-ims/apps/ims-admin/frontend/package.json', search: '"vite"', replace: '"vite --port 3051"' },
  { file: 'products/zolexora-ims/apps/ims-admin/package.json', search: '"npx wrangler dev"', replace: '"npx wrangler dev --port 8787"' },
  { file: 'products/zolexora-ims/apps/ims-user/frontend/package.json', search: '"vite"', replace: '"vite --port 3052"' },
  { file: 'products/zolexora-ims/apps/ims-user/package.json', search: '"wrangler dev"', replace: '"wrangler dev --port 8788"' },
  { file: 'products/zolexora-erp/backend/erpnext/banking/package.json', search: '"vite"', replace: '"vite --port 3061"' },
  { file: 'products/maunkavach/web/package.json', search: '"vite"', replace: '"vite --port 3071"' },
  { file: 'products/clarityfi/apps/web/package.json', search: '"npx serve ."', replace: '"npx serve . -l 3081"' },
  { file: 'products/zolexora-ai/frontend/package.json', search: '"vite"', replace: '"vite --port 3091"' },
  { file: 'products/zolexora-marketplace/apps/portals/marketplace-admin/web/package.json', search: 'next dev -p 3002', replace: 'next dev -p 3101' },
  { file: 'products/zolexora-marketplace/apps/portals/seller/web/package.json', search: 'next dev -p 3001', replace: 'next dev -p 3102' },
  { file: 'products/zolexora-marketplace/apps/storefronts/zolexora-shop/web/package.json', search: 'next dev -p 3000', replace: 'next dev -p 3103' },
  { file: 'products/zolexora-marketplace/apps/storefronts/zolexora-shop/mobile/package.json', search: 'expo start --clear --port 8081', replace: 'expo start --clear --port 8083' },
  { file: 'products/zolexora-marketplace/apps/storefronts/mahila-madel/mobile/package.json', search: 'expo start --clear --port 8081', replace: 'expo start --clear --port 8084' },
  { file: 'products/zolexora-marketplace/apps/storefronts/mahila-madel/web/package.json', search: 'PORT=3003 react-scripts start', replace: 'PORT=3104 react-scripts start' }
];

updates.forEach(u => {
  if (fs.existsSync(u.file)) {
    let content = fs.readFileSync(u.file, 'utf8');
    if (content.includes(u.search)) {
      content = content.replace(u.search, u.replace);
      fs.writeFileSync(u.file, content);
      console.log(`Updated ${u.file}`);
    } else {
      console.log(`Search string not found in ${u.file}`);
    }
  } else {
    console.log(`File not found: ${u.file}`);
  }
});
