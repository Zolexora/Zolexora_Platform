const fs = require('fs');

const updates = [
  { file: 'apps/core-platform/zolexora-tms/apps/tms-web/package.json', search: 'vite --port 3000', replace: 'vite --port 3031' },
  { file: 'apps/core-platform/zolexora-tms/apps/tms-admin/package.json', search: 'vite --port 3001', replace: 'vite --port 3032' },
  { file: 'apps/core-platform/zolexora-engage/apps/web/package.json', search: '--host 0.0.0.0"', replace: '--host 0.0.0.0 --port 3041"' },
  { file: 'apps/core-platform/zolexora-ims/apps/ims-user/frontend/package.json', search: '"vite"', replace: '"vite --port 3052"' },
  { file: 'apps/core-platform/zolexora-erp/services/frappe/erpnext/banking/package.json', search: '"vite"', replace: '"vite --port 3061"' },
  { file: 'apps/standalone-apps/maunkavach/apps/web/package.json', search: '"vite"', replace: '"vite --port 3071"' },
  { file: 'apps/standalone-apps/clarityfi/apps/web/package.json', search: '"npx serve ."', replace: '"npx serve . -l 3081"' },
  { file: 'apps/core-platform/zolexora-ai/apps/web/package.json', search: '"vite"', replace: '"vite --port 3091"' },
  { file: 'apps/standalone-apps/marketplace/apps/admin/package.json', search: 'next dev -p 3002', replace: 'next dev -p 3101' },
  { file: 'apps/standalone-apps/marketplace/apps/web/seller/package.json', search: 'next dev -p 3001', replace: 'next dev -p 3102' },
  { file: 'apps/standalone-apps/marketplace/apps/web/shop/package.json', search: 'next dev -p 3000', replace: 'next dev -p 3103' },
  { file: 'apps/standalone-apps/marketplace/apps/mobile/shop/package.json', search: 'expo start --clear --port 8081', replace: 'expo start --clear --port 8083' },
  { file: 'apps/standalone-apps/marketplace/apps/mobile/mahila-madel/package.json', search: 'expo start --clear --port 8081', replace: 'expo start --clear --port 8084' },
  { file: 'apps/standalone-apps/marketplace/apps/web/mahila-madel/package.json', search: 'PORT=3003 react-scripts start', replace: 'PORT=3104 react-scripts start' }
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
