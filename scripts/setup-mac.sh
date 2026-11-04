#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../worker"
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<24 || (major===24 && minor<15) || major===25) throw new Error("Install Node.js 24 LTS (24.15+) first")'
npm ci --no-audit --no-fund
npm run build:web
npx playwright install chromium
npm test
printf '\nSetup complete. Read README-iMac.md before connecting production services.\n'
