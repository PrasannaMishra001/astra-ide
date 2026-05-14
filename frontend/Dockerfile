# ── deps stage ──────────────────────────────────────────────────────────────
# Copy .npmrc FIRST so legacy-peer-deps is active before install runs.
# Monaco-editor + y-monaco have peer-dep conflicts that block strict resolution.
FROM node:20-alpine AS deps
WORKDIR /app
COPY .npmrc package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# ── build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY .npmrc ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Avoid building with telemetry / lint-on-build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ── runtime stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install only production deps for the runtime image (smaller image)
COPY .npmrc package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --omit=dev || npm install --legacy-peer-deps --omit=dev

COPY --from=builder /app/public  ./public
COPY --from=builder /app/.next   ./.next

EXPOSE 3000
CMD ["npm", "run", "start"]
