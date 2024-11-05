class VideoController {
    constructor() {
        console.log("Initializing VideoController");
        this.video = document.getElementById('videoPlayer');
        this.frameCount = document.getElementById('frameCount');
        this.timeCount = document.getElementById('timeCount');
        this.timelineMarker = document.getElementById('timelineMarker');
        
        this.FPS = 15; // 30fps에서 15fps로 변경
        this.isPlaying = false;
        this.controlsEnabled = true;
        this.currentVideoPath = null;
 
        this.initializeControls();
        this.initializeEventListeners();
    }
 
    initializeControls() {
        // 컨트롤 버튼 초기화
        console.log("Initializing video controls");
        this.playPauseBtn = document.getElementById('playPause');
        this.prevFrameBtn = document.getElementById('prevFrame');
        this.nextFrameBtn = document.getElementById('nextFrame');
        this.prevSecondBtn = document.getElementById('prevSecond');
        this.nextSecondBtn = document.getElementById('nextSecond');
        this.markPointBtn = document.getElementById('markPoint');
        this.completeButton = document.getElementById('completeButton');
 
        // 버튼 비활성화 상태로 시작
        this.buttons = [
            this.playPauseBtn,
            this.prevFrameBtn,
            this.nextFrameBtn,
            this.prevSecondBtn,
            this.nextSecondBtn,
            this.markPointBtn,
            this.completeButton
        ];
        this.disableControls();
    }
 
    initializeEventListeners() {
        console.log("Setting up video event listeners");
        // 비디오 이벤트
        this.video.addEventListener('loadstart', () => {
            console.log("Video load started");
            this.showLoading();
        });
 
        this.video.addEventListener('canplay', () => {
            console.log("Video can play", {
                duration: this.video.duration,
                currentTime: this.video.currentTime
            });
            this.hideLoading();
            this.enableControls();
            this.updateTimeDisplay();
        });
 
        this.video.addEventListener('timeupdate', () => {
            this.updateTimeDisplay();
            this.updateTimelineMarker();
        });
 
        this.video.addEventListener('play', () => {
            console.log("Video playing");
            this.isPlaying = true;
            this.updatePlayPauseButton();
        });
 
        this.video.addEventListener('pause', () => {
            console.log("Video paused");
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });
 
        // 컨트롤 버튼 이벤트
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.prevFrameBtn.addEventListener('click', () => this.moveFrame(-1));
        this.nextFrameBtn.addEventListener('click', () => this.moveFrame(1));
        this.prevSecondBtn.addEventListener('click', () => this.moveSecond(-1));
        this.nextSecondBtn.addEventListener('click', () => this.moveSecond(1));
        
        // 구간 표시 버튼 이벤트 
        this.markPointBtn.addEventListener('click', () => {
            console.log("Mark point clicked");
            this.pause();
            timelineController.markTimelinePoint();
        });
 
        // 작성 완료 버튼 이벤트
        this.completeButton.addEventListener('click', () => {
            console.log("Complete button clicked");
            timelineController.handleComplete();
        });
        
        // 키보드 단축키
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
 
    showLoading() {
        console.log("Showing loading state");
        this.video.style.opacity = '0.5';
    }
 
    hideLoading() {
        console.log("Hiding loading state");
        this.video.style.opacity = '1';
    }
 
    updatePlayPauseButton() {
        console.log("Updating play/pause button state:", this.isPlaying);
        this.playPauseBtn.innerHTML = this.isPlaying ? 
            '<span>일시정지</span>' : 
            '<span>재생</span>';
    }
 
    togglePlay() {
        if (!this.controlsEnabled || !this.video.src) {
            console.log("Play toggle ignored - controls disabled or no video");
            return;
        }
        
        console.log("Toggling play state");
        if (this.video.paused) {
            const modal = document.getElementById('segmentModal');
            if (modal.style.display !== 'block') {
                this.video.play();
            }
        } else {
            this.pause();
        }
    }
 
    moveFrame(frames) {
        if (!this.controlsEnabled || !this.video.src) {
            console.log("Frame move ignored - controls disabled or no video");
            return;
        }
        
        console.log("Moving frames:", {
            frames,
            currentTime: this.video.currentTime,
            frameTime: 1/this.FPS
        });

        const frameTime = 1/this.FPS;
        this.video.currentTime = Math.max(0, 
            Math.min(this.video.duration, 
                this.video.currentTime + (frames * frameTime)
            )
        );
        this.pause();
    }
 
    moveSecond(seconds) {
        if (!this.controlsEnabled || !this.video.src) {
            console.log("Second move ignored - controls disabled or no video");
            return;
        }
        
        console.log("Moving seconds:", {
            seconds,
            currentTime: this.video.currentTime
        });

        this.video.currentTime = Math.max(0, 
            Math.min(this.video.duration, 
                this.video.currentTime + seconds
            )
        );
    }
 
    updateTimeDisplay() {
        if (!this.video.src) return;
        
        const currentFrame = Math.floor(this.video.currentTime * this.FPS);
        const totalFrames = Math.floor(this.video.duration * this.FPS);
        const currentTime = this.video.currentTime.toFixed(2);
        
        this.frameCount.textContent = `${currentFrame}/${totalFrames}`;
        this.timeCount.textContent = `${currentTime}/${this.video.duration.toFixed(2)}`;
    }
 
    updateTimelineMarker() {
        if (!this.video.src) {
            console.log("Timeline marker update skipped - no video source");
            return;
        }
        const currentTime = this.video.currentTime;
        const duration = this.video.duration;
        const percentage = (currentTime / duration) * 100;
    
    console.log("Updating timeline marker:", {
        currentTime,
        duration,
        percentage,
        markerElement: this.timelineMarker,
        markerVisible: this.timelineMarker.style.display !== 'none'
    });

    // 마커가 사라지는 것을 방지하기 위한 검증
    if (!this.timelineMarker.style.left || percentage !== parseFloat(this.timelineMarker.style.left)) {
        this.timelineMarker.style.display = 'block';  // 마커 표시 상태 유지
        this.timelineMarker.style.left = `${percentage}%`;
    }
}
 
    handleKeyPress(e) {
        if (!this.controlsEnabled || !this.video.src) {
            console.log("Key press ignored - controls disabled or no video");
            return;
        }

        // 모달이 열려있을 때는 키보드 조작 방지
        if (document.getElementById('segmentModal').style.display === 'block') {
            return;
        }
 
        console.log("Key pressed:", e.code);

        const keyActions = {
            'Space': (e) => {
                e.preventDefault();
                this.togglePlay();
            },
            'ArrowLeft': (e) => {
                e.preventDefault();
                if (e.ctrlKey) {
                    this.moveFrame(-1);  // 한 프레임 뒤로 (1/15초)
                } else {
                    this.moveSecond(-1);
                }
            },
            'ArrowRight': (e) => {
                e.preventDefault();
                if (e.ctrlKey) {
                    this.moveFrame(1);  // 한 프레임 앞으로 (1/15초)
                } else {
                    this.moveSecond(1);
                }
            },
            'KeyM': () => {
                if (this.markPointBtn && !this.markPointBtn.disabled) {
                    this.markPointBtn.click();
                }
            }
        };
 
        const action = keyActions[e.code];
        if (action) action(e);
    }
 
    async loadVideo(url) {
        console.log("Loading video:", url);
        try {
            this.pause();
            this.video.src = url;
            
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    console.log("Video metadata loaded", {
                        duration: this.video.duration,
                        videoWidth: this.video.videoWidth,
                        videoHeight: this.video.videoHeight
                    });
                    this.video.currentTime = 0;
                    resolve();
                };
                this.video.onerror = (error) => {
                    console.error("Video load error:", error);
                    reject(new Error('비디오 로드 실패'));
                };
            });
        } catch (error) {
            console.error('비디오 로드 에러:', error);
            throw error;
        }
    }
 
    getCurrentFrame() {
        return Math.floor(this.video.currentTime * this.FPS);
    }
 
    getTotalFrames() {
        return Math.floor(this.video.duration * this.FPS);
    }
 
    frameToTime(frame) {
        return frame / this.FPS;
    }
 
    timeToFrame(time) {
        return Math.floor(time * this.FPS);
    }
 
    pause() {
        console.log("Pausing video");
        this.video.pause();
    }
 
    enableControls() {
        console.log("Enabling video controls");
        this.controlsEnabled = true;
        this.buttons.forEach(button => {
            if (button) button.disabled = false;
        });
    }
 
    disableControls() {
        console.log("Disabling video controls");
        this.controlsEnabled = false;
        this.buttons.forEach(button => {
            if (button) button.disabled = true;
        });
    }
 }
 
 const videoController = new VideoController();