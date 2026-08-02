const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  console.log('Navigating to game...');
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 4000));
  console.log('Pressing P...');
  await page.keyboard.press('P');
  await new Promise(r => setTimeout(r, 2000));
  console.log('Closing...');
  await browser.close();
})();
