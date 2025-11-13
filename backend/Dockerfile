# Use a small Python base image
FROM python:3.12-slim

# Environment settings for Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set workdir inside the container
WORKDIR /app

# Install system dependencies (if we need them later, we’ll add more)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency file and install Python packages
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the backend app code
COPY app /app/app

# Expose the backend port
EXPOSE 8000

# Default environment values (can be overridden by docker-compose or env)
ENV API_ENV=development \
    API_PORT=8000

# Start the FastAPI app with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]