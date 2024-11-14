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

             // API 호출 전 타임아웃 설정
            const timeoutDuration = 30000; // 30초
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

            try {
                const response = await fetch('/api/load-path', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ path }),
                    signal: controller.signal
                });
    
                clearTimeout(timeoutId); // 타임아웃 클리어
    
                // 상태 코드별 처리
                if (response.status === 404) {
                    throw new Error('지정된 경로에서 비디오 파일을 찾을 수 없습니다.');
                } else if (response.status === 403) {
                    throw new Error('경로에 접근 권한이 없습니다. 관리자 권한으로 실행하거나 외부 저장장치 연결을 확인해주세요.');
                } else if (response.status === 400) {
                    throw new Error('잘못된 경로입니다. 경로를 다시 확인해주세요.');
                } else if (!response.ok) {
                    throw new Error('서버 응답 오류: ' + response.statusText);
                }

            // 응답 데이터 검증
            const data = await response.json();
            if (!data || !Array.isArray(data.files)) {
                throw new Error('서버에서 올바른 형식의 데이터를 받지 못했습니다.');
            }

            // 파일 목록 검증
            const validFiles = data.files.filter(file => 
                file && 
                typeof file.name === 'string' && 
                typeof file.path === 'string' && 
                typeof file.size === 'number'
            );

            if (validFiles.length === 0) {
                throw new Error('사용 가능한 비디오 파일이 없습니다.');
            }

            console.log(`Found ${validFiles.length} valid video files`);
            this.currentFiles = this.removeDuplicates(validFiles);
            await this.displayFileList();

        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                throw new Error('요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.');
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('Error loading files:', error);
        alert(error.message || '파일 로드 중 오류가 발생했습니다.');
    } finally {
        this.hideProgress();
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
        if (files.length === 0) {
            alert('선택된 비디오 파일이 없습니다.');
            return;
        }

        try {
            this.showProgress();
            const processedFiles = await Promise.all(files.map(async file => {
                const fileInfo = {
                    name: file.name,
                    path: URL.createObjectURL(file),
                    size: file.size,
                    type: 'local',
                    originalPath: file.path || file.webkitRelativePath || file.name,
                    file: file,
                    accessible: true
                };

                return fileInfo;
            }));

            this.currentFiles = this.removeDuplicates([...this.currentFiles, ...processedFiles]);
            await this.displayFileList();
            this.hideProgress();
        } catch (error) {
            this.hideProgress();
            console.error('Error processing files:', error);
            alert('파일 처리 중 오류가 발생했습니다.');
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
            const file = this.currentFiles[index];
            
            // 파일 접근성 재확인
            if (!file.accessible) {
                throw new Error('비디오 파일에 접근할 수 없습니다. 외부 저장장치가 연결되어 있는지 확인해주세요.');
            }

            // 저장되지 않은 변경사항 체크
            if (this.hasModifiedContent) {
                const confirmSave = confirm('수정된 내용이 있습니다. 저장하시겠습니까?');
                if (confirmSave) {
                    await timelineController.saveAnnotations();
                }
            }

            this.currentFileIndex = index;
            console.log("Loading file:", file);
            this.hasModifiedContent = false;
            
            timelineController.clearSegments();

           try {
                await videoController.loadVideo(file.path);
                videoController.currentVideoPath = file.originalPath;
                console.log("Video loaded successfully");
            } catch (videoError) {
                console.error("Error loading video:", videoError);
                throw new Error('비디오 로드 실패: 파일이 손상되었거나 접근할 수 없습니다.');
            }
            
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
            alert(error.message ||'비디오 로드 중 오류가 발생했습니다.');
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

            // 수정: 접근 불가능한 파일 표시 추가
            const inaccessibleClass = !file.accessible ? 'inaccessible' : '';
            
            tr.innerHTML = `
                <td class="filename-cell ${inaccessibleClass}" title="${file.name}">
                    ${file.name}
                    ${!file.accessible ? '<span class="warning-icon">⚠️</span>' : ''}
                </td>
                <td class="status-cell">
                    ${hasAnnotation ? '<span class="status-check">✓</span>' : ''}
                </td>
                <td class="action-cell">
                    <button class="btn small-btn" ${isActive || !file.accessible ? 'disabled' : ''}>
                        ${!file.accessible ? '접근 불가' : '로드'}
                    </button>
                </td>
            `;

            if (!isActive && file.accessible) {
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
        } catch (error) {
            console.error('Error checking annotation:', error);
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