from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pathlib import Path
import traceback
import logging

from app.routers import video, annotations
from config import (
    STATIC_DIR, 
    TEMPLATE_DIR, 
    CORS_ORIGINS, 
    CORS_ALLOW_CREDENTIALS, 
    CORS_ALLOW_METHODS, 
    CORS_ALLOW_HEADERS,
    API_PREFIX
)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI 앱 초기화
app = FastAPI(
    title="Video Labeling Platform",
    description="Large-scale video labeling platform for AI training",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
)

# static 및 template 디렉토리 존재 확인
if not STATIC_DIR.exists():
    logger.warning(f"Static directory not found: {STATIC_DIR}")
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

if not TEMPLATE_DIR.exists():
    logger.warning(f"Template directory not found: {TEMPLATE_DIR}")
    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)

# 정적 파일 마운트
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# 라우터 등록
app.include_router(video.router)
app.include_router(annotations.router)

@app.get("/")
async def read_root():
    """루트 경로 처리"""
    try:
        index_path = TEMPLATE_DIR / "index.html"
        if not index_path.exists():
            logger.error(f"Template not found: {index_path}")
            return HTMLResponse(content="""
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <title>비디오 라벨링 플랫폼</title>
                </head>
                <body>
                    <h1>비디오 라벨링 플랫폼</h1>
                    <p>프론트엔드 파일이 없습니다. frontend/templates/index.html을 확인해주세요.</p>
                </body>
                </html>
            """)
        return FileResponse(str(index_path))
    except Exception as e:
        logger.error(f"Error serving index.html: {str(e)}")
        return HTMLResponse(content=f"""
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <title>오류</title>
            </head>
            <body>
                <h1>오류가 발생했습니다</h1>
                <p>{str(e)}</p>
            </body>
            </html>
        """)

@app.get("/healthcheck")
async def healthcheck():
    """서버 상태 확인"""
    return {
        "status": "ok",
        "static_dir": str(STATIC_DIR),
        "static_dir_exists": STATIC_DIR.exists(),
        "template_dir": str(TEMPLATE_DIR),
        "template_dir_exists": TEMPLATE_DIR.exists()
    }

@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception):
    """404 에러 처리"""
    if request.url.path.startswith("/api"):
        return JSONResponse(
            status_code=404,
            content={"detail": "Not Found"}
        )
    return FileResponse(str(TEMPLATE_DIR / "index.html"))

@app.exception_handler(500)
async def server_error_handler(request: Request, exc: Exception):
    """500 에러 처리"""
    error_detail = str(exc)
    if app.debug:
        error_detail = traceback.format_exc()
    
    if request.url.path.startswith("/api"):
        return JSONResponse(
            status_code=500,
            content={"detail": error_detail}
        )
    return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <title>500 - 서버 오류</title>
        </head>
        <body>
            <h1>500 - 서버 오류</h1>
            <p>{error_detail}</p>
        </body>
        </html>
    """, status_code=500)

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    """전역 예외 처리 미들웨어"""
    try:
        return await call_next(request)
    except Exception as e:
        logger.error(f"Unhandled exception: {str(e)}")
        logger.error(traceback.format_exc())
        
        if request.url.path.startswith("/api"):
            return JSONResponse(
                status_code=500,
                content={"detail": str(e)}
            )
        return HTMLResponse(
            content=f"""
            <!DOCTYPE html>
            <html lang="ko">
            <head>
                <meta charset="UTF-8">
                <title>500 - 서버 오류</title>
            </head>
            <body>
                <h1>500 - 서버 오류</h1>
                <p>{str(e)}</p>
            </body>
            </html>
            """,
            status_code=500
        )