const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
     console.log('PAGE LOG:', msg.text());
  });
  page.on('pageerror', error => {
     console.log('PAGE ERROR:', error.message);
  });
  
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 4000));
  
  console.log('Executing script to drop HP...');
  await page.evaluate(() => {
     try {
       const scene = window.game.scene.scenes.find(s => s.sys.config === 'GameScene' || s.p1);
       if (scene && scene.p1) {
           scene.p1.hp = 100; // Drop to 10%
           console.log("P1 HP set to 100. P1 state: " + scene.p1.fsm.currentType);
       } else {
           console.log("No scene.p1 found.");
       }
     } catch(e) {
       console.log("EVAL ERROR: " + e.message);
     }
  });
  
  await new Promise(r => setTimeout(r, 2000));
  console.log('Checking if browser is responsive...');
  const isResponsive = await page.evaluate(() => {
     return "YES";
  });
  console.log("Browser responsive? " + isResponsive);
  
  await browser.close();
})();
