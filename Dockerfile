# Production stage
FROM node:20-alpine

WORKDIR /app

# Install all dependencies (including devDependencies for tsx)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and Prisma schema
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Start the server with tsx
CMD ["npx", "tsx", "src/index.ts"]
