import { checkAppointments } from "./checker.js"
import fs from "fs"
import path from "path"

/**
 * Test the appointment checker
 * Usage: node src/test-checker.js
 */
async function testChecker() {
	console.log("🔍 Testing appointment checker...")
	console.log("=" .repeat(50))

	try {
		const startTime = Date.now()

		const result = await checkAppointments()

		const endTime = Date.now()
		const duration = ((endTime - startTime) / 1000).toFixed(2)

		console.log("\n✅ Check completed successfully!")
		console.log("=" .repeat(50))
		console.log(`Available: ${result.available ? "YES ✅" : "NO ❌"}`)
		console.log(`Message: ${result.message}`)
		console.log(`Time taken: ${duration}s`)

		// Save screenshot if available
		if (result.screenshot) {
			const screenshotPath = path.join(
				process.cwd(),
				"screenshots",
				`test-${Date.now()}.png`
			)

			// Ensure screenshots directory exists
			const screenshotsDir = path.join(process.cwd(), "screenshots")
			if (!fs.existsSync(screenshotsDir)) {
				fs.mkdirSync(screenshotsDir, { recursive: true })
			}

			fs.writeFileSync(
				screenshotPath,
				Buffer.from(result.screenshot, "base64")
			)
			console.log(`Screenshot saved: ${screenshotPath}`)
		}

		console.log("=" .repeat(50))

		if (result.available) {
			console.log("\n🎉 APPOINTMENTS AVAILABLE! Check the appointment page!")
			process.exit(0)
		} else {
			console.log("\n😔 No appointments available at this time.")
			process.exit(0)
		}
	} catch (error) {
		console.error("\n❌ Test failed:")
		console.error("=" .repeat(50))
		console.error(error.message)
		console.error("\nStack trace:")
		console.error(error.stack)
		process.exit(1)
	}
}

testChecker()
