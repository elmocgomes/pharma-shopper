# Custom wa-gateway build
# - Upgrades Baileys from 7.0.0-rc.6 to 7.0.0-rc13
# - Adds debug logging for incoming message events
FROM node:20-alpine AS build

RUN apk add --no-cache git python3 make g++

WORKDIR /app

# Clone wa-gateway source
RUN git clone --depth 1 https://github.com/mimamch/wa-gateway.git .

# Install dependencies
RUN npm install

# Upgrade Baileys inside wa-multi-session to latest RC
RUN cd node_modules/wa-multi-session && \
    npm install baileys@7.0.0-rc13 --save --legacy-peer-deps 2>&1 | tail -5

# Patch source: add debug logging to webhook message handler
RUN sed -i 's|if (!props.baseUrl) return;|console.log("[WA-MSG] handler called, from:", message.key?.remoteJid, "fromMe:", message.key?.fromMe, "type:", message.key?.participant ? "group" : "dm");\n    if (!props.baseUrl) return;|' src/webhooks/message.ts && \
    sed -i 's|webhookClient.post(endpoint, body).catch(console.error);|console.log("[WA-MSG] POST ->", endpoint, "from:", body.from);\n    webhookClient.post(endpoint, body).then(() => console.log("[WA-MSG] POST OK")).catch((err) => console.error("[WA-MSG] POST FAIL:", err.message));|' src/webhooks/message.ts

# Patch source: add debug logging to whatsapp.ts onMessageReceived
RUN sed -i 's|onMessageReceived: webhookMessage,|onMessageReceived: (...args) => { console.log("[WA-EVENT] onMessageReceived fired"); return webhookMessage(...args); },|' src/whatsapp.ts

# Patch wa-multi-session dist: add logging to messages.upsert handler
RUN find node_modules/wa-multi-session/dist -name "*.js" -exec grep -l "messages.upsert" {} \; | while read f; do \
      sed -i 's|if(events\["messages.upsert"\])|if(events["messages.upsert"]){console.log("[WA-BAILEYS] messages.upsert event, msgs:",events["messages.upsert"].messages?.length,"type:",events["messages.upsert"].type);}if(events["messages.upsert"])|g' "$f" 2>/dev/null; \
    done

# Build with ncc
RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/assets ./assets

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
