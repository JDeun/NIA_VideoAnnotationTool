class FileHandler {
    constructor() {
        this.currentFiles = [];
        this.currentFileIndex = -1;
        this.hasModifiedContent = false;
        this.currentAnnotationData = null;
        this.initializeElements();
        this.initializeEventListeners();
    }

    initializeElements() {
        this.pathInput = document.getElementById('pathInput');
        this.directoryInput = document.getElementById('directoryInput');
        this.fileInput = document.getElementById('fileInput');
        this.loadPathBtn = document.getElementById('loadPath');
        this.loadFilesBtn = document.getElementById('loadFiles');
        this.loadSingleFilesBtn = document.getElementById('loadSingleFiles');
        this.saveSegmentBtn = document.getElementById('saveSegment');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
        this.completeButton = document.getElementById('completeButton');
        this.updateSaveButtonState();
    }

    initializeEventListeners() {
        this.loadPathBtn.addEventListener('click', () => this.handlePathLoad());
        this.loadFilesBtn.addEventListener('click', () => this.handleDirectoryLoad());
        this.loadSingleFilesBtn.addEventListener('click', () => this.handleSingleFileLoad());
        
        this.directoryInput.addEventListener('change', (e) => this.handleDirectorySelect(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        this.saveSegmentBtn.addEventListener('click', async () => {
            const annotations = timelineController.segments;
            await this.saveAnnotations(annotations);
        });

        document.addEventListener('annotationModified', () => {
            this.hasModifiedContent = true;
            this.updateSaveButtonState();
        });

        this.pathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handlePathLoad();
        });
    }

    async handlePathLoad() {
        const path = this.pathInput.value.trim();
        if (!path) {
            alert('경로를 입력해주세요.');
            return;
        }

        try {
            this.showProgress();
            const response = await fetch('/api/load-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });

            if (!response.ok) throw new Error('서버 응답 오류');

            const data = await response.json();
            this.currentFiles = this.removeDuplicates(data.files);
            await this.displayFileList();
            this.hideProgress();
        } catch (error) {
            this.hideProgress();
            alert('파일 로드 중 오류가 발생했습니다.');
            console.error('Error:', error);
        }
    }

    handleDirectoryLoad() {
        this.directoryInput.click();
    }

    handleSingleFileLoad() {
        this.fileInput.click();
    }

    handleDirectorySelect(event) {
        const files = Array.from(event.target.files)
            .filter(file => file.type.startsWith('video/'));
        this.processSelectedFiles(files);
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files)
            .filter(file => file.type.startsWith('video/'));
        this.processSelectedFiles(files);
    }

    async processSelectedFiles(files) {
        if (files.length === 0) {
            alert('선택된 비디오 파일이 없습니다.');
            return;
        }

        try {
            this.showProgress();
            const processedFiles = files.map(file => ({
                name: file.name,
                path: URL.createObjectURL(file),
                size: file.size,
                type: 'local',
                originalPath: file.path || file.webkitRelativePath || file.name,
                file: file
            }));

            this.currentFiles = this.removeDuplicates([...this.currentFiles, ...processedFiles]);
            await this.displayFileList();
            this.hideProgress();
        } catch (error) {
            this.hideProgress();
            alert('파일 처리 중 오류가 발생했습니다.');
            console.error('Error:', error);
        }
    }

    async loadVideo(index) {
        if (index === this.currentFileIndex) return;

        try {
            if (this.hasModifiedContent) {
                const confirmSave = confirm('수정된 내용이 있습니다. 저장하시겠습니까?');
                if (confirmSave) {
                    await this.saveAnnotations(timelineController.segments);
                }
            }

            const file = this.currentFiles[index];
            this.currentFileIndex = index;
            this.hasModifiedContent = false;
            
            timelineController.clearSegments();
            await videoController.loadVideo(file.path);
            videoController.currentVideoPath = file.originalPath || file.path;
            
            await this.loadAnnotations(index);
            await this.displayFileList();
            
        } catch (error) {
            console.error('Error:', error);
            alert('비디오 로드 중 오류가 발생했습니다.');
        }
    }

    async displayFileList() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        for (const [index, file] of this.currentFiles.entries()) {
            const hasAnnotation = await this.checkAnnotationExists(file.originalPath || file.path);
            const isActive = index === this.currentFileIndex;
            
            const tr = document.createElement('tr');
            tr.className = isActive ? 'active' : '';
            
            tr.innerHTML = `
                <td class="filename-cell" title="${file.name}">${file.name}</td>
                <td class="status-cell">
                    ${hasAnnotation ? '<span class="status-check">✓</span>' : ''}
                </td>
                <td class="action-cell">
                    <button class="btn small-btn" ${isActive ? 'disabled' : ''}>로드</button>
                </td>
            `;

            if (!isActive) {
                tr.querySelector('button').addEventListener('click', async () => {
                    await this.loadVideo(index);
                });
            }

            fileList.appendChild(tr);
        }
    }

    async loadAnnotations(index) {
        try {
            const file = this.currentFiles[index];
            if (!file.originalPath && !file.path) return;
            
            const path = file.originalPath || file.path;
            const response = await fetch(`/api/annotations/${encodeURIComponent(path)}`);
            
            if (response.ok) {
                const data = await response.json();
                this.currentAnnotationData = data;
                timelineController.segments = data.segments || [];
                timelineController.renderSegments();
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async saveAnnotations(segments) {
        if (!this.currentFiles[this.currentFileIndex]) return;
        
        try {
            const file = this.currentFiles[this.currentFileIndex];
            const video = document.getElementById('videoPlayer');
            
            const data = {
                info: {
                    filename: file.originalPath || file.path,
                    format: 'mp4',
                    size: file.size || 0,
                    width_height: [video.videoWidth, video.videoHeight],
                    environment: 1,
                    device: 'KIOSK',
                    frame_rate: 15,
                    playtime: video.duration,
                    date: new Date().toISOString().split('T')[0]
                },
                // segments를 직접 배열로 전달
                segments: Array.isArray(segments) ? segments : [],
                additional_info: {
                    InteractionType: 'Touchscreen'
                }
            };
    
            const response = await fetch(`/api/save-annotations/${encodeURIComponent(file.originalPath || file.path)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
    
            if (response.ok) {
                this.hasModifiedContent = false;
                this.updateSaveButtonState();
                await this.loadAnnotations(this.currentFileIndex);
                return true;
            } else {
                throw new Error('저장 실패');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('저장 중 오류가 발생했습니다.');
            return false;
        }
    }

    async handleComplete() {
        try {
            if (timelineController.segments.length === 0) {
                alert('저장할 구간이 없습니다.');
                return;
            }
    
            if (confirm('작성을 완료하시겠습니까?')) {
                await this.saveAnnotations(timelineController.segments);
                alert('저장이 완료되었습니다.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    }

    async checkAnnotationExists(path) {
        if (!path) return false;
        try {
            const response = await fetch(`/api/check-annotation?path=${encodeURIComponent(path)}`);
            const data = await response.json();
            return data.exists;
        } catch {
            return false;
        }
    }

    updateSaveButtonState() {
        const hasSegments = timelineController.segments.length > 0;
        this.saveSegmentBtn.disabled = !hasSegments && !this.hasModifiedContent;
    }

    showProgress() {
        this.progressContainer.style.display = 'block';
        this.progressBar.style.width = '0%';
    }

    hideProgress() {
        this.progressContainer.style.display = 'none';
    }

    removeDuplicates(files) {
        return Array.from(new Map(files.map(file => [file.name, file])).values());
    }

    getCurrentFile() {
        return this.currentFiles[this.currentFileIndex];
    }
}

const fileHandler = new FileHandler();