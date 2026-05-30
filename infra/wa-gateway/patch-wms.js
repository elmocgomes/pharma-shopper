/**
 * Patch wa-multi-session's compiled Whatsapp.js to add diagnostic logging.
 * This is more reliable than sed for complex pattern matching.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'node_modules', 'wa-multi-session', 'dist', 'Whatsapp', 'Whatsapp.js');

console.log('[PATCH] Reading', filePath);
let code = fs.readFileSync(filePath, 'utf8');
const originalLength = code.length;

// Patch 1: Log ALL events inside sock.ev.process
// Find: sock.ev.process((events) => __awaiter(this, void 0, void 0, function* () {
// Insert logging right after the opening
const processPattern = 'sock.ev.process((events) => __awaiter(this, void 0, void 0, function* () {';
const processReplacement = 'sock.ev.process((events) => __awaiter(this, void 0, void 0, function* () { var _evKeys = Object.keys(events); if (_evKeys.length > 0) console.log("[WMS-EVENTS]", sessionId, _evKeys.join(", "));';

const processCount = code.split(processPattern).length - 1;
console.log('[PATCH] Found sock.ev.process pattern:', processCount, 'times');
code = code.split(processPattern).join(processReplacement);

// Patch 2: Log when messages.upsert is detected
const upsertPattern = 'if (events["messages.upsert"]) {';
const upsertReplacement = 'console.log("[WMS-CHECK] messages.upsert?", !!(events["messages.upsert"])); if (events["messages.upsert"]) { console.log("[WMS-UPSERT] HIT! session:", sessionId);';

const upsertCount = code.split(upsertPattern).length - 1;
console.log('[PATCH] Found messages.upsert pattern:', upsertCount, 'times');
// Only replace the first occurrence in each process callback (there are 2 per callback)
code = code.split(upsertPattern).join(upsertReplacement);

// Patch 3: Log connection.update details
const connPattern = 'if (events["connection.update"]) {';
const connReplacement = 'if (events["connection.update"]) { console.log("[WMS-CONN]", sessionId, JSON.stringify(events["connection.update"]));';

const connCount = code.split(connPattern).length - 1;
console.log('[PATCH] Found connection.update pattern:', connCount, 'times');
code = code.split(connPattern).join(connReplacement);

// Write back
fs.writeFileSync(filePath, code, 'utf8');
console.log('[PATCH] File patched successfully. Size:', originalLength, '->', code.length);

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
console.log('[PATCH] Verify WMS-EVENTS:', (verify.match(/WMS-EVENTS/g) || []).length);
console.log('[PATCH] Verify WMS-UPSERT:', (verify.match(/WMS-UPSERT/g) || []).length);
console.log('[PATCH] Verify WMS-CONN:', (verify.match(/WMS-CONN/g) || []).length);
console.log('[PATCH] Done!');
