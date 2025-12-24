# German Consulate NYC Appointment Checker

Automated monitoring tool that checks the German Consulate NYC passport appointment booking page for available slots and sends instant push notifications when availability is detected.

## Features

- 🔄 **Automated monitoring** with adaptive check intervals
- 🧩 **Automatic captcha solving** using CapSolver API
- ⏰ **Time-based scheduling** - more frequent checks during peak release windows (midnight Germany time)
- 📱 **Instant push notifications** via ntfy.sh when appointments become available
- 🛡️ **Robust error handling** - continues running even if individual checks fail
- 🎭 **Stealth-friendly** - randomized intervals and realistic browser behavior

## Prerequisites

- **Node.js 24+** (uses native fetch and top-level await)
- **pnpm** package manager
- **curl** command-line tool (usually pre-installed)
- **CapSolver API key** - Sign up at [capsolver.com](https://capsolver.com)
- **ntfy.sh topic** - Choose a unique topic name for notifications

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
```

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

3. **Notifications** (`src/notify.js`):
   - Sends urgent push notification when appointments are found
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
│   ├── notify.js                  # ntfy.sh notifications
│   ├── test-checker.js            # Test the checker
│   ├── test-captcha.js            # Test captcha solving
│   ├── test-notify.js             # Test notifications
│   └── capture-captcha.js         # Capture real captchas for testing
├── .env                           # Configuration (gitignored)
├── .env.example                   # Configuration template
├── package.json
└── README.md
```

## Troubleshooting

### Notifications not working

1. Test curl directly:
   ```bash
   curl -d "Test message" ntfy.sh/your-topic-name
   ```

2. Make sure your `NTFY_TOPIC` in `.env` is set correctly

3. Check you're subscribed to the topic in the ntfy app/web

### Captcha solving failures

- CapSolver should have >95% accuracy with `module_005`
- Check your CapSolver API key is valid and has credits
- The checker automatically retries up to 3 times per captcha

### Browser crashes or hangs

- Set `HEADLESS=false DEBUG=true` to see what's happening
- Make sure you have enough RAM (Chromium needs ~500MB per instance)
- Check Playwright installation: `pnpm exec playwright install chromium`

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
