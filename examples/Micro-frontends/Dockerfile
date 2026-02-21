# Stage 1: Build the library from source
FROM node:22-alpine AS lib-builder
WORKDIR /lib
COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/
RUN npm ci --ignore-scripts && npm run build && npm pack

# Stage 2: Run the Vite app
FROM node:22-alpine
ARG APP_DIR
WORKDIR /app
COPY --from=lib-builder /lib/rpc-iframe-*.tgz /tmp/rpc-iframe.tgz
COPY examples/Micro-frontends/${APP_DIR}/package.json ./
RUN npm install /tmp/rpc-iframe.tgz && npm install
COPY examples/Micro-frontends/${APP_DIR}/ ./
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]
