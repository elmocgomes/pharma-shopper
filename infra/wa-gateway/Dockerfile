# Custom wa-gateway build
# - Keeps Baileys at 7.0.0-rc.6 (the version wa-multi-session ships with)
# - Adds deep diagnostic logging to wa-multi-session's compiled JS
# - Patches webhook handler for message forwarding logs
# - Runs TypeScript source directly with tsx (no ncc bundling)
FROM node:20-alpine

RUN apk add --no-cache git python3 make g++ tini

WORKDIR /app

# Clone wa-gateway source
RUN git clone --depth 1 https://github.com/mimamch/wa-gateway.git .

# Install dependencies + tsx for running TypeScript directly
RUN npm install && npm install tsx

# ============================================================
# DIAGNOSTIC PATCHES — wa-multi-session compiled JS
# Patch the actual event handler to log ALL events Baileys emits
# ============================================================

# 1. Log EVERY event batch that sock.ev.process receives
#    Insert after the var declarations line inside the process callback
RUN sed -i '/var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m/a\
                        var _evKeys = Object.keys(events); if (_evKeys.length > 0) console.log("[WMS-EVENTS]", sessionId, _evKeys.join(", "));' \
    node_modules/wa-multi-session/dist/Whatsapp/Whatsapp.js

# 2. Log when messages.upsert block is entered
RUN sed -i 's|if (events\["messages.upsert"\]) {|if (events["messages.upsert"]) { console.log("[WMS-UPSERT] messages.upsert! session:", sessionId); } if (events["messages.upsert"]) {|' \
    node_modules/wa-multi-session/dist/Whatsapp/Whatsapp.js

# 3. Log the ON_MESSAGE_RECEIVED callback dispatch
RUN sed -i 's|this.callback.get(Defaults_1.CALLBACK_KEY.ON_MESSAGE_RECEIVED)|(() => { console.log("[WMS-CB] ON_MESSAGE_RECEIVED"); return this.callback.get(Defaults_1.CALLBACK_KEY.ON_MESSAGE_RECEIVED); })()|g' \
    node_modules/wa-multi-session/dist/Whatsapp/Whatsapp.js

# Verify patches applied
RUN echo "=== Patch verification ===" && \
    echo -n "WMS-EVENTS: " && grep -c "WMS-EVENTS" node_modules/wa-multi-session/dist/Whatsapp/Whatsapp.js && \
    echo -n "WMS-UPSERT: " && grep -c "WMS-UPSERT" node_modules/wa-multi-session/dist/Whatsapp/Whatsapp.js && \
    echo -n "WMS-CB: " && grep -c "WMS-CB" node_modules/wa-multi-session/dist/Whatsapp/Whatsapp.js && \
    echo "=== All patches verified ==="

# ============================================================
# DIAGNOSTIC PATCHES — wa-gateway source (TypeScript, run by tsx)
# ============================================================

# Patch webhook message handler for logging
RUN sed -i 's|if (!props.baseUrl) return;|console.log("[WA-MSG] handler called, from:", message.key?.remoteJid, "fromMe:", message.key?.fromMe);\n    if (!props.baseUrl) return;|' src/webhooks/message.ts && \
    sed -i 's|webhookClient.post(endpoint, body).catch(console.error);|console.log("[WA-MSG] POST ->", endpoint, "from:", body.from);\n    webhookClient.post(endpoint, body).then(() => console.log("[WA-MSG] POST OK")).catch((err: any) => console.error("[WA-MSG] POST FAIL:", err.message));|' src/webhooks/message.ts

# Patch whatsapp.ts onMessageReceived callback
RUN sed -i 's|onMessageReceived: webhookMessage,|onMessageReceived: (...args: any[]) => { console.log("[WA-EVENT] onMessageReceived fired"); return webhookMessage(...args); },|' src/whatsapp.ts

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "src/index.ts"]
