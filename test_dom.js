const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:8000/gallery.html', { waitUntil: 'networkidle0' });
    const html = await page.$eval('#root', el => el.innerHTML);
    require('fs').writeFileSync('dom.txt', html);
    await browser.close();
})();
