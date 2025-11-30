# Dockerfile
# Use the official Node.js 22 LTS (Alpine version for smaller size)
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files first to install dependencies
COPY package.json package-lock.json ./

# Install all Node.js dependencies (including webdav)
RUN npm install

# Security: Create a new, unprivileged user named 'scanner_user' inside the container.
RUN adduser -D scanner_user

# Security: Switch the context: All subsequent commands and the final CMD will run as this user.
USER scanner_user

# Copy the rest of the application files (scripts, config, opml)
COPY . .

# Command to run the entry script when the container starts
# The image will be tagged 'media-feed-scanner'
CMD [ "node", "src/runAll.js" ]