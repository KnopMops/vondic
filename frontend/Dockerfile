FROM node:20-alpine

WORKDIR /app

COPY . .

WORKDIR /app/frontend

RUN npm i && npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
