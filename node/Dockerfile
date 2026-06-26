FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# NODE_ID and C2_WS_URL are provided via environment (see docker-compose.yml).
CMD ["sh", "-c", "python node.py --node-id ${NODE_ID:-node-001}"]
