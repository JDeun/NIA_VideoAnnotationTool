class TimelineController {
    constructor() {
        this.timeline = document.getElementById('timeline');
        this.modal = document.getElementById('segmentModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.actionButtons = document.querySelectorAll('.action-type-btn');
        this.saveSegmentBtn = document.getElementById('saveSegment');
        this.deleteSegmentBtn = document.getElementById('deleteSegment');
        this.cancelSegmentBtn = document.getElementById('cancelSegment');
        this.markPointBtn = document.getElementById('markPoint');
        
        this.captionInput = document.getElementById('captionInput');
        this.startFrameInput = document.getElementById('startFrame');
        this.endFrameInput = document.getElementById('endFrame');
        this.ageSelect = document.getElementById('age');
        this.genderInputs = document.getElementsByName('gender');
        this.disabilityInputs = document.getElementsByName('disability');

        this.segments = [];
        this.currentSegment = null;
        this.selectedActionType = null;
        this.lastEndTime = null;
        this.temporaryMarker = null;
        this.editingSegmentIndex = null;
        this.FPS = 15;
        this.tempSegment = null;

        this.lastUserInfo = {
            age: '1',
            gender: '1',
            disability: '2'
        };
        this.reset();
        this.initializeEventListeners();
    }

    reset() {
        this.currentSegment = null;
        this.temporaryMarker = null;
        this.markPointBtn.textContent = '구간 표시';
        this.markPointBtn.classList.remove('active');
    }

    initializeEventListeners() {
        // 액션 타입 버튼 이벤트
        this.actionButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.actionButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.selectedActionType = parseInt(button.dataset.action);
                this.validateSegmentData();
            });
        });

        // 프레임 입력 이벤트
        this.startFrameInput.addEventListener('change', () => this.handleFrameInputChange('start'));
        this.endFrameInput.addEventListener('change', () => this.handleFrameInputChange('end'));

        // 버튼 이벤트
        this.saveSegmentBtn.addEventListener('click', () => this.handleSegmentSave());
        this.deleteSegmentBtn.addEventListener('click', () => this.handleSegmentDelete());
        this.cancelSegmentBtn.addEventListener('click', () => this.hideModal());
        this.markPointBtn.addEventListener('click', () => this.markTimelinePoint());

        // 모달 외부 클릭 시 닫기
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hideModal();
        });

        // 키보드 이벤트
        document.addEventListener('keydown', (e) => {
            if (this.modal.style.display !== 'block') return;
            
            if (e.key === 'Escape') {
                this.hideModal();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSegmentSave();
            }
        });
    }

    handleFrameInputChange(type) {
        const frame = parseInt(type === 'start' ? this.startFrameInput.value : this.endFrameInput.value);
        if (isNaN(frame)) return;

        const video = document.getElementById('videoPlayer');
        video.currentTime = frame / this.FPS;
        this.validateSegmentData();
    }

    frameToTimestamp(frame) {
        const seconds = frame / this.FPS;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${hours}:${String(minutes).padStart(2, '0')}:${remainingSeconds.toFixed(6)}`;
    }

    timestampToFrame(timestamp) {
        if (!timestamp) return 0;
        
        try {
            const [hours, minutes, seconds] = timestamp.split(':').map(Number);
            return Math.round((hours * 3600 + minutes * 60 + seconds) * this.FPS);
        } catch (error) {
            console.error('Invalid timestamp format:', timestamp);
            return 0;
        }
    }

    markTimelinePoint() {
        const video = document.getElementById('videoPlayer');
        videoController.pause();
    
        if (!video.src) {
            alert('먼저 비디오를 로드해주세요.');
            return;
        }
    
        const currentTime = video.currentTime;
        const currentFrame = Math.floor(currentTime * this.FPS);
    
        if (!this.currentSegment) {
            this.currentSegment = {
                start: currentTime,
                startFrame: currentFrame
            };
            this.showTemporaryMarker(currentTime);
            this.markPointBtn.textContent = '구간 종료';
            this.markPointBtn.classList.add('active');
        } else {
            if (currentFrame <= this.currentSegment.startFrame) {
                alert('종료 시점은 시작 시점보다 뒤여야 합니다.');
                return;
            }
            this.showModal({
                ...this.currentSegment,
                end: currentTime,
                endFrame: currentFrame
            });
            this.reset();
        }
    }
    

    showModal(segment = null, isEdit = false) {
        videoController.pause();
        videoController.disableControls();
        this.modal.style.display = 'block';
        
        let startFrame = 0;
        let endFrame = 0;

        if (segment) {
            startFrame = segment.startFrame || 0;
            endFrame = segment.endFrame || 0;
            this.tempSegment = segment;
        } else {
            const video = document.getElementById('videoPlayer');
            const currentFrame = Math.floor(video.currentTime * this.FPS);
            startFrame = currentFrame;
            endFrame = currentFrame + this.FPS;
            this.tempSegment = { startFrame, endFrame };
        }

        this.startFrameInput.value = startFrame;
        this.endFrameInput.value = endFrame;
        
        if (isEdit && this.editingSegmentIndex !== null) {
            const segmentData = this.segments[this.editingSegmentIndex];
            this.modalTitle.textContent = '구간 정보 수정';
            this.deleteSegmentBtn.style.display = 'block';
            
            document.querySelectorAll('.action-type-btn').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.action) === segmentData.action);
            });
            this.selectedActionType = segmentData.action;
            
            this.captionInput.value = segmentData.caption;
            this.ageSelect.value = segmentData.age;
            this.setRadioValue('gender', segmentData.gender);
            this.setRadioValue('disability', segmentData.disability);
        } else {
            this.modalTitle.textContent = '구간 정보 입력';
            this.deleteSegmentBtn.style.display = 'none';
            
            document.getElementById('age').value = this.lastUserInfo.age;
            this.setRadioValue('gender', this.lastUserInfo.gender);
            this.setRadioValue('disability', this.lastUserInfo.disability);
            
            document.querySelectorAll('.action-type-btn').forEach(btn => btn.classList.remove('active'));
            this.selectedActionType = null;
            this.captionInput.value = '';
        }
        
        this.validateSegmentData();
    }

    hideModal() {
        this.modal.style.display = 'none';
        this.currentSegment = null;
        this.selectedActionType = null;
        this.editingSegmentIndex = null;
        this.captionInput.value = '';
        
        videoController.enableControls();
        
        if (this.temporaryMarker) {
            this.temporaryMarker.remove();
            this.temporaryMarker = null;
        }
        
        this.markPointBtn.textContent = '구간 표시';
        this.markPointBtn.classList.remove('active');
    }

    validateSegmentData() {
        const startFrame = parseInt(this.startFrameInput.value);
        const endFrame = parseInt(this.endFrameInput.value);
        
        if (isNaN(startFrame) || isNaN(endFrame) || startFrame >= endFrame) {
            this.saveSegmentBtn.disabled = true;
            return false;
        }
        
        const video = document.getElementById('videoPlayer');
        const maxFrame = Math.floor(video.duration * this.FPS);
        
        if (startFrame < 0 || endFrame > maxFrame) {
            this.saveSegmentBtn.disabled = true;
            return false;
        }
        
        this.saveSegmentBtn.disabled = !this.selectedActionType || 
                                     !this.captionInput.value.trim() ||
                                     !this.getRadioValue('gender') ||
                                     !this.getRadioValue('disability');
        
        return !this.saveSegmentBtn.disabled;
    }

    async handleSegmentSave() {
        if (!this.validateSegmentData()) {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        try {
            const startFrame = parseInt(this.startFrameInput.value);
            const endFrame = parseInt(this.endFrameInput.value);
            
            const segment = {
                segment_id: this.editingSegmentIndex ?? this.segments.length,
                start_time: this.frameToTimestamp(startFrame),
                end_time: this.frameToTimestamp(endFrame),
                duration: (endFrame - startFrame) / this.FPS,
                action: this.selectedActionType,
                caption: this.captionInput.value.trim(),
                age: parseInt(this.ageSelect.value),
                gender: this.getRadioValue('gender'),
                disability: this.getRadioValue('disability'),
                keyframes: []
            };

            // 현재 사용자 정보 저장
            this.lastUserInfo = {
                age: segment.age.toString(),
                gender: segment.gender.toString(),
                disability: segment.disability.toString()
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
            
            document.dispatchEvent(new CustomEvent('annotationModified'));
        } catch (error) {
            console.error('세그먼트 저장 실패:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    }

    async handleSegmentDelete() {
        if (this.editingSegmentIndex === null) return;
        
        if (confirm('선택한 구간을 삭제하시겠습니까?')) {
            this.segments.splice(this.editingSegmentIndex, 1);
            
            this.segments = this.segments.map((segment, index) => ({
                ...segment,
                segment_id: index
            }));
            
            await this.saveAnnotations();
            this.renderSegments();
            this.hideModal();
            
            document.dispatchEvent(new CustomEvent('annotationModified'));
        }
    }

    async saveAnnotations() {
        try {
            const video = document.getElementById('videoPlayer');
            const annotations = {
                info: {
                    filename: videoController.currentVideoPath,
                    format: 'mp4',
                    size: 0,
                    width_height: [video.videoWidth, video.videoHeight],
                    environment: 1,
                    device: 'KIOSK',
                    frame_rate: this.FPS,
                    playtime: video.duration,
                    date: new Date().toISOString().split('T')[0]
                },
                segments: this.segments,
                additional_info: {
                    InteractionType: 'Touchscreen'
                }
            };

            await fileHandler.saveAnnotations(annotations);
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }

    renderSegments() {
        this.clearSegments();
        
        const colors = {
            1: '#FFC107', // observe
            2: '#2196F3', // approach
            3: '#4CAF50', // use
            4: '#F44336'  // complete
        };

        this.segments.forEach((segment, index) => {
            const el = document.createElement('div');
            el.className = 'segment';
            el.dataset.index = index;
            
            const video = document.getElementById('videoPlayer');
            const startTime = this.timestampToFrame(segment.start_time) / this.FPS;
            const endTime = this.timestampToFrame(segment.end_time) / this.FPS;
            const startPct = (startTime / video.duration) * 100;
            const endPct = (endTime / video.duration) * 100;
            
            el.style.left = `${startPct}%`;
            el.style.width = `${endPct - startPct}%`;
            el.style.backgroundColor = colors[segment.action];
            el.style.top = `${(index % 3) * 16}px`;
            
            const tooltipText = `${this.getActionTypeText(segment.action)}\n` +
                              `나이: ${this.getAgeText(segment.age)}\n` +
                              `성별: ${this.getGenderText(segment.gender)}\n` +
                              `장애: ${this.getDisabilityText(segment.disability)}\n` +
                              `설명: ${segment.caption}`;
            el.title = tooltipText;

            const leftHandle = document.createElement('div');
            leftHandle.className = 'handle left';
            el.appendChild(leftHandle);

            const rightHandle = document.createElement('div');
            rightHandle.className = 'handle right';
            el.appendChild(rightHandle);
            
            this.initializeDragHandlers(el, leftHandle, rightHandle);
            
            el.onclick = (e) => {
                if (!e.target.classList.contains('handle')) {
                    this.editingSegmentIndex = index;
                    this.showModal({
                        startFrame: startTime * this.FPS,
                        endFrame: endTime * this.FPS
                    }, true);
                }
            };
            
            this.timeline.appendChild(el);
        });
    }

    initializeDragHandlers(segment, leftHandle, rightHandle) {
        let isDragging = false;
        let startX = 0;
        let segmentLeft = 0;
        let segmentWidth = 0;
        
        const startDrag = (e, isHandle, isLeft) => {
            isDragging = true;
            startX = e.clientX;
            segmentLeft = parseFloat(segment.style.left);
            segmentWidth = parseFloat(segment.style.width);
            
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const drag = (e) => {
            if (!isDragging) return;
            
            const timeline = this.timeline.getBoundingClientRect();
            const deltaX = ((e.clientX - startX) / timeline.width) * 100;
            
            if (e.target.classList.contains('handle')) {
                if (e.target === leftHandle) {
                    const newLeft = Math.max(0, segmentLeft + deltaX);
                    const newWidth = Math.max(1, segmentWidth - deltaX);
                    if (newLeft + newWidth <= 100) {
                        segment.style.left = `${newLeft}%`;
                        segment.style.width = `${newWidth}%`;
                    }
                } else {
                    const newWidth = Math.max(1, segmentWidth + deltaX);
                    if (segmentLeft + newWidth <= 100) {
                        segment.style.width = `${newWidth}%`;
                    }
                }
            } else {
                const newLeft = Math.max(0, Math.min(100 - segmentWidth, segmentLeft + deltaX));
                segment.style.left = `${newLeft}%`;
            }
         };
         
         const stopDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
            
            const index = parseInt(segment.dataset.index);
            const video = document.getElementById('videoPlayer');
            const totalFrames = Math.floor(video.duration * this.FPS);
            
            const left = parseFloat(segment.style.left);
            const width = parseFloat(segment.style.width);
            
            const startFrame = Math.round((left / 100) * totalFrames);
            const endFrame = Math.round(((left + width) / 100) * totalFrames);
            
            this.segments[index] = {
                ...this.segments[index],
                start_time: this.frameToTimestamp(startFrame),
                end_time: this.frameToTimestamp(endFrame),
                duration: (endFrame - startFrame) / this.FPS
            };
            
            document.dispatchEvent(new CustomEvent('annotationModified'));
            this.saveAnnotations();
         };
         
         segment.addEventListener('mousedown', (e) => {
            if (!e.target.classList.contains('handle')) {
                startDrag(e, false);
            }
         });
         
         leftHandle.addEventListener('mousedown', (e) => startDrag(e, true, true));
         rightHandle.addEventListener('mousedown', (e) => startDrag(e, true, false));
         }
         
         getActionTypeText(action) {
            const types = {
                1: 'Observe',
                2: 'Approach', 
                3: 'Use',
                4: 'Complete'
            };
            return types[action] || '';
         }
         
         getAgeText(age) {
            const ages = {1: '유소년', 2: '청중장년', 3: '노년'};
            return ages[age] || '';
         }
         
         getGenderText(gender) {
            return gender === 1 ? '남성' : '여성';
         }
         
         getDisabilityText(disability) {
            return disability === 1 ? '유' : '무';
         }
         
         clearSegments() {
            while (this.timeline.firstChild) {
                this.timeline.removeChild(this.timeline.firstChild);
            }
         }
         
         setRadioValue(name, value) {
            document.querySelector(`input[name="${name}"][value="${value}"]`).checked = true;
         }
         
         getRadioValue(name) {
            const radios = document.getElementsByName(name);
            for (const radio of radios) {
                if (radio.checked) {
                    return parseInt(radio.value);
                }
            }
            return null;
         }
         
         showTemporaryMarker(time) {
            if (this.temporaryMarker) {
                this.temporaryMarker.remove();
            }
         
            const marker = document.createElement('div');
            marker.className = 'temporary-marker';
            const percentage = (time / videoController.video.duration) * 100;
            marker.style.left = `${percentage}%`;
            marker.style.display = 'block';  // 추가
            this.timeline.appendChild(marker);
            this.temporaryMarker = marker;
        }
         }
         
         const timelineController = new TimelineController();