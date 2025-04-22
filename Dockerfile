# Étape 1 : Build
FROM node:20-alpine AS build

WORKDIR /app

# Copie des fichiers nécessaires pour installer les dépendances
COPY package*.json ./

# Installation des dépendances
RUN npm ci --production=false

# Copie du reste du code source
COPY . .

# Build de l’application (si tu utilises TypeScript)
RUN npm run build

# Étape 2 : Production
FROM node:20-alpine

WORKDIR /app

# Copie uniquement les fichiers nécessaires depuis l’étape de build
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/.env ./

# Expose le port par défaut d’AdonisJS
EXPOSE 3333

# Commande de lancement
CMD ["node", "build/server.js"]