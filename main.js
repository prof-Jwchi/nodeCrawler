const http = require('http');
const fs = require('fs');
const path = require('path');

// MIME 타입 매핑
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 서버 생성
const server = http.createServer((req, res) => {
    let url = req.url;
    
    // favicon 요청 무시
    if (url === '/favicon.ico') {
        res.statusCode = 204;
        res.end();
        return;
    }
    
    // 루트 경로는 index.html로 변경
    if (url === '/') {
        url = '/index.html';
    }
    
    // 파일 경로 생성 (현재 디렉토리 기준)
    const filePath = path.join(__dirname, url);
    
    // 파일 확장자 추출
    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'text/plain';
    
    // 파일 읽기
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 파일을 찾을 수 없음 (404)
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/html');
                res.end('<h1>404 - File Not Found</h1>');
            } else {
                // 서버 에러 (500)
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/html');
                res.end(`<h1>500 - Server Error</h1><p>${err.code}</p>`);
            }
        } else {
            // 성공 (200)
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(content);
        }
    });
});

// 서버를 특정 포트에서 실행
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});