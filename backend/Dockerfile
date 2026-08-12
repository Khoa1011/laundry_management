FROM eclipse-temurin:17-jdk-jammy AS builder

WORKDIR /workspace

COPY .mvn/ .mvn/
COPY --chmod=0755 mvnw ./mvnw
COPY pom.xml ./pom.xml

RUN ./mvnw -B -ntp dependency:go-offline

COPY src/ src/

RUN ./mvnw -B -ntp -DskipTests clean package \
    && JAR_FILE="$(find target -maxdepth 1 -type f -name '*.jar' ! -name '*.original' -print -quit)" \
    && test -n "$JAR_FILE" \
    && cp "$JAR_FILE" /tmp/app.jar

FROM eclipse-temurin:17-jre-jammy AS runtime

RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 laundry \
    && useradd --system --uid 10001 --gid laundry --home-dir /app --shell /usr/sbin/nologin laundry

WORKDIR /app

COPY --from=builder --chown=laundry:laundry /tmp/app.jar ./app.jar

RUN mkdir -p /app/private-data/employee-documents \
    && chown -R laundry:laundry /app/private-data

USER laundry:laundry

ENV JAVA_TOOL_OPTIONS="-XX:InitialRAMPercentage=5.0 -XX:MaxRAMPercentage=25.0 -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
  CMD curl --fail --silent --show-error http://127.0.0.1:8080/actuator/health > /dev/null || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
