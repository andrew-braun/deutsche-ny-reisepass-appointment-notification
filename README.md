# German Consulate NYC Appointment Checker

Automated monitoring tool that checks the German Consulate NYC passport appointment booking page for available slots and sends instant push notifications when availability is detected.

## Features

- 🔄 **Automated monitoring** with adaptive check intervals
- 🧩 **Automatic captcha solving** using CapSolver API
- ⏰ **Time-based scheduling** - more frequent checks during peak release windows (midnight Germany time)
- 📱 **Instant push notifications** via ntfy.sh when appointments become available
- 💬 **SMS alerts** (optional) via TextBelt for critical notifications
- 🛡️ **Robust error handling** - continues running even if individual checks fail
- 🎭 **Stealth-friendly** - randomized intervals and realistic browser behavior

## Prerequisites

- **Node.js 24+** (uses native fetch and top-level await)
- **pnpm** package manager
- **curl** command-line tool (usually pre-installed)
- **CapSolver API key** - Sign up at [capsolver.com](https://capsolver.com)
- **ntfy.sh topic** - Choose a unique topic name for notifications
- **TextBelt API key** (optional) - For SMS notifications, sign up at [textbelt.com](https://textbelt.com)

## Setup

1. **Install dependencies:**

```bash
cd app
pnpm install
```

2. **Install Playwright browsers:**

```bash
pnpm exec playwright install chromium
```

3. **Configure environment variables:**

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
ANTHROPIC_API_KEY=your-anthropic-api-key-here
CAPSOLVER_API_KEY=your-capsolver-api-key-here
NTFY_TOPIC=your-unique-topic-name
APPOINTMENT_URL=https://service2.diplo.de/rktermin/extern/appointment_showMonth.do?locationCode=newy&realmId=683&categoryId=2673

# Optional
HEADLESS=true    # Set to false to see browser
DEBUG=false      # Set to true for verbose logging

# SMS notifications (optional)
SMS_PHONE_NUMBER=5551234567              # Single phone number
SMS_PHONE_NUMBERS=5551234567,5559876543  # Or multiple (comma-separated)
TEXTBELT_API_KEY=textbelt                # Use "textbelt" for 1 free SMS/day, or get a paid key

# Proxy (optional - use if your server's IP is blocked)
PROXY_SERVER=    # Example: socks5://localhost:9050 or http://user:pass@proxy:port
```

**Note on Proxies**: If your server's IP is blocked by the German consulate website (connection timeouts), you'll need to route traffic through a proxy. See the "Proxy Configuration" section below.

4. **Test notifications:**

```bash
pnpm test:notify
```

You should receive a test notification on your phone/desktop via [ntfy.sh/your-topic-name](https://ntfy.sh)

5. **Test the checker:**

```bash
# Test with visible browser and debug logging
HEADLESS=false DEBUG=true pnpm test:checker
```

## Usage

### Running Locally

```bash
# Start the scheduler (headless mode)
pnpm start

# Run with visible browser for debugging
HEADLESS=false pnpm start

# Run with debug logging
DEBUG=true pnpm start
```

Press `Ctrl+C` to stop gracefully.

### Running in Production (PM2)

1. **Install PM2 globally:**

```bash
npm install -g pm2
```

2. **Start the checker:**

```bash
pm2 start src/index.js --name consulate-checker
```

3. **Enable auto-restart on server reboot:**

```bash
pm2 startup
pm2 save
```

4. **Monitor logs:**

```bash
# View logs
pm2 logs consulate-checker

# View status
pm2 status

# Restart
pm2 restart consulate-checker

# Stop
pm2 stop consulate-checker
```

## How It Works

1. **Scheduler** (`src/index.js`) runs checks at adaptive intervals:
   - **Peak** (23:00-02:00 CET): Every 2-5 minutes
   - **Off-peak** (02:00-23:00 CET): Every 30-60 minutes

2. **Browser Checker** (`src/checker.js`) for each check:
   - Launches headless Chromium via Playwright
   - Navigates to appointment page
   - Detects and solves captcha automatically (up to 3 retry attempts)
   - Checks for "no appointments" message
   - Checks both current month and next month

3. **Notifications** (`src/notify.js`, `src/notify-sms.js`):
   - Sends urgent push notification via ntfy.sh when appointments are found
   - Optionally sends SMS via TextBelt if phone number is configured
   - Sends error notifications on failures
   - Uses curl to avoid Node.js network issues

## Project Structure

```
app/
├── src/
│   ├── index.js                   # Main scheduler and entry point
│   ├── checker.js                 # Playwright browser automation
│   ├── captcha-solver-capsolver.js # CapSolver API integration
│   ├── captcha-solver.js          # Claude Vision API (backup)
│   ├── notify.js                  # ntfy.sh push notifications
│   ├── notify-sms.js              # TextBelt SMS notifications
│   ├── notify-all.js              # Unified notification sender
│   ├── test-checker.js            # Test the checker
│   ├── test-captcha.js            # Test captcha solving
│   ├── test-notify.js             # Test notifications (ntfy + SMS)
│   └── capture-captcha.js         # Capture real captchas for testing
├── .env                           # Configuration (gitignored)
├── .env.example                   # Configuration template
├── package.json
└── README.md
```

## Proxy Configuration

If your server's IP address or datacenter is blocked by the German consulate website (you'll see connection timeouts), you need to route traffic through a proxy.

### Option 1: SSH Tunnel (FREE - Recommended)

If the checker works on your local machine, tunnel traffic through it:

**On your local machine** (where it works):

```bash
# Install and keep this running
ssh -R 9050:localhost:9050 root@your-server-ip -N
```

**On your server**, add to `.env`:

```env
PROXY_SERVER=socks5://localhost:9050
```

This creates a reverse SSH tunnel that routes all Playwright traffic through your local machine's network connection.

### Option 2: Commercial Proxy Service

Use a residential proxy service to avoid IP blocking:

1. **WebShare.io** (Budget option - ~$3/month)
   - Sign up at [webshare.io](https://www.webshare.io)
   - Get proxy credentials
   - Add to `.env`: `PROXY_SERVER=http://username:password@proxy.webshare.io:port`

2. **BrightData** (Premium - better reliability)
   - Sign up at [brightdata.com](https://brightdata.com)
   - Use residential proxies for best results
   - Add to `.env`: `PROXY_SERVER=http://username:password@brd.superproxy.io:port`

3. **Oxylabs** (Enterprise)
   - Similar to BrightData
   - Add to `.env`: `PROXY_SERVER=http://username:password@proxy.oxylabs.io:port`

### Testing Proxy Connection

After configuring a proxy, test that it works:

```bash
DEBUG=true pnpm test:checker
```

You should see in the debug output:

```text
[DEBUG] Using proxy: socks5://localhost:9050
[DEBUG] Request: GET https://service2.diplo.de/...
[DEBUG] Response: 200 https://service2.diplo.de/...
```

## Troubleshooting

### Notifications not working

**For ntfy.sh push notifications:**

1. Test curl directly:
   ```bash
   curl -d "Test message" ntfy.sh/your-topic-name
   ```

2. Make sure your `NTFY_TOPIC` in `.env` is set correctly

3. Check you're subscribed to the topic in the ntfy app/web

**For SMS notifications:**

1. Make sure `SMS_PHONE_NUMBER` or `SMS_PHONE_NUMBERS` is set in `.env`
   - Single number: `SMS_PHONE_NUMBER=5551234567`
   - Multiple numbers: `SMS_PHONE_NUMBERS=5551234567,5559876543,+15551112222`

2. Test with the free tier first (uses `TEXTBELT_API_KEY=textbelt`)
   - Free tier: 1 SMS per day per phone number
   - For unlimited SMS, get a paid key from [textbelt.com](https://textbelt.com)

3. Check TextBelt quota:
   ```bash
   curl https://textbelt.com/quota/textbelt
   ```

4. Note: When appointments are found, SMS is sent to ALL configured phone numbers

### Captcha solving failures

- CapSolver should have >95% accuracy with `module_005`
- Check your CapSolver API key is valid and has credits
- The checker automatically retries up to 3 times per captcha

### Browser crashes or hangs

- Set `HEADLESS=false DEBUG=true` to see what's happening
- Make sure you have enough RAM (Chromium needs ~500MB per instance)
- Check Playwright installation: `pnpm exec playwright install chromium`

### Connection timeouts / IP blocking

**Symptoms**: `Failed to connect to service2.diplo.de port 443` or `Connection timed out`

**Cause**: The German consulate website blocks certain datacenter IPs (Linode, AWS, etc.) to prevent bots

**Solution**: Configure a proxy - see the "Proxy Configuration" section above. The FREE SSH tunnel option works great if the checker runs successfully on your local machine.

**Quick test**:

```bash
# On your server, test if you can reach the site
curl -I 'https://service2.diplo.de/rktermin/extern/appointment_showMonth.do?locationCode=newy&realmId=683&categoryId=2673'

# If this times out, you need a proxy
```

### High CapSolver costs

- Reduce check frequency by increasing off-peak intervals in `src/index.js`
- Each check costs approximately 1 CapSolver credit (~$0.001)
- Expected monthly cost: ~$5-10 depending on intervals

## Development

### Testing Individual Modules

```bash
# Test notifications
pnpm test:notify

# Test captcha solver with an image
pnpm test:captcha screenshots/captcha.png

# Test captcha solver with Claude Vision
pnpm test:captcha screenshots/captcha.png --claude

# Capture a real captcha from the site
pnpm capture:captcha

# Test the full checker
pnpm test:checker
```

## License

ISC

## Disclaimer

This tool is for personal use only. Be respectful of the consulate's servers and don't abuse the system. The author is not responsible for any misuse or consequences of using this tool.
