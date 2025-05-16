# Use official Node.js LTS image
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "crash-broadcaster.js"]