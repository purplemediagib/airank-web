FROM node:22-alpine@sha256:2c752226d477b4a886378baa95b9af252be59301b725fdb0b7e15208131505a8
ARG AIRANK_VERSION=0.21.0
LABEL org.opencontainers.image.title="AI Rank API" \
      org.opencontainers.image.version="${AIRANK_VERSION}" \
      org.opencontainers.image.description="AI Rank Google OAuth and scan API on Bunny Magic Containers"
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts && npm cache clean --force
COPY src ./src
COPY test ./test
COPY data ./data
RUN npm test
ENV NODE_ENV=production APP_ENV=staging PORT=3000 EMAIL_AUTH_ENABLED=true MONITORING_ENABLED=false CONSUMER_COLLECTION_ENABLED=false PROJECT_SCHEDULER_ENABLED=false
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","src/app/start-release.mjs"]
