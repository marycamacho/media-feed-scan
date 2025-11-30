# Dockerfile

# Use the official Node.js 22 LTS (Alpine version for smaller size)
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files first to install dependencies
COPY package.json package-lock.json ./

# Install all Node.js dependencies (including webdav)
RUN npm install

# 1. Copy the rest of the application files (scripts, config, opml)
# This runs as the root builder user.
COPY . .

# 2. Security: Create the unprivileged user
RUN adduser -D scanner_user

# 3. FIX EACCES: Ensure the data directory exists and is owned by the user.
# --- This resolves the "No such file or directory" error by creating it ---
RUN mkdir -p /usr/src/app/data && chown -R scanner_user:scanner_user /usr/src/app/data

# 4. Security: Switch the context: All subsequent commands and the final CMD will run as this user.
USER scanner_user

# Command to run the entry script when the container starts
CMD [ "node", "src/runAll.js" ]