const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('requestmakerElectron', {
  isElectron: true,
  sendHttpRequest(payload) {
    return ipcRenderer.invoke('requestmaker:http-request', payload)
  },
  onMenuAction(handler) {
    if (typeof handler !== 'function') {
      return () => {}
    }

    const listener = (_event, actionId) => {
      handler(actionId)
    }

    ipcRenderer.on('requestmaker:menu-action', listener)

    return () => {
      ipcRenderer.removeListener('requestmaker:menu-action', listener)
    }
  },
})
