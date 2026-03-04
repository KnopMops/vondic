FROM node:20-alpine

WORKDIR /app

COPY . .

EXPOSE 3000

RUN cd frontend && npm i && npm run build

CMD ["cd frontend", "&&", "npm run start"]
