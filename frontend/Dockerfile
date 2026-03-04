FROM node:20-alpine

WORKDIR /app

COPY . .

RUN cd frontend && npm i && npm run build

RUN addgroup --system --gid 1001 appuser && adduser --system --uid 1001 appuser
USER appuser

EXPOSE 3000

CMD ["npm", "start"]
