FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
# Bake the API URL at build time (browser talks to the host-mapped server port).
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
# Optional: absolute URL of the AI agent backend (used in cloud deploys where the
# browser cannot reach it same-origin). Empty by default; leaves dev behavior intact.
ARG VITE_AGENT_URL=
ENV VITE_AGENT_URL=$VITE_AGENT_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
