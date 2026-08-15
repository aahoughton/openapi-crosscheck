# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# Only this library is installed. A container holding the whole roster could
# resolve a transitive dependency differently from one holding a single
# library, and the point of a container per library is that nothing else is
# present.
COPY package.json ./package.json
RUN npm install --no-package-lock --loglevel=error

COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY entry.ts ./entry.ts

RUN npx --no-install tsc --noEmit
# Paths named explicitly: with no .gitignore in the image, oxlint walks
# node_modules and reports on the library under test.
RUN npx --no-install oxlint --deny-warnings src entry.ts

ENV PORT=8080
EXPOSE 8080
CMD ["npx", "--no-install", "tsx", "entry.ts"]
