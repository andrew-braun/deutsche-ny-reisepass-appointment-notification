/**
 * SMS notification module using TextBelt
 * https://textbelt.com - Simple SMS API
 *
 * Note: Uses curl instead of fetch for consistency with notify.js
 */

import { execSync } from "node:child_process"

const TEXTBELT_API_URL = "https://textbelt.com/text"

/**
 * Send an SMS via TextBelt
 * @param {string} phone - The phone number to send to (e.g., "5551234567" or "+15551234567")
 * @param {string} message - The SMS message (max 160 chars recommended)
 * @param {object} options - Optional settings
 * @param {string} options.key - TextBelt API key (defaults to env TEXTBELT_API_KEY, or "textbelt" for free tier)
 * @returns {Promise<boolean>} - True if successful
 */
export async function sendSMS(phone, message, options = {}) {
	const apiKey = options.key || process.env.TEXTBELT_API_KEY || "textbelt"

	// Escape single quotes in phone and message for shell safety
	const escapedPhone = phone.replace(/'/g, "'\\''")
	const escapedMessage = message.replace(/'/g, "'\\''")

	// Build curl command for TextBelt API (uses form encoding, not JSON)
	let cmd = `curl -s -X POST "${TEXTBELT_API_URL}"`

	// Add proxy if NA_PROXY_SERVER is configured
	const naProxy = process.env.NA_PROXY_SERVER
	if (naProxy) {
		// Parse proxy URL to extract credentials
		// Format: http://host:port:username:password or http://username:password@host:port
		let proxyUrl
		if (naProxy.includes("@")) {
			// Standard format: http://username:password@host:port
			proxyUrl = naProxy
		} else {
			// ProxyEmpire format: http://host:port:username:password
			const match = naProxy.match(/^(https?:\/\/)([^:]+):(\d+):([^:]+):(.+)$/)
			if (match) {
				const [, protocol, host, port, username, password] = match
				proxyUrl = `${protocol}${username}:${password}@${host}:${port}`
			} else {
				proxyUrl = naProxy
			}
		}

		cmd += ` -x "${proxyUrl}"`
	}

	cmd += ` \
		--data-urlencode 'phone=${escapedPhone}' \
		--data-urlencode 'message=${escapedMessage}' \
		-d 'key=${apiKey}'`

	try {
		const response = execSync(cmd, { encoding: "utf8", timeout: 15000 })
		const result = JSON.parse(response)

		if (!result.success) {
			throw new Error(`TextBelt API error: ${result.error || "Unknown error"}`)
		}

		// Log quota info if available
		if (result.quotaRemaining !== undefined) {
			console.log(
				`[SMS] Message sent. Quota remaining: ${result.quotaRemaining}`
			)
		}

		return true
	} catch (err) {
		throw new Error(`SMS send failed: ${err.message}`)
	}
}

/**
 * Get list of phone numbers from environment variable
 * Supports both SMS_PHONE_NUMBER (single) and SMS_PHONE_NUMBERS (comma-separated)
 * @returns {string[]} Array of phone numbers
 */
function getPhoneNumbers() {
	const phones = []

	// Support new SMS_PHONE_NUMBERS (comma-separated)
	if (process.env.SMS_PHONE_NUMBERS) {
		const numbers = process.env.SMS_PHONE_NUMBERS.split(",")
			.map((num) => num.trim())
			.filter((num) => num.length > 0)
		phones.push(...numbers)
	}

	// Remove duplicates
	return [...new Set(phones)]
}

function getErrorPhoneNumbers() {
	const phones = []

	if (process.env.ERROR_PHONE_NUMBERS) {
		const numbers = process.env.ERROR_PHONE_NUMBERS.split(",")
			.map((num) => num.trim())
			.filter((num) => num.length > 0)
		phones.push(...numbers)
	}

	// Remove duplicates
	return [...new Set(phones)]
}

/**
 * Send an availability alert via SMS to all configured phone numbers
 * @param {string|string[]} phone - Single phone number or array of phone numbers (optional - uses env if not provided)
 */
export async function smsAvailability(phone) {
	const message =
		"🚨 APPOINTMENT SLOTS MAY BE AVAILABLE at German Consulate NY!"
	// Check immediately: https://service2.diplo.de/rktermin/extern/appointment_showMonth.do?locationCode=newy&realmId=683&categoryId=2673

	// If phone is provided, use it; otherwise get from env
	const phones = phone
		? Array.isArray(phone)
			? phone
			: [phone]
		: getPhoneNumbers()

	if (phones.length === 0) {
		throw new Error("No phone numbers configured for SMS")
	}

	// Send to all phone numbers
	const results = await Promise.allSettled(
		phones.map((num) => sendSMS(num, message))
	)

	// Check if any succeeded
	const succeeded = results.filter((r) => r.status === "fulfilled").length
	const failed = results.filter((r) => r.status === "rejected").length

	console.log(
		`[SMS] Availability alert sent to ${succeeded}/${phones.length} numbers`
	)

	if (failed > 0) {
		const errors = results
			.filter((r) => r.status === "rejected")
			.map((r) => r.reason.message)
		console.error(
			`[SMS] Failed to send to ${failed} numbers: ${errors.join("; ")}`
		)
	}

	return succeeded > 0
}

/**
 * Send an error notification via SMS to all configured phone numbers
 * @param {string|string[]} phone - Single phone number or array of phone numbers (optional - uses env if not provided)
 * @param {string} errorMessage - The error message
 */
export async function smsError(phone, errorMessage) {
	// Handle both old API (phone, message) and new API (message only)
	let phones
	let actualMessage

	if (typeof phone === "string" && phone.match(/^\+?\d+$/)) {
		// phone is actually a phone number
		phones = Array.isArray(phone) ? phone : [phone]
		actualMessage = errorMessage
	} else {
		// phone is actually the error message (new API)
		phones = getErrorPhoneNumbers()
		actualMessage = typeof phone === "string" ? phone : errorMessage
	}

	if (phones.length === 0) {
		throw new Error("No phone numbers configured for SMS")
	}

	// Send to all phone numbers
	const results = await Promise.allSettled(
		phones.map((num) =>
			sendSMS(num, `⚠️ German Consulate checker error: ${actualMessage}`)
		)
	)

	// Check if any succeeded
	const succeeded = results.filter((r) => r.status === "fulfilled").length
	const failed = results.filter((r) => r.status === "rejected").length

	console.log(`[SMS] Error alert sent to ${succeeded}/${phones.length} numbers`)

	if (failed > 0) {
		const errors = results
			.filter((r) => r.status === "rejected")
			.map((r) => r.reason.message)
		console.error(
			`[SMS] Failed to send to ${failed} numbers: ${errors.join("; ")}`
		)
	}

	return succeeded > 0
}
