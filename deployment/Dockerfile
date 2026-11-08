# syntax=docker/dockerfile:1

FROM ghcr.io/voidzero-dev/vite-plus:latest AS build
WORKDIR /app

COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
RUN vp install --frozen-lockfile

COPY --chown=vp:vp . .
ENV NODE_ENV=production
ENV BUILD_ENV=production
RUN vp run build
RUN cp "$(vp env which node | head -1)" /tmp/node \
  && cp -L /usr/lib/*/libatomic.so.1 /tmp/libatomic.so.1

FROM ghcr.io/voidzero-dev/vite-plus:latest AS deps
WORKDIR /app

COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
RUN vp install --frozen-lockfile --prod

FROM gcr.io/distroless/cc-debian13:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV BUILD_ENV=production
ENV LD_LIBRARY_PATH=/usr/local/lib

COPY --from=build /tmp/node /usr/local/bin/node
COPY --from=build /tmp/libatomic.so.1 /usr/local/lib/libatomic.so.1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/.drizzle ./.drizzle
COPY --from=build /app/package.json ./

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/node"]
CMD ["dist/serve.js"]
