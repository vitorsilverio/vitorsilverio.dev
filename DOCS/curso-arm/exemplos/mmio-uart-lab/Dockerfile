# Laboratório de "Memória e MMIO no emulador": JDK 25 + binutils ARM + arm-jitter 1.3.0.
FROM eclipse-temurin:25.0.1_8-jdk
RUN apt-get update \
 && apt-get install -y --no-install-recommends binutils-arm-none-eabi curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL -o /opt/arm-jitter-1.3.0.jar \
    https://repo1.maven.org/maven2/dev/vitorsilverio/arm-jitter/1.3.0/arm-jitter-1.3.0.jar
WORKDIR /lab
