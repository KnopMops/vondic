FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --fetch-retries=5 --fetch-retry-maxtimeout=120000 || npm i --fetch-retries=5 --fetch-retry-maxtimeout=120000

COPY . .

RUN rm -rf .next && npm run build

EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
