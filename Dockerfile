# Production image: docker build -t wutzebaer/cardano-tools2 .
# NEXT_PUBLIC_CARDANO_NETWORK is compiled into the client, so it is a build argument.
# CARDANO_DBSYNC_API_URL and IPFS_API_URL are read by the server at runtime.
# With TELEGRAM_BOT_TOKEN the server also runs the alert bot, which keeps its subscriptions in /data.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_CARDANO_NETWORK=mainnet
ENV NEXT_PUBLIC_CARDANO_NETWORK=$NEXT_PUBLIC_CARDANO_NETWORK NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# subscriptions of the Telegram bot; mount a volume here to keep them across updates
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
