# CI browser preparation

The failing checks for commit `218a683` stopped at `npx playwright install --with-deps chromium`, before `npm test`. The installer could not fetch font packages because the runner could not resolve `azure.archive.ubuntu.com`; APT exited with code 100. The runner's Ubuntu migration notice does not establish that the application or Node version failed.

Both browser workflows now use `ubuntu-24.04` explicitly and run `worker/tools/prepare-browser.cjs`. This first launches the Chrome/Chromium already installed on the runner, renders a local test page and closes the browser. Only after that verification does it publish `AGENT_CHROMIUM` through `GITHUB_ENV` for the subsequent tests or agent check.

If no installed browser works, the script falls back to Playwright installation, with a three-minute limit, and verifies that binary too. An installation or launch failure still fails the job. It does not skip UI tests. An explicit `AGENT_CHROMIUM` override must work and is never silently replaced.

The existing Node 24 and 25.9.0 matrix, application tests and Firestore rules checks remain enabled. No Firebase configuration, credentials, runtime application code or alert policy changes are needed for this CI fix.

Verification:

- Browser selection, explicit override failure, package CLI fallback and installation failure are covered by `worker/tools/prepare-browser.test.cjs` on both Node versions.
- A real Chromium launch and page render are checked with both Node versions, including the environment file consumed by later CI steps.
- The workflow files are parsed as YAML and their runner and browser-preparation steps are checked.
- Firestore emulator testing in the managed cloud remains blocked by the existing outbound network policy; the CI rules step is retained.
