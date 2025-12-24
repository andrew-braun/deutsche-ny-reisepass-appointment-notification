import fs from "fs"
import path from "path"
import { solveCaptchaCapSolver } from "./captcha-solver-capsolver.js"
import { solveCaptcha } from "./captcha-solver.js"

/**
 * Test the captcha solver with a sample image
 * Usage: node src/test-captcha.js [path/to/image.png] [--claude]
 * By default uses captchaai.com, use --claude flag to use Claude Vision API
 */
async function testCaptchaSolver() {
	try {
		// Check if --claude flag is present
		const useClaude = process.argv.includes("--claude")

		// Get image path from command line args
		const imagePath = process.argv.find(
			(arg) =>
				!arg.includes("test-captcha.js") &&
				!arg.includes("--claude") &&
				arg !== process.argv[0]
		)

		if (!imagePath) {
			console.error(
				"Usage: node src/test-captcha.js <path-to-captcha-image> [--claude]"
			)
			console.error("Example: node src/test-captcha.js screenshots/captcha.png")
			console.error(
				"Example: node src/test-captcha.js screenshots/captcha.png --claude"
			)
			process.exit(1)
		}

		// Resolve path (handle relative paths)
		const fullPath = path.isAbsolute(imagePath)
			? imagePath
			: path.join(process.cwd(), imagePath)

		if (!fs.existsSync(fullPath)) {
			console.error(`Error: Image file not found at ${fullPath}`)
			process.exit(1)
		}

		// Determine media type from file extension
		const ext = path.extname(fullPath).toLowerCase()
		const mediaTypeMap = {
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".webp": "image/webp",
		}

		const mediaType = mediaTypeMap[ext] || "image/png"

		console.log(`Reading captcha image: ${fullPath}`)
		console.log(`Solver: ${useClaude ? "Claude Vision API" : "CapSolver"}`)

		// Read the image and convert to base64
		const imageBuffer = fs.readFileSync(fullPath)
		const imageBase64 = imageBuffer.toString("base64")

		console.log("Solving captcha...")
		const startTime = Date.now()

		let result
		if (useClaude) {
			result = await solveCaptcha(imageBase64, mediaType)
		} else {
			// Use CapSolver with common module
			result = await solveCaptchaCapSolver(imageBase64, {
				module: "module_005",
			})
		}

		const endTime = Date.now()
		const duration = ((endTime - startTime) / 1000).toFixed(2)

		console.log("\n✅ Captcha solved successfully!")
		console.log(`Result: "${result}"`)
		console.log(`Time taken: ${duration}s`)
	} catch (error) {
		console.error("\n❌ Test failed:", error.message)
		process.exit(1)
	}
}

testCaptchaSolver()
