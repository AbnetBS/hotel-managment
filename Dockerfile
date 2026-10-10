# ---- build the web app ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- API + web app in one service ----
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared

# Runtime data lives on volumes (upload photos, and the SQLite file if you run
# without PostgreSQL). Seeding creates them on first boot if they are missing.
VOLUME ["/app/server/uploads", "/app/server/data"]

ENV PORT=4000
ENV HOST=0.0.0.0
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
