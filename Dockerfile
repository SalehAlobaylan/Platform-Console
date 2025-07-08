# Simple Dockerfile for iTunesBrowser (Next.js + Fastify)

# 1. Use official lightweight Node.js LTS image
FROM node:20-alpine

# 2. Create app directory inside container
WORKDIR /app

# 3. Copy dependency manifests and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# 4. Copy the rest of the application source code
COPY . .

# 5. Expose the ports used by the Next.js frontend (3000) and Fastify API (4000)
EXPOSE 3000 4000

# 6. Run both servers in development mode (concurrently)
CMD ["npm", "run", "dev"] 