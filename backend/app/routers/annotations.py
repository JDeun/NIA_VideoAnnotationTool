from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Dict
import json
from pathlib import Path
from urllib.parse import unquote
import shutil
import cv2
from datetime import datetime
import logging

# 로깅 설정
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

router = APIRouter(prefix="/api", tags=["annotations"])

@router.get("/check-annotation")
async def check_annotation(path: str):
   """어노테이션 파일 존재 여부 확인"""
   try:
       logger.info(f"Checking annotation for path: {path}")
       video_path = unquote(path)
       json_path = Path(video_path).with_suffix('.json')

       exists = json_path.exists()
       logger.info(f"Annotation exists: {exists} at path: {json_path}")
       
       return JSONResponse(
           content={"exists": json_path.exists()},
           status_code=200
       )
   except Exception as e:
       logger.error(f"Error checking annotation: {str(e)}")
       return JSONResponse(
           content={"exists": False},
           status_code=200
       )

@router.post("/save-annotation")
async def save_annotation(file: UploadFile = File(...), path: str = Form(...)):
    """어노테이션 저장"""
    try:
        print(f"Saving annotation for path: {path}")  # 디버깅용 로그

        if path.startswith('blob:'):
            logger.error("Invalid file path: blob URL detected")
            raise HTTPException(status_code=400, detail="Invalid file path")

        # 파일 경로 처리
        video_path = unquote(path)
        json_path = Path(video_path).with_suffix('.json')
        
        logger.info(f"JSON path: {json_path}")  # 디버깅용 로그
        
        # 디렉토리가 없으면 생성
        json_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 새로운 데이터 로드
        content = await file.read()
        try:
            new_data = json.loads(content)
            logger.info(f"New data loaded: {list(new_data.keys())}")  # 디버깅용 로그
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")  # 디버깅용 로그
            raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")

        save_data = None
        if json_path.exists():
            logger.info("Existing file found - updating")  # 디버깅용 로그
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    existing_data = json.load(f)
                
                # 백업 생성
                backup_path = json_path.with_suffix('.json.bak')
                shutil.copy2(json_path, backup_path)
                logger.info(f"Backup created at: {backup_path}")

                # 새로운 segments만 업데이트
                updated_segments = []
                existing_segments = {s.get('segment_id'): s for s in existing_data.get('segments', [])}
                new_segments = {s.get('segment_id'): s for s in new_data.get('segments', [])}

                # 모든 segment_id에 대해 처리
                all_segment_ids = set(existing_segments.keys()) | set(new_segments.keys())
                for segment_id in all_segment_ids:
                    if segment_id in new_segments:
                        updated_segments.append(new_segments[segment_id])
                    elif segment_id in existing_segments:
                        updated_segments.append(existing_segments[segment_id])

                # segments만 업데이트하고 나머지는 기존 데이터 유지
                existing_data['segments'] = sorted(
                    updated_segments, 
                    key=lambda x: x.get('segment_id', 0)
                )
                save_data = existing_data
                save_data['segments'] = new_data.get('segments', [])
                
            except Exception as e:
                logger.error(f"Error processing existing file: {str(e)}")  # 디버깅용 로그
                raise HTTPException(status_code=500, detail=f"Error processing existing file: {str(e)}")
        else:
            logger.info("Creating new annotation file")  # 디버깅용 로그
            try:
                # 새 파일 생성의 경우
                video_info = {
                    "filename": Path(video_path).name,
                    "format": Path(video_path).suffix[1:],
                    "size": 0,
                    "width_height": [0, 0],
                    "environment": 1,
                    "device": "KIOSK",
                    "frame_rate": 15,
                    "playtime": 0,
                    "date": datetime.now().strftime("%Y-%m-%d")
                }

                # 비디오 파일이 존재하면 실제 정보로 업데이트
                if Path(video_path).exists():
                    try:
                        video_file = Path(video_path)
                        cap = cv2.VideoCapture(str(video_file))
                        video_info.update({
                            "size": video_file.stat().st_size,
                            "width_height": [
                                int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                                int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                            ],
                            "playtime": cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS)
                        })
                        cap.release()
                        logger.info(f"Video info updated: {video_info}")
                    except Exception as e:
                        logger.error(f"Error getting video info: {str(e)}")  # 비디오 정보 획득 실패해도 계속 진행

                save_data = {
                    "info": video_info,
                    "segments": new_data.get('segments', []),
                    "additional_info": {
                        "InteractionType": "Touchscreen"
                    }
                }

            except Exception as e:
                logger.error(f"Error creating new file: {str(e)}")  # 디버깅용 로그
                raise HTTPException(status_code=500, detail=f"Error creating new file: {str(e)}")

        # 저장 전 데이터 검증
        try:
            logger.info("Validating data structure")
            validate_data_structure(save_data)
            logger.info("Data validation passed")
        except ValueError as e:
            logger.error(f"Validation error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))

        # 파일 저장
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, ensure_ascii=False, indent=2)
                logger.info(f"File saved successfully at: {json_path}")
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")  # 디버깅용 로그
            raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")
        
        return JSONResponse(
            content={
                "status": "success",
                "message": "Annotations saved successfully",
                "path": str(json_path)
            },
            status_code=200
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")  # 디버깅용 로그
        raise HTTPException(status_code=500, detail=str(e))

def validate_data_structure(data):
    """데이터 구조 검증"""
    logger.info("Starting data structure validation")

    if not isinstance(data, dict):
        logger.error("Data is not a dictionary")
        raise ValueError("Data must be a dictionary")
        
    required_sections = ['info', 'segments', 'additional_info']
    for section in required_sections:
        if section not in data:
            logger.error(f"Missing required section: {section}")
            raise ValueError(f"Missing required section: {section}")
            
    if not isinstance(data['segments'], list):
        logger.error("Segments is not a list")
        raise ValueError("Segments must be a list")
        
    for i, segment in enumerate(data['segments']):
        logger.debug(f"Validating segment {i}")
        if not isinstance(segment, dict):
            logger.error(f"Segment {i} is not a dictionary")
            raise ValueError("Each segment must be a dictionary")
            
        required_fields = [
            'segment_id', 'start_frame', 'end_frame',
            'duration', 'action', 'caption',
            'age', 'gender', 'disability'
        ]
        
        for field in required_fields:
            if field not in segment:
                logger.error(f"Missing required field '{field}' in segment {i}")
                raise ValueError(f"Missing required field in segment: {field}")
            
    logger.info("Data structure validation completed successfully")

@router.get("/annotations/{video_path:path}")
async def get_annotations(video_path: str):
    """어노테이션 조회"""
    # url 디코딩
    try:
        logger.info(f"Getting annotations for video: {video_path}")
        decoded_path = unquote(video_path)
        json_path = Path(decoded_path).with_suffix('.json')
        
        if not json_path.exists():
            logger.info(f"No annotations found at {json_path}")
            return JSONResponse(
                content={"segments": []},
                status_code=200
            )
        # json 파일 가져오기   
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                logger.info(f"Successfully loaded annotations from {json_path}")
                logger.debug(f"Loaded data contains {len(data.get('segments', []))} segments")
                return JSONResponse(content=data, status_code=200)
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Invalid JSON format: {str(e)}")

    except Exception as e:
        logger.error(f"Error getting annotations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete-annotation/{video_path:path}")
async def delete_annotation(video_path: str):
   """어노테이션 삭제"""
   try:
       logger.info(f"Deleting annotation for video: {video_path}")
       decoded_path = unquote(video_path)
       json_path = Path(decoded_path).with_suffix('.json')
       
       if json_path.exists():
           # 삭제 전 백업
           backup_path = json_path.with_suffix('.json.bak')
           shutil.copy2(json_path, backup_path)
           logger.info(f"Backup created at {backup_path}")
           
           # 파일 삭제
           json_path.unlink()
           logger.info(f"Annotation file deleted: {json_path}")

       return JSONResponse(
           content={"status": "success"},
           status_code=200
       )
   except Exception as e:
       logger.error(f"Error deleting annotation: {str(e)}")
       raise HTTPException(status_code=500, detail=str(e))

def validate_segment(segment: Dict):
   """세그먼트 데이터 검증"""
   logger.info("Validating segment data")
   logger.debug(f"Segment data: {segment}")

   required_fields = [
       'segment_id', 'start_frame', 'end_frame', 'duration',
       'action', 'caption', 'age', 'gender', 'disability'
   ]

   for field in required_fields:
       if field not in segment:
           logger.error(f"Missing required field: {field}")
           raise ValueError(f"Missing required field in segment: {field}")

   # 값 범위 검증
   if not (0 <= segment['action'] <= 3):
       logger.error(f"Invalid action value: {segment['action']}")
       raise ValueError("Invalid action value (must be 1-4)")
       
   if not (1 <= segment['age'] <= 3):
       logger.error(f"Invalid age value: {segment['age']}")
       raise ValueError("Invalid age value (must be 1-3)")
       
   if not (1 <= segment['gender'] <= 2):
       logger.error(f"Invalid gender value: {segment['gender']}")
       raise ValueError("Invalid gender value (must be 1-2)")
       
   if not (1 <= segment['disability'] <= 2):
       logger.error(f"Invalid disability value: {segment['disability']}")
       raise ValueError("Invalid disability value (must be 1-2)")

   # 프레임 검증
   try:
       start_frame = int(segment['start_frame'])
       end_frame = int(segment['end_frame'])
       if start_frame >= end_frame:
           raise ValueError("start_frame must be less than end_time")
   except ValueError:
       raise ValueError("Invalid frame format")

   # duration 검증
   try:
        duration = int(segment['duration'])
        if duration <= 0:
            logger.error(f"Invalid duration: {duration}")
            raise ValueError("Duration must be positive")
   except ValueError as e:
        logger.error(f"Invalid duration format: {str(e)}")
        raise ValueError("Invalid duration format")

   logger.info("Segment validation completed successfully")