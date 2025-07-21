# APIfyn Backend Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (default Express port)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
