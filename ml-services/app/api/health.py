from fastapi import APIRouter

router = APIRouter(
    prefix="/health",
    tags=["Health"]
)


@router.get("")
def health():
    return {
        "status": "healthy",
        "service": "VARUNA AI",
        "model": "gemini-2.5-flash-lite"
    }