FROM node:24-bookworm-slim@sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd AS tested
WORKDIR /app
COPY package.json server.mjs store.mjs reports.mjs diagnostics.mjs launch.mjs ./
COPY test ./test
RUN node --test

FROM node:24-bookworm-slim@sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY --from=tested /app/package.json /app/server.mjs /app/store.mjs /app/reports.mjs /app/diagnostics.mjs /app/launch.mjs ./
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "launch.mjs"]
