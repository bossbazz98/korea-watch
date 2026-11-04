// Replace only the owned subscription schema, preserving server-managed test history.
export async function writeSubscription({ fs, db, uid, token, preferences, language, requestTest = false }) {
  if (!uid || !token) throw new Error('Subscription credentials are unavailable');
  const ref = fs.doc(db, 'subscribers', uid);
  return fs.runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists() ? snapshot.data() : {};
    const lastTestAt = existing.lastTestAt;
    const lastMs = typeof lastTestAt?.toMillis === 'function' ? lastTestAt.toMillis() : 0;
    const cooldown = Math.max(0, lastMs + 5 * 60000 - Date.now());
    const enabledNow = !!preferences.enabled && existing.enabled !== true;
    const testQueued = (!!requestTest || enabledNow) && !!preferences.enabled && cooldown === 0;
    const data = {
      token, cats: [...new Set(preferences.cats)],
      level: ['all', 'high'].includes(preferences.level) ? preferences.level : 'critical',
      enabled: !!preferences.enabled, testRequested: testQueued || (!!preferences.enabled && existing.testRequested === true),
      lang: language, subscriptionVersion: 2,
      quietOn: !!preferences.quietOn, quietFrom: Number(preferences.quietFrom ?? 22), quietTo: Number(preferences.quietTo ?? 7),
      quietBypass: preferences.quietBypass !== false, updatedAt: fs.serverTimestamp()
    };
    if (testQueued) data.lastTestAt = fs.serverTimestamp();
    else if (lastTestAt !== undefined) data.lastTestAt = lastTestAt;
    transaction.set(ref, data);
    return { enabledNow, testQueued, testPending: data.testRequested, retryAfterMs: requestTest && !testQueued ? cooldown : 0 };
  });
}
