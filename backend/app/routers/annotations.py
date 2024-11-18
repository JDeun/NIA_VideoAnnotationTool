from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Dict
import json
from pathlib import Path
from urllib.parse import unquote
import shutil
import cv2
import os
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
        logger.info(f"Saving annotation for original path: {path}")

        if path.startswith('blob:'):
            logger.error("Invalid file path: blob URL detected")
            raise HTTPException(status_code=400, detail="Invalid file path: blob URL not allowed")

        try:
            # url 디코딩
            video_path = unquote(path)
            logger.info(f"Decoded video path: {video_path}")
            
            # get_annotations와 동일한 방식으로 경로 처리
            video_file = Path(video_path)
            json_path = video_file.with_suffix('.json')
            logger.info(f"Target JSON path: {json_path}")

            # 비디오 파일의 디렉토리 존재 확인
            if not video_file.parent.exists():
                error_msg = f"Directory not found: {video_file.parent}"
                logger.error(error_msg)
                raise HTTPException(status_code=404, detail=error_msg)

            # 디렉토리 쓰기 권한 확인
            if not os.access(str(video_file.parent), os.W_OK):
                error_msg = f"No write permission: {video_file.parent}"
                logger.error(error_msg)
                raise HTTPException(status_code=403, detail=error_msg)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Path validation error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Path validation error: {str(e)}")

        # 파일 내용 처리
        try:
            content = await file.read()
            new_data = json.loads(content.decode('utf-8'))
            logger.info(f"Parsed JSON data with keys: {list(new_data.keys())}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
        except Exception as e:
            logger.error(f"Content processing error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Content processing error: {str(e)}")

        # 데이터 구조 검증
        try:
            validate_data_structure(new_data)
            logger.info("Data structure validation passed")
        except ValueError as e:
            logger.error(f"Data validation error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))

        # 파일 저장
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(new_data, f, ensure_ascii=False, indent=2)
            logger.info(f"Successfully saved to: {json_path}")
        except Exception as e:
            logger.error(f"File save error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"File save error: {str(e)}")

        return JSONResponse(
            content={
                "status": "success",
                "message": "Annotations saved successfully",
                "path": str(json_path)
            },
            status_code=200
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

def validate_data_structure(data):
    """데이터 구조 검증"""
    logger.info("Starting data structure validation")

    if not isinstance(data, dict):
        logger.error("Data is not a dictionary")
        raise ValueError("Data must be a dictionary")

    # 최상위 필수 섹션 검증    
    required_sections = ['meta_data', 'additional_info', 'annotations']
    for section in required_sections:
        if section not in data:
            logger.error(f"Missing required section: {section}")
            raise ValueError(f"Missing required section: {section}")
            
        # meta_data 섹션 검증
        required_meta_fields = [
            'file_name', 'format', 'size', 'width_height', 'environment',
            'frame_rate', 'total_frames', 'camera_height', 'camera_angle'
        ]
        for field in required_meta_fields:
            if field not in data['meta_data']:
                logger.error(f"Missing required field in meta_data: {field}")
                raise ValueError(f"Missing required field in meta_data: {field}")
            
        # annotations 섹션 검증
        required_annotation_fields = ['space_context', 'user_num', 'target_objects', 'segmentation']
        for field in required_annotation_fields:
            if field not in data['annotations']:
                logger.error(f"Missing required field in annotations: {field}")
                raise ValueError(f"Missing required field in annotations: {field}")

        # user_num 값 범위 검증
        user_num = data['annotations'].get('user_num')
        if not isinstance(user_num, int) or user_num < 1 or user_num > 10:
            logger.error(f"Invalid user_num value: {user_num}")
            raise ValueError("user_num must be an integer between 1 and 10")

        # segmentation 배열 검증
        if not isinstance(data['annotations']['segmentation'], list):
            logger.error("Segmentation is not a list")
            raise ValueError("Segmentation must be a list")
            
        for i, segment in enumerate(data['annotations']['segmentation']):
            logger.debug(f"Validating segment {i}")
            if not isinstance(segment, dict):
                logger.error(f"Segment {i} is not a dictionary")
                raise ValueError("Each segment must be a dictionary")
                
            required_segment_fields = [
                'segment_id', 'action_type', 'start_frame', 
                'end_frame', 'duration', 'keyframe', 'keypoints'
            ]
            
            for field in required_segment_fields:
                if field not in segment:
                    logger.error(f"Missing required field '{field}' in segment {i}")
                    raise ValueError(f"Missing required field in segment: {field}")

            # action_type 값 범위 검증 (0-3)
            if not (0 <= segment['action_type'] <= 3):
                logger.error(f"Invalid action_type value in segment {i}: {segment['action_type']}")
                raise ValueError(f"Invalid action_type value in segment {i} (must be 0-3)")

            # 프레임 값 검증
            if not (segment['start_frame'] >= 0 and segment['start_frame'] < segment['end_frame']):
                logger.error(f"Invalid frame values in segment {i}")
                raise ValueError(f"Invalid frame values in segment {i}")

            # keyframe 값 검증
            if not (segment['start_frame'] <= segment['keyframe'] <= segment['end_frame']):
                logger.error(f"Invalid keyframe value in segment {i}")
                raise ValueError(f"Invalid keyframe value in segment {i}")
                
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