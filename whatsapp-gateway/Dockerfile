FROM node:20-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    procps \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --production

# Copy server
COPY server.js ./

# Create session directory
RUN mkdir -p /usr/src/app/session

EXPOSE 2785

CMD ["node", "server.js"]
