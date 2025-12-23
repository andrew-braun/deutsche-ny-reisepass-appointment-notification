/**
 * Test script for ntfy.sh notifications
 * Run: pnpm test:notify
 *
 * Before running, make sure you have:
 * 1. Created a .env file with NTFY_TOPIC set to a unique topic name
 * 2. Subscribed to that topic in the ntfy app on your phone
 *    - iOS: https://apps.apple.com/app/ntfy/id1625396347
 *    - Android: https://play.google.com/store/apps/details?id=io.heckel.ntfy
 *    - Or use the web app: https://ntfy.sh/YOUR_TOPIC_NAME
 */

import "dotenv/config"
import { notify, notifyAvailability, notifyError } from "./notify.js"

async function runTests() {
	console.log("Testing ntfy.sh notifications...\n")
	console.log(`Using topic: ${process.env.NTFY_TOPIC}\n`)

	try {
		// Test 1: Basic notification
		console.log("1. Sending basic notification...")
		await notify("Test message from consulate checker")
		console.log("   ✓ Basic notification sent\n")

		// Test 2: Availability alert (this is the important one!)
		console.log("2. Sending availability alert (should be LOUD)...")
		await notifyAvailability()
		console.log("   ✓ Availability alert sent\n")

		// Test 3: Error notification
		console.log("3. Sending error notification...")
		await notifyError("This is a test error message")
		console.log("   ✓ Error notification sent\n")

		console.log("All tests passed! Check your phone for notifications.")
		console.log(
			"\nIMPORTANT: Make sure the availability alert is loud enough to wake you up!"
		)
	} catch (error) {
		console.error("Test failed:", error.message)
		process.exit(1)
	}
}

runTests()
