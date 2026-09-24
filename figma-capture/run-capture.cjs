const puppeteer = require('puppeteer-core');

const captures = [
  {
    name: '首页高保真原型',
    path: '/index.html',
    selector: '#screen',
    captureId: 'a8e2ed23-ec34-413f-9147-87bce6a26cce',
    endpoint: 'https://mcp.figma.com/mcp/capture/a8e2ed23-ec34-413f-9147-87bce6a26cce/submit?bindVariables=true',
    viewport: { width: 520, height: 1100, deviceScaleFactor: 1 }
  },
  {
    name: '组件与开发切图',
    path: '/components.html',
    selector: '#components',
    captureId: '5c3fcb7a-5b07-49cb-a7a8-69331f94972b',
    endpoint: 'https://mcp.figma.com/mcp/capture/5c3fcb7a-5b07-49cb-a7a8-69331f94972b/submit?bindVariables=true',
    viewport: { width: 1500, height: 1900, deviceScaleFactor: 1 }
  },
  {
    name: '开发标注',
    path: '/spec.html',
    selector: '#spec',
    captureId: 'ef322e4f-2523-4ce0-84d3-7da80d6b777e',
    endpoint: 'https://mcp.figma.com/mcp/capture/ef322e4f-2523-4ce0-84d3-7da80d6b777e/submit?bindVariables=true',
    viewport: { width: 1460, height: 1650, deviceScaleFactor: 1 }
  }
];

async function main() {
  const executablePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    for (const item of captures) {
      const page = await browser.newPage();
      await page.setViewport(item.viewport);
      await page.goto(`http://127.0.0.1:3000${item.path}`, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });
      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        await Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        })));
      });
      await page.addScriptTag({ path: '/tmp/figma-capture.js' });
      await page.waitForFunction(() => window.figma && typeof window.figma.captureForDesign === 'function', { timeout: 30000 });
      await page.waitForTimeout(1000);
      const result = await page.evaluate(async cfg => {
        return await window.figma.captureForDesign({
          captureId: cfg.captureId,
          endpoint: cfg.endpoint,
          selector: cfg.selector
        });
      }, item);
      console.log(`CAPTURED ${item.name}`, JSON.stringify(result));
      await page.waitForTimeout(1500);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
