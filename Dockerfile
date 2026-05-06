# Utilisation de l'image officielle Node.js légère
FROM node:20-alpine

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de définition des dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste du code source
COPY . .

# Exposer le port sur lequel Vite va tourner
EXPOSE 3015

# Démarrer le serveur de développement Vite
CMD ["npm", "run", "dev"]
