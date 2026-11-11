// Read-only public diagnostics. No service account or API key is needed.
const project = process.argv[2] || 'korea-watch01';
if (!/^[a-z0-9-]+$/.test(project)) throw Error('Invalid project ID');
function decode(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, field]) => [key, decode(field)]));
  return null;
}
async function read(document) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/meta/${document}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`${document}: HTTP ${response.status}`);
  const data = await response.json();
  return Object.fromEntries(Object.entries(data.fields || {}).map(([key, value]) => [key, decode(value)]));
}
(async () => {
  const [status, feed] = await Promise.all([read('status'), read('feed')]);
  const { completeThai } = require('../../public/news-text');
  const items = feed.items || [];
  console.log('Per-category translation outcomes:', JSON.stringify(status.translationByCategory || 'Not available: worker needs the diagnostics update', null, 2));
  console.log('Pending retry cooldown:', JSON.stringify(status.retryDelayedByCategory || 'Not reported by this worker version', null, 2));
  console.log(JSON.stringify({ project, workerCommit: status.workerCommit || 'not reported by this worker version', workerBranch: status.workerBranch || 'unknown', lastRun: status.lastRun, lastSuccessfulPublishAt: status.lastSuccessfulPublishAt, ageMinutes: status.lastRun ? Math.round((Date.now() - Date.parse(status.lastRun)) / 60000) : null, published: items.length, completeThai: items.filter(completeThai).length, pending: status.pending, hidden: status.hidden, byCategory: status.publishedByCategory, pendingByCategory: status.pendingByCategory, missingLanguages: status.missingLanguages, localizedThisRun: status.localized, aiDisabled: status.disabled, aiModelErrors: status.aiModelErrors, aiUnavailableModels: status.aiUnavailableModels, quotaUsed: status.quotaUsed, lastError: status.lastError, feedErrors: status.feedErrors }, null, 2));
})().catch(error => { console.error('Read-only diagnosis failed:', error.message); process.exitCode = 1; });
