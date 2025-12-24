import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Captures a captcha image from the consulate appointment page
 * Saves it to screenshots/captcha.png for testing
 */
async function captureCaptcha() {
  const url = process.env.APPOINTMENT_URL;

  if (!url) {
    console.error('Error: APPOINTMENT_URL not found in .env file');
    process.exit(1);
  }

  console.log(`Navigating to: ${url}`);

  const browser = await chromium.launch({
    headless: false, // Show browser so you can see what's happening
  });

  try {
    const page = await browser.newPage();

    // Set reasonable viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    console.log('Loading page...');
    await page.goto(url, { waitUntil: 'networkidle' });

    console.log('Page loaded. Looking for captcha image...');

    // Try to find the captcha image - common selectors
    // Adjust these selectors based on the actual page structure
    const captchaSelectors = [
      'img[alt*="captcha" i]',
      'img[src*="captcha" i]',
      'img[id*="captcha" i]',
      '#captcha img',
      '.captcha img',
      'img[alt*="security" i]',
    ];

    let captchaElement = null;
    for (const selector of captchaSelectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`Found captcha using selector: ${selector}`);
        captchaElement = element;
        break;
      }
    }

    if (!captchaElement) {
      console.log('\nCould not auto-detect captcha. Please manually inspect the page.');
      console.log('Look for the captcha image and note its selector.');
      console.log('\nBrowser will remain open for 60 seconds for manual inspection...');
      await page.waitForTimeout(60000);
      throw new Error('Captcha element not found automatically');
    }

    // Take screenshot of the captcha element
    const screenshotPath = path.join(
      process.cwd(),
      'screenshots',
      'captcha.png'
    );

    await captchaElement.screenshot({ path: screenshotPath });

    console.log(`\n✅ Captcha screenshot saved to: ${screenshotPath}`);
    console.log('\nYou can now test the captcha solver with:');
    console.log('pnpm test:captcha screenshots/captcha.png');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

captureCaptcha().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
