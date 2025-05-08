FROM node:16-alpine as builder
WORKDIR /app
COPY src/package*.json ./
RUN npm ci
COPY src/ ./
RUN npm run build

FROM nginx:1.23-alpine
COPY default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
