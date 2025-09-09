### Stage 1: Build the React frontend
#
# We first copy only the package definition files to leverage Docker layer
# caching.  npm ci installs dependencies based on package-lock.json and
# fails if package-lock.json is missing or out of sync.  After
# dependencies are installed, we copy the rest of the frontend sources
# and run the build.  The build output will be located in
# `/app/build`.
FROM node:20 AS frontend-build
WORKDIR /app

# Copy package definitions and install dependencies
COPY frontend/package*.json ./
## Use npm install instead of npm ci to install dependencies based on package.json.  
## This avoids strict lockfile enforcement and allows new dependencies to be fetched even if package-lock.json
## is not yet updated.  npm ci would fail when the lock file does not include recently added packages.
RUN npm install --no-progress

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the production assets
RUN npm run build

### Stage 2: Install Python dependencies and prepare backend source
FROM python:3.11-slim AS backend-build
WORKDIR /backend

# Install required system packages for Python (e.g. SSL certificates)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy only requirements first to leverage Docker cache, then install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application
COPY backend/ ./

### Stage 3: Build final image with Nginx serving the frontend and Python backend
FROM nginx:stable-alpine AS runtime
WORKDIR /

# Install Python runtime and certificates for backend service
RUN apk add --no-cache python3 py3-pip ca-certificates openssl

# Copy built frontend into Nginx web root
COPY --from=frontend-build /app/build /usr/share/nginx/html

# Copy backend application into the final image
COPY --from=backend-build /backend /backend

# Copy configuration files and entrypoint script
COPY nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Install Python dependencies for the backend in the final stage.  We reuse
# the requirements file from the copied backend.  This step ensures the
# runtime image has all Python dependencies installed.  Note: we run
# pip3 here again because the previous stage’s installed packages are
# not available in this final Alpine-based environment.
# Use --break-system-packages to allow installation into the system
RUN pip3 install --break-system-packages --no-cache-dir -r /backend/requirements.txt

# Ensure Python output is unbuffered (helpful for logging)
ENV PYTHONUNBUFFERED=1

# Launch both Nginx and the Python backend via the entrypoint script
CMD ["/entrypoint.sh"]
