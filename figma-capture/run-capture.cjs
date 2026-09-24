const puppeteer = require('puppeteer-core');

const captures = [
  {
    name: '组件与开发切图',
    path: '/components.html',
    selector: '#components',
    captureId: '56b2f944-39e8-42fc-9947-e60f75a638b0',
    endpoint: 'https://mcp.figma.com/mcp/capture/56b2f944-39e8-42fc-9947-e60f75a638b0/submit?bindVariables=true',
    viewport: { width: 1500, height: 1900, deviceScaleFactor: 1 }
  },
  {
    name: '开发标注',
    path: '/spec.html',
    selector: '#spec',
    captureId: 'e42596a3-9965-42b8-89f5-85e84c1cb4bb',
    endpoint: 'https://mcp.figma.com/mcp/capture/e42596a3-9965-42b8-89f5-85e84c1cb4bb/submit?bindVariables=true',
    viewport: { width: 1460, height: 1650, deviceScaleFactor: 1 }
  }
];

async function main() {
  const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    protocolTimeout: 900000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    for (const item of captures) {
      console.log(`START ${item.name}`);
      const page = await browser.newPage();
      page.setDefaultTimeout(900000);
      page.setDefaultNavigationTimeout(120000);
      page.on('console', msg => console.log(`[browser ${item.name}] ${msg.text()}`));
      await page.setViewport(item.viewport);
      await page.goto(`http://127.0.0.1:3000${item.path}`, { waitUntil: 'networkidle0', timeout: 120000 });
      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        await Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        })));
      });
      await page.addScriptTag({ path: '/tmp/figma-capture.js' });
      await page.waitForFunction(() => window.figma && typeof window.figma.captureForDesign === 'function', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 1200));
      const result = await page.evaluate(async cfg => {
        return await window.figma.captureForDesign({ captureId: cfg.captureId, endpoint: cfg.endpoint, selector: cfg.selector });
      }, item);
      console.log(`CAPTURED ${item.name}`, JSON.stringify(result));
      await new Promise(resolve => setTimeout(resolve, 1800));
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
