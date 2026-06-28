
(async () => {
  try {
    const mod = await import('@napi-rs/canvas');
    console.log('canvas loaded', !!mod.Canvas);
  } catch (e) {
    console.error('load error', e.message);
  }
})();
