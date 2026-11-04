# Сборка из корня репозитория:  docker build -f deploy/Dockerfile -t english-pilot .
FROM node:22-alpine AS build
WORKDIR /repo
COPY app/package.json app/package-lock.json app/
RUN cd app && npm ci
COPY app app
COPY content content
RUN cd app && node scripts/sync-content.mjs && npx next build

FROM node:22-alpine AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /srv
COPY --from=build /repo/app/.next/standalone ./
COPY --from=build /repo/app/.next/static ./.next/static
COPY --from=build /repo/app/content ./content
COPY --from=build /repo/app/db ./db
COPY --from=build /repo/app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY deploy/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh && addgroup -S app && adduser -S app -G app && chown -R app:app /srv
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/en >/dev/null || exit 1
ENTRYPOINT ["./entrypoint.sh"]
