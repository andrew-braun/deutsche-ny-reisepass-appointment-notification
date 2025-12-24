import dotenv from "dotenv"
import { chromium } from "playwright"
import { solveCaptchaCapSolver } from "./captcha-solver-capsolver.js"

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
		const captchaPresent = await page
			.locator('div[style*="background"][style*="data:image"]')
			.count()

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
			console.log(
				"[DEBUG] No appointments in current month, checking next month..."
			)
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
	const maxRetries = 3

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		if (DEBUG) {
			console.log(`[DEBUG] Captcha attempt ${attempt}/${maxRetries}`)
		}

		// The captcha image is in a div with background-image style
		// Find the div that contains the captcha (has a long ID and background-image with base64 data)
		const captchaDiv = page
			.locator('div[style*="background"][style*="data:image"]')
			.first()

		// Wait for the captcha div to be visible
		await captchaDiv.waitFor({ state: "visible", timeout: 10000 })

		if (DEBUG) {
			console.log(
				"[DEBUG] Found captcha div, extracting base64 from style attribute..."
			)
		}

		// Extract the base64 image directly from the style attribute
		const styleAttr = await captchaDiv.getAttribute("style")

		// Parse the base64 data from the background-image URL
		// Format: background: ... url('data:image/jpg;base64,/9j/4AAQ...')
		const base64Match = styleAttr.match(/data:image\/[^;]+;base64,([^')]+)/)

		if (!base64Match || !base64Match[1]) {
			throw new Error("Could not extract base64 image from captcha div")
		}

		const imageBase64 = base64Match[1]

		if (DEBUG) {
			console.log(
				`[DEBUG] Extracted base64 image (${imageBase64.length} chars)`
			)
		}

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

		// Clear any existing text and fill in the captcha
		await captchaInput.clear()
		await captchaInput.fill(captchaText)

		// Wait a moment to ensure the text is filled
		await page.waitForTimeout(500)

		if (DEBUG) {
			const filledValue = await captchaInput.inputValue()
			console.log(`[DEBUG] Captcha text entered: "${filledValue}"`)
			console.log("[DEBUG] Clicking Continue button...")
		}

		// Click the "Continue" button (id="appointment_captcha_month_appointment_showMonth")
		const continueButton = page.locator(
			"#appointment_captcha_month_appointment_showMonth"
		)

		await continueButton.click()

		if (DEBUG) {
			console.log("[DEBUG] Continue button clicked, waiting for navigation...")
		}

		// Wait for navigation after submitting captcha
		await page.waitForLoadState("networkidle")

		// Check if we're still on the captcha page (indicates failure)
		const stillOnCaptchaPage =
			(await page.locator('input[name="captchaText"]').count()) > 0

		if (stillOnCaptchaPage) {
			if (DEBUG) {
				console.log("[DEBUG] Captcha was incorrect, retrying...")
			}

			if (attempt === maxRetries) {
				throw new Error(`Failed to solve captcha after ${maxRetries} attempts`)
			}

			// Continue to next iteration to retry
			continue
		}

		// Successfully passed captcha
		if (DEBUG) {
			console.log("[DEBUG] Captcha submitted successfully!")
		}
		return
	}
}

/**
 * Check the current page for the "no appointments" message
 * @private
 * @returns {Promise<boolean>} true if appointments are available
 */
async function checkPageForAvailability(page) {
	// First, verify we're not still on the captcha page
	const onCaptchaPage =
		(await page.locator('input[name="captchaText"]').count()) > 0

	if (onCaptchaPage) {
		if (DEBUG) {
			console.log("[DEBUG] Still on captcha page - something went wrong")
		}
		throw new Error("Still on captcha page after submission")
	}

	// Look for the H2 element with the "no appointments" message
	const noAppointmentsH2 = page.locator(
		'h2:has-text("Unfortunately, there are no appointments available")'
	)

	const count = await noAppointmentsH2.count()

	// Verify we're on the appointments page by checking for month navigation
	const onAppointmentsPage =
		(await page.locator('img[src="images/go-next.gif"]').count()) > 0

	if (!onAppointmentsPage) {
		if (DEBUG) {
			console.log("[DEBUG] Not on appointments page - unexpected page state")
		}
		throw new Error("Not on expected appointments page")
	}

	// If the H2 is NOT found, appointments might be available
	const available = count === 0

	if (DEBUG) {
		console.log(
			`[DEBUG] Availability check: ${
				available ? "AVAILABLE" : "NOT AVAILABLE"
			} (no-appointments h2 count: ${count})`
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
	const nextMonthLink = page
		.locator('a img[src="images/go-next.gif"]')
		.locator("..")

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
