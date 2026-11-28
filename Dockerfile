FROM python:3.12-slim

ARG APP_UID=1001
ARG APP_GID=1001

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

RUN groupadd -g ${APP_GID} appuser \
    && useradd -m -u ${APP_UID} -g ${APP_GID} -s /usr/sbin/nologin appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY 1-telegram-bot ./1-telegram-bot
COPY 2-telegram-user-chat ./2-telegram-user-chat
COPY alembic ./alembic
COPY alembic.ini .
RUN mkdir -p /app/storage/channel_images \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
