import Anthropic from "@anthropic-ai/sdk"
import dotenv from "dotenv"

dotenv.config()

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Solves a captcha image using Claude's vision API
 * @param {string} imageBase64 - Base64-encoded image data (without data:image prefix)
 * @param {string} mediaType - MIME type (e.g., 'image/png', 'image/jpeg')
 * @returns {Promise<string>} The solved captcha text
 */
export async function solveCaptcha(imageBase64, mediaType = "image/png") {
	if (!process.env.ANTHROPIC_API_KEY) {
		throw new Error("ANTHROPIC_API_KEY not found in environment variables")
	}

	if (!imageBase64) {
		throw new Error("Image data is required")
	}

	try {
		const message = await anthropic.messages.create({
			model: "claude-opus-4-5",
			max_tokens: 1024,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "image",
							source: {
								type: "base64",
								media_type: mediaType,
								data: imageBase64,
							},
						},
						{
							type: "text",
							text: `You are an expert at reading distorted captcha text. This image contains a 6-character captcha code.

CRITICAL INSTRUCTIONS:
- The captcha is EXACTLY 6 characters long (letters and/or numbers)
- All letters are LOWERCASE (never uppercase)
- Common confusions to avoid:
  * The number "4" vs letter "A" - if it looks angular with crossing lines, it's "4"
  * The number "5" vs letter "S" - if it has a flat top and curved bottom, it's "5"
  * The letter "n" vs "m" - count the humps carefully
  * The letter "d" vs "a" - look for the vertical line on the right for "d"
  * The number "3" vs letter "e" - "3" has two curves, "e" is more circular
- Ignore any lines, noise, or distortions around the characters
- Return ONLY the 6 lowercase characters with no spaces, punctuation, or explanation

Example format: abc123

Now read the captcha and return exactly 6 characters:`,
						},
					],
				},
			],
		})

		const captchaText = message.content[0].text.trim()

		if (!captchaText) {
			throw new Error("Claude returned empty response")
		}

		return captchaText
	} catch (error) {
		if (error.status === 401) {
			throw new Error("Invalid Anthropic API key")
		} else if (error.status === 429) {
			throw new Error("Rate limit exceeded on Anthropic API")
		} else if (error.status >= 500) {
			throw new Error(`Anthropic API server error: ${error.message}`)
		}
		throw new Error(`Captcha solving failed: ${error.message}`)
	}
}
