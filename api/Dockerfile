FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

# Dependencias primero, para aprovechar la caché de capas.
# Con lockfile se usa npm ci (instalación exacta); sin lockfile, npm install.
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; \
    else npm install --omit=dev --no-audit --no-fund; fi

COPY --chown=node:node . .
USER node

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
