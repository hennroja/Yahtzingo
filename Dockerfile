# Use the official Node.js image from the Docker Hub
FROM node:alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production

# Copy the rest of your application files
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run your application
CMD ["node", "server.js"]
