FROM nginx:1.23-alpine
RUN apk add --no-cache ffmpeg curl

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 1935 80
CMD ["nginx", "-g", "daemon off;"]
