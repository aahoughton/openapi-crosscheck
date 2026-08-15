# syntax=docker/dockerfile:1
FROM python:3.13-slim AS check

WORKDIR /check
COPY requirements.txt requirements-check.txt ./
RUN pip install --no-cache-dir --disable-pip-version-check \
      -r requirements.txt -r requirements-check.txt
COPY ruff.toml server.py ./
RUN mypy --strict server.py && ruff check server.py

FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

COPY --from=check /check/server.py ./server.py

ENV PORT=8080
EXPOSE 8080
CMD ["python", "-u", "server.py"]
