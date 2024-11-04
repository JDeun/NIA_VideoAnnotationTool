class TimelineController {
    constructor() {
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
        this.lastEndTime = null;
        this.temporaryMarker = null;
        this.editingSegmentIndex = null;
        this.isDragging = false;
        this.draggedSegment = null;
        this.dragStartX = 0;
        this.originalStartFrame = 0;
        this.originalEndFrame = 0;
        this.dragType = null;

        // 신규 생성 시 사용할 기본값
        this.defaultValues = {
            age: null,
            gender: null,
            disability: null
        };

        // 신규/수정 모드 구분
        this.isNewFile = true;

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
        const totalFrames = video.duration * 15;
        const pixelsPerFrame = timelineRect.width / totalFrames;
        const framesDelta = Math.round((e.clientX - this.dragStartX) / pixelsPerFrame);

        const index = parseInt(this.draggedSegment.dataset.index);
        const segment = this.segments[index];

        switch (this.dragType) {
            case "left":
                const newStartFrame = Math.max(0, this.originalStartFrame + framesDelta);
                if (newStartFrame < segment.end_frame) {
                    segment.start_frame = newStartFrame;
                    segment.duration = (segment.end_frame - newStartFrame) / 15;
                }
                break;

            case "right":
                const newEndFrame = Math.min(totalFrames, this.originalEndFrame + framesDelta);
                if (newEndFrame > segment.start_frame) {
                    segment.end_frame = newEndFrame;
                    segment.duration = (newEndFrame - segment.start_frame) / 15;
                }
                break;

            case "move":
                const minFrame = Math.max(0, this.originalStartFrame + framesDelta);
                const maxFrame = Math.min(totalFrames, this.originalEndFrame + framesDelta);
                const duration = this.originalEndFrame - this.originalStartFrame;

                if (minFrame >= 0 && maxFrame <= totalFrames) {
                    segment.start_frame = minFrame;
                    segment.end_frame = maxFrame;
                    segment.duration = duration / 15;
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
        const totalFrames = Math.floor(video.duration * 15);

        let startFrame = parseInt(this.startFrameInput.value);
        let endFrame = parseInt(this.endFrameInput.value);

        startFrame = Math.max(0, Math.min(startFrame, totalFrames));
        endFrame = Math.max(0, Math.min(endFrame, totalFrames));

        if (type === "start" && startFrame >= endFrame) {
            startFrame = endFrame - 1;
        } else if (type === "end" && endFrame <= startFrame) {
            endFrame = startFrame + 1;
        }

        this.startFrameInput.value = startFrame;
        this.endFrameInput.value = endFrame;

        if (this.tempSegment) {
            this.tempSegment.startFrame = startFrame;
            this.tempSegment.endFrame = endFrame;
        }
    }

    markTimelinePoint() {
        const video = document.getElementById("videoPlayer");
        videoController.pause();

        if (!video.src) {
            alert("먼저 비디오를 로드해주세요.");
            return;
        }

        const currentFrame = Math.floor(video.currentTime * 15);

        if (!this.currentSegment) {
            this.currentSegment = {
                startFrame: this.lastEndTime ?? currentFrame,
            };
            this.showTemporaryMarker((this.currentSegment.startFrame / 15));
            this.markPointBtn.textContent = "구간 종료";
            this.markPointBtn.classList.add("active");
        } else {
            if (currentFrame <= this.currentSegment.startFrame) {
                alert("종료 시점은 시작 시점보다 뒤여야 합니다.");
                return;
            }
            this.showModal({
                ...this.currentSegment,
                endFrame: currentFrame,
            });
            this.markPointBtn.textContent = "구간 표시";
            this.markPointBtn.classList.remove("active");
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
        if (!this.validateSegmentData()) {
            console.log("Validation failed, cannot save segment");
            return;
        }

        try {
            const startFrame = parseInt(this.startFrameInput);
            const endFrame = parseInt(this.endFrameInput);

            const segment = {
                segment_id: this.editingSegmentIndex !== null ? this.editingSegmentIndex : this.segments.length,
                start_frame: startFrame,
                end_frame: endFrame,
                duration: ((endFrame - startFrame) / 15).toFixed(6),
                action: this.selectedActionType,
                caption: this.captionInput.value.trim(),
                age: this.isNewFile ? this.defaultValues.age : parseInt(this.getSelectedRadioValue('age')),
                gender: this.isNewFile ? this.defaultValues.gender : parseInt(this.getSelectedRadioValue('gender')),
                disability: this.isNewFile ? this.defaultValues.disability : parseInt(this.getSelectedRadioValue('disability')),
                keyframes: []
            };

            console.log('Saving segment:', segment);

            if (this.editingSegmentIndex !== null) {
                this.segments[this.editingSegmentIndex] = segment;
            } else {
                this.segments.push(segment);
                this.lastEndTime = endFrame;
            }

            await this.saveAnnotations();
            this.renderSegments();
            this.hideModal();
            fileHandler.hasModifiedContent = true;
        } catch (error) {
            console.error("세그먼트 저장 실패:", error);
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
                    frame_rate: 15,
                    playtime: videoController.video.duration,
                    date: new Date().toISOString().split('T')[0]
                },
                segments: this.segments.map(segment => ({
                    ...segment,
                    start_frame: parseInt(segment.start_frame),
                    end_frame: parseInt(segment.end_frame),
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

    renderSegments() {
        this.clearSegments();

        const colors = {
            0: "#9E9E9E", // 기타: 회색
            1: "#2196F3", // 접근: 파란색
            2: "#4CAF50", // 사용: 초록색
            3: "#F44336"  // 종료: 빨간색
        };

        const video = document.getElementById("videoPlayer");
        const totalFrames = video.duration * 15;

        this.segments.forEach((segment, index) => {
            const el = document.createElement("div");
            el.className = "segment";
            el.dataset.index = index;

            const startPct = (segment.start_frame / totalFrames) * 100;
            const endPct = (segment.end_frame / totalFrames) * 100;

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
            1: "접근",
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
        if (!annotations?.segments) return;

        this.isNewFile = false;
        this.segments = annotations.segments;
        this.renderSegments();

        if (this.segments.length > 0) {
            const lastSegment = this.segments[this.segments.length - 1];
            this.lastEndTime = lastSegment.end_frame;
        }
    }

    showTemporaryMarker(time) {
        if (this.temporaryMarker) {
            this.temporaryMarker.remove();
        }

        const marker = document.createElement("div");
        marker.className = "temporary-marker";
        const percentage = (time / videoController.video.duration) * 100;
        marker.style.left = `${percentage}%`;
        this.timeline.appendChild(marker);
        this.temporaryMarker = marker;
    }
}

const timelineController = new TimelineController();