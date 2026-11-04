#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../worker"
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<24 || (major===24 && minor<15) || (major===25 && minor<9)) throw new Error("Use Node.js 24.15+, 25.9+, or 26+")'
npm ci --no-audit --no-fund
npm run build:web
npx playwright install chromium
npm test
printf '\nSetup complete. Read README-iMac.md before connecting production services.\n'
