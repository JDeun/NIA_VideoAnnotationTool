class FileHandler {
    constructor() {
        this.currentFiles = [];
        this.currentFileIndex = -1;
        this.hasModifiedContent = false;
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
        this.fileList = document.getElementById('fileList');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressBar = document.getElementById('progressBar');
    }

    initializeEventListeners() {
        this.loadPathBtn.addEventListener('click', () => this.handlePathLoad());
        this.pathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handlePathLoad();
        });
        this.loadFilesBtn.addEventListener('click', () => this.handleDirectoryLoad());
        this.loadSingleFilesBtn.addEventListener('click', () => this.handleSingleFileLoad());
        this.directoryInput.addEventListener('change', (e) => this.handleDirectorySelect(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
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

    async handleDirectorySelect(event) {
        const files = Array.from(event.target.files)
            .filter(file => file.type.startsWith('video/'));
        await this.processSelectedFiles(files);
    }

    async handleFileSelect(event) {
        const files = Array.from(event.target.files)
            .filter(file => file.type.startsWith('video/'));
        await this.processSelectedFiles(files);
    }

    async processSelectedFiles(files) {
        if (files.length === 0) return;

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

    async loadAnnotations(file) {
        try {
            if (!file.originalPath) {
                throw new Error('파일 경로가 없습니다.');
            }
    
            console.log("Loading annotations for:", file.originalPath);
            const response = await fetch(`/api/annotations/${encodeURIComponent(file.originalPath)}`);
            console.log("Load annotations response:", response);

            if (response.ok) {
                const data = await response.json();
                console.log("Loaded annotations:", data);
                timelineController.loadAnnotations(data);
                return data;
            } else {
                console.log("No existing annotations found");
                timelineController.segments = [];
                return null;
            }
        } catch (error) {
            console.error('Error loading annotations:', error);
            timelineController.segments = [];
            return null;
        }
    }

    async loadVideo(index) {
        console.log("Loading video:", {
            index,
            currentIndex: this.currentFileIndex,
            hasModifiedContent: this.hasModifiedContent
        });

        if (index === this.currentFileIndex) {
            console.log("Same video already loaded");
            return;
        }

        try {
            if (this.hasModifiedContent) {
                const confirmSave = confirm('수정된 내용이 있습니다. 저장하시겠습니까?');
                if (confirmSave) {
                    await timelineController.saveAnnotations();
                }
            }

            const file = this.currentFiles[index];
            console.log("Loading file:", file);

            this.currentFileIndex = index;
            this.hasModifiedContent = false;
            
            timelineController.clearSegments();
            await videoController.loadVideo(file.path);
            videoController.currentVideoPath = file.originalPath;
            
            const hasAnnotation = await this.checkAnnotationExists(file.originalPath);
            console.log("Annotation exists:", hasAnnotation);

            if (hasAnnotation) {
                await this.loadAnnotations(file);
                timelineController.isNewFile = false;
            } else {
                timelineController.isNewFile = true;
                timelineController.segments = [];
            }
            
            await this.displayFileList();
        } catch (error) {
            console.error("Error loading video:", error);
            console.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            alert('비디오 로드 중 오류가 발생했습니다.');
        }
    }

    async saveAnnotations(annotations, isComplete = false) {
        const currentFile = this.getCurrentFile();
        if (!currentFile) {
            throw new Error('현재 선택된 파일이 없습니다.');
        }

        try {
            console.log("Saving annotations for:", currentFile);
            const originalPath = currentFile.originalPath || currentFile.path;
            console.log("Original path:", originalPath);

            const formData = new FormData();
            const jsonBlob = new Blob([JSON.stringify(annotations, null, 2)], {
                type: 'application/json'
            });
            
            formData.append('file', jsonBlob, 'annotations.json');
            formData.append('path', originalPath);

            console.log("Sending annotation data:", annotations);

            const saveResponse = await fetch('/api/save-annotation', {
                method: 'POST',
                body: formData
            });

            if (!saveResponse.ok) {
                console.error('Save response not OK:', await saveResponse.text());
                throw new Error('저장 실패');
            }

            const saveResult = await saveResponse.json();
            console.log("Save result:", saveResult);

            if (isComplete) {
                alert('작성이 완료되었습니다.');
            }

            this.hasModifiedContent = false;
            await this.displayFileList();
            return saveResult;

        } catch (error) {
            console.error('Save error:', error);
            throw error;
        }
    }

    async displayFileList() {
        this.fileList.innerHTML = '';
        
        for (const file of this.currentFiles) {
            const hasAnnotation = await this.checkAnnotationExists(file.originalPath || file.path);
            
            const tr = document.createElement('tr');
            const isActive = file === this.getCurrentFile();
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
                tr.querySelector('button').addEventListener('click', () => {
                    const index = this.currentFiles.findIndex(f => f.name === file.name);
                    if (index !== -1) {
                        this.loadVideo(index);
                    }
                });
            }

            this.fileList.appendChild(tr);
        }
    }

    removeDuplicates(files) {
        return Array.from(new Map(files.map(file => [file.name, file])).values());
    }

    handleDirectoryLoad() {
        this.directoryInput.click();
    }

    handleSingleFileLoad() {
        this.fileInput.click();
    }

    getCurrentFile() {
        return this.currentFileIndex >= 0 ? this.currentFiles[this.currentFileIndex] : null;
    }

    async checkAnnotationExists(path) {
        if (!path) return false;
        try {
            const response = await fetch(`/api/check-annotation?path=${encodeURIComponent(path)}`);
            return response.ok;
        } catch {
            return false;
        }
    }

    showProgress() {
        this.progressContainer.style.display = 'block';
        this.progressBar.style.width = '0%';
        this.animateProgress();
    }

    hideProgress() {
        this.progressBar.style.width = '100%';
        setTimeout(() => {
            this.progressContainer.style.display = 'none';
            this.progressBar.style.width = '0%';
        }, 200);
    }

    animateProgress() {
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 90) {
                clearInterval(interval);
            } else {
                width += Math.random() * 10;
                this.progressBar.style.width = `${Math.min(width, 90)}%`;
            }
        }, 200);
    }
}

const fileHandler = new FileHandler();