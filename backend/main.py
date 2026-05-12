from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import recycling

load_dotenv()

app = FastAPI(title="분리수거 AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "https://*.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recycling.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
