/** IUC Sheet â†” Site bridge. No secrets belong in this file or in Sheet cells. */
const IUC_SITE = 'https://iuc-nadi-mpc-hr.iuc-people-a-4289.chatgpt.site';
function callIucSync_(probe) {
  const p = PropertiesService.getScriptProperties();
  const key = p.getProperty('SYNC_RUNNER_KEY');
  const serviceToken = p.getProperty('SITES_SERVICE_TOKEN');
  if (!key || key.length < 32 || !serviceToken) throw new Error('Configure the two private Script Properties first.');
  const response = UrlFetchApp.fetch(IUC_SITE + '/api/people-culture/sync/runner', {
    method: 'post', contentType: 'application/json', followRedirects: false, muteHttpExceptions: true,
    headers: {'OAI-Sites-Authorization': 'Bearer ' + serviceToken, 'X-Sync-Runner-Key': key},
    payload: JSON.stringify({googleAccessToken: ScriptApp.getOAuthToken(), probe: probe === true})
  });
  if (response.getResponseCode() !== 200) throw new Error('IUC sync failed (HTTP ' + response.getResponseCode() + '). Check the P&C Sync page.');
  // No access token, employee data or response body is logged.
  return JSON.parse(response.getContentText());
}
function verifyIucConnection() {
  return callIucSync_(true).status;
}
function installIucSync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('A sync operation is running. Try again shortly.');
  try {
    if (callIucSync_(true).status !== 'connection_verified') throw new Error('Connection verification did not complete.');
    const existing = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runIucSync');
    if (!existing.length) ScriptApp.newTrigger('runIucSync').timeBased().everyMinutes(1).create();
    existing.slice(1).forEach(t => ScriptApp.deleteTrigger(t));
    return 'Runner installed. Open P&C > Google Sheet sync to enable transfers.';
  } finally { lock.releaseLock(); }
}
function runIucSync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try { callIucSync_(false); } finally { lock.releaseLock(); }
}
function pauseIucRunner() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runIucSync').forEach(t => ScriptApp.deleteTrigger(t));
}

/** Run once as h.r@innovative.edu.my and approve Send email. */
function enableIucInvitations() {
  iucInvitationSender_();
  MailApp.getRemainingDailyQuota();
  iucInvitationCall_({mailAction: 'ready'});
  const existing = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runIucInvitations');
  if (!existing.length) ScriptApp.newTrigger('runIucInvitations').timeBased().everyMinutes(1).create();
  existing.slice(1).forEach(t => ScriptApp.deleteTrigger(t));
  return 'Email invitations enabled. Refresh Nadi Sign-in accounts.';
}
function iucInvitationSender_() {
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== 'h.r@innovative.edu.my') throw new Error('Sign in to Google as h.r@innovative.edu.my before enabling invitations.');
}
function iucInvitationCall_(data) {
  iucInvitationSender_();
  const p = PropertiesService.getScriptProperties(), key = p.getProperty('SYNC_RUNNER_KEY'), token = p.getProperty('SITES_SERVICE_TOKEN');
  if (!key || key.length < 32 || !token) throw new Error('The private runner properties are missing.');
  const response = UrlFetchApp.fetch(IUC_SITE + '/api/people-culture/sync/runner', {
    method: 'post', contentType: 'application/json', followRedirects: false, muteHttpExceptions: true,
    headers: {'OAI-Sites-Authorization': 'Bearer ' + token, 'X-Sync-Runner-Key': key},
    payload: JSON.stringify(Object.assign({}, data, {sender: 'h.r@innovative.edu.my'}))
  });
  if (response.getResponseCode() !== 200) throw new Error('Invitation delivery needs attention. HTTP ' + response.getResponseCode() + '. Check Nadi Sign-in accounts.');
  return JSON.parse(response.getContentText());
}
function runIucInvitations() {
  // A separate user lock prevents sheet sync from starving mail delivery.
  const lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) return;
  try {
    iucInvitationSender_();
    const p = PropertiesService.getScriptProperties();
    // Receipts contain only job IDs and delivery leases, never passwords or email bodies.
    const receipt = p.getProperty('IUC_INVITATION_RECEIPT');
    if (receipt) { iucInvitationCall_(JSON.parse(receipt)); p.deleteProperty('IUC_INVITATION_RECEIPT'); }
    iucInvitationCall_({mailAction: 'ready'});
    for (let n = 0; n < 30 && MailApp.getRemainingDailyQuota() > 0; n++) {
      const result = iucInvitationCall_({mailAction: 'claim'});
      if (result.status !== 'invitation') break;
      const job = result.job;
      if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@innovative\.edu\.my$/i.test(job.to)) throw new Error('Invalid invitation recipient.');
      let outcome = 'sent';
      try { MailApp.sendEmail({to: job.to, subject: job.subject, body: job.body, name: 'IUC Nadi | People & Culture', replyTo: 'h.r@innovative.edu.my'}); }
      catch (_) { outcome = 'uncertain'; }
      const ack = {mailAction: 'ack', jobId: job.id, lease: job.lease, outcome: outcome};
      p.setProperty('IUC_INVITATION_RECEIPT', JSON.stringify(ack));
      iucInvitationCall_(ack); p.deleteProperty('IUC_INVITATION_RECEIPT');
      if (outcome !== 'sent') throw new Error('An invitation needs review. Check Sign-in accounts; do not resend blindly.');
    }
  } finally { lock.releaseLock(); }
}
function pauseIucInvitations() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runIucInvitations').forEach(t => ScriptApp.deleteTrigger(t));
}
