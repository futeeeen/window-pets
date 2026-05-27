const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

let mainWindow = null;
const WIN_SIZE = 110; // 2D pet window size (new normal size)
let currentSize = WIN_SIZE; // Active window size state to prevent DPI-scaling creep

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WIN_SIZE,
    height: WIN_SIZE,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  // Enforce strict size constraints at the OS level to completely prevent DPI scaling creep on Windows
  mainWindow.setMinimumSize(WIN_SIZE, WIN_SIZE);
  mainWindow.setMaximumSize(WIN_SIZE, WIN_SIZE);

  mainWindow.loadFile('index.html');

  // Forward renderer console messages to terminal for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (at ${path.basename(sourceId)}:${line})`);
  });

  // Always on top — above full-screen apps too
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Dynamic window positioning from renderer physics
  ipcMain.on('set-window-pos', (event, { x, y }) => {
    if (mainWindow && typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
      mainWindow.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: currentSize,
        height: currentSize
      });
    }
  });

  // Dynamic window resize (for size toggle)
  ipcMain.on('resize-window', (event, { width, height }) => {
    if (!mainWindow) return;
    currentSize = Math.round(width);
    mainWindow.setMinimumSize(currentSize, currentSize);
    mainWindow.setMaximumSize(currentSize, currentSize);
    const bounds = mainWindow.getBounds();
    const deltaH = height - bounds.height;
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y - deltaH,
      width: currentSize,
      height: currentSize
    });
  });

  // Native Context Menu Handler with dynamic skin scanning
  ipcMain.on('show-context-menu', (event, { roamMode, sleeping, activeSkin }) => {
    const fs = require('fs');
    const petsDir = path.join(__dirname, 'pets');
    const skins = [];
    if (fs.existsSync(petsDir)) {
      const dirs = fs.readdirSync(petsDir);
      for (const dir of dirs) {
        const configPath = path.join(petsDir, dir, 'config.json');
        let skinName = dir;
        if (fs.existsSync(configPath)) {
          try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            skinName = config.name || dir;
          } catch (e) {
            console.error('Error parsing config for skin:', dir, e);
          }
        }
        skins.push({ id: dir, name: skinName });
      }
    }

    const template = [
      { label: '🍎 餵食蘋果', click: () => { event.sender.send('menu-feed', 'apple'); } },
      { label: '🎂 餵食蛋糕', click: () => { event.sender.send('menu-feed', 'cake'); } },
      { label: '💖 摸摸寵物', click: () => { event.sender.send('menu-pet'); } },
      { type: 'separator' },
      {
        label: '🐾 隨機散步模式',
        type: 'radio',
        checked: roamMode === 'walk',
        click: () => { event.sender.send('menu-set-mode', 'walk'); }
      },
      {
        label: '🏃 運動模式 (螢幕來回)',
        type: 'radio',
        checked: roamMode === 'sports',
        click: () => { event.sender.send('menu-set-mode', 'sports'); }
      },
      {
        label: '🛑 罰站模式 (定點不移動)',
        type: 'radio',
        checked: roamMode === 'stand',
        click: () => { event.sender.send('menu-set-mode', 'stand'); }
      },
      {
        label: sleeping ? '💤 喚醒寵物' : '💤 讓牠睡覺',
        click: () => { event.sender.send('menu-toggle-sleep'); }
      },
      { type: 'separator' },
      {
        label: '🎭 更換外觀 (Skins)',
        submenu: skins.map(skin => ({
          label: skin.name,
          type: 'radio',
          checked: activeSkin === skin.id,
          click: () => { event.sender.send('menu-set-skin', skin.id); }
        }))
      },
      { type: 'separator' },
      {
        label: '📐 尺寸',
        submenu: [
          { label: '小 (80x80)', click: () => { event.sender.send('menu-resize', 'sm'); } },
          { label: '中 (110x110)', click: () => { event.sender.send('menu-resize', 'md'); } },
          { label: '大 (140x140)', click: () => { event.sender.send('menu-resize', 'lg'); } }
        ]
      },
      { type: 'separator' },
      { label: '🚪 關閉寵物', click: () => { app.quit(); } }
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup(BrowserWindow.fromWebContents(event.sender));
  });

  // Click-through transparency
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    if (mainWindow) mainWindow.setIgnoreMouseEvents(ignore, options || {});
  });

  // Exit
  ipcMain.on('exit-app', () => { app.quit(); });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Single-instance lock (prevents multiple pets)
const gotTheLock = app.requestSingleInstanceLock({ myKey: 'desktop-pet-gulpin-2d' });
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
