from pathlib import Path
from typing import List, Dict
import os
import platform
from config import ALLOWED_VIDEO_EXTENSIONS

def normalize_path(path: Path) -> Path:
    """경로를 정규화하고 OS에 맞게 변환합니다."""
    try:
        if platform.system() == 'Windows':
            path_str = str(path.resolve())
            if not path_str.startswith("\\\\?\\"):
                path_str = "\\\\?\\" + path_str
            return Path(path_str)
        return path.resolve()
    except Exception as e:
        raise ValueError(f"Path normalization error: {str(e)}")

def check_file_access(path: Path) -> bool:
    """파일 또는 디렉토리의 접근 가능 여부를 확인합니다."""
    try:
        return path.exists() and os.access(str(path), os.R_OK)
    except Exception:
        return False

async def get_video_files(path: Path) -> List[Dict]:
    """로컬 경로에서 비디오 파일을 검색합니다."""
    try:
        normalized_path = normalize_path(path)
        if not check_file_access(normalized_path):
            raise ValueError(f"Path is not accessible: {path}")

        video_files = []
        
        # 경로가 파일인 경우
        if normalized_path.is_file():
            if await validate_video_file(normalized_path):
                video_files.append({
                    "name": normalized_path.name,
                    "path": str(normalized_path).replace("\\", "/"),
                    "size": normalized_path.stat().st_size,
                    "type": "local",
                    # 추가 정보
                    "originalPath": str(normalized_path).replace("\\", "/"),
                    "drive": normalized_path.drive,
                    "accessible": True
                })
        # 경로가 디렉토리인 경우
        elif normalized_path.is_dir():
            for file_path in normalized_path.rglob("*"):
                try:
                    if await validate_video_file(file_path):
                        video_files.append({
                            "name": file_path.name,
                            "path": str(file_path).replace("\\", "/"),
                            "size": file_path.stat().st_size,
                            "type": "local",
                            # 추가 정보
                            "originalPath": str(file_path).replace("\\", "/"),
                            "drive": file_path.drive,
                            "accessible": True
                        })
                except Exception as e:
                    print(f"Error processing file {file_path}: {str(e)}")
                    continue
        
        return video_files
    except Exception as e:
        raise ValueError(f"Error processing path: {str(e)}")

async def validate_video_file(path: Path) -> bool:
    """비디오 파일의 유효성을 검사합니다."""
    try:
        if not check_file_access(path):
            return False
        
        if not path.is_file():
            return False
        
        if path.suffix.lower() not in ALLOWED_VIDEO_EXTENSIONS:
            return False
        
        try:
            stats = path.stat()
            if stats.st_size == 0:
                return False
        except OSError:
            return False
            
        # Windows 숨김 파일 체크
        if platform.system() == 'Windows':
            try:
                import ctypes
                attrs = ctypes.windll.kernel32.GetFileAttributesW(str(path))
                if attrs != -1 and attrs & 2:  # Hidden attribute
                    return False
            except:
                pass
        
        return True
    except Exception:
        return False

async def check_file_status(path: Path) -> Dict:
    """파일의 상태 정보를 반환합니다."""
    try:
        normalized_path = normalize_path(path)
        return {
            "exists": normalized_path.exists(),
            "accessible": check_file_access(normalized_path),
            "is_file": normalized_path.is_file() if normalized_path.exists() else False,
            "is_video": await validate_video_file(normalized_path) if normalized_path.exists() else False,
            "drive": normalized_path.drive if platform.system() == 'Windows' else None,
            "error": None
        }
    except Exception as e:
        return {
            "exists": False,
            "accessible": False,
            "is_file": False,
            "is_video": False,
            "drive": None,
            "error": str(e)
        }