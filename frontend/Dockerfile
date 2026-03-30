FROM node:20-alpine

WORKDIR /app

COPY . .

WORKDIR /app/frontend

RUN npm i && npm run build

# Add hosts entries for NAT loopback - both external and internal domains resolve to local IP
RUN echo "192.168.20.31 api.vondic.knopusmedia.ru webrtc.vondic.knopusmedia.ru in.api.vondic.knopusmedia.ru in.webrtc.vondic.knopusmedia.ru" >> /etc/hosts

EXPOSE 3000

CMD ["npm", "run", "start"]
