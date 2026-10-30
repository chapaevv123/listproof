FROM node:22.23.0-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
COPY web ./web
COPY data ./data
COPY evidence/cre-local-simulation.txt ./evidence/cre-local-simulation.txt
ENV PORT=4173
ENV LISTPROOF_HOST=0.0.0.0
EXPOSE 4173
CMD ["node","scripts/server.mjs"]
