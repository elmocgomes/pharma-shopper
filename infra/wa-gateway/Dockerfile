# Custom wa-gateway build
# - Upgrades Baileys from 7.0.0-rc.6 to 7.0.0-rc13
# - Adds debug logging for incoming message events
# - Runs TypeScript source directly with tsx (no ncc bundling)
#   to ensure patches and Baileys upgrade survive
FROM node:20-alpine

RUN apk add --no-cache git python3 make g++ tini

WORKDIR /app

# Clone wa-gateway source
RUN git clone --depth 1 https://github.com/mimamch/wa-gateway.git .

# Install dependencies + tsx for running TypeScript directly
RUN npm install && npm install tsx

# Upgrade Baileys inside wa-multi-session to latest RC
RUN cd node_modules/wa-multi-session && \
    npm install baileys@7.0.0-rc13 --save --legacy-peer-deps 2>&1 | tail -5

# ── Patch 1: webhook message handler (src/webhooks/message.ts) ──
# Add logging when handler is called and when webhook POST happens
RUN sed -i 's|if (!props.baseUrl) return;|console.log("[WA-MSG] handler called, from:", message.key?.remoteJid, "fromMe:", message.key?.fromMe);\n    if (!props.baseUrl) return;|' src/webhooks/message.ts && \
    sed -i 's|webhookClient.post(endpoint, body).catch(console.error);|console.log("[WA-MSG] POST ->", endpoint, "from:", body.from);\n    webhookClient.post(endpoint, body).then(() => console.log("[WA-MSG] POST OK")).catch((err: any) => console.error("[WA-MSG] POST FAIL:", err.message));|' src/webhooks/message.ts

# ── Patch 2: whatsapp.ts onMessageReceived callback ──
RUN sed -i 's|onMessageReceived: webhookMessage,|onMessageReceived: (...args: any[]) => { console.log("[WA-EVENT] onMessageReceived fired"); return webhookMessage(...args); },|' src/whatsapp.ts

# ── Patch 3: wa-multi-session compiled JS — log messages.upsert events ──
RUN find node_modules/wa-multi-session/dist -name "*.js" -exec grep -l "messages.upsert" {} \; | while read f; do \
      echo "[BUILD] Patching messages.upsert logging in $f"; \
      sed -i 's|if(events\["messages.upsert"\])|if(events["messages.upsert"]){console.log("[WA-BAILEYS] messages.upsert event, count:",events["messages.upsert"].messages?.length,"type:",events["messages.upsert"].type);}if(events["messages.upsert"])|g' "$f" 2>/dev/null; \
    done

# ── Patch 4: wa-multi-session — log ALL event keys from sock.ev.process ──
# Find the ev.process handler and add a log line for all event keys received
RUN find node_modules/wa-multi-session/dist -name "*.js" | while read f; do \
      if grep -q "ev.process" "$f" 2>/dev/null; then \
        echo "[BUILD] Patching ev.process logging in $f"; \
        sed -i 's|\.ev\.process(function|.ev.process(function|g' "$f" 2>/dev/null; \
        sed -i '/\.ev\.process/,/function/{s/function(\(.*\)){/function(\1){console.log("[WA-EVENTS] received:",Object.keys(\1||{}).join(","));/}' "$f" 2>/dev/null || true; \
      fi; \
    done

# ── Patch 5: Log Baileys version at startup ──
RUN echo 'console.log("[WA-BOOT] Baileys version:", require("wa-multi-session/node_modules/baileys/package.json").version);' > /app/log-version.js

# Verify patches applied
RUN echo "=== Patch verification ===" && \
    grep -c "WA-MSG" src/webhooks/message.ts && \
    grep -c "WA-EVENT" src/whatsapp.ts && \
    echo "Source patches OK"

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

ENTRYPOINT ["/sbin/tini", "--"]
# Log Baileys version then run TypeScript source directly
CMD ["sh", "-c", "node /app/log-version.js 2>/dev/null || true; npx tsx src/index.ts"]
