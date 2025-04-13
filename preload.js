const { contextBridge, ipcRenderer } = require('electron')

// Expose a synchronization method to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // You can add IPC methods here if needed for communication between windows
})
