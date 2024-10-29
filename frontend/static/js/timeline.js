class TimelineController {
    constructor() {
        this.timeline = document.getElementById('timeline');
        this.modal = document.getElementById('segmentModal');
        this.actionButtons = document.querySelectorAll('.action-type-btn');
        this.saveSegmentBtn = document.getElementById('saveSegment');
        this.cancelSegmentBtn = document.getElementById('cancelSegment');
        this.completeButton = document.getElementById('completeButton');
        this.markPointBtn = document.getElementById('markPoint');
        this.captionInput = document.getElementById('captionInput');

        this.segments = [];
        this.currentSegment = null;
        this.selectedActionType = null;
        this.lastEndTime = null;
        this.temporaryMarker = null;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.actionButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.actionButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.selectedActionType = button.dataset.action;
                this.captionInput.placeholder = this.getDefaultCaption(button.dataset.action);
                this.validateSegmentData();
            });
        });

        this.saveSegmentBtn.addEventListener('click', () => this.handleSegmentSave());
        this.cancelSegmentBtn.addEventListener('click', () => this.hideModal());
        this.completeButton.addEventListener('click', () => this.handleComplete());

        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.modal.style.display !== 'block') return;

            if (e.key === 'Escape') {
                this.hideModal();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSegmentSave();
            }
        });

        this.timeline.addEventListener('click', (e) => {
            if (e.target.classList.contains('segment')) {
                this.handleSegmentClick(e.target);
            }
        });
    }

    getDefaultCaption(actionType) {
        const captions = {
            'observe': '키오스크를 멀리서 살펴보는 중입니다.',
            'approach': '키오스크로 다가가는 중입니다.',
            'use': '키오스크를 사용하는 중입니다.',
            'complete': '키오스크 사용을 마치고 이동 중입니다.'
        };
        return captions[actionType] || '구간에 대한 설명을 입력해주세요.';
    }

    markTimelinePoint() {
        const video = document.getElementById('videoPlayer');
        videoController.pause();

        if (!video.src) {
            alert('먼저 비디오를 로드해주세요.');
            return;
        }

        const currentTime = video.currentTime;

        if (!this.currentSegment) {
            this.currentSegment = {
                start: this.lastEndTime ?? currentTime,
                startFrame: Math.floor((this.lastEndTime ?? currentTime) * 30)
            };
            this.showTemporaryMarker(this.currentSegment.start);
            this.markPointBtn.textContent = '구간 종료';
            this.markPointBtn.classList.add('active');
        } else {
            if (currentTime <= this.currentSegment.start) {
                alert('종료 시점은 시작 시점보다 뒤여야 합니다.');
                return;
            }
            this.showModal({
                ...this.currentSegment,
                end: currentTime,
                endFrame: Math.floor(currentTime * 30)
            });
            this.markPointBtn.textContent = '구간 표시';
            this.markPointBtn.classList.remove('active');
        }
    }

    showTemporaryMarker(time) {
        if (this.temporaryMarker) {
            this.temporaryMarker.remove();
        }

        const marker = document.createElement('div');
        marker.className = 'temporary-marker';
        const percentage = (time / videoController.video.duration) * 100;
        marker.style.left = `${percentage}%`;
        this.timeline.appendChild(marker);
        this.temporaryMarker = marker;
    }

    showModal(segment) {
        videoController.pause();
        videoController.disableControls();
        
        this.modal.style.display = 'block';
        this.tempSegment = segment;
        
        this.actionButtons.forEach(btn => btn.classList.remove('active'));
        this.selectedActionType = null;
        this.captionInput.value = '';
        this.validateSegmentData();
    }

    hideModal() {
        this.modal.style.display = 'none';
        this.currentSegment = null;
        this.selectedActionType = null;
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
        this.saveSegmentBtn.disabled = !this.selectedActionType;
    }

    async handleSegmentSave() {
        if (!this.selectedActionType) {
            alert('액션 타입을 선택해주세요.');
            return;
        }

        const caption = this.captionInput.value.trim();
        if (!caption) {
            alert('캡션을 입력해주세요.');
            return;
        }

        try {
            const segment = {
                action_type: this.selectedActionType,
                action_start: {
                    time: new Date(this.tempSegment.start * 1000).toISOString(),
                    frame: this.tempSegment.startFrame
                },
                action_end: {
                    time: new Date(this.tempSegment.end * 1000).toISOString(),
                    frame: this.tempSegment.endFrame
                },
                caption: caption
            };

            this.segments.push(segment);
            this.lastEndTime = this.tempSegment.end;
            await this.saveAnnotations();
            this.renderSegments();
            this.hideModal();
        } catch (error) {
            console.error('세그먼트 저장 실패:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    }

    async saveAnnotations() {
        try {
            const annotations = {
                annotations: {
                    start_time: new Date(0).toISOString(),
                    end_time: new Date(videoController.video.duration * 1000).toISOString(),
                    temporal_action_localization: this.segments
                }
            };

            await fileHandler.saveAnnotations(annotations);
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }

    async handleComplete() {
        try {
            await this.saveAnnotations();
            await fileHandler.displayFileList();
            alert('작성이 완료되었습니다.');
        } catch (error) {
            console.error('Error:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    }

    renderSegments() {
        this.clearSegments();
        
        const colors = {
            'observe': '#FFC107',
            'approach': '#2196F3',
            'use': '#4CAF50',
            'complete': '#F44336'
        };

        this.segments.forEach((segment, index) => {
            const el = document.createElement('div');
            el.className = 'segment';
            el.dataset.index = index;
            
            const video = document.getElementById('videoPlayer');
            const startPct = (segment.action_start.frame / (video.duration * 30)) * 100;
            const endPct = (segment.action_end.frame / (video.duration * 30)) * 100;
            
            el.style.left = `${startPct}%`;
            el.style.width = `${endPct - startPct}%`;
            el.style.backgroundColor = colors[segment.action_type];
            el.style.top = `${(index % 3) * 16}px`;
            el.style.height = '14px';
            
            el.title = `${segment.action_type}: ${segment.caption}`;
            
            this.timeline.appendChild(el);
        });
    }

    handleSegmentClick(segmentEl) {
        const index = parseInt(segmentEl.dataset.index);
        const segment = this.segments[index];
        
        if (confirm(`선택한 세그먼트를 삭제하시겠습니까?\n\n${segment.caption}`)) {
            this.segments.splice(index, 1);
            this.renderSegments();
            this.saveAnnotations();
        }
    }

    clearSegments() {
        const segments = this.timeline.querySelectorAll('.segment');
        segments.forEach(segment => segment.remove());
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
}

const timelineController = new TimelineController();