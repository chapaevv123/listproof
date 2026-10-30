FROM node:22.23.0-alpine
WORKDIR /app
COPY package.json ./package.json
COPY src/core.mjs src/verify.mjs ./src/
COPY scripts/server.mjs ./scripts/server.mjs
COPY web/index.html web/styles.css web/app.js web/cases.js ./web/
COPY data/epoch-1.json data/epoch-2.json data/invalid-schema.json data/sepolia-public.json ./data/
COPY evidence/cre-local-simulation.txt ./evidence/cre-local-simulation.txt
COPY evidence/cre-onchain-settings.txt ./evidence/cre-onchain-settings.txt
COPY evidence/cre-v3-onchain-settings.txt ./evidence/cre-v3-onchain-settings.txt
ENV PORT=4173
ENV LISTPROOF_HOST=0.0.0.0
USER node
EXPOSE 4173
CMD ["node","scripts/server.mjs"]
