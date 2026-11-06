if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    .catch(function (error) { console.error('No se pudo activar la PWA:', error); });
}
