# Étape 1 : Dépendances
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Étape 2 : Build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Si tu as un .env.production, décommente la ligne suivante :
# COPY .env.production .env
RUN npm run build || node ace build --ignore-ts-errors
RUN rm -rf node_modules

# Étape 3 : Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# Si tu as un .env.production, décommente la ligne suivante :
# COPY .env.production .env
COPY .env .env

EXPOSE 3000

# Point d'entrée AdonisJS 6 (TypeScript)
CMD ["node", "./bin/server.js"]
# Si tu as build/start/server.js, adapte :
# CMD ["node", "build/start/server.js"]