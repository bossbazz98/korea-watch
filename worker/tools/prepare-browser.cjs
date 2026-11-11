// CI runners already include Chrome. Verify it before downloading another browser.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {chromium} = require('playwright');

async function verify(executablePath) {
  const browser = await chromium.launch({executablePath, timeout:15000});
  try {
    const page = await browser.newPage();
    await page.setContent('<p>Browser ready</p>');
    if (await page.textContent('p') !== 'Browser ready') throw Error('Browser could not render the test page');
    console.log(`Verified browser ${browser.version()}: ${executablePath}`);
  } finally { await browser.close(); }
  if (/[\r\n]/.test(executablePath)) throw Error('Invalid browser path');
  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `AGENT_CHROMIUM=${executablePath}\n`);
  return executablePath;
}

async function main() {
  // An explicit override must fail visibly if it is unusable.
  if (process.env.AGENT_CHROMIUM) return verify(process.env.AGENT_CHROMIUM);
  const candidates = [...new Set([
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', chromium.executablePath()
  ])];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try { return await verify(candidate); }
    catch (error) { console.warn(`Browser check failed for ${candidate}: ${error.message}`); }
  }
  console.log('No working browser is installed; installing Playwright Chromium.');
  const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
  const result = spawnSync(process.execPath, [cli, 'install', '--with-deps', 'chromium'], {
    stdio:'inherit', timeout:180000,
    env:{...process.env, PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT:'30000'}
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`Playwright browser installation failed (exit ${result.status}, signal ${result.signal || 'none'})`);
  return verify(chromium.executablePath());
}

module.exports = {prepareBrowser:main};
if (require.main === module) main().catch(error => { console.error(error); process.exitCode=1; });
