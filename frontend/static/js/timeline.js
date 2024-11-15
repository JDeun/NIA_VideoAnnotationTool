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
    this.startFrameInput = document.getElementById("startFrame");
    this.endFrameInput = document.getElementById("endFrame");
    this.userNumInput = document.getElementById("userNum"); // 새로 추가된 부분

    // userNumInput 초기화 확인을 위한 로그 추가
    console.log("userNumInput element:", this.userNumInput);

    // 삭제된 입력 필드들
    // this.captionInput = document.getElementById("captionInput");
    // this.ageInputs = document.getElementsByName("age");
    // this.genderInputs = document.getElementsByName("gender");
    // this.disabilityInputs = document.getElementsByName("disability");

    // 타임라인 상태 관리 변수들
    this.segments = [];
    this.currentSegment = null;
    this.selectedActionType = null;
    this.lastEndTime = 0;
    this.temporaryMarker = null;
    this.editingSegmentIndex = null;
    this.isDragging = false;
    this.draggedSegment = null;
    this.dragStartX = 0;
    this.originalStartFrame = 0;
    this.originalEndFrame = 0;
    this.dragType = null;

    // 프레임 관련 상수
    this.FPS = 15;
    this.FRAME_TIME = 1 / this.FPS;
    this.MINIMUM_SEGMENT_FRAMES = 1;

    // 삭제된 기본값들
    // this.defaultValues = {
    //     age: null,
    //     gender: null,
    //     disability: null
    // };

    // 새로운 기본값
    this.defaultValues = {
      user_num: 1,
    };

    // 신규/수정 모드 구분
    this.isNewFile = true;

    // 현재 상태 추적
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

    // user_num 입력 이벤트 추가
    this.userNumInput.addEventListener("input", () => {
      this.validateSegmentData();
    });

    // 프레임 입력 이벤트
    this.startFrameInput.addEventListener("change", () =>
      this.handleFrameInputChange("start")
    );
    this.endFrameInput.addEventListener("change", () =>
      this.handleFrameInputChange("end")
    );

    // 버튼 이벤트
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
    const framesDelta = Math.round(
      (e.clientX - this.dragStartX) / pixelsPerFrame
    );

    const index = parseInt(this.draggedSegment.dataset.index);
    const segment = this.segments[index];

    switch (this.dragType) {
      case "left":
        const newStartFrame = Math.max(
          0,
          this.originalStartFrame + framesDelta
        );
        if (newStartFrame < segment.end_frame - this.MINIMUM_SEGMENT_FRAMES) {
          segment.start_frame = newStartFrame;
          segment.duration = (segment.end_frame - newStartFrame) / this.FPS;
        }
        break;

      case "right":
        const newEndFrame = Math.min(
          totalFrames,
          this.originalEndFrame + framesDelta
        );
        if (newEndFrame > segment.start_frame + this.MINIMUM_SEGMENT_FRAMES) {
          segment.end_frame = newEndFrame;
          segment.duration = (newEndFrame - segment.start_frame) / this.FPS;
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
      videoDuration: video.duration,
    });

    // 수정: 프레임 유효성 검사 강화
    startFrame = Math.max(0, Math.min(startFrame, totalFrames));
    endFrame = Math.max(0, Math.min(endFrame, totalFrames));

    if (
      type === "start" &&
      startFrame >= endFrame - this.MINIMUM_SEGMENT_FRAMES
    ) {
      startFrame = endFrame - this.MINIMUM_SEGMENT_FRAMES;
    } else if (
      type === "end" &&
      endFrame <= startFrame + this.MINIMUM_SEGMENT_FRAMES
    ) {
      endFrame = startFrame + this.MINIMUM_SEGMENT_FRAMES;
    }

    console.log("Frame Input After Validation:", {
      after: { startFrame, endFrame },
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
      lastEndTime: this.lastEndTime,
      videoDuration: video.duration,
      totalFrames: Math.round(video.duration * this.FPS),
    });

    if (!this.currentSegment) {
      // 수정: 시작 프레임 결정 로직 개선
      let startFrame =
        this.lastEndTime !== null && this.lastEndTime > currentFrame
          ? this.lastEndTime
          : currentFrame;

      console.log("Creating new segment:", {
        startFrame,
        currentFrame,
        timeInSeconds: startFrame / this.FPS,
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
          startFrame: this.currentSegment.startFrame,
        });
        alert("종료 시점은 시작 시점보다 뒤여야 합니다.");
        return;
      }

      // 수정: 최소 구간 길이 검사 추가
      if (
        currentFrame - this.currentSegment.startFrame <
        this.MINIMUM_SEGMENT_FRAMES
      ) {
        alert("구간이 너무 짧습니다. 더 길게 입력하세요.");
        return;
      }

      console.log("Ending segment", {
        startFrame: this.currentSegment.startFrame,
        endFrame: currentFrame,
      });

      // 시작 프레임 유효성 검사 강화
      const totalFrames = Math.round(video.duration * this.FPS);
      if (startFrame < 0) {
        startFrame = 0;
      } else if (startFrame >= totalFrames) {
        startFrame = totalFrames - 1;
      }

      console.log("Creating new segment:", {
        startFrame,
        currentFrame,
        timeInSeconds: startFrame / this.FPS,
        totalFrames: totalFrames,
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
    this.modal.style.display = "block";
    this.tempSegment = segment;
    this.modalTitle.textContent = isEdit ? "구간 정보 수정" : "구간 정보 입력";

    this.startFrameInput.value = segment.startFrame;
    this.endFrameInput.value = segment.endFrame;

    if (isEdit) {
      this.deleteSegmentBtn.style.display = "block";
      const segmentData = this.segments[this.editingSegmentIndex];
      this.selectedActionType = segmentData.action;

      // user_num 값 설정 부분에 null 체크 추가
      //if (this.userNumInput) {
      //  this.userNumInput.value = this.defaultValues.user_num;
      //}

      this.actionButtons.forEach((btn) => {
        btn.classList.toggle(
          "active",
          parseInt(btn.dataset.action) === segmentData.action
        );
      });
    } else {
      this.deleteSegmentBtn.style.display = "none";
      this.actionButtons.forEach((btn) => btn.classList.remove("active"));
      this.selectedActionType = null;

      // user_num 값 설정 부분에 null 체크 추가
      //if (this.userNumInput) {
      //  this.userNumInput.value = this.defaultValues.user_num;
      //}
    }

    this.validateSegmentData();
  }

  // 모달 창 여닫을 시 userNum 리셋되는 부분 수정
  hideModal() {
    this.modal.style.display = "none";
    this.currentSegment = null;
    this.selectedActionType = null;
    this.editingSegmentIndex = null;
    
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
      startFrame: this.startFrameInput?.value,
      endFrame: this.endFrameInput?.value,
      userNumInput: this.userNumInput,
      isNewFile: this.isNewFile,
      editingIndex: this.editingSegmentIndex,
    });

    if (!this.validateSegmentData()) {
      console.log("Validation failed, cannot save segment");
      return;
    }

    try {
      // null 체크 추가
      if (!this.userNumInput) {
        throw new Error("userNumInput element not found");
      }

      const startFrame = Math.round(parseInt(this.startFrameInput.value));
      const endFrame = Math.round(parseInt(this.endFrameInput.value));
      const userNum = parseInt(this.userNumInput.value) || 1; // 기본값 1 설정

      const segment = {
        segment_id:
          this.editingSegmentIndex !== null
            ? this.editingSegmentIndex
            : this.segments.length,
        action: this.selectedActionType,
        start_frame: startFrame,
        end_frame: endFrame,
        duration: endFrame - startFrame,
        user_num: userNum, // user_num 추가
      };

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
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
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
        alert("저장할 구간이 없습니다.");
        return;
      }

      if (confirm("작성을 완료하시겠습니까?")) {
        await this.saveAnnotations(true);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  // timeline.js의 saveAnnotations 메서드
  async saveAnnotations(isComplete = false) {
    try {
      const video = videoController.video;
      const currentFile = fileHandler.getCurrentFile();

      // 데이터 구조 작성 전 로그
      console.log("Preparing save data with:", {
        video,
        currentFile,
        videoPath: videoController.currentVideoPath,
        segments: this.segments,
      });

      // user_num 값 가져오기
      const userNum = parseInt(this.userNumInput.value) || 1;
      console.log("User number:", userNum);

      // target_objects 배열 생성 - object_id를 0부터 userNum-1까지 순차적으로 할당
      const targetObjects = Array(userNum)
        .fill(null)
        .map((_, index) => ({
          object_id: index, // 0부터 순차적으로 증가
          age: 1,
          gender: 1,
          disability: 2,
        }));

      console.log("Generated target objects:", targetObjects);

      const annotationsData = {
        meta_data: {
          file_name: videoController.currentVideoPath.split("/").pop(),
          format: videoController.currentVideoPath
            .split(".")
            .pop()
            .toLowerCase(),
          size: currentFile.size || 0,
          width_height: [video.videoWidth || 0, video.videoHeight || 0],
          environment: 0,
          frame_rate: this.FPS,
          total_frames: Math.round(video.duration * this.FPS),
          camera_height: 170,
          camera_angle: 15,
        },
        additional_info: {
          InteractionType: "Touchscreen",
        },
        annotations: {
          space_context: "",
          user_num: userNum,
          target_objects: targetObjects,
          segmentation: this.segments.map((segment) => ({
            segment_id: segment.segment_id,
            action_type: segment.action,
            start_frame: Math.round(segment.start_frame),
            end_frame: Math.round(segment.end_frame),
            duration: Math.round(segment.end_frame - segment.start_frame),
            keyframe: Math.round((segment.start_frame + segment.end_frame) / 2),
            keypoints: targetObjects.map((obj) => ({
              // 각 target_object에 대한 keypoints 생성
              object_id: obj.object_id,
              keypoints: [],
            })),
          })),
        },
      };

      // 최종 데이터 구조 로깅
      console.log(
        "Final annotations data structure:",
        JSON.stringify(annotationsData, null, 2)
      );

      // 데이터 저장 시도
      try {
        await fileHandler.saveAnnotations(annotationsData, isComplete);
        console.log("Annotations saved successfully");
      } catch (saveError) {
        console.error("Error saving annotations:", saveError);
        throw saveError;
      }
    } catch (error) {
      console.error("Error preparing annotations:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  setRadioValue(name, value) {
    if (value) {
      const radio = document.querySelector(
        `input[name="${name}"][value="${value}"]`
      );
      if (radio) radio.checked = true;
    }
  }

  getSelectedRadioValue(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : null;
  }

  validateSegmentData() {
    console.log("Validation Check:", {
      actionType: this.selectedActionType,
      startFrame: this.startFrameInput?.value,
      endFrame: this.endFrameInput?.value,
      userNumInput: this.userNumInput, // 요소 자체 로깅
      userNumValue: this.userNumInput?.value, // value 로깅
      isNewFile: this.isNewFile,
      defaultValues: this.defaultValues,
    });

    const isValid =
      this.selectedActionType !== null &&
      this.startFrameInput?.value !== "" &&
      this.endFrameInput?.value !== "" &&
      (this.userNumInput
        ? this.userNumInput.value !== "" &&
          parseInt(this.userNumInput.value) >= 1 &&
          parseInt(this.userNumInput.value) <= 10
        : true);

    if (this.saveSegmentBtn) {
      this.saveSegmentBtn.disabled = !isValid;
    }
    return isValid;
  }

  // 수정: 세그먼트 렌더링 정확도 향상
  renderSegments() {
    this.clearSegments();

    const colors = {
      0: "#9E9E9E", // 기타: 회색
      1: "#2196F3", // 탐색: 파란색
      2: "#4CAF50", // 사용: 초록색
      3: "#F44336", // 종료: 빨간색
    };

    const video = document.getElementById("videoPlayer");
    // 수정: 전체 프레임 수 계산 정확도 향상
    const totalFrames = Math.round(video.duration * this.FPS);

    this.segments.forEach((segment, index) => {
      // 수정: 위치 계산 정확도 향상
      const startPct = Math.max(
        0,
        Math.min(100, (segment.start_frame / totalFrames) * 100)
      );
      const endPct = Math.max(
        0,
        Math.min(100, (segment.end_frame / totalFrames) * 100)
      );

      // 세그먼트 요소 생성
      const el = document.createElement("div");
      el.className = "segment";
      el.dataset.index = index;

      el.style.left = `${startPct}%`;
      el.style.width = `${endPct - startPct}%`;
      el.style.backgroundColor = colors[segment.action];
      el.style.top = `${(index % 3) * 16}px`;

      // 핸들 생성
      const leftHandle = document.createElement("div");
      leftHandle.className = "handle handle-left";
      el.appendChild(leftHandle);

      const rightHandle = document.createElement("div");
      rightHandle.className = "handle handle-right";
      el.appendChild(rightHandle);

      el.title = `${this.getActionName(segment.action)}: ${segment.caption}`;

      // 세그먼트 클릭 이벤트
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

      // 시작 지점 마커 화살표 생성
      const marker = document.createElement("div");
      marker.className = "segment-marker";
      marker.dataset.action = segment.action;
      marker.dataset.segmentIndex = index;
      marker.style.left = `${startPct}%`;

      // 마커 클릭 이벤트
      marker.addEventListener("click", (e) => {
        e.stopPropagation(); // 세그먼트 클릭 이벤트와 중복 방지

        // 비디오 시간 이동
        const startTime = segment.start_frame / this.FPS;
        videoController.video.currentTime = startTime;
        videoController.pause();
        videoController.updateTimeDisplay();
        videoController.updateTimelineMarker();
      });

      // 타임라인에 요소 추가
      this.timeline.appendChild(el);
      this.timeline.appendChild(marker);
    });
  }

  getActionName(action) {
    const actions = {
      0: "기타",
      1: "탐색",
      2: "사용",
      3: "종료",
    };
    return actions[action] || "알 수 없음";
  }

  clearSegments() {
    const segments = this.timeline.querySelectorAll(
      ".segment, .segment-marker"
    );
    segments.forEach((element) => element.remove());
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
        stack: error.stack,
      });
    }
  }

  // 수정: 임시 마커 표시 기능 개선
  showTemporaryMarker(time) {
    console.log("Showing temporary marker:", {
      time,
      videoDuration: videoController.video.duration,
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
    const percentage = Math.max(
      0,
      Math.min(100, (time / video.duration) * 100)
    );

    console.log("Setting temporary marker position:", {
      percentage,
      calculatedLeft: `${percentage}%`,
    });

    marker.style.left = `${percentage}%`;
    this.timeline.appendChild(marker);
    this.temporaryMarker = marker;
  }
}

const timelineController = new TimelineController();
