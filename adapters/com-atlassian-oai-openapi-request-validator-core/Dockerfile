# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /src
COPY pom.xml ./pom.xml
COPY src ./src
# -Xlint:all -Werror is this container holding itself to more than the harness
# asks: every warning javac can raise, and none of them tolerated.
RUN mvn -q -DskipTests dependency:copy-dependencies -DoutputDirectory=/libs \
 && mkdir -p /out \
 && javac -Xlint:all -Werror -cp "/libs/*" -d /out src/main/java/Server.java

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /libs /app/libs
COPY --from=build /out /app/out
# The manifest travels into the runtime image so the container can report how
# it was told to install the library, which is derived rather than written down.
COPY --from=build /src/pom.xml /app/pom.xml
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "java -cp /app/out:/app/libs/* Server"]
