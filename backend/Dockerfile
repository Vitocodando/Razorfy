FROM maven:3.9.11-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src src
RUN mvn -B clean package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S razorfy && adduser -S razorfy -G razorfy
COPY --from=build /app/target/*.jar app.jar
USER razorfy
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
