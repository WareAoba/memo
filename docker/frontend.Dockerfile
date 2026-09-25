FROM node:24-bookworm-slim
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
EXPOSE 15173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
