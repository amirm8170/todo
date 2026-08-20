FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Helps NestJS file watching work inside Docker volumes.
ENV CHOKIDAR_USEPOLLING=true

CMD ["npm", "run", "start:dev"]
