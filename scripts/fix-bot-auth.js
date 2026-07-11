const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (file === 'route.ts') {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '../src/app/api/bot'));
files.push(path.join(__dirname, '../src/app/api/wa-orders/cleanup/route.ts'));
files.push(path.join(__dirname, '../src/app/api/wa-orders/[id]/reject/route.ts'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add crypto import if not exists
  if (content.includes('process.env.BOT_API_KEY') || content.includes('process.env.WA_BOT_API_KEY')) {
    if (!content.includes("import crypto from 'crypto';")) {
      content = "import crypto from 'crypto';\n" + content;
      changed = true;
    }
  }

  // Replace standard logic
  const oldLogic1 = `if (!clientApiKey || clientApiKey !== serverApiKey) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }`;
  
  const oldLogic2 = `if (!clientApiKey || clientApiKey !== serverApiKey) {
      return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
    }`;

  const oldLogic3 = `if (validKey && apiKey !== validKey) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }`;

  const newLogic1 = `let isAuthorized = false;
  if (clientApiKey && serverApiKey && clientApiKey.length === serverApiKey.length) {
    isAuthorized = crypto.timingSafeEqual(Buffer.from(clientApiKey), Buffer.from(serverApiKey));
  }
  if (!isAuthorized) {
    return NextResponse.json({ status: "error", message: "Akses Ditolak" }, { status: 401 });
  }`;

  const newLogic3 = `let isAuthorized = false;
    if (validKey && apiKey && apiKey.length === validKey.length) {
      isAuthorized = crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(validKey));
    }
    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }`;

  if (content.includes(oldLogic1)) {
    content = content.replaceAll(oldLogic1, newLogic1);
    changed = true;
  }
  if (content.includes(oldLogic2)) {
    content = content.replaceAll(oldLogic2, newLogic1);
    changed = true;
  }
  if (content.includes(oldLogic3)) {
    content = content.replaceAll(oldLogic3, newLogic3);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
});
