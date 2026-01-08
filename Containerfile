# Podman/Docker Containerfile für tldraw-in-obsidian Entwicklung
# Verwendung: podman build -t tldraw-dev -f Containerfile .
#             podman run -it --rm -v .:/app:Z -p 3000:3000 tldraw-dev

FROM node:24-alpine

# Labels für Dokumentation
LABEL maintainer="tldraw-in-obsidian"
LABEL description="Development environment for tldraw-in-obsidian Obsidian plugin"

# Arbeitsverzeichnis setzen
WORKDIR /app

# Abhängigkeiten für native Module (falls benötigt)
RUN apk add --no-cache git python3 make g++

# npm konfigurieren für schnellere Installationen
RUN npm config set progress=false && \
    npm config set loglevel=warn

# package.json und package-lock.json kopieren (für besseres Caching)
COPY package*.json ./

# patches Ordner kopieren (für postinstall patch-package)
COPY patches ./patches/

# Abhängigkeiten installieren
RUN npm ci

# Rest des Quellcodes kopieren
COPY . .

# Port für mögliche Entwicklungsserver
EXPOSE 3000

# Standard-Befehl: dev-Server starten
CMD ["npm", "run", "dev"]
