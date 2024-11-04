from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import Dict
from pathlib import Path
import os
import aiofiles
from ..utils.file_handler import get_video_files, validate_video_file
from config import ALLOWED_VIDEO_EXTENSIONS
import aiofiles

router = APIRouter(tags=["video"])

@router.post("/load-path")
async def load_path(request: Dict[str, str]):
    try:
        path = request.get("path")
        if not path:
            raise HTTPException(status_code=400, detail="Path is required")
            
        # 경로가 전체 경로인 경우
        if os.path.isabs(path):
            files = await get_video_files(Path(path))
        else:
            # 상대 경로인 경우
            files = await get_video_files(Path.cwd() / path)

        if not files:
            raise HTTPException(status_code=404, detail="No video files found in the specified path")
            
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/video/{path:path}")
async def get_video(path: str):
    try:
        # 경로가 전체 경로인 경우
        if os.path.isabs(path):
            video_path = Path(path)
        else:
            # 상대 경로인 경우
            video_path = Path.cwd() / path

        if not await validate_video_file(video_path):
            raise HTTPException(status_code=400, detail="Invalid video file")
            
        return FileResponse(
            str(video_path),
            media_type="video/mp4",
            filename=video_path.name
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Video not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-file")
async def check_file(path: str):
    try:
        file_path = Path(path)
        if not file_path.is_absolute():
            file_path = Path.cwd() / file_path

        return {
            "exists": file_path.exists(),
            "is_file": file_path.is_file() if file_path.exists() else False,
            "is_video": await validate_video_file(file_path) if file_path.exists() else False
        }
    except Exception as e:
        return {"exists": False, "is_file": False, "is_video": False}

@router.post("/video/upload")
async def upload_video(file: UploadFile = File(...)):
    try:
        # 파일 확장자 검사
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_VIDEO_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Invalid file format")
        
        # 파일 저장
        save_path = Path("uploaded_videos") / file.filename
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(save_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        return {
            "filename": file.filename,
            "path": str(save_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))