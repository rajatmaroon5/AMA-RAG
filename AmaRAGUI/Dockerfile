# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with retry and built-in npm config
RUN npm install --legacy-peer-deps --no-audit --prefer-offline --retry 3 || npm install --legacy-peer-deps --no-audit --prefer-offline

# Copy source
COPY . .

# Build Angular app
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist/ama-rag-ui /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
