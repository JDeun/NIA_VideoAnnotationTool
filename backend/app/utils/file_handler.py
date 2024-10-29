from pathlib import Path
from typing import List, Dict
import os
from config import ALLOWED_VIDEO_EXTENSIONS

async def get_video_files(path: Path) -> List[Dict]:
    """로컬 경로에서 비디오 파일을 검색합니다."""
    try:
        video_files = []
        
        # 경로가 파일인 경우
        if path.is_file():
            if await validate_video_file(path):
                video_files.append({
                    "name": path.name,
                    "path": str(path),
                    "size": path.stat().st_size,
                    "type": "local"
                })
        # 경로가 디렉토리인 경우
        elif path.is_dir():
            for file_path in path.rglob("*"):
                if await validate_video_file(file_path):
                    video_files.append({
                        "name": file_path.name,
                        "path": str(file_path),
                        "size": file_path.stat().st_size,
                        "type": "local"
                    })
        
        return video_files
    except Exception as e:
        raise ValueError(f"Error processing path: {str(e)}")

async def validate_video_file(path: Path) -> bool:
    """비디오 파일의 유효성을 검사합니다."""
    try:
        if not path.exists():
            return False
        
        if not path.is_file():
            return False
        
        if path.suffix.lower() not in ALLOWED_VIDEO_EXTENSIONS:
            return False
        
        # 0바이트 파일 체크
        if path.stat().st_size == 0:
            return False
        
        return True
    except Exception:
        return False