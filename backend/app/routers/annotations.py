from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from typing import Dict
import json
from pathlib import Path
from datetime import datetime
from urllib.parse import unquote
import traceback

router = APIRouter(prefix="/api", tags=["annotations"])

REQUIRED_INFO_FIELDS = {
    'filename': str,
    'format': str,
    'size': (int, float),
    'width_height': list,
    'environment': int,
}

FIXED_VALUES = {
    'format': 'mp4',
    'device': 'KIOSK',
    'frame_rate': 15,
    'InteractionType': 'Touchscreen'
}

VALUE_RANGES = {
    'environment': (1, 10),
    'action': (1, 4),
    'age': (1, 3),
    'gender': (1, 2),
    'disability': (1, 2)
}

def validate_json_format(data: Dict) -> bool:
    try:
        if 'info' not in data:
            return False
            
        info = data['info']
        for field, field_type in REQUIRED_INFO_FIELDS.items():
            if field not in info:
                return False
            if not isinstance(info[field], field_type):
                return False
                
        if 'segments' not in data:
            return False
        if not isinstance(data['segments'], list):
            return False
            
        for segment in data['segments']:
            required_segment_fields = [
                'segment_id', 'start_time', 'end_time', 'duration',
                'action', 'caption', 'age', 'gender', 'disability', 'keyframes'
            ]
            if not all(field in segment for field in required_segment_fields):
                return False
                
            # 값 범위 검증
            for field, (min_val, max_val) in VALUE_RANGES.items():
                if field in segment and not min_val <= segment[field] <= max_val:
                    return False

            # 프레임/타임스탬프 검증
            try:
                start_parts = segment['start_time'].split(':')
                end_parts = segment['end_time'].split(':')
                if len(start_parts) != 3 or len(end_parts) != 3:
                    return False
                
                start_time = float(start_parts[0])*3600 + float(start_parts[1])*60 + float(start_parts[2])
                end_time = float(end_parts[0])*3600 + float(end_parts[1])*60 + float(end_parts[2])
                
                if end_time <= start_time:
                    return False
                    
                if abs(segment['duration'] - (end_time - start_time)) > 0.1:  # 0.1초 오차 허용
                    return False
            except:
                return False
                
        return True
    except Exception as e:
        print(f"Validation error: {e}")
        return False

def create_new_json_structure(filename: str, video_info: Dict = None) -> Dict:
    if video_info is None:
        video_info = {}
    
    return {
        "info": {
            "filename": filename,
            "format": FIXED_VALUES['format'],
            "size": video_info.get('size', 0),
            "width_height": video_info.get('width_height', [0, 0]),
            "environment": 1,
            "device": FIXED_VALUES['device'],
            "frame_rate": FIXED_VALUES['frame_rate'],
            "playtime": video_info.get('playtime', 0),
            "date": datetime.now().strftime('%Y-%m-%d')
        },
        "segments": [],
        "additional_info": {
            "InteractionType": FIXED_VALUES['InteractionType']
        }
    }

# 메모리 캐시
annotations_data = {}

@router.post("/save-annotations/{video_name}")
async def save_annotation(data: Dict = Body(...)):
    try:
        path = data.get('info', {}).get('filename')
        if not path or path.startswith('blob:'):
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        video_path = unquote(path)
        json_path = Path(video_path).with_suffix('.json')
        
        print("Saving to path:", json_path) # 디버깅용 
        print("Data to save:", data) # 디버깅용
        
        # 데이터 검증
        if not validate_json_format(data):
            print("Invalid JSON format") # 디버깅용
            print("Validation errors:", data) # 디버깅용
            raise HTTPException(status_code=400, detail="Invalid annotation format")
            
        json_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 파일 저장
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        return JSONResponse(
            content={
                "status": "success",
                "message": "Annotations saved successfully",
                "path": str(json_path)
            },
            status_code=200
        )
    except Exception as e:
        print(f"Error saving annotations: {str(e)}") # 디버깅용
        print(f"Full error: {traceback.format_exc()}") # 디버깅용
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/annotations/{video_name}")
async def get_annotations(video_name: str):
    try:
        if not video_name:
            raise HTTPException(status_code=400, detail="Invalid video_name provided")

        # 캐시된 데이터 확인
        if video_name in annotations_data:
            return annotations_data[video_name]
        
        # 파일에서 로드
        video_path = unquote(video_name)
        json_path = Path(video_path).with_suffix('.json')
        
        if json_path.exists():
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not validate_json_format(data):
                    data = create_new_json_structure(video_name)
                annotations_data[video_name] = data
                return data
        
        # 새로운 JSON 구조 생성
        new_data = create_new_json_structure(video_name)
        annotations_data[video_name] = new_data
        return new_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save-annotations/{video_name}")
async def save_annotation(data: Dict = Body(...)):
    try:
        path = data.get('info', {}).get('filename')
        if not path or path.startswith('blob:'):
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        video_path = unquote(path)
        json_path = Path(video_path).with_suffix('.json')
        json_path.parent.mkdir(parents=True, exist_ok=True)

        # 데이터 검증
        if not validate_json_format(data):
            raise HTTPException(status_code=400, detail="Invalid annotation format")
            
        # 세그먼트 ID 재정렬
        if data.get('segments'):
            for idx, segment in enumerate(data['segments']):
                segment['segment_id'] = idx
        
        # 파일 저장
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        return JSONResponse(
            content={
                "status": "success",
                "message": "Annotations saved successfully",
                "path": str(json_path)
            },
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/annotations/{video_name}")
async def delete_annotation(video_name: str):
    try:
        if not video_name:
            raise HTTPException(status_code=400, detail="Invalid video_name provided")

        # 캐시에서 제거
        if video_name in annotations_data:
            del annotations_data[video_name]

        # 파일 삭제
        video_path = unquote(video_name)
        json_path = Path(video_path).with_suffix('.json')
        
        if json_path.exists():
            json_path.unlink()

        return JSONResponse(content={"status": "success"}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-annotation")
async def check_annotation(path: str):
    try:
        if not path:
            raise HTTPException(status_code=400, detail="Invalid path provided")

        video_path = unquote(path)
        json_path = Path(video_path).with_suffix('.json')
        
        return JSONResponse(
            content={"exists": json_path.exists()},
            status_code=200
        )
    except Exception as e:
        return JSONResponse(content={"exists": False}, status_code=200)