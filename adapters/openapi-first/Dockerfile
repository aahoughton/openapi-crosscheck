# syntax=docker/dockerfile:1
FROM ruby:3.4 AS check

WORKDIR /check
COPY Gemfile ./Gemfile
RUN bundle install
COPY .rubocop.yml server.rb ./
RUN ruby -c server.rb && bundle exec rubocop --fail-level convention

FROM ruby:3.4

WORKDIR /app
COPY Gemfile ./Gemfile
RUN bundle config set --local without check && bundle install

COPY --from=check /check/server.rb ./server.rb

ENV PORT=8080
EXPOSE 8080
CMD ["ruby", "server.rb"]
