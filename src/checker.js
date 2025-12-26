import dotenv from "dotenv"
import { chromium } from "playwright"
import { solveCaptchaCapSolver } from "./captcha-solver-capsolver.js"

dotenv.config()

const APPOINTMENT_URL = process.env.APPOINTMENT_URL
const HEADLESS = process.env.HEADLESS !== "false"
const DEBUG = process.env.DEBUG === "true"
const PROXY_SERVER = process.env.PROXY_SERVER || null

/**
 * Check for appointment availability
 * @returns {Promise<{available: boolean, message: string, screenshot?: string}>}
 */
export async function checkAppointments() {
	const launchOptions = {
		headless: HEADLESS,
		args: [
			"--disable-blink-features=AutomationControlled",
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage", // Helps with Docker/container environments
			"--disable-gpu",
			"--disable-software-rasterizer",
		],
	}

	// Add proxy configuration if provided
	if (PROXY_SERVER) {
		// Parse proxy URL to extract credentials
		const proxyUrl = new URL(PROXY_SERVER)

		launchOptions.proxy = {
			server: `${proxyUrl.protocol}//${proxyUrl.host}`,
		}

		// Add credentials if present in the URL
		if (proxyUrl.username && proxyUrl.password) {
			launchOptions.proxy.username = proxyUrl.username
			launchOptions.proxy.password = proxyUrl.password
		}

		// Ignore SSL certificate errors (needed for BrightData and similar proxies)
		launchOptions.ignoreHTTPSErrors = true
		if (DEBUG) {
			console.log(`[DEBUG] Using proxy: ${proxyUrl.protocol}//${proxyUrl.host}`)
			console.log(
				`[DEBUG] Proxy credentials configured: ${
					proxyUrl.username ? "Yes" : "No"
				}`
			)
		}
	}

	const browser = await chromium.launch(launchOptions)

	try {
		// Create context with ignoreHTTPSErrors if using proxy
		const contextOptions = {}
		if (PROXY_SERVER) {
			contextOptions.ignoreHTTPSErrors = true
		}

		const context = await browser.newContext(contextOptions)
		const page = await context.newPage()

		// Set viewport
		await page.setViewportSize({ width: 1280, height: 720 })

		// Set a realistic user agent
		await page.setExtraHTTPHeaders({
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			"Accept-Language": "en-US,en;q=0.9",
		})

		// Override navigator.webdriver
		await page.addInitScript(() => {
			Object.defineProperty(navigator, "webdriver", {
				get: () => undefined,
			})
		})

		// Debug: Log network requests and responses
		if (DEBUG) {
			page.on("request", (request) => {
				console.log(`[DEBUG] Request: ${request.method()} ${request.url()}`)
			})
			page.on("response", (response) => {
				console.log(`[DEBUG] Response: ${response.status()} ${response.url()}`)
			})
			page.on("requestfailed", (request) => {
				console.log(
					`[DEBUG] Request failed: ${request.url()} - ${
						request.failure()?.errorText
					}`
				)
			})
		}

		if (DEBUG) {
			console.log(`[DEBUG] Navigating to: ${APPOINTMENT_URL}`)
		}

		// Step 1: Navigate to the appointment page
		// Use 'domcontentloaded' instead of 'networkidle' for better reliability
		try {
			await page.goto(APPOINTMENT_URL, {
				waitUntil: "domcontentloaded",
				timeout: 30000, // Increased timeout for slow networks
			})
			if (DEBUG) {
				console.log("[DEBUG] Navigation successful with domcontentloaded")
			}
		} catch (error) {
			if (DEBUG) {
				console.log(
					`[DEBUG] Navigation error: ${error.message}, trying without waiting...`
				)
			}
			// If navigation times out, try again with commit wait
			await page.goto(APPOINTMENT_URL, {
				waitUntil: "commit",
				timeout: 30000,
			})
			if (DEBUG) {
				console.log("[DEBUG] Navigation successful with commit")
			}
		}

		// Wait for dynamic content to load
		await page.waitForTimeout(3000)

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
		await page.waitForLoadState("domcontentloaded", { timeout: 30000 })

		// Wait a bit more for dynamic content
		await page.waitForTimeout(2000)

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
			// Get current URL and page title for debugging
			const url = page.url()
			const title = await page.title()
			console.log(`[DEBUG] Current URL: ${url}`)
			console.log(`[DEBUG] Page title: ${title}`)

			// Check what we can find on the page
			const bodyText = await page.locator("body").textContent()
			console.log(
				`[DEBUG] Page body (first 500 chars): ${bodyText?.substring(0, 500)}`
			)
		}
		throw new Error(
			"Not on expected appointments page - check debug logs for details"
		)
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
	await page.waitForLoadState("domcontentloaded", { timeout: 30000 })

	// Wait a bit for dynamic content
	await page.waitForTimeout(2000)

	// Check availability on the new page
	return await checkPageForAvailability(page)
}
