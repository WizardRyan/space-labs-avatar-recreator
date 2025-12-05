import puppeteer from 'puppeteer';
import fs from 'fs';

const filePath = process.argv[2] || 'events.json';
let latestEventsByParameter = {};

try {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(fileContent);
  
  if (data.action_log && Array.isArray(data.action_log)) {

    let lastAction;
    data.action_log.forEach(event => {
      if (event.Action_type === 'select_customization_option') {
        let parameter = event.Parameter;
        
        if(lastAction != null && event.Parameter == "Empty_Icon"){
          event.Parameter = lastAction.Parameter;
          parameter = lastAction.Parameter;
        }

        latestEventsByParameter[parameter] = event;
        lastAction = event;
      }
    });
  }
  
  // Log the result
  console.log('Latest events by parameter:');
  console.log(JSON.stringify(latestEventsByParameter, null, 2));
  
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`Error: File not found: ${filePath}`);
  } else if (error instanceof SyntaxError) {
    console.error('Error: Invalid JSON format');
  } else {
    console.error('Error:', error.message);
  }
//   process.exit(1);
}

const barHeight = 88;
const numBoxes = 8;
const boxHeight = (1080 -barHeight) / numBoxes;
const cLoc = (numInList) => {
    return ((boxHeight * numInList));
};
const getX = (num) => {
    return 1200 + 20;
}

const allCategories = [
  'Gender',
  'Body_Shape',
  'Face_Shape',
  'Eye_Shape',
  'Eyebrow',
  'Nose_Shape',
  'Lip_Shape',
  'Beard',
  'Hair',
  'Top',
  'Bottom',
  'Shoes',
  'Outfit',
  'Glasses',
  'Makeup',
  'Facewear',
  'Headwear'
];

const categoryMap = {
    "Body": 1,
    "Body_Shape": {parent: "Body"},
    "Gender": {parent: "Body"},
    "Head": 2,
    "Face_Shape": {parent: "Head", self: 1},
    "Eye_Shape": {parent: "Head", self: 2},
    "Eyebrow": {parent: "Head", self: 3},
    "Nose_Shape": {parent: "Head", self: 4},
    "Lip_Shape": {parent: "Head", self: 5},
    "Beard": {parent: "Head", self: 6},
    "Hair": 3,
    "Clothes": 4,
    "Outfit": {parent: "Clothes", self: 4},
    "Top": {parent: "Clothes", self: 1},
    "Bottom": {parent: "Clothes", self: 2},
    "Shoes": {parent: "Clothes", self: 3},
    "Glasses": 5,
    "Makeup": 6,
    "Mask": 7,
    "Headwear": 8
}; 

// Helper function to replace deprecated waitForTimeout
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const doClick = async (page, time, selector) => {
    try{
      await page.waitForSelector(selector, { timeout: time });
      await page.click(selector);
      console.log(`${selector} clicked`);
    }
    catch(selectorError){
        console.log(`Failed to click ${selector}: ${selectorError}`);
    }
}


async function clickAssetInList(page, substring) {
  return await page.evaluate(async (searchSubstring) => {
    const assetList = document.querySelector('[data-cy="asset-list"]');
    
    if (!assetList) {
      return { success: false, error: 'asset-list container not found' };
    }
    
    
    const startTime = Date.now();
    const scrollInterval = 100; 
    const scrollAmount = 200; 
    const scrollDurationSeconds = 5;
    
    await new Promise((resolve) => {
      const scrollTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= scrollDurationSeconds * 1000) {
          clearInterval(scrollTimer);
          resolve();
          return;
        }
        
        assetList.scrollTop += scrollAmount;
      }, scrollInterval);
    });
    
    const assetItems = document.querySelectorAll('[data-cy="asset-item"]');
    for (const item of assetItems) {
      const img = item.querySelector('img');
      
      if (img && img.src && img.src.includes(searchSubstring)) {
        img.click();
        return { success: true, src: img.src };
      }
    }
    
    return { success: false, error: `No match found for: ${searchSubstring}` };
  }, substring);
}

const clickOnOption = async (page, parameter, value) => {
    console.log(`Clicking on option: ${parameter} with value ${value}`);

    if(categoryMap[parameter]){
        if(typeof categoryMap[parameter] == 'number'){
            console.log(`Clicking on flat option number: ${categoryMap[parameter]}`);            
            const childIndex = categoryMap[parameter] - 1;
            await page.evaluate((index) => {
              let element = document.querySelector('.categorypicker');
              if (element && element.children[index]) {
                element.children[index].click();
              }
            }, childIndex);

            await sleep(1500);

            await clickAssetInList(page, value);
        }
        else{
          if(parameter == "Body_Shape"){
            // 
          }
          else if(parameter == "Gender"){
            await page.evaluate((val) => {
              let element = document.querySelector('.categorypicker');
              element.children[0].click();
            }, value);

            await sleep(1000);

            await page.evaluate((val) => {
                const gender = document.querySelector(`[aria-label="${val}"`);
                if (gender){
                  console.log(`Clicking on Gender ${val}`);
                  gender.click();
                };
            }, value);
          }
          else{
            console.log(`Clicking on option ${parameter}`);
            let childIndex = categoryMap[categoryMap[parameter].parent] - 1;
            await page.evaluate((index) => {
              let element = document.querySelector('.categorypicker');
              if (element && element.children[index]) {
                element.children[index].click();
              }
            }, childIndex);

            await sleep(1000);

            childIndex = categoryMap[parameter].self - 1;
            console.log(`child index nested option: ${childIndex}`);
            await page.evaluate((index) => {
              let element = document.querySelector('.subcategorypicker');
              if (element && element.firstChild && element.firstChild.firstChild && element.firstChild.firstChild.children[index]) {
                element.firstChild.firstChild.children[index].click();
              }
            }, childIndex);

            await sleep(1000);

            await clickAssetInList(page, value);
          }
        }
    }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log('Navigating to Ready Player Me avatar editor...');
    await page.goto('https://space-labs-avatar-editor.readyplayer.me/avatar/choose', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('Page loaded.');
    
    await doClick(page, 3000, '[data-cy="connect-new-avatar-button"]');

    await sleep(1000);

    await doClick(page, 3000, '[data-cy="modal-close-button"]');

    for(const cat of allCategories){
        if(latestEventsByParameter[cat]){
            let event = latestEventsByParameter[cat];
            await clickOnOption(page, event.Parameter, event.New_Value);
            await sleep(2000);
        }
    }
    
    console.log('\nTask completed. Browser window left open for inspection.');
    
    // Keep the script running
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error occurred:', error.message);
    console.log('\nBrowser window left open for inspection.');
    console.log('Press Ctrl+C to exit and close the browser.');
    
    // Keep the script running even on error
    await new Promise(() => {});
  }
})();