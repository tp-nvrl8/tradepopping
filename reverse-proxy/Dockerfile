FROM nginx:alpine

# Remove default config
RUN rm -f /etc/nginx/nginx.conf

# Copy our custom config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]