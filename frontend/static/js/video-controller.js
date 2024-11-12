class VideoController {
  constructor() {
      console.log("Initializing VideoController");
      this.video = document.getElementById('videoPlayer');
      this.frameCount = document.getElementById('frameCount');
      this.timeCount = document.getElementById('timeCount');
      this.timelineMarker = document.getElementById('timelineMarker');
      
      this.FPS = 15;
      this.isPlaying = false;
      this.controlsEnabled = true;
      this.currentVideoPath = null;

      this.initializeControls();
      this.initializeEventListeners();
  }

  initializeControls() {
      console.log("Initializing video controls");
      this.playPauseBtn = document.getElementById('playPause');
      this.prevFrameBtn = document.getElementById('prevFrame');
      this.nextFrameBtn = document.getElementById('nextFrame');
      this.prevSecondBtn = document.getElementById('prevSecond');
      this.nextSecondBtn = document.getElementById('nextSecond');
      this.markPointBtn = document.getElementById('markPoint');
      this.completeButton = document.getElementById('completeButton');

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

    // bind를 사용하여 this 컨텍스트 유지
    const boundUpdateTimeDisplay = this.updateTimeDisplay.bind(this);
    const boundUpdateTimelineMarker = this.updateTimelineMarker.bind(this);

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
      boundUpdateTimeDisplay();
      boundUpdateTimelineMarker();
  });

    this.video.addEventListener('timeupdate', () => {
      boundUpdateTimeDisplay();
      boundUpdateTimelineMarker();
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

      this.playPauseBtn.addEventListener('click', () => this.togglePlay());
      this.prevFrameBtn.addEventListener('click', () => this.moveFrame(-1));
      this.nextFrameBtn.addEventListener('click', () => this.moveFrame(1));
      this.prevSecondBtn.addEventListener('click', () => this.moveSecond(-1));
      this.nextSecondBtn.addEventListener('click', () => this.moveSecond(1));
      
      this.markPointBtn.addEventListener('click', () => {
          console.log("Mark point clicked");
          this.pause();
          timelineController.markTimelinePoint();
      });

      this.completeButton.addEventListener('click', () => {
          console.log("Complete button clicked");
          timelineController.handleComplete();
      });
      
      document.addEventListener('keydown', (e) => this.handleKeyPress(e));
  }

  updateTimeDisplay() {
      if (!this.video.src) return;
      
      const currentFrame = Math.round(this.video.currentTime * this.FPS);
      const totalFrames = Math.round(this.video.duration * this.FPS);
      const currentTime = Number(this.video.currentTime).toFixed(2);
      const totalTime = Number(this.video.duration).toFixed(2);
      
      if (this.frameCount) {
          this.frameCount.textContent = `${currentFrame}/${totalFrames}`;
      }
      if (this.timeCount) {
          this.timeCount.textContent = `${currentTime}/${totalTime}`;
      }
  }

  updateTimelineMarker() {
      if (!this.video.src || !this.timelineMarker) return;

      const currentTime = this.video.currentTime;
      const duration = this.video.duration;
      
      if (isNaN(currentTime) || isNaN(duration) || duration === 0) return;

      const percentage = Math.max(0, Math.min(100, (currentTime / duration) * 100));
      
      console.log("Timeline marker update:", {
          currentTime,
          duration,
          percentage
      });

      this.timelineMarker.style.display = 'block';
      this.timelineMarker.style.left = `${percentage}%`;
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
      
      this.updateTimeDisplay();
      this.updateTimelineMarker();
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
      
      this.updateTimeDisplay();
      this.updateTimelineMarker();
  }

  handleKeyPress(e) {
      if (!this.controlsEnabled || !this.video.src) {
          console.log("Key press ignored - controls disabled or no video");
          return;
      }

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
                  this.updateTimeDisplay();
                  this.updateTimelineMarker();
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
      return Math.round(this.video.currentTime * this.FPS);
  }

  getTotalFrames() {
      return Math.round(this.video.duration * this.FPS);
  }

  frameToTime(frame) {
      return frame / this.FPS;
  }

  timeToFrame(time) {
      return Math.round(time * this.FPS);
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