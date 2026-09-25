// Run before the app renders so a saved dark theme never flashes light.
(() => {
  let saved;
  try { saved = localStorage.getItem('telaah-theme'); } catch { /* Storage can be blocked. */ }
  const theme = saved === 'light' || saved === 'dark'
    ? saved
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101a17' : '#f3f6f4');
})();
