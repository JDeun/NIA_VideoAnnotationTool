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

    removeDuplicates(files) {
        return Array.from(new Map(files.map(file => [file.name, file])).values());
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

            // 중복 제거 후 기존 파일과 병합
            this.currentFiles = this.removeDuplicates([...this.currentFiles, ...processedFiles]);
            await this.displayFileList();
            this.hideProgress();
        } catch (error) {
            this.hideProgress();
            alert('파일 처리 중 오류가 발생했습니다.');
            console.error('Error:', error);
        }
    }

    async displayFileList() {
        this.fileList.innerHTML = '';
        
        // key: 파일명, value: {파일정보, 어노테이션 상태}
        const fileMap = new Map();
        
        // 파일별 어노테이션 상태 확인
        for (const file of this.currentFiles) {
            const fileName = file.name;
            if (!fileMap.has(fileName)) {
                const hasAnnotation = await this.checkAnnotationExists(file.originalPath || file.path);
                fileMap.set(fileName, {
                    file: file,
                    hasAnnotation: hasAnnotation
                });
            }
        }

        // 파일 목록 생성
        for (const [fileName, {file, hasAnnotation}] of fileMap) {
            const tr = document.createElement('tr');
            const isActive = file === this.getCurrentFile();
            tr.className = isActive ? 'active' : '';
            
            tr.innerHTML = `
                <td class="filename-cell" title="${fileName}">${fileName}</td>
                <td class="status-cell">
                    ${hasAnnotation ? '<span class="status-check">✓</span>' : ''}
                </td>
                <td class="action-cell">
                    <button class="btn small-btn" ${isActive ? 'disabled' : ''}>로드</button>
                </td>
            `;

            if (!isActive) {
                tr.querySelector('button').addEventListener('click', () => {
                    const index = this.currentFiles.findIndex(f => f.name === fileName);
                    if (index !== -1) {
                        this.loadVideo(index);
                    }
                });
            }

            this.fileList.appendChild(tr);
        }
    }

    async loadVideo(index) {
        if (index === this.currentFileIndex) return;

        try {
            // 수정된 내용이 있는 경우 저장 여부 확인
            if (this.hasModifiedContent) {
                const confirmSave = confirm('수정된 내용이 있습니다. 저장하시겠습니까?');
                if (confirmSave) {
                    await timelineController.saveAnnotations();
                }
            }

            const file = this.currentFiles[index];
            this.currentFileIndex = index;
            this.hasModifiedContent = false;
            
            timelineController.clearSegments();
            await videoController.loadVideo(file.path);
            videoController.currentVideoPath = file.originalPath;
            
            if (file.originalPath) {
                await this.loadAnnotations(index);
            }
            
            await this.displayFileList();
        } catch (error) {
            console.error('Error:', error);
            alert('비디오 로드 중 오류가 발생했습니다.');
        }
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

    async loadAnnotations(index) {
        try {
            const file = this.currentFiles[index];
            if (!file.originalPath) return;
            
            const response = await fetch(`/api/annotations/${encodeURIComponent(file.originalPath)}`);
            if (response.ok) {
                const annotations = await response.json();
                timelineController.loadAnnotations(annotations);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async saveAnnotations(annotations, isComplete = false) {
        const currentFile = this.getCurrentFile();
        if (!currentFile) {
            throw new Error('현재 선택된 파일이 없습니다.');
        }
    
        try {
            // 완료 버튼 클릭 시 기존 파일 존재 여부 확인
            if (isComplete && await this.checkAnnotationExists(currentFile.originalPath)) {
                if (!confirm('기존 파일이 존재합니다. 수정하시겠습니까?')) {
                    return;
                }
            }
    
            const formData = new FormData();
            const jsonBlob = new Blob([JSON.stringify(annotations, null, 2)], {
                type: 'application/json'
            });
            
            formData.append('file', jsonBlob, 'annotations.json');
            formData.append('path', currentFile.originalPath);
    
            const response = await fetch('/api/save-annotation', {
                method: 'POST',
                body: formData
            });
    
            if (!response.ok) {
                throw new Error('저장 실패');
            }
    
            // 완료 시에만 alert 표시
            if (isComplete) {
                alert('작성이 완료되었습니다.');
            }
    
            this.hasModifiedContent = false;
            await this.displayFileList();
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }

    getCurrentFile() {
        return this.currentFileIndex >= 0 ? this.currentFiles[this.currentFileIndex] : null;
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