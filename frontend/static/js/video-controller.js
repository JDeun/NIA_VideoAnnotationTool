class VideoController {
    constructor() {
        this.video = document.getElementById('videoPlayer');
        this.frameCount = document.getElementById('frameCount');
        this.timeCount = document.getElementById('timeCount');
        this.timelineMarker = document.getElementById('timelineMarker');
        this.completeButton = document.getElementById('completeButton');
        
        this.FPS = 15;
        this.isPlaying = false;
        this.controlsEnabled = true;
        this.currentVideoPath = null;

        this.initializeControls();
        this.initializeEventListeners();
    }

    initializeControls() {
        this.playPauseBtn = document.getElementById('playPause');
        this.prevFrameBtn = document.getElementById('prevFrame');
        this.nextFrameBtn = document.getElementById('nextFrame');
        this.prevSecondBtn = document.getElementById('prevSecond');
        this.nextSecondBtn = document.getElementById('nextSecond');
        this.markPointBtn = document.getElementById('markPoint');

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
        this.video.addEventListener('loadstart', () => this.showLoading());
        this.video.addEventListener('canplay', () => {
            this.hideLoading();
            this.enableControls();
            this.updateTimeDisplay();
        });

        this.video.addEventListener('timeupdate', () => {
            this.updateTimeDisplay();
            this.updateTimelineMarker();
        });

        this.video.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayPauseButton();
        });

        this.video.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });

        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.prevFrameBtn.addEventListener('click', () => this.moveFrame(-1));
        this.nextFrameBtn.addEventListener('click', () => this.moveFrame(1));
        this.prevSecondBtn.addEventListener('click', () => this.moveSecond(-1));
        this.nextSecondBtn.addEventListener('click', () => this.moveSecond(1));
        this.markPointBtn.addEventListener('click', () => {
            this.pause();
            timelineController.markTimelinePoint();
        });

        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    showLoading() {
        this.video.style.opacity = '0.5';
    }

    hideLoading() {
        this.video.style.opacity = '1';
    }

    updatePlayPauseButton() {
        this.playPauseBtn.innerHTML = this.isPlaying ? 
            '<span>일시정지</span>' : 
            '<span>재생</span>';
    }

    togglePlay() {
        if (!this.controlsEnabled || !this.video.src) return;
        
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
        if (!this.controlsEnabled || !this.video.src) return;
        
        const frameTime = 1 / this.FPS;
        this.video.currentTime = Math.max(0, 
            Math.min(this.video.duration, 
                this.video.currentTime + (frames * frameTime)
            )
        );
        this.pause();
    }

    moveSecond(seconds) {
        if (!this.controlsEnabled || !this.video.src) return;
        
        this.video.currentTime = Math.max(0, 
            Math.min(this.video.duration, 
                this.video.currentTime + seconds
            )
        );
    }

    updateTimeDisplay() {
        if (!this.video.src) return;
        
        const currentFrame = Math.floor(this.video.currentTime * this.FPS);
        const currentTime = this.video.currentTime.toFixed(2);
        
        this.frameCount.textContent = currentFrame;
        this.timeCount.textContent = currentTime;
    }

    updateTimelineMarker() {
        if (!this.video.src || !this.timelineMarker) return;
        
        const percentage = (this.video.currentTime / this.video.duration) * 100;
        requestAnimationFrame(() => {
            this.timelineMarker.style.left = `${percentage}%`;
            this.timelineMarker.style.display = 'block';
        });
    }

    handleKeyPress(e) {
        if (!this.controlsEnabled || !this.video.src) return;
        
        if (document.getElementById('segmentModal').style.display === 'block') {
            return;
        }

        const keyActions = {
            'Space': (e) => {
                e.preventDefault();
                this.togglePlay();
            },
            'ArrowLeft': (e) => {
                e.preventDefault();
                if (e.ctrlKey) {
                    this.moveFrame(-1);
                } else {
                    this.moveSecond(-1);
                }
            },
            'ArrowRight': (e) => {
                e.preventDefault();
                if (e.ctrlKey) {
                    this.moveFrame(1);
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
        try {
            this.pause();
            this.video.src = url;
            
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.currentTime = 0;
                    resolve();
                };
                this.video.onerror = () => reject(new Error('비디오 로드 실패'));
            });
        } catch (error) {
            console.error('비디오 로드 에러:', error);
            throw error;
        }
    }

    pause() {
        this.video.pause();
    }

    enableControls() {
        this.controlsEnabled = true;
        this.buttons.forEach(button => {
            if (button) button.disabled = false;
        });
    }

    disableControls() {
        this.controlsEnabled = false;
        this.buttons.forEach(button => {
            if (button) button.disabled = true;
        });
    }
}

const videoController = new VideoController();