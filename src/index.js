import dotenv from "dotenv"
import { checkAppointments } from "./checker.js"
import { notifyAvailability, notifyError } from "./notify.js"

dotenv.config()

const DEBUG = process.env.DEBUG === "true"

/**
 * Calculate the next check interval based on current time
 * Uses adaptive intervals to check more frequently during peak release times
 *
 * Time windows (Germany CET = EST + 6 hours):
 * - 23:00-02:00 CET (17:00-20:00 EST): 2-5 min  - Peak release window
 * - 02:00-08:00 CET (20:00-02:00 EST): 30-60 min - Overnight low activity
 * - 08:00-23:00 CET (02:00-17:00 EST): 30-60 min - Business hours
 *
 * @returns {number} Interval in milliseconds
 */
function getNextInterval() {
	const now = new Date()

	// Convert to Germany time (CET/CEST)
	const germanyTime = new Date(
		now.toLocaleString("en-US", { timeZone: "Europe/Berlin" })
	)
	const hour = germanyTime.getHours()

	// Peak window: 23:00-02:00 CET (midnight releases)
	if (hour >= 23 || hour < 2) {
		// 2-5 minutes
		const minMs = 1 * 60 * 1000
		const maxMs = 2 * 60 * 1000
		return randomInterval(minMs, maxMs)
	}

	// Off-peak: 02:00-23:00 CET
	// 30-60 minutes
	const minMs = 5 * 60 * 1000
	const maxMs = 15 * 60 * 1000
	return randomInterval(minMs, maxMs)
}

/**
 * Generate a random interval between min and max
 * @param {number} min - Minimum milliseconds
 * @param {number} max - Maximum milliseconds
 * @returns {number} Random interval in milliseconds
 */
function randomInterval(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Format milliseconds to human-readable duration
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration (e.g., "3m 24s" or "45m 12s")
 */
function formatDuration(ms) {
	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`
	}
	return `${seconds}s`
}

/**
 * Main check cycle
 * Runs once, logs result, returns success/failure
 */
async function runCheck() {
	const timestamp = new Date().toISOString()
	console.log(`\n[${timestamp}] Starting appointment check...`)

	try {
		const result = await checkAppointments()

		if (result.available) {
			console.log(`[${timestamp}] 🎉 AVAILABILITY DETECTED!`)
			console.log(`Message: ${result.message}`)

			// Send urgent notification
			await notifyAvailability()
			console.log(`[${timestamp}] ✅ Availability notification sent!`)

			// Continue checking even after finding availability
			// User may want to know if more slots open up
		} else {
			console.log(`[${timestamp}] ℹ️  No availability`)
			console.log(`Message: ${result.message}`)
		}

		return true
	} catch (error) {
		console.error(`[${timestamp}] ❌ Check failed:`, error.message)

		if (DEBUG) {
			console.error("Stack trace:", error.stack)
		}

		// Send error notification
		try {
			await notifyError(error.message)
			console.log(`[${timestamp}] Error notification sent`)
		} catch (notifyErr) {
			console.error(
				`[${timestamp}] Failed to send error notification:`,
				notifyErr.message
			)
		}

		return false
	}
}

/**
 * Main scheduler loop
 * Runs checks at adaptive intervals indefinitely
 */
async function startScheduler() {
	console.log("🚀 German Consulate Appointment Checker")
	console.log("=".repeat(50))
	console.log(`Started at: ${new Date().toLocaleString()}`)
	console.log(`Target URL: ${process.env.APPOINTMENT_URL}`)
	console.log(`Headless mode: ${process.env.HEADLESS !== "false"}`)
	console.log(`Debug mode: ${DEBUG}`)
	console.log("=".repeat(50))
	console.log("\nScheduler active. Press Ctrl+C to stop.\n")

	// Run first check immediately
	await runCheck()

	// Schedule subsequent checks
	while (true) {
		const interval = getNextInterval()
		const nextCheckTime = new Date(Date.now() + interval)

		console.log(
			`\n⏰ Next check in ${formatDuration(
				interval
			)} (at ${nextCheckTime.toLocaleTimeString()})`
		)

		// Wait for the interval
		await new Promise((resolve) => setTimeout(resolve, interval))

		// Run the check
		await runCheck()
	}
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandler() {
	const shutdown = () => {
		console.log("\n\n👋 Shutting down gracefully...")
		console.log(`Stopped at: ${new Date().toLocaleString()}`)
		process.exit(0)
	}

	process.on("SIGINT", shutdown)
	process.on("SIGTERM", shutdown)
}

// Entry point
setupShutdownHandler()
startScheduler().catch((error) => {
	console.error("\n💥 Fatal error in scheduler:", error)
	process.exit(1)
})
