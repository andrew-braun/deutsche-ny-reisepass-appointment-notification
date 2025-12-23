/**
 * Push notification module using ntfy.sh
 * https://ntfy.sh - simple HTTP-based pub/sub notifications
 *
 * Note: Uses curl instead of fetch due to Node.js undici network issues
 * on some servers (ETIMEDOUT with IPv4/IPv6 dual-stack)
 */

import { execSync } from "node:child_process"

const NTFY_BASE_URL = "https://ntfy.sh"

/**
 * Send a push notification via ntfy.sh
 * @param {string} message - The notification message
 * @param {object} options - Optional settings
 * @param {string} options.title - Notification title
 * @param {string} options.priority - Priority: min, low, default, high, urgent
 * @param {string[]} options.tags - Emoji tags (e.g., ['warning', 'skull'])
 */
export async function notify(message, options = {}) {
	const topic = process.env.NTFY_TOPIC

	if (!topic) {
		throw new Error("NTFY_TOPIC environment variable is not set")
	}

	// Build curl command with headers
	const headers = []

	if (options.title) {
		headers.push(`-H "Title: ${options.title}"`)
	}

	if (options.priority) {
		headers.push(`-H "Priority: ${options.priority}"`)
	}

	if (options.tags && options.tags.length > 0) {
		headers.push(`-H "Tags: ${options.tags.join(",")}"`)
	}

	const url = `${NTFY_BASE_URL}/${topic}`
	const escapedMessage = message.replace(/"/g, '\\"')
	const cmd = `curl -s ${headers.join(" ")} -d "${escapedMessage}" "${url}"`

	try {
		execSync(cmd, { encoding: "utf8", timeout: 10000 })
		return true
	} catch (err) {
		throw new Error(`ntfy.sh curl failed: ${err.message}`)
	}
}

/**
 * Send an availability alert (high priority, loud)
 */
export async function notifyAvailability() {
	return notify("🚨 APPOINTMENT SLOTS MAY BE AVAILABLE! Check immediately!", {
		title: "German Consulate - Appointments Available!",
		priority: "urgent",
		tags: ["rotating_light", "de"],
	})
}

/**
 * Send an error notification
 */
export async function notifyError(errorMessage) {
	return notify(`Checker error: ${errorMessage}`, {
		title: "Consulate Checker Error",
		priority: "high",
		tags: ["warning"],
	})
}
