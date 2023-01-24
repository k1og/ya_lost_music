FROM node:16.19-alpine as build
WORKDIR /api

COPY ./package.json .
COPY ./yarn.lock .

RUN yarn

COPY . .

RUN yarn build
RUN yarn build-packages


FROM node:16.19-alpine
COPY --from=build /api/dist /dist

ARG DB_URL
ARG TG_BOT_TOKEN

ENV DB_URL=${DB_URL}
ENV TG_BOT_TOKEN=${TG_BOT_TOKEN}

CMD ["node", "dist/index.js"]