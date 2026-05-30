# Custom wa-gateway build
# - Keeps Baileys at 7.0.0-rc.6 (the version wa-multi-session ships with)
# - Patches wa-multi-session via Node.js script (reliable, not sed)
# - Patches wa-gateway webhook handler for message forwarding logs
# - Runs TypeScript source directly with tsx (no ncc bundling)
FROM node:20-alpine

RUN apk add --no-cache git python3 make g++ tini

WORKDIR /app

# Clone wa-gateway source
RUN git clone --depth 1 https://github.com/mimamch/wa-gateway.git .

# Install dependencies + tsx for running TypeScript directly
RUN npm install && npm install tsx

# ============================================================
# DIAGNOSTIC PATCH — wa-multi-session compiled JS
# Uses Node.js string replacement (no sed fragility)
# ============================================================
COPY patch-wms.js /app/patch-wms.js
RUN node /app/patch-wms.js

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
