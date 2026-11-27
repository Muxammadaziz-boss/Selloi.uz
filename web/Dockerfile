FROM node:22-alpine
WORKDIR /web
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build && chown -R node:node /web
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
