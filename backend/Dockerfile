FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B --no-transfer-progress -Pprod clean package -DskipTests

FROM eclipse-temurin:17-jre-jammy AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system hellojourney \
    && useradd --system --gid hellojourney --home-dir /app hellojourney
WORKDIR /app
COPY --from=build /workspace/target/HelloJourney-backend-*.jar app.jar
RUN mkdir -p /app/data/trip_tasks && chown -R hellojourney:hellojourney /app
USER hellojourney
EXPOSE 8000
ENV SPRING_PROFILES_ACTIVE=prod \
    TRIP_TASK_DATA_DIR=/app/data/trip_tasks \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -Dfile.encoding=UTF-8"
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:8000/health >/dev/null || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
