FROM node:16-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY server.js ./
EXPOSE 3000
CMD ["node", "server.js"]
