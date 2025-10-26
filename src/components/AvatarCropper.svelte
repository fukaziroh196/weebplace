<script>
  import { onMount } from 'svelte';
  export let src = '';
  export let onCancel = () => {};
  export let onApply = (dataUrl) => {};

  const FRAME = 250; // square crop viewport
  let imgEl;
  let naturalW = 0;
  let naturalH = 0;
  let minScale = 1;
  let scale = 1;
  let posX = 0; // image offset inside frame (px)
  let posY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startPosX = 0;
  let startPosY = 0;

  function clampPosition() {
    const dispW = naturalW * scale;
    const dispH = naturalH * scale;
    const minX = Math.min(0, FRAME - dispW);
    const minY = Math.min(0, FRAME - dispH);
    const maxX = 0;
    const maxY = 0;
    posX = Math.max(minX, Math.min(maxX, posX));
    posY = Math.max(minY, Math.min(maxY, posY));
  }

  function onImgLoad() {
    naturalW = imgEl.naturalWidth;
    naturalH = imgEl.naturalHeight;
    const scaleToCover = Math.max(FRAME / naturalW, FRAME / naturalH);
    minScale = scaleToCover;
    scale = scaleToCover;
    // center
    const dispW = naturalW * scale;
    const dispH = naturalH * scale;
    posX = (FRAME - dispW) / 2;
    posY = (FRAME - dispH) / 2;
  }

  function onPointerDown(e) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startPosX = posX;
    startPosY = posY;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }

  function onPointerMove(e) {
    if (!dragging) return;
    posX = startPosX + (e.clientX - dragStartX);
    posY = startPosY + (e.clientY - dragStartY);
    clampPosition();
  }

  function onPointerUp() {
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
  }

  function onScaleChange(e) {
    const prevScale = scale;
    scale = Number(e.currentTarget.value);
    // keep center relative to cursor: simple approach keep image center
    const centerX = posX + (naturalW * prevScale) / 2;
    const centerY = posY + (naturalH * prevScale) / 2;
    posX = centerX - (naturalW * scale) / 2;
    posY = centerY - (naturalH * scale) / 2;
    clampPosition();
  }

  function applyCrop() {
    if (!naturalW || !naturalH) return;
    const canvasSize = 512; // export size
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    const sx = -posX / scale;
    const sy = -posY / scale;
    const sw = FRAME / scale;
    const sh = FRAME / scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, canvasSize, canvasSize);
    const url = canvas.toDataURL('image/png');
    onApply?.(url);
  }
</script>

<div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
  <div class="bg-neutral-900 rounded-xl p-4 w-[min(95vw,720px)]">
    <div class="text-white font-semibold mb-3">Обрезка аватара</div>
    <div class="flex items-start gap-6">
      <div class="relative w-[250px] h-[250px] overflow-hidden rounded-lg bg-black/50">
        <img bind:this={imgEl} src={src} alt="crop" class="select-none" draggable="false"
             on:load={onImgLoad}
             on:pointerdown={onPointerDown}
             style="position:absolute; left:0; top:0; width:{naturalW * scale}px; height:{naturalH * scale}px; transform: translate({posX}px, {posY}px);" />
        <div class="absolute inset-0 ring-2 ring-white/50 pointer-events-none rounded-lg"></div>
      </div>
      <div class="flex-1 text-white/90">
        <div class="mb-4">
          <label class="block text-sm mb-2">Масштаб</label>
          <input type="range" min={minScale} max={minScale * 4} step="0.01" value={scale} on:input={onScaleChange} class="w-full" />
        </div>
        <div class="flex gap-2 justify-end mt-8">
          <button class="px-4 py-2 rounded bg-white/15 hover:bg-white/25 text-white" on:click={() => onCancel?.()}>Отмена</button>
          <button class="px-4 py-2 rounded bg-pink-600 hover:bg-pink-500 text-white font-semibold" on:click={applyCrop}>Сохранить</button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  img { user-select: none; }
</style>












