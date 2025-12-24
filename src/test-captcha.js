import { solveCaptcha } from './captcha-solver.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test the captcha solver with a sample image
 * Usage: node src/test-captcha.js [path/to/image.png]
 */
async function testCaptchaSolver() {
  try {
    // Get image path from command line args, or use a default test image path
    const imagePath = process.argv[2];

    if (!imagePath) {
      console.error('Usage: node src/test-captcha.js <path-to-captcha-image>');
      console.error('Example: node src/test-captcha.js screenshots/captcha.png');
      process.exit(1);
    }

    // Resolve path (handle relative paths)
    const fullPath = path.isAbsolute(imagePath)
      ? imagePath
      : path.join(process.cwd(), imagePath);

    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Image file not found at ${fullPath}`);
      process.exit(1);
    }

    // Determine media type from file extension
    const ext = path.extname(fullPath).toLowerCase();
    const mediaTypeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const mediaType = mediaTypeMap[ext] || 'image/png';

    console.log(`Reading captcha image: ${fullPath}`);
    console.log(`Media type: ${mediaType}`);

    // Read the image and convert to base64
    const imageBuffer = fs.readFileSync(fullPath);
    const imageBase64 = imageBuffer.toString('base64');

    console.log('Sending to Claude Vision API...');
    const startTime = Date.now();

    const result = await solveCaptcha(imageBase64, mediaType);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n✅ Captcha solved successfully!');
    console.log(`Result: "${result}"`);
    console.log(`Time taken: ${duration}s`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testCaptchaSolver();
