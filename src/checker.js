import { chromium } from "playwright"
import { solveCaptchaCapSolver } from "./captcha-solver-capsolver.js"
import dotenv from "dotenv"

dotenv.config()

const APPOINTMENT_URL = process.env.APPOINTMENT_URL
const HEADLESS = process.env.HEADLESS !== "false"
const DEBUG = process.env.DEBUG === "true"

/**
 * Check for appointment availability
 * @returns {Promise<{available: boolean, message: string, screenshot?: string}>}
 */
export async function checkAppointments() {
	const browser = await chromium.launch({
		headless: HEADLESS,
	})

	try {
		const page = await browser.newPage()

		if (DEBUG) {
			console.log(`[DEBUG] Navigating to: ${APPOINTMENT_URL}`)
		}

		// Step 1: Navigate to the appointment page
		await page.goto(APPOINTMENT_URL, { waitUntil: "networkidle" })

		// Step 2: Check for and solve captcha if present
		// Captcha is in a div with background-image containing base64 data
		const captchaPresent = await page.locator('div[style*="background"][style*="data:image"]').count()

		if (captchaPresent > 0) {
			if (DEBUG) {
				console.log("[DEBUG] Captcha detected, solving...")
			}

			await solveCaptchaAndSubmit(page)
		} else {
			if (DEBUG) {
				console.log("[DEBUG] No captcha detected")
			}
		}

		// Step 3: Check current month for availability
		const currentMonthAvailable = await checkPageForAvailability(page)

		if (currentMonthAvailable) {
			if (DEBUG) {
				console.log("[DEBUG] Appointments available in current month!")
			}

			// Take screenshot if available
			let screenshot = null
			if (DEBUG) {
				screenshot = await page.screenshot({ fullPage: true })
			}

			return {
				available: true,
				message: "Appointments available in current month!",
				screenshot: screenshot?.toString("base64"),
			}
		}

		if (DEBUG) {
			console.log("[DEBUG] No appointments in current month, checking next month...")
		}

		// Step 4: Click "next month" button and check again
		const nextMonthAvailable = await checkNextMonth(page)

		if (nextMonthAvailable) {
			if (DEBUG) {
				console.log("[DEBUG] Appointments available in next month!")
			}

			let screenshot = null
			if (DEBUG) {
				screenshot = await page.screenshot({ fullPage: true })
			}

			return {
				available: true,
				message: "Appointments available in next month!",
				screenshot: screenshot?.toString("base64"),
			}
		}

		if (DEBUG) {
			console.log("[DEBUG] No appointments available")
		}

		return {
			available: false,
			message: "No appointments available in current or next month",
		}
	} catch (error) {
		if (DEBUG) {
			console.error("[DEBUG] Error during check:", error)
		}
		throw error
	} finally {
		await browser.close()
	}
}

/**
 * Detect and solve captcha, then submit
 * @private
 */
async function solveCaptchaAndSubmit(page) {
	// The captcha image is in a div with background-image style
	// Find the div that contains the captcha (has a long ID and background-image with base64 data)
	const captchaDiv = page.locator('div[style*="background"][style*="data:image"]').first()

	if (DEBUG) {
		console.log("[DEBUG] Found captcha div, taking screenshot...")
	}

	// Get the image as base64 by taking a screenshot of the div
	const imageBuffer = await captchaDiv.screenshot()
	const imageBase64 = imageBuffer.toString("base64")

	if (DEBUG) {
		console.log("[DEBUG] Captcha image extracted, sending to CapSolver...")
	}

	// Solve the captcha
	const captchaText = await solveCaptchaCapSolver(imageBase64, {
		module: "module_005",
	})

	if (DEBUG) {
		console.log(`[DEBUG] Captcha solved: "${captchaText}"`)
	}

	// Find the captcha input field by name
	const captchaInput = page.locator('input[name="captchaText"]')

	// Fill in the captcha
	await captchaInput.fill(captchaText)

	if (DEBUG) {
		console.log("[DEBUG] Captcha text entered, clicking Continue button...")
	}

	// Click the "Continue" button (id="appointment_captcha_month_appointment_showMonth")
	const continueButton = page.locator('#appointment_captcha_month_appointment_showMonth')

	await continueButton.click()

	if (DEBUG) {
		console.log("[DEBUG] Continue button clicked, waiting for navigation...")
	}

	// Wait for navigation after submitting captcha
	await page.waitForLoadState("networkidle")

	if (DEBUG) {
		console.log("[DEBUG] Captcha submitted successfully")
	}
}

/**
 * Check the current page for the "no appointments" message
 * @private
 * @returns {Promise<boolean>} true if appointments are available
 */
async function checkPageForAvailability(page) {
	// Look for the H2 element with the "no appointments" message
	const noAppointmentsH2 = page.locator(
		'h2:has-text("Unfortunately, there are no appointments available")'
	)

	const count = await noAppointmentsH2.count()

	// If the H2 is NOT found, appointments might be available
	const available = count === 0

	if (DEBUG) {
		console.log(
			`[DEBUG] Availability check: ${available ? "AVAILABLE" : "NOT AVAILABLE"} (no-appointments h2 count: ${count})`
		)
	}

	return available
}

/**
 * Click next month button and check for availability
 * @private
 * @returns {Promise<boolean>} true if appointments are available next month
 */
async function checkNextMonth(page) {
	// Find the "next month" navigation button
	// It's an <a> tag containing an <img src="images/go-next.gif"/>
	const nextMonthLink = page.locator('a img[src="images/go-next.gif"]').locator('..')

	if ((await nextMonthLink.count()) === 0) {
		if (DEBUG) {
			console.log("[DEBUG] No next month button found")
		}
		return false
	}

	if (DEBUG) {
		console.log("[DEBUG] Found next month button, clicking...")
	}

	// Click the next month link
	await nextMonthLink.first().click()

	if (DEBUG) {
		console.log("[DEBUG] Clicked next month button, waiting for page load...")
	}

	// Wait for the page to load
	await page.waitForLoadState("networkidle")

	// Check availability on the new page
	return await checkPageForAvailability(page)
}
