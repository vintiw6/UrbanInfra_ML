from fastapi import FastAPI

app = FastAPI(
    title="UrbanInfra ML API",
    description="Urban Infrastructure and Growth Prediction API",
    version="1.0.0"
)

@app.get("/")
def home():
    return {
        "message": "UrbanInfra ML API is running!"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
    