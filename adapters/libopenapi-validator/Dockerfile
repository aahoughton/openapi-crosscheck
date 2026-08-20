# syntax=docker/dockerfile:1
FROM golang:1.27-alpine AS build

WORKDIR /src
COPY go.mod ./go.mod
COPY main.go ./main.go
RUN go get github.com/pb33f/libopenapi-validator@latest && go get github.com/pb33f/libopenapi@latest && go mod tidy

RUN go vet ./...
RUN go install honnef.co/go/tools/cmd/staticcheck@latest && staticcheck ./...
RUN go build -o /server .

FROM alpine:3
WORKDIR /app
COPY --from=build /server /app/server
ENV PORT=8080
EXPOSE 8080
CMD ["/app/server"]
