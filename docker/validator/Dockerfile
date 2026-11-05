FROM eclipse-temurin:21-jre-alpine

# Pinned assets, checked by SHA-256 on every build.
#   engine: https://github.com/itplr-kosit/validator/releases/tag/v1.6.3
#   rules:  https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-08-31
# The release-assets host has been unreliable, so fetch through the API asset
# endpoint. The asset id is part of the pin.
ARG VALIDATOR_ASSET=522497986
ARG CONFIG_ASSET=541277964
ARG VALIDATOR_SHA256=799e64befca97d4080e03608c80b85dd5a5ecc5f4ae4f35d1116ec2855b9a7c9
ARG CONFIG_SHA256=2530cd107c414511c5d0462ec10f886910395abfca820db82e83d70bf01221a8

RUN apk add --no-cache curl \
  && mkdir -p /opt/validator/config \
  && curl -fsSL --retry 3 --retry-all-errors --retry-delay 2 \
       -H "Accept: application/octet-stream" \
       -o /opt/validator/validator.jar \
       "https://api.github.com/repos/itplr-kosit/validator/releases/assets/${VALIDATOR_ASSET}" \
  && echo "${VALIDATOR_SHA256}  /opt/validator/validator.jar" | sha256sum -c - \
  && curl -fsSL --retry 3 --retry-all-errors --retry-delay 2 \
       -H "Accept: application/octet-stream" \
       -o /tmp/config.zip \
       "https://api.github.com/repos/itplr-kosit/validator-configuration-xrechnung/releases/assets/${CONFIG_ASSET}" \
  && echo "${CONFIG_SHA256}  /tmp/config.zip" | sha256sum -c - \
  && unzip -q /tmp/config.zip -d /opt/validator/config \
  && rm /tmp/config.zip \
  && apk del curl

WORKDIR /opt/validator

# Saxon keeps a large rule set in memory. The daemon handles one request per
# thread and holds no state between invoices.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

# -G turns off the show-case GUI. POST an XML body to any path to validate it.
CMD ["java", "-jar", "validator.jar", "-s", "config/scenarios.xml", "-r", "config", "-D", "-G", "-H", "0.0.0.0", "-P", "8080"]
