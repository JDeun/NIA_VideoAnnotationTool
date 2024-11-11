from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import Dict
from pathlib import Path
import os
import platform
import logging
from ..utils.file_handler import get_video_files, validate_video_file, normalize_path, check_file_access
from config import ALLOWED_VIDEO_EXTENSIONS
import aiofiles

# 로깅 설정 추가
logger = logging.getLogger(__name__)

router = APIRouter(tags=["video"])

@router.post("/load-path")
async def load_path(request: Dict[str, str]):
    """비디오 파일 목록을 로드합니다."""
    try:
        path = request.get("path")
        if not path:
            raise HTTPException(status_code=400, detail="Path is required")

        logger.info(f"Loading path: {path}")
            
        try:
            # 경로 생성 및 정규화
            if os.path.isabs(path):
                base_path = Path(path)
            else:
                base_path = Path.cwd() / path

            # 파일 목록 가져오기
            files = await get_video_files(base_path)
            
            if not files:
                logger.warning(f"No video files found in path: {path}")
                raise HTTPException(
                    status_code=404, 
                    detail="No video files found in the specified path"
                )
            
            logger.info(f"Found {len(files)} video files")
            return {"files": files}

        except PermissionError:
            logger.error(f"Permission denied accessing path: {path}")
            raise HTTPException(
                status_code=403,
                detail="Permission denied: Cannot access the specified path"
            )
            
        except FileNotFoundError:
            logger.error(f"Path not found: {path}")
            raise HTTPException(
                status_code=404,
                detail="The specified path does not exist"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in load_path: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/video/{path:path}")
async def get_video(path: str):
    """비디오 파일을 스트리밍합니다."""
    try:
        logger.info(f"Streaming video from path: {path}")
        
        try:
            # 경로 정규화
            if os.path.isabs(path):
                video_path = Path(path)
            else:
                video_path = Path.cwd() / path

            # 파일 접근성 검사
            if not check_file_access(video_path):
                logger.error(f"Cannot access video file: {video_path}")
                raise HTTPException(
                    status_code=403,
                    detail="Cannot access the video file. Check file permissions or if external drive is connected."
                )

            # 비디오 파일 유효성 검사
            if not await validate_video_file(video_path):
                logger.error(f"Invalid video file: {video_path}")
                raise HTTPException(
                    status_code=400,
                    detail="Invalid video file or file format not supported"
                )
                
            # 비디오 스트리밍
            return FileResponse(
                str(video_path),
                media_type="video/mp4",
                filename=video_path.name
            )
            
        except FileNotFoundError:
            logger.error(f"Video file not found: {path}")
            raise HTTPException(
                status_code=404,
                detail="Video file not found"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-file")
async def check_file(path: str):
    """파일의 상태를 확인합니다."""
    try:
        logger.info(f"Checking file status: {path}")
        
        # 경로 정규화
        try:
            if os.path.isabs(path):
                file_path = Path(path)
            else:
                file_path = Path.cwd() / path
        except Exception as e:
            logger.error(f"Invalid path format: {path}")
            return {
                "exists": False,
                "is_file": False,
                "is_video": False,
                "accessible": False,
                "error": str(e)
            }

        # 파일 상태 확인
        exists = file_path.exists()
        is_file = file_path.is_file() if exists else False
        is_accessible = check_file_access(file_path) if exists else False
        is_video = await validate_video_file(file_path) if (exists and is_file and is_accessible) else False
        
        return {
            "exists": exists,
            "is_file": is_file,
            "is_video": is_video,
            "accessible": is_accessible,
            "drive": file_path.drive if platform.system() == 'Windows' else None,
            "error": None
        }
        
    except Exception as e:
        logger.error(f"Error checking file status: {str(e)}")
        return {
            "exists": False,
            "is_file": False,
            "is_video": False,
            "accessible": False,
            "error": str(e)
        }

@router.post("/video/upload")
async def upload_video(file: UploadFile = File(...)):
    """비디오 파일을 업로드합니다."""
    try:
        logger.info(f"Uploading video file: {file.filename}")
        
        # 파일 확장자 검사
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_VIDEO_EXTENSIONS:
            logger.error(f"Invalid file format: {ext}")
            raise HTTPException(
                status_code=400,
                detail="Invalid file format. Only video files are allowed."
            )
        
        # 업로드 디렉토리 생성
        save_path = Path("uploaded_videos") / file.filename
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 파일 저장
        try:
            content = await file.read()
            save_path.write_bytes(content)
            
            logger.info(f"File saved successfully: {save_path}")
            return {
                "filename": file.filename,
                "path": str(save_path),
                "size": len(content),
                "type": "local"
            }
            
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Failed to save uploaded file"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in upload_video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))