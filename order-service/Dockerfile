FROM eclipse-temurin:21-jre-jammy AS base
WORKDIR /app
RUN addgroup --system --gid 1001 appuser && \
    adduser --system --uid 1001 --ingroup appuser appuser

FROM base AS runtime
COPY --chown=appuser:appuser target/*.jar app.jar
USER appuser
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
