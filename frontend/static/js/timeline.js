class TimelineController {
    constructor() {
        console.log("Initializing TimelineController");
        this.timeline = document.getElementById("timeline");
        this.modal = document.getElementById("segmentModal");
        this.modalTitle = document.getElementById("modalTitle");
        this.actionButtons = document.querySelectorAll(".action-type-btn");
        this.saveSegmentBtn = document.getElementById("saveSegment");
        this.deleteSegmentBtn = document.getElementById("deleteSegment");
        this.cancelSegmentBtn = document.getElementById("cancelSegment");
        this.completeButton = document.getElementById("completeButton");
        this.markPointBtn = document.getElementById("markPoint");
        this.captionInput = document.getElementById("captionInput");
        this.startFrameInput = document.getElementById("startFrame");
        this.endFrameInput = document.getElementById("endFrame");
        this.ageInputs = document.getElementsByName("age");
        this.genderInputs = document.getElementsByName("gender");
        this.disabilityInputs = document.getElementsByName("disability");

        this.segments = [];
        this.currentSegment = null;
        this.selectedActionType = null;
        // 수정: lastEndTime 초기화 값 설정
        this.lastEndTime = 0;
        this.temporaryMarker = null;
        this.editingSegmentIndex = null;
        this.isDragging = false;
        this.draggedSegment = null;
        this.dragStartX = 0;
        this.originalStartFrame = 0;
        this.originalEndFrame = 0;
        this.dragType = null;

        // 추가: 프레임 관련 상수
        this.FPS = 15;
        this.FRAME_TIME = 1 / this.FPS;
        // 추가: 최소 구간 길이 제한
        this.MINIMUM_SEGMENT_FRAMES = 1; // 최소 1프레임

        // 신규 생성 시 사용할 기본값
        this.defaultValues = {
            age: null,
            gender: null,
            disability: null
        };

        // 신규/수정 모드 구분
        this.isNewFile = true;

        // 추가: 현재 상태 추적
        this.isMarkingSegment = false;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 액션 타입 버튼 이벤트
        this.actionButtons.forEach((button) => {
            button.addEventListener("click", () => {
                this.actionButtons.forEach((btn) => btn.classList.remove("active"));
                button.classList.add("active");
                this.selectedActionType = parseInt(button.dataset.action);
                this.validateSegmentData();
            });
        });

        // 캡션 입력 이벤트 추가
        this.captionInput.addEventListener('input', () => {
            this.validateSegmentData();
        });

        // 속성 라디오 버튼 이벤트
        this.ageInputs.forEach(input => {
            input.addEventListener('change', () => {
                if(this.isNewFile) {
                    this.defaultValues.age = parseInt(input.value);
                }
                this.validateSegmentData();
            });
        });

        this.genderInputs.forEach(input => {
            input.addEventListener('change', () => {
                if(this.isNewFile) {
                    this.defaultValues.gender = parseInt(input.value);
                }
                this.validateSegmentData();
            });
        });

        this.disabilityInputs.forEach(input => {
            input.addEventListener('change', () => {
                if(this.isNewFile) {
                    this.defaultValues.disability = parseInt(input.value);
                }
                this.validateSegmentData();
            });
        });

        // 프레임 입력 이벤트
        this.startFrameInput.addEventListener("change", () => this.handleFrameInputChange("start"));
        this.endFrameInput.addEventListener("change", () => this.handleFrameInputChange("end"));

        // 버튼 이벤트
        this.saveSegmentBtn.addEventListener("click", () => this.handleSegmentSave());
        this.deleteSegmentBtn.addEventListener("click", () => this.handleSegmentDelete());
        this.cancelSegmentBtn.addEventListener("click", () => this.hideModal());
        this.completeButton.addEventListener("click", () => this.handleComplete());

        // 모달 외부 클릭 시 닫기
        this.modal.addEventListener("click", (e) => {
            if (e.target === this.modal) this.hideModal();
        });

        // ESC/Enter 키 이벤트
        document.addEventListener("keydown", (e) => {
            if (this.modal.style.display !== "block") return;
            if (e.key === "Escape") {
                this.hideModal();
            } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.handleSegmentSave();
            }
        });

        // 타임라인 이벤트
        this.timeline.addEventListener("mousedown", (e) => this.handleTimelineMouseDown(e));
        document.addEventListener("mousemove", (e) => this.handleTimelineMouseMove(e));
        document.addEventListener("mouseup", () => this.handleTimelineMouseUp());
        }

        handleTimelineMouseDown(e) {
            const segment = e.target.closest(".segment");
            if (!segment) return;
    
            this.isDragging = true;
            this.draggedSegment = segment;
            this.dragStartX = e.clientX;
            const index = parseInt(segment.dataset.index);
            const segmentData = this.segments[index];
    
            if (e.target.classList.contains("handle-left")) {
                this.dragType = "left";
            } else if (e.target.classList.contains("handle-right")) {
                this.dragType = "right";
            } else {
                this.dragType = "move";
            }
    
            this.originalStartFrame = segmentData.start_frame;
            this.originalEndFrame = segmentData.end_frame;
    
            e.preventDefault();
        }

        handleTimelineMouseMove(e) {
            if (!this.isDragging) return;
    
            const timelineRect = this.timeline.getBoundingClientRect();
            const video = document.getElementById("videoPlayer");
            // 수정: 프레임 계산 정확도 향상
            const totalFrames = Math.round(video.duration * this.FPS);
            const pixelsPerFrame = timelineRect.width / totalFrames;
            const framesDelta = Math.round((e.clientX - this.dragStartX) / pixelsPerFrame);
    
            const index = parseInt(this.draggedSegment.dataset.index);
            const segment = this.segments[index];
    
            switch (this.dragType) {
                case "left":
                    const newStartFrame = Math.max(0, this.originalStartFrame + framesDelta);
                    if (newStartFrame < segment.end_frame - this.MINIMUM_SEGMENT_FRAMES) {
                        segment.start_frame = newStartFrame;
                        segment.duration = (segment.end_frame - newStartFrame) / this.FPS;
                    }
                    break;
    
                case "right":
                    const newEndFrame = Math.min(totalFrames, this.originalEndFrame + framesDelta);
                    if (newEndFrame > segment.start_frame + this.MINIMUM_SEGMENT_FRAMES) {
                        segment.end_frame = newEndFrame;
                        segment.duration = (newEndFrame - segment.start_frame) / this.FPS;
                    }
                    break;
    
                case "move":
                    const minFrame = Math.max(0, this.originalStartFrame + framesDelta);
                    const maxFrame = Math.min(totalFrames, this.originalEndFrame + framesDelta);
                    const duration = this.originalEndFrame - this.originalStartFrame;
    
                    if (minFrame >= 0 && maxFrame <= totalFrames) {
                        segment.start_frame = minFrame;
                        segment.end_frame = maxFrame;
                        segment.duration = duration / this.FPS;
                    }
                    break;
            }
    
            this.renderSegments();
            fileHandler.hasModifiedContent = true;
        }

        handleTimelineMouseUp() {
            if (this.isDragging) {
                this.isDragging = false;
                this.draggedSegment = null;
                this.saveAnnotations();
            }
        }
    
        handleFrameInputChange(type) {
            const video = document.getElementById("videoPlayer");
            // 수정: 프레임 계산 정확도 향상
            const totalFrames = Math.round(video.duration * this.FPS);
    
            let startFrame = parseInt(this.startFrameInput.value);
            let endFrame = parseInt(this.endFrameInput.value);
    
            console.log("Frame Input Change:", {
                type,
                before: { startFrame, endFrame },
                totalFrames,
                videoDuration: video.duration
            });

        // 수정: 프레임 유효성 검사 강화
        startFrame = Math.max(0, Math.min(startFrame, totalFrames));
        endFrame = Math.max(0, Math.min(endFrame, totalFrames));

        if (type === "start" && startFrame >= endFrame - this.MINIMUM_SEGMENT_FRAMES) {
            startFrame = endFrame - this.MINIMUM_SEGMENT_FRAMES;
        } else if (type === "end" && endFrame <= startFrame + this.MINIMUM_SEGMENT_FRAMES) {
            endFrame = startFrame + this.MINIMUM_SEGMENT_FRAMES;
        }

        console.log("Frame Input After Validation:", {
            after: { startFrame, endFrame }
        });

        this.startFrameInput.value = startFrame;
        this.endFrameInput.value = endFrame;

        if (this.tempSegment) {
            this.tempSegment.startFrame = startFrame;
            this.tempSegment.endFrame = endFrame;
        }
    }

    // 수정: 구간 표시 기능 개선
    markTimelinePoint() {
        console.log("Timeline Point Marking Started");
        const video = document.getElementById("videoPlayer");
        videoController.pause();

        if (!video.src) {
            console.warn("No video loaded - cannot mark timeline point");
            alert("먼저 비디오를 로드해주세요.");
            return;
        }

        const currentTime = video.currentTime;
        // 수정: 프레임 계산 정확도 향상
        const currentFrame = Math.round(currentTime * this.FPS);
        
        console.log("Marking timeline point:", {
            currentTime,
            currentFrame,
            hasCurrentSegment: !!this.currentSegment,
            lastEndTime: this.lastEndTime
        });

        if (!this.currentSegment) {
            // 수정: 시작 프레임 결정 로직 개선
            let startFrame = this.lastEndTime !== null && this.lastEndTime > currentFrame 
                ? this.lastEndTime 
                : currentFrame;

            console.log("Creating new segment:", {
                startFrame,
                currentFrame,
                timeInSeconds: startFrame / this.FPS
            });

            // 수정: 시작 지점 유효성 검사 추가
            if (startFrame >= 0 && startFrame <= video.duration * this.FPS) {
                this.currentSegment = { startFrame };
                this.showTemporaryMarker(startFrame / this.FPS);
                this.markPointBtn.textContent = "구간 종료";
                this.markPointBtn.classList.add("active");
                this.isMarkingSegment = true;
            } else {
                console.error("Invalid start frame:", startFrame);
                alert("유효하지 않은 시작 지점입니다.");
                return;
            }
        } else {
            if (currentFrame <= this.currentSegment.startFrame) {
                console.warn("End point before start point:", {
                    currentFrame,
                    startFrame: this.currentSegment.startFrame
                });
                alert("종료 시점은 시작 시점보다 뒤여야 합니다.");
                return;
            }

            // 수정: 최소 구간 길이 검사 추가
            if (currentFrame - this.currentSegment.startFrame < this.MINIMUM_SEGMENT_FRAMES) {
                alert("구간이 너무 짧습니다. 더 길게 입력하세요.");
                return;
            }

            console.log("Ending segment", {
                startFrame: this.currentSegment.startFrame,
                endFrame: currentFrame
            });

            this.showModal({
                ...this.currentSegment,
                endFrame: currentFrame,
            });
            this.markPointBtn.textContent = "구간 표시";
            this.markPointBtn.classList.remove("active");
            this.isMarkingSegment = false;
        }
    }

    showModal(segment, isEdit = false) {
        videoController.pause();
        videoController.disableControls();

        this.modal.style.display = "block";
        this.tempSegment = segment;
        this.modalTitle.textContent = isEdit ? "구간 정보 수정" : "구간 정보 입력";

        this.startFrameInput.value = segment.startFrame;
        this.endFrameInput.value = segment.endFrame;

        if (isEdit) {
            this.deleteSegmentBtn.style.display = "block";
            const segmentData = this.segments[this.editingSegmentIndex];
            this.selectedActionType = segmentData.action;
            this.captionInput.value = segmentData.caption;

            this.setRadioValue('age', segmentData.age);
            this.setRadioValue('gender', segmentData.gender);
            this.setRadioValue('disability', segmentData.disability);

            this.actionButtons.forEach((btn) => {
                if (parseInt(btn.dataset.action) === segmentData.action) {
                    btn.classList.add("active");
                } else {
                    btn.classList.remove("active");
                }
            });
        } else {
            this.deleteSegmentBtn.style.display = "none";
            this.actionButtons.forEach((btn) => btn.classList.remove("disabled"));
            this.selectedActionType = null;
            this.captionInput.value = "";

            if (this.isNewFile) {
                this.setRadioValue('age', this.defaultValues.age);
                this.setRadioValue('gender', this.defaultValues.gender);
                this.setRadioValue('disability', this.defaultValues.disability);
            }
        }

        this.validateSegmentData();
    }

    hideModal() {
        this.modal.style.display = "none";
        this.currentSegment = null;
        this.selectedActionType = null;
        this.editingSegmentIndex = null;
        this.captionInput.value = "";

        videoController.enableControls();

        if (this.temporaryMarker) {
            this.temporaryMarker.remove();
            this.temporaryMarker = null;
        }

        this.markPointBtn.textContent = "구간 표시";
        this.markPointBtn.classList.remove("active");
    }

    async handleSegmentSave() {
        console.log("Starting segment save process");
        console.log("Current state:", {
            selectedActionType: this.selectedActionType,
            captionValue: this.captionInput.value,
            startFrame: this.startFrameInput.value,
            endFrame: this.endFrameInput.value,
            isNewFile: this.isNewFile,
            editingIndex: this.editingSegmentIndex
        });

        if (!this.validateSegmentData()) {
            console.log("Validation failed, cannot save segment");
            return;
        }

        try {
            // 수정: 프레임 값 검증 및 변환 개선
            const startFrame = Math.round(parseInt(this.startFrameInput.value));
            const endFrame = Math.round(parseInt(this.endFrameInput.value));

            // 수정: 세그먼트 데이터 구조 개선
            const segment = {
                segment_id: this.editingSegmentIndex !== null ? this.editingSegmentIndex : this.segments.length,
                start_frame: startFrame,
                end_frame: endFrame,
                duration: ((endFrame - startFrame) / this.FPS).toFixed(6),
                action: this.selectedActionType,
                caption: this.captionInput.value.trim(),
                age: this.isNewFile ? this.defaultValues.age : parseInt(this.getSelectedRadioValue('age')),
                gender: this.isNewFile ? this.defaultValues.gender : parseInt(this.getSelectedRadioValue('gender')),
                disability: this.isNewFile ? this.defaultValues.disability : parseInt(this.getSelectedRadioValue('disability')),
                keyframes: []
            };

            console.log('Saving segment:', segment);

            if (this.editingSegmentIndex !== null) {
                console.log(`Updating existing segment at index ${this.editingSegmentIndex}`);
                this.segments[this.editingSegmentIndex] = segment;
            } else {
                console.log('Adding new segment');
                this.segments.push(segment);
                // 수정: lastEndTime 업데이트 로직 개선
                this.lastEndTime = endFrame;
            }

            console.log('Current segments array:', this.segments);
            await this.saveAnnotations();
            console.log('Annotations saved successfully');
            
            this.renderSegments();
            this.hideModal();
            fileHandler.hasModifiedContent = true;

        } catch (error) {
            console.error("세그먼트 저장 실패:", error);
            console.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            alert("저장 중 오류가 발생했습니다.");
        }
    }

    async handleSegmentDelete() {
        if (this.editingSegmentIndex === null) return;

        if (confirm("선택한 구간을 삭제하시겠습니까?")) {
            this.segments.splice(this.editingSegmentIndex, 1);
            await this.saveAnnotations();
            this.renderSegments();
            this.hideModal();
            fileHandler.hasModifiedContent = true;
        }
    }

    async handleComplete() {
        try {
            if (this.segments.length === 0) {
                alert('저장할 구간이 없습니다.');
                return;
            }

            if (confirm('작성을 완료하시겠습니까?')) {
                await this.saveAnnotations(true);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    }

    async saveAnnotations(isComplete = false) {
        try {
            console.log("Current segments before save:", this.segments);
            
            const annotations = {
                info: {
                    filename: videoController.currentVideoPath.split('/').pop(),
                    format: 'mp4',
                    size: 0,
                    width_height: [0, 0],
                    environment: 1,
                    device: "KIOSK",
                    frame_rate: this.FPS,
                    playtime: videoController.video.duration,
                    date: new Date().toISOString().split('T')[0]
                },
                segments: this.segments.map(segment => ({
                    ...segment,
                    // 수정: 프레임 값 변환 정확도 향상
                    start_frame: Math.round(segment.start_frame),
                    end_frame: Math.round(segment.end_frame),
                    action: parseInt(segment.action),
                    age: parseInt(segment.age),
                    gender: parseInt(segment.gender),
                    disability: parseInt(segment.disability)
                })),
                additional_info: {
                    InteractionType: "Touchscreen"
                }
            };

            console.log("Saving annotations:", annotations);
            await fileHandler.saveAnnotations(annotations, isComplete);
            console.log("Save completed");
            
        } catch (error) {
            console.error('Error saving annotations:', error);
            throw error;
        }
    }

    setRadioValue(name, value) {
        if (value) {
            const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
            if (radio) radio.checked = true;
        }
    }

    getSelectedRadioValue(name) {
        const selected = document.querySelector(`input[name="${name}"]:checked`);
        return selected ? selected.value : null;
    }

    validateSegmentData() {
        const isValid = 
            this.selectedActionType !== null && 
            this.captionInput.value.trim() !== '' &&
            this.startFrameInput.value !== '' &&
            this.endFrameInput.value !== '' &&
            (this.isNewFile ? 
                (this.defaultValues.age && this.defaultValues.gender && this.defaultValues.disability) :
                (this.getSelectedRadioValue('age') && this.getSelectedRadioValue('gender') && this.getSelectedRadioValue('disability'))
            );

        console.log('Validation Check:', {
            actionType: this.selectedActionType,
            caption: this.captionInput.value.trim(),
            startFrame: this.startFrameInput.value,
            endFrame: this.endFrameInput.value,
            isNewFile: this.isNewFile,
            defaultValues: this.defaultValues,
            selectedValues: {
                age: this.getSelectedRadioValue('age'),
                gender: this.getSelectedRadioValue('gender'),
                disability: this.getSelectedRadioValue('disability')
            }
        });
        
        this.saveSegmentBtn.disabled = !isValid;
        return isValid;
    }

    // 수정: 세그먼트 렌더링 정확도 향상
    renderSegments() {
        this.clearSegments();

        const colors = {
            0: "#9E9E9E", // 기타: 회색
            1: "#2196F3", // 탐색: 파란색
            2: "#4CAF50", // 사용: 초록색
            3: "#F44336"  // 종료: 빨간색
        };

        const video = document.getElementById("videoPlayer");
        // 수정: 전체 프레임 수 계산 정확도 향상
        const totalFrames = Math.round(video.duration * this.FPS);

        this.segments.forEach((segment, index) => {
            // 수정: 위치 계산 정확도 향상
            const startPct = Math.max(0, Math.min(100, (segment.start_frame / totalFrames) * 100));
            const endPct = Math.max(0, Math.min(100, (segment.end_frame / totalFrames) * 100));

            const el = document.createElement("div");
            el.className = "segment";
            el.dataset.index = index;

            el.style.left = `${startPct}%`;
            el.style.width = `${endPct - startPct}%`;
            el.style.backgroundColor = colors[segment.action];
            el.style.top = `${(index % 3) * 16}px`;

            const leftHandle = document.createElement("div");
            leftHandle.className = "handle handle-left";
            el.appendChild(leftHandle);

            const rightHandle = document.createElement("div");
            rightHandle.className = "handle handle-right";
            el.appendChild(rightHandle);

            el.title = `${this.getActionName(segment.action)}: ${segment.caption}`;

            el.addEventListener("click", (e) => {
                if (!e.target.classList.contains("handle")) {
                    this.editingSegmentIndex = index;
                    this.showModal(
                        {
                            startFrame: segment.start_frame,
                            endFrame: segment.end_frame,
                        },
                        true
                    );
                }
            });

            this.timeline.appendChild(el);
        });
    }

    getActionName(action) {
        const actions = {
            0: "기타",
            1: "탐색",
            2: "사용",
            3: "종료"
        };
        return actions[action] || "알 수 없음";
    }

    clearSegments() {
        const segments = this.timeline.querySelectorAll(".segment");
        segments.forEach((segment) => segment.remove());
    }

    loadAnnotations(annotations) {
        console.log("Loading annotations:", annotations);
        
        if (!annotations?.segments) {
            console.warn("No segments found in annotations");
            return;
        }

        try {
            this.isNewFile = false;
            this.segments = annotations.segments;
            console.log("Loaded segments:", this.segments);
            
            this.renderSegments();


            if (this.segments.length > 0) {
                const lastSegment = this.segments[this.segments.length - 1];
                // 수정: lastEndTime 설정 정확도 향상
                this.lastEndTime = Math.round(lastSegment.end_frame);
                console.log("Last end time set to:", this.lastEndTime);
            }
        } catch (error) {
            console.error("Error loading annotations:", error);
            console.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
    }

    // 수정: 임시 마커 표시 기능 개선
    showTemporaryMarker(time) {
        console.log("Showing temporary marker:", {
            time,
            videoDuration: videoController.video.duration
        });
            
        if (this.temporaryMarker) {
            console.log("Removing existing temporary marker");
            this.temporaryMarker.remove();
        }

        const video = videoController.video;
        // 수정: 시간 값 검증 강화
        if (time < 0 || time > video.duration) {
            console.error("Invalid marker time:", time);
            return;
        }

        const marker = document.createElement("div");
        marker.className = "temporary-marker";
        // 수정: 위치 계산 정확도 향상
        const percentage = Math.max(0, Math.min(100, (time / video.duration) * 100));

        console.log("Setting temporary marker position:", {
            percentage,
            calculatedLeft: `${percentage}%`
        });
        
        marker.style.left = `${percentage}%`;
        this.timeline.appendChild(marker);
        this.temporaryMarker = marker;
    }
}

const timelineController = new TimelineController();