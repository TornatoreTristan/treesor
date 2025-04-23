# Étape 1 : Dépendances (prod + dev)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Étape 2 : Build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Si tu as un .env.production, décommente la ligne suivante :
# COPY .env.production .env
RUN npm run build || node ace build --ignore-ts-errors

RUN npm run build

# Build frontend (Vite)
RUN npm run build

# Étape 3 : Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# On réinstalle les dépendances de prod uniquement
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/public ./public
# Si tu as un .env.production, décommente la ligne suivante :
# COPY .env.production .env
COPY .env .env

EXPOSE 3000

# Point d'entrée AdonisJS 6 (TypeScript)
CMD ["node", "build/bin/server.js"]
# Si tu as build/start/server.js, adapte :
# CMD ["node", "build/start/server.js"]