from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Dict
import json
from pathlib import Path
import os
from urllib.parse import unquote

router = APIRouter(prefix="/api", tags=["annotations"])

# 현재 메모리에 저장된 어노테이션 데이터
annotations_data = {}

@router.post("/annotations/{video_name}")
async def save_annotations(video_name: str, data: Dict = Body(...)):
   """
   비디오 어노테이션 임시 저장
   """
   try:
       annotations_data[video_name] = data
       return JSONResponse(
           content={"status": "success"},
           status_code=200
       )
   except Exception as e:
       raise HTTPException(status_code=500, detail=str(e))

@router.get("/annotations/{video_name}")
async def get_annotations(video_name: str):
   """
   비디오 어노테이션 조회
   """
   try:
       # 메모리에서 먼저 확인
       if video_name in annotations_data:
           return annotations_data[video_name]
       
       # 파일에서 확인
       video_path = unquote(video_name)
       json_path = Path(video_path).with_suffix('.json')
       
       if json_path.exists():
           with open(json_path, 'r', encoding='utf-8') as f:
               data = json.load(f)
               annotations_data[video_name] = data  # 메모리에 캐시
               return data
               
       # 없으면 빈 데이터 반환
       return {
           "annotations": {
               "start_time": "",
               "end_time": "",
               "temporal_action_localization": []
           }
       }
   except Exception as e:
       raise HTTPException(status_code=500, detail=str(e))

@router.post("/complete/{video_name}")
async def complete_annotations(video_name: str):
   """
   어노테이션 최종 저장 및 JSON 파일 생성
   """
   try:
       if video_name not in annotations_data:
           raise HTTPException(status_code=404, detail="Annotations not found")
           
       output_path = Path(unquote(video_name)).with_suffix('.json')
       output_path.parent.mkdir(parents=True, exist_ok=True)
       
       with open(output_path, 'w', encoding='utf-8') as f:
           json.dump(annotations_data[video_name], f, ensure_ascii=False, indent=2)
       
       # 메모리에서 데이터 삭제
       del annotations_data[video_name]
       
       return JSONResponse(
           content={
               "status": "success",
               "file": str(output_path)
           },
           status_code=200
       )
   except Exception as e:
       raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-annotation")
async def check_annotation(path: str):
   """
   어노테이션 파일 존재 여부 확인
   """
   try:
       video_path = unquote(path)
       json_path = Path(video_path).with_suffix('.json')
       
       return JSONResponse(
           content={"exists": json_path.exists()},
           status_code=200
       )
   except Exception as e:
       return JSONResponse(
           content={"exists": False},
           status_code=200
       )

@router.post("/save-annotation")
async def save_annotation(file: UploadFile = File(...), path: str = Form(...)):
   """
   어노테이션 저장
   """
   try:
       if path.startswith('blob:'):
           raise HTTPException(status_code=400, detail="Invalid file path")

       # 파일 경로 처리
       video_path = unquote(path)
       if os.path.isabs(video_path):
           json_path = Path(video_path).with_suffix('.json')
       else:
           json_path = Path(video_path).with_suffix('.json')

       # 디렉토리가 없으면 생성
       json_path.parent.mkdir(parents=True, exist_ok=True)
       
       # 파일 내용 읽기 및 저장
       content = await file.read()
       json_path.write_bytes(content)
       
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
async def delete_annotations(video_name: str):
   """
   어노테이션 삭제
   """
   try:
       if video_name in annotations_data:
           del annotations_data[video_name]

       video_path = unquote(video_name)
       json_path = Path(video_path).with_suffix('.json')
       
       if json_path.exists():
           json_path.unlink()
           
       return JSONResponse(
           content={"status": "success"},
           status_code=200
       )
   except Exception as e:
       raise HTTPException(status_code=500, detail=str(e))