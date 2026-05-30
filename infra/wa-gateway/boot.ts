/**
 * Boot wrapper for wa-gateway
 * Monkey-patches wa-multi-session to log ALL Baileys events
 * This runs BEFORE the main wa-gateway app starts
 */

// Patch wa-multi-session's Whatsapp class to intercept all events
const origModule = require('module');
const origRequire = origModule.prototype.require;

let patchApplied = false;

origModule.prototype.require = function (id: string) {
  const result = origRequire.apply(this, arguments);

  // Intercept wa-multi-session's makeWASocket from baileys
  if (id === 'baileys' && !patchApplied) {
    patchApplied = true;
    console.log('[BOOT] Intercepted baileys require');
    console.log('[BOOT] Baileys version:', result.default ? 'has default export' : 'named exports');

    const origMakeWASocket = result.makeWASocket || result.default;
    if (origMakeWASocket) {
      const patchedMakeWASocket = function (...args: any[]) {
        console.log('[BOOT] makeWASocket called');
        const sock = origMakeWASocket(...args);

        // Monkey-patch sock.ev.process to log all events
        const origProcess = sock.ev.process.bind(sock.ev);
        sock.ev.process = function (handler: any) {
          console.log('[BOOT] sock.ev.process registered');
          return origProcess(function (events: any) {
            const keys = Object.keys(events);
            if (keys.length > 0) {
              console.log('[WA-EVENTS]', keys.join(', '));
              if (events['messages.upsert']) {
                console.log('[WA-UPSERT] count:', events['messages.upsert'].messages?.length,
                  'type:', events['messages.upsert'].type);
                const msg = events['messages.upsert'].messages?.[0];
                if (msg) {
                  console.log('[WA-UPSERT] from:', msg.key?.remoteJid,
                    'fromMe:', msg.key?.fromMe,
                    'hasMessage:', !!msg.message,
                    'msgType:', msg.message ? Object.keys(msg.message).join(',') : 'none');
                }
              }
            }
            return handler(events);
          });
        };

        // Also patch sock.ev.on to catch any direct listeners
        const origOn = sock.ev.on.bind(sock.ev);
        sock.ev.on = function (event: string, handler: any) {
          console.log('[BOOT] sock.ev.on registered for:', event);
          return origOn(event, function (...args: any[]) {
            console.log('[WA-ON]', event, 'fired');
            return handler(...args);
          });
        };

        return sock;
      };

      if (result.makeWASocket) {
        result.makeWASocket = patchedMakeWASocket;
      }
      if (result.default) {
        result.default = patchedMakeWASocket;
      }
    }
  }

  return result;
};

console.log('[BOOT] Event interceptor installed, starting wa-gateway...');

// Now import and run the actual wa-gateway
import('./src/index');
