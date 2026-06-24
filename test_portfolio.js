const puppeteer = require('puppeteer');
const fs = require('fs');

const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

let executablePath = null;
for (const p of paths) {
    if (fs.existsSync(p)) {
        executablePath = p;
        break;
    }
}

if (!executablePath) {
    console.error("Could not find Chrome or Edge executable.");
    process.exit(1);
}

(async () => {
    try {
        const browser = await puppeteer.launch({ 
            headless: true,
            executablePath: executablePath
        });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('LIVE PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.error('LIVE PAGE ERROR:', err.toString()));
        
        console.log("Navigating to https://dev.typelin.me/...");
        await page.goto('https://dev.typelin.me/', { waitUntil: 'domcontentloaded', timeout: 40000 });
        
        console.log("Waiting 12 seconds for react app to fully load...");
        await new Promise(resolve => setTimeout(resolve, 12000));
        
        const rootHTML = await page.evaluate(() => {
            const root = document.getElementById('root');
            return root ? root.innerHTML : 'No #root';
        });
        
        console.log("----------------- FULL #root HTML -----------------");
        console.log(rootHTML);
        console.log("---------------------------------------------------");
        
        await browser.close();
        console.log("Done.");
    } catch (e) {
        console.error("Test script error:", e);
    }
})();
