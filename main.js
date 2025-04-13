const { app, BrowserWindow, screen, ipcMain } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')

// Konfiguriere Logger für Autoupdater
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
log.info('App startet...')

// Wichtige Konfiguration für vollautomatische Updates
autoUpdater.autoDownload = true           // Updates automatisch herunterladen
autoUpdater.autoInstallOnAppQuit = true   // Updates automatisch installieren, wenn die App beendet wird

// Auto-Updater konfigurieren
function setupAutoUpdater() {
  // Prüfe auf Updates beim Start
  autoUpdater.checkForUpdatesAndNotify()
  
  // Prüfe regelmäßig auf Updates (alle 60 Minuten)
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 60 * 60 * 1000)
  
  // Event-Handler für Updates
  autoUpdater.on('update-available', (info) => {
    log.info('Update verfügbar!', info.version)
  })
  
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update heruntergeladen, wird installiert...', info.version)
    
    // Installiere Update sofort ohne Benutzerinteraktion
    // Parameter: isSilent = true, isForceRunAfter = true
    autoUpdater.quitAndInstall(true, true)
  })
  
  autoUpdater.on('error', (err) => {
    log.error('Fehler beim Auto-Update:', err)
  })
}

let mainWindow;
let secondWindow;

function createWindows() {
  // Get all displays
  const displays = screen.getAllDisplays()
  const primaryDisplay = screen.getPrimaryDisplay()
  
  // Create main window on primary display
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    // Remove menu bar
    autoHideMenuBar: true
  })
  
  // Load your HTML file
  mainWindow.loadFile('index.html')
  
  // If there's a second display, create a window there
  if (displays.length > 1) {
    const secondaryDisplay = displays.find(d => d.id !== primaryDisplay.id)
    
    if (secondaryDisplay) {
      secondWindow = new BrowserWindow({
        width: secondaryDisplay.size.width,
        height: secondaryDisplay.size.height,
        x: secondaryDisplay.bounds.x,
        y: secondaryDisplay.bounds.y,
        // Set fullscreen for the secondary window
        fullscreen: true,
        // Remove menu bar
        autoHideMenuBar: true,
        // Remove frame (title bar and borders)
        frame: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      })
      
      // Load the same HTML file but with a query parameter to identify it as secondary
      secondWindow.loadFile('index.html', { query: { "mode": "secondary" } })
      
      // When main window is ready, tell it to send initial data to secondary
      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('secondary-ready');
      });
    }
  }
  
  // Set up communication between windows
  ipcMain.on('update-display', (event, data) => {
    if (secondWindow && !secondWindow.isDestroyed()) {
      secondWindow.webContents.send('update-from-main', data);
    }
  });
  
  // Add keyboard shortcut to toggle fullscreen on main window
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      document.addEventListener('keydown', (e) => {
        if (e.key === 'F11') {
          require('electron').ipcRenderer.send('toggle-fullscreen-main');
        }
      });
    `);
  });
  
  // Handle fullscreen toggle request
  ipcMain.on('toggle-fullscreen-main', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  
  // Set up communication for zoom controls
  ipcMain.on('zoom-in', () => {
    console.log('Zoom in requested for secondary window');
    if (secondWindow && !secondWindow.isDestroyed()) {
      const currentZoom = secondWindow.webContents.getZoomFactor();
      secondWindow.webContents.setZoomFactor(currentZoom + 0.1);
    }
  });
  
  ipcMain.on('zoom-out', () => {
    console.log('Zoom out requested for secondary window');
    if (secondWindow && !secondWindow.isDestroyed()) {
      const currentZoom = secondWindow.webContents.getZoomFactor();
      secondWindow.webContents.setZoomFactor(Math.max(0.5, currentZoom - 0.1));
    }
  });
  
  ipcMain.on('zoom-reset', () => {
    console.log('Zoom reset requested for secondary window');
    if (secondWindow && !secondWindow.isDestroyed()) {
      secondWindow.webContents.setZoomFactor(1.0);
    }
  });
  
  // Zeige Update-Status im Hauptfenster an (optional)
  autoUpdater.on('checking-for-update', () => {
    log.info('Prüfe auf Updates...');
  });
  
  autoUpdater.on('update-available', (info) => {
    log.info(`Update verfügbar: ${info.version}`);
  });
  
  autoUpdater.on('update-not-available', (info) => {
    log.info(`Kein Update verfügbar. Aktuelle Version: ${info.version}`);
  });
  
  autoUpdater.on('download-progress', (progressObj) => {
    let logMessage = `Download-Geschwindigkeit: ${progressObj.bytesPerSecond}`;
    logMessage = `${logMessage} - Heruntergeladen: ${progressObj.percent}%`;
    logMessage = `${logMessage} (${progressObj.transferred}/${progressObj.total})`;
    log.info(logMessage);
  });
}

app.whenReady().then(() => {
  // Hide the menu bar for the entire application
  app.applicationMenu = null;
  
  createWindows();
  
  // Setup auto-updater
  setupAutoUpdater();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindows();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Zusätzliche Ereignisbehandlung für Updates
app.on('ready', function() {
  // Wenn die App bereit ist, prüfe auf Updates
  autoUpdater.checkForUpdatesAndNotify();
});
