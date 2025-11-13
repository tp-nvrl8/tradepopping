from fastapi import FastAPI
import os

app = FastAPI(title="TradePopping Backend")


@app.get("/")
def root():
    return {"message": "TradePopping backend is alive"}


@app.get("/health")
def health():
    env = os.getenv("API_ENV", "unknown")
    return {
        "status": "ok",
        "service": "backend",
        "environment": env,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("API_PORT", "8000")),
        reload=True,
    )