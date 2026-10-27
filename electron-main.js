// electron-main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        backgroundColor: '#030712', // 起動時のチラシ防止の背景色
        title: "Global Operations Command",
        autoHideMenuBar: true, // 上部の余計なメニューバーを隠す
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    // index.htmlを読み込む
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // デバッグ用（必要に応じてコメントアウトを外してね）
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});