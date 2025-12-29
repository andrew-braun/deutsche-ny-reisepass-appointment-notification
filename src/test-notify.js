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
import { sendSMS, smsAvailability, smsError } from "./notify-sms.js"
import { notify, notifyAvailability, notifyError } from "./notify.js"

// Parse command-line arguments
const args = process.argv.slice(2)
const testMode = args[0] // 'ntfy', 'sms', or undefined (all)

async function runTests() {
	const shouldTestNtfy = !testMode || testMode === "ntfy"
	const shouldTestSms = !testMode || testMode === "sms"

	console.log("Testing notification systems...\n")

	if (shouldTestNtfy) {
		console.log("=".repeat(50))
		console.log("NTFY PUSH NOTIFICATIONS")
		console.log("=".repeat(50))
		console.log(`Using topic: ${process.env.NTFY_TOPIC}\n`)
	}

	try {
		if (shouldTestNtfy) {
			// Test 1: Basic notification
			console.log("1. Sending basic ntfy notification...")
			await notify("Test message from consulate checker")
			console.log("   ✓ Basic notification sent\n")

			// Test 2: Availability alert (this is the important one!)
			console.log("2. Sending ntfy availability alert (should be LOUD)...")
			await notifyAvailability()
			console.log("   ✓ Availability alert sent\n")

			// Test 3: Error notification
			console.log("3. Sending ntfy error notification...")
			await notifyError("This is a test error message")
			console.log("   ✓ Error notification sent\n")

			console.log("✓ All ntfy tests passed!\n")
		}

		// SMS Tests (optional - only if phone number is configured)
		if (shouldTestSms) {
			const smsPhone = process.env.SMS_PHONE_NUMBER
			const smsPhones = process.env.SMS_PHONE_NUMBERS
			const hasPhoneNumbers = smsPhone || smsPhones

			if (hasPhoneNumbers) {
				// Parse phone numbers
				const phoneList = []
				if (smsPhone) phoneList.push(smsPhone)
				if (smsPhones) {
					phoneList.push(...smsPhones.split(",").map((num) => num.trim()))
				}
				const uniquePhones = [...new Set(phoneList)]

				console.log("=".repeat(50))
				console.log("SMS NOTIFICATIONS (TextBelt)")
				console.log("=".repeat(50))
				console.log(
					`Sending to ${uniquePhones.length} number(s): ${uniquePhones.join(
						", "
					)}\n`
				)

				// Test 4: Basic SMS (to first number only for quota conservation)
				console.log("4. Sending basic SMS (to first number only)...")
				await sendSMS(uniquePhones[0], "Test SMS from German Consulate checker")
				console.log("   ✓ Basic SMS sent\n")

				// Test 5: Availability alert SMS (to all numbers)
				console.log("5. Sending SMS availability alert (to all numbers)...")
				await smsAvailability()
				console.log("   ✓ Availability SMS sent\n")

				// Test 6: Error SMS (to all numbers)
				console.log("6. Sending SMS error notification (to all numbers)...")
				await smsError("This is a test error message")
				console.log("   ✓ Error SMS sent\n")

				console.log("✓ All SMS tests passed!\n")
			} else {
				console.log("=".repeat(50))
				console.log("SMS NOTIFICATIONS - SKIPPED")
				console.log("=".repeat(50))
				console.log(
					"To enable SMS notifications, add SMS_PHONE_NUMBER or SMS_PHONE_NUMBERS to your .env file"
				)
				console.log("Examples:")
				console.log("  SMS_PHONE_NUMBER=5551234567")
				console.log("  SMS_PHONE_NUMBERS=5551234567,5559876543,+15551112222\n")
			}
		}

		console.log("=".repeat(50))
		console.log("ALL TESTS COMPLETED")
		console.log("=".repeat(50))
		console.log("Check your phone for notifications!")
		console.log(
			"\nIMPORTANT: Make sure the availability alerts are loud enough to wake you up!"
		)
	} catch (error) {
		console.error("\n❌ Test failed:", error.message)
		process.exit(1)
	}
}

runTests()
