# One container: the React app (built here) served by the FastAPI model server.
FROM node:22-slim AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY public public
COPY src src
COPY api/coach_library.json api/coach_library.json
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
# LightGBM needs the OpenMP runtime, which the slim image leaves out.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api api
COPY deploy deploy
COPY --from=web /src/dist dist
# Run as an unprivileged user; the app only reads its files. Accounts go to Azure Blob Storage when
# AZURE_STORAGE_CONNECTION_STRING is set, otherwise to DATA_DIR (lost when the container is replaced).
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user DATA_DIR=/home/user/data
# Hosts such as Render set PORT; 7860 is the local default.
ENV PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "uvicorn deploy.serve:app --host 0.0.0.0 --port ${PORT}"]
