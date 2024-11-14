# Video Interaction Annotation Tool

이 비디오 어노테이션 도구는 NIA의 초거대 확산 생태계 조성 사업 중 키오스크/무인이동체에 탑재될 AI모델을 학습시키기 위한 데이터를 작성하기 위한 도구입니다.
사용자의 키오스크 사용 영상을 분석하고 레이블링합니다.

## 주요 기능

   - 비디오 재생 및 제어 (프레임 단위 이동, 구간 지정)
   - 상호작용 유형 레이블링 (기타/접근/사용/종료)
   - 사용 인원 입력
   - 타임라인 기반 구간 관리
   - JSON 형식의 어노테이션 데이터 저장/로드

## 시스템 요구사항

   - Python 3.8 이상
   - Node.js 14.0 이상 (프론트엔드 개발 시)
   - 모던 웹 브라우저 (Chrome, Firefox, Safari 최신 버전 권장)

## 설치 방법

1. 저장소 클론
```bash
git clone https://github.com/username/video-annotation-tool.git
cd video-annotation-tool
```

2. Python 가상환경 생성 및 활성화
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

3. 필요한 패키지 설치
```bash
pip install -r requirements.txt
```

## 실행 방법

1. 서버 실행
```bash
python run.py
```

2. 웹 브라우저에서 접속
```
http://localhost:8000
```

## 사용 방법
### 1. 비디오 로드

   - 경로 로드: 특정 경로의 비디오 파일 로드
   - 폴더 로드: 폴더 내의 모든 비디오 파일 로드
   - 파일 로드: 개별 비디오 파일 선택 로드

### 2. 비디오 제어

   - 재생/일시정지: Space 키 또는 재생 버튼
   - 프레임 이동:

   -- 이전/다음 프레임: Ctrl + ←/→
   -- 이전/다음 초: ←/→

   - 구간 표시: M 키 또는 구간 표시 버튼

### 3. 구간 레이블링

   - '구간 표시' 버튼으로 시작 지점 지정
   - 원하는 종료 지점에서 다시 '구간 표시' 클릭
   - 팝업 창에서 다음 정보 입력:

   -- 행동 유형 (기타/접근/사용/종료)
   -- 사용 인원 (1-10명)

   - '저장' 버튼으로 구간 저장

### 4. 구간 편집

   - 타임라인의 구간을 클릭하여 정보 수정
   - 드래그하여 구간 이동 또는 크기 조절
   - 삭제 버튼으로 구간 제거

### 5. 작업 저장

   - 구간 정보는 자동 저장
   - '작성 완료' 버튼으로 최종 저장

## 데이터 형식
### 입력 데이터

   - 지원 비디오 형식: MP4, AVI, MOV, MKV
   - 권장 프레임레이트: 15fps

### 출력 데이터 (JSON)
```json
{
    "meta_data": {
        "file_name": "example.mp4",
        "format": "mp4",
        "size": 61362738,
        "width_height": [2304, 1296],
        "environment": 0,
        "frame_rate": 15,
        "total_frames": 4746,
        "camera_height": 170,
        "camera_angle": 15
    },
    "additional_info": {
        "InteractionType": "Touchscreen"
    },
    "annotations": {
        "space_context": "",
        "user_num": 1,
        "target_objects": [
            {
                "object_id": 0,
                "age": 1,
                "gender": 1,
                "disability": 2
            }
        ],
        "segmentation": [
            {
                "segment_id": 0,
                "action_type": 1,
                "start_frame": 150,
                "end_frame": 300,
                "duration": 150,
                "keyframe": 225,
                "keypoints": [
                    {
                        "object_id": 0,
                        "keypoints": []
                    }
                ]
            }
        ]
    }
}
```

## 코드 구조

```
video-annotation-tool/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── annotations.py
│   │   │   └── video.py
│   │   ├── utils/
│   │   │   └── file_handler.py
│   │   └── main.py
│   ├── config.py
│   └── run.py
├── frontend/
│   ├── static/
│   │   ├── video-controller.js
│   │   ├── timeline.js
│   │   ├── file-handler.js
│   │   └── style.css
│   └── templates/
│       └── index.html
└── requirements.txt
```

## 문제 해결

### 자주 발생하는 문제

1. 비디오 로드 실패
   - 지원하는 비디오 형식인지 확인
   - 파일 경로에 한글이나 특수문자 포함 여부 확인

2. 구간 저장 안됨
   - 모든 필수 필드 입력 확인
   - 브라우저 콘솔에서 에러 메시지 확인

3. 타임라인 표시 오류
   - 비디오 프레임레이트 확인 (15fps 권장)
   - 브라우저 새로고침 후 재시도

### 로그 확인 방법

1. 클라이언트 로그
   - 브라우저 개발자 도구(F12) > Console 탭

2. 서버 로그
   - 터미널에서 서버 실행 로그 확인
   - `logs/` 디렉토리의 로그 파일 확인

## 개발자 정보

- 이 도구는 NIA 프로젝트의 일환으로 개발되었습니다.
- 버그 리포트 및 기능 제안은 Issues 탭을 이용해 주세요.

## 라이선스
This project is licensed under the MIT License - see the LICENSE file for details.

### 주요 변경사항:
1. 주요 기능에서 연령대/성별/장애여부 제거하고 사용 인원 추가
2. 구간 레이블링 절차 간소화
3. JSON 구조를 새로운 형식으로 업데이트
4. 예제 JSON에 모든 필수 필드 포함

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
