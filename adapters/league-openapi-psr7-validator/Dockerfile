# syntax=docker/dockerfile:1
FROM php:8.4-cli AS check

RUN apt-get update \
  && apt-get install -y --no-install-recommends git unzip \
  && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /check
COPY composer.json ./composer.json
RUN composer install --no-interaction --no-progress
COPY phpstan.neon server.php ./
RUN php -l server.php && vendor/bin/phpstan analyse --no-progress

FROM php:8.4-cli

RUN apt-get update \
  && apt-get install -y --no-install-recommends git unzip \
  && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY composer.json ./composer.json
RUN composer install --no-interaction --no-progress --no-dev

COPY --from=check /check/server.php ./server.php

ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "exec php -S 0.0.0.0:${PORT} server.php"]
