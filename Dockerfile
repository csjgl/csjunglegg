# Use official Node.js LTS image
FROM node:20

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

# Install PM2 to run multiple processes
RUN npm install -g pm2

# Start both broadcasters with PM2
CMD ["pm2-runtime", "start", "crash-broadcaster.js", "--name", "crash", "--watch", "--no-autorestart", "--", "&&", "pm2", "start", "roulette-broadcaster.js", "--name", "roulette", "--watch", "--no-autorestart"]