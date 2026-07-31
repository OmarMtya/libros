FROM node:24-alpine AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--poll", "1000"]

FROM development AS build

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
