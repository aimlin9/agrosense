from fastapi import FastAPI

app = FastAPI(
    title="AgroSense API",
    description="AI-powered crop disease advisory for smallholder farmers",
    version="0.1.0",
)


@app.get("/")
def read_root():
    return {
        "service": "AgroSense API",
        "version": "0.1.0",
        "status": "operational",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}