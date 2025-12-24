import dotenv from "dotenv"

dotenv.config()

const API_ENDPOINT = "https://api.capsolver.com/createTask"

/**
 * Solves a captcha image using CapSolver's ImageToText API
 * @param {string} imageBase64 - Base64-encoded image data (without data:image prefix)
 * @param {object} options - Additional options for the captcha
 * @param {string} options.module - Recognition module (e.g., "common", "queueit")
 * @returns {Promise<string>} The solved captcha text
 */
export async function solveCaptchaCapSolver(imageBase64, options = {}) {
	const clientKey = process.env.CAPSOLVER_API_KEY

	if (!clientKey) {
		throw new Error("CAPSOLVER_API_KEY not found in environment variables")
	}

	if (!imageBase64) {
		throw new Error("Image data is required")
	}

	const requestBody = {
		clientKey: clientKey,
		task: {
			type: "ImageToTextTask",
			body: imageBase64,
		},
	}

	// Add optional module parameter
	if (options.module) {
		requestBody.task.module = options.module
	}

	try {
		const response = await fetch(API_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		})

		const data = await response.json()

		// Check for errors
		if (data.errorId && data.errorId !== 0) {
			throw new Error(
				`CapSolver error ${data.errorId}: ${data.errorCode || "Unknown error"}`
			)
		}

		// CapSolver returns results directly in the createTask response
		if (data.status === "ready" && data.solution?.text) {
			console.info("Solved captcha with solution: ", data.solution.text)
			return data.solution.text
		}

		throw new Error(
			`Unexpected response from CapSolver: ${JSON.stringify(data)}`
		)
	} catch (error) {
		if (error.message.includes("CapSolver error")) {
			throw error
		}
		throw new Error(`Failed to solve captcha: ${error.message}`)
	}
}
