# Dockerfile
# Use the official Node.js 22 LTS (Alpine version for smaller size)
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files first to install dependencies
COPY package.json package-lock.json ./

# Install all Node.js dependencies (including webdav)
RUN npm install

# Copy the rest of the application files (scripts, config, opml)
COPY . .

# Command to run the entry script when the container starts
# The image will be tagged 'media-feed-scanner'
CMD [ "node", "src/runAll.js" ]