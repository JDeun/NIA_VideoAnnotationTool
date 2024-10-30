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
    this.dragType = null; // 'left', 'right', 'move'

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // 액션 타입 버튼 이벤트
    this.actionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.actionButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        this.selectedActionType = button.dataset.action;
        this.validateSegmentData();
      });
    });

    // 프레임 입력 이벤트
    this.startFrameInput.addEventListener("change", () =>
      this.handleFrameInputChange("start")
    );
    this.endFrameInput.addEventListener("change", () =>
      this.handleFrameInputChange("end")
    );

    // 저장/취소/삭제 버튼 이벤트
    this.saveSegmentBtn.addEventListener("click", () =>
      this.handleSegmentSave()
    );
    this.deleteSegmentBtn.addEventListener("click", () =>
      this.handleSegmentDelete()
    );
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
    this.timeline.addEventListener("mousedown", (e) =>
      this.handleTimelineMouseDown(e)
    );
    document.addEventListener("mousemove", (e) =>
      this.handleTimelineMouseMove(e)
    );
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

    // 드래그 타입 결정
    if (e.target.classList.contains("handle-left")) {
      this.dragType = "left";
    } else if (e.target.classList.contains("handle-right")) {
      this.dragType = "right";
    } else {
      this.dragType = "move";
    }

    this.originalStartFrame = segmentData.action_start.frame;
    this.originalEndFrame = segmentData.action_end.frame;

    e.preventDefault();
  }

  handleTimelineMouseMove(e) {
    if (!this.isDragging) return;

    const timelineRect = this.timeline.getBoundingClientRect();
    const video = document.getElementById("videoPlayer");
    const totalFrames = video.duration * 30;
    const pixelsPerFrame = timelineRect.width / totalFrames;
    const deltaX = e.clientX - this.dragStartX;
    const framesDelta = Math.round(deltaX / pixelsPerFrame);

    const index = parseInt(this.draggedSegment.dataset.index);
    const segment = this.segments[index];

    switch (this.dragType) {
      case "left":
        const newStartFrame = Math.max(
          0,
          this.originalStartFrame + framesDelta
        );
        if (newStartFrame < segment.action_end.frame) {
          segment.action_start.frame = newStartFrame;
          segment.action_start.time = this.frameToTimestamp(newStartFrame);
        }
        break;
      case "right":
        const newEndFrame = Math.min(
          totalFrames,
          this.originalEndFrame + framesDelta
        );
        if (newEndFrame > segment.action_start.frame) {
          segment.action_end.frame = newEndFrame;
          segment.action_end.time = this.frameToTimestamp(newEndFrame);
        }
        break;
      case "move":
        const minFrame = Math.max(0, this.originalStartFrame + framesDelta);
        const maxFrame = Math.min(
          totalFrames,
          this.originalEndFrame + framesDelta
        );
        const duration = this.originalEndFrame - this.originalStartFrame;

        if (minFrame >= 0 && maxFrame <= totalFrames) {
          segment.action_start.frame = minFrame;
          segment.action_end.frame = maxFrame;
          segment.action_start.time = this.frameToTimestamp(minFrame);
          segment.action_end.time = this.frameToTimestamp(maxFrame);
        }
        break;
    }

    this.renderSegments();
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
    const totalFrames = Math.floor(video.duration * 30);

    let startFrame = parseInt(this.startFrameInput.value);
    let endFrame = parseInt(this.endFrameInput.value);

    // 유효성 검사
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
      this.tempSegment.start = startFrame / 30;
      this.tempSegment.end = endFrame / 30;
    }
  }

  frameToTimestamp(frame) {
    const seconds = frame / 30;
    return new Date(seconds * 1000).toISOString();
  }

  markTimelinePoint() {
    const video = document.getElementById("videoPlayer");
    videoController.pause();

    if (!video.src) {
      alert("먼저 비디오를 로드해주세요.");
      return;
    }

    const currentTime = video.currentTime;
    const currentFrame = Math.floor(currentTime * 30);

    if (!this.currentSegment) {
      // 새로운 세그먼트 시작
      this.currentSegment = {
        start: this.lastEndTime ?? currentTime,
        startFrame: Math.floor((this.lastEndTime ?? currentTime) * 30),
      };
      this.showTemporaryMarker(this.currentSegment.start);
      this.markPointBtn.textContent = "구간 종료";
      this.markPointBtn.classList.add("active");
    } else {
      // 세그먼트 종료
      if (currentFrame <= this.currentSegment.startFrame) {
        alert("종료 시점은 시작 시점보다 뒤여야 합니다.");
        return;
      }
      this.showModal({
        ...this.currentSegment,
        end: currentTime,
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
      this.selectedActionType = segmentData.action_type;
      this.captionInput.value = segmentData.caption;

      // 액션 타입 버튼 활성화
      this.actionButtons.forEach((btn) => {
        if (btn.dataset.action === segmentData.action_type) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    } else {
      this.deleteSegmentBtn.style.display = "none";
      this.actionButtons.forEach((btn) => btn.classList.remove("active"));
      this.selectedActionType = null;
      this.captionInput.value = "";
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

  validateSegmentData() {
    this.saveSegmentBtn.disabled =
      !this.selectedActionType || !this.captionInput.value.trim();
  }

  async handleSegmentSave() {
    if (!this.selectedActionType) {
      alert("액션 타입을 선택해주세요.");
      return;
    }

    const caption = this.captionInput.value.trim();
    if (!caption) {
      alert("캡션을 입력해주세요.");
      return;
    }

    try {
      const segment = {
        action_type: this.selectedActionType,
        action_start: {
          time: this.frameToTimestamp(parseInt(this.startFrameInput.value)),
          frame: parseInt(this.startFrameInput.value),
        },
        action_end: {
          time: this.frameToTimestamp(parseInt(this.endFrameInput.value)),
          frame: parseInt(this.endFrameInput.value),
        },
        caption: caption,
      };

      if (this.editingSegmentIndex !== null) {
        this.segments[this.editingSegmentIndex] = segment;
      } else {
        this.segments.push(segment);
        this.lastEndTime = this.tempSegment.end;
      }

      await this.saveAnnotations();
      this.renderSegments();
      this.hideModal();
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
    }
  }

  async saveAnnotations() {
    try {
      const video = document.getElementById("videoPlayer");
      const annotations = {
        annotations: {
          start_time: new Date(0).toISOString(),
          end_time: new Date(video.duration * 1000).toISOString(),
          temporal_action_localization: this.segments,
        },
      };

      await fileHandler.saveAnnotations(annotations);
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  }

  async handleComplete() {
    try {
        if (this.segments.length === 0) {
            alert('저장할 구간이 없습니다.');
            return;
        }

        const annotations = {
            annotations: {
                start_time: new Date(0).toISOString(),
                end_time: new Date(videoController.video.duration * 1000).toISOString(),
                temporal_action_localization: this.segments
            }
        };

        if (confirm('작성을 완료하시겠습니까?')) {
            await fileHandler.saveAnnotations(annotations, true);  // isComplete flag를 true로 설정
            // 여기서 alert를 제거하고 fileHandler의 saveAnnotations에서 처리하도록 변경
        }
    } catch (error) {
        console.error('Error:', error);
        alert('저장 중 오류가 발생했습니다.');
    }
}

  renderSegments() {
    this.clearSegments();

    const colors = {
      observe: "#FFC107",
      approach: "#2196F3",
      use: "#4CAF50",
      complete: "#F44336",
    };

    this.segments.forEach((segment, index) => {
      const el = document.createElement("div");
      el.className = "segment";
      el.dataset.index = index;

      const video = document.getElementById("videoPlayer");
      const startPct =
        (segment.action_start.frame / (video.duration * 30)) * 100;
      const endPct = (segment.action_end.frame / (video.duration * 30)) * 100;

      el.style.left = `${startPct}%`;
      el.style.width = `${endPct - startPct}%`;
      el.style.backgroundColor = colors[segment.action_type];
      el.style.top = `${(index % 3) * 16}px`;

      // 드래그 핸들 추가
      // 드래그 핸들 추가
      const leftHandle = document.createElement("div");
      leftHandle.className = "handle handle-left";
      el.appendChild(leftHandle);

      const rightHandle = document.createElement("div");
      rightHandle.className = "handle handle-right";
      el.appendChild(rightHandle);

      el.title = `${segment.action_type}: ${segment.caption}`;

      // 세그먼트 클릭 이벤트
      el.addEventListener("click", (e) => {
        // 핸들 클릭은 무시 (드래그용)
        if (!e.target.classList.contains("handle")) {
          this.editingSegmentIndex = index;
          this.showModal(
            {
              start: segment.action_start.frame / 30,
              end: segment.action_end.frame / 30,
              startFrame: segment.action_start.frame,
              endFrame: segment.action_end.frame,
            },
            true
          );
        }
      });

      this.timeline.appendChild(el);
    });
  }

  clearSegments() {
    const segments = this.timeline.querySelectorAll(".segment");
    segments.forEach((segment) => segment.remove());
  }

  loadAnnotations(annotations) {
    if (!annotations?.annotations?.temporal_action_localization) return;

    this.segments = annotations.annotations.temporal_action_localization;
    this.renderSegments();

    if (this.segments.length > 0) {
      const lastSegment = this.segments[this.segments.length - 1];
      this.lastEndTime = lastSegment.action_end.frame / 30;
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
