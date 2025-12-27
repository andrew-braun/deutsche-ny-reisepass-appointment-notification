/**
 * Unified notification module
 * Sends notifications to all configured channels (ntfy + SMS)
 */

import { smsAvailability, smsError } from "./notify-sms.js"
import { notifyAvailability, notifyError } from "./notify.js"

/**
 * Send availability alert to all configured channels
 * Always sends to ntfy, optionally sends SMS if phone numbers are configured
 */
export async function alertAvailability() {
	const results = []
	const errors = []

	// Always send ntfy notification
	try {
		await notifyAvailability()
		results.push("ntfy")
	} catch (err) {
		errors.push(`ntfy: ${err.message}`)
	}

	// Send SMS if phone numbers are configured
	const hasPhoneNumbers =
		process.env.SMS_PHONE_NUMBER || process.env.SMS_PHONE_NUMBERS
	if (hasPhoneNumbers) {
		try {
			await smsAvailability()
			results.push("SMS")
		} catch (err) {
			errors.push(`SMS: ${err.message}`)
		}
	}

	// Log results
	if (results.length > 0) {
		console.log(`✓ Availability alert sent via: ${results.join(", ")}`)
	}

	if (errors.length > 0) {
		console.error(`⚠️  Some notifications failed: ${errors.join("; ")}`)
	}

	// Return success if at least one notification was sent
	return results.length > 0
}

/**
 * Send error alert to all configured channels
 * Always sends to ntfy, optionally sends SMS if phone numbers are configured
 */
export async function alertError(errorMessage) {
	const results = []
	const errors = []

	// Always send ntfy notification
	try {
		await notifyError(errorMessage)
		results.push("ntfy")
	} catch (err) {
		errors.push(`ntfy: ${err.message}`)
	}

	// Send SMS if phone numbers are configured
	// const hasPhoneNumbers =
	// 	process.env.SMS_PHONE_NUMBER || process.env.SMS_PHONE_NUMBERS
	// if (hasPhoneNumbers) {
	// 	try {
	// 		await smsError(errorMessage)
	// 		results.push("SMS")
	// 	} catch (err) {
	// 		errors.push(`SMS: ${err.message}`)
	// 	}
	// }

	// Log results
	if (results.length > 0) {
		console.log(`✓ Error alert sent via: ${results.join(", ")}`)
	}

	if (errors.length > 0) {
		console.error(`⚠️  Some notifications failed: ${errors.join("; ")}`)
	}

	// Return success if at least one notification was sent
	return results.length > 0
}
