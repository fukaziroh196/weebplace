<script>
  import { onMount, onDestroy } from 'svelte';
  export let src = '';
  export let onCancel = () => {};
  export let onApply = (dataUrl) => {};

  const FRAME = 400; // увеличенный размер области обрезки
  let imgEl;
  let cropContainer;
  let naturalW = 0;
  let naturalH = 0;
  let minScale = 1;
  let scale = 1;
  let rotation = 0;
  let posX = 0;
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
    const dispW = naturalW * scale;
    const dispH = naturalH * scale;
    posX = (FRAME - dispW) / 2;
    posY = (FRAME - dispH) / 2;
  }

  function onPointerDown(e) {
    if (!cropContainer?.contains(e.target) || !imgEl) return;
    // Разрешаем drag только внутри области обрезки
    const previewBox = e.target.closest('.cropper-preview-box');
    if (previewBox && previewBox === cropContainer) {
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startPosX = posX;
      startPosY = posY;
      e.preventDefault();
      e.stopPropagation();
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    }
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    posX = startPosX + deltaX;
    posY = startPosY + deltaY;
    clampPosition();
  }

  function onPointerUp() {
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
  }

  function onScaleChange(e) {
    const prevScale = scale;
    const newScale = Number(e.currentTarget.value);
    scale = newScale;
    const centerX = posX + (naturalW * prevScale) / 2;
    const centerY = posY + (naturalH * prevScale) / 2;
    posX = centerX - (naturalW * scale) / 2;
    posY = centerY - (naturalH * scale) / 2;
    clampPosition();
  }

  function onWheel(e) {
    if (!cropContainer?.contains(e.target) || !imgEl) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const prevScale = scale;
    scale = Math.max(minScale, Math.min(minScale * 4, scale + (minScale * delta)));
    const centerX = posX + (naturalW * prevScale) / 2;
    const centerY = posY + (naturalH * prevScale) / 2;
    posX = centerX - (naturalW * scale) / 2;
    posY = centerY - (naturalH * scale) / 2;
    clampPosition();
  }

  function rotateLeft() {
    rotation = (rotation - 90) % 360;
  }

  function rotateRight() {
    rotation = (rotation + 90) % 360;
  }

  function applyCrop() {
    if (!naturalW || !naturalH || !imgEl) return;
    const canvasSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    // Применяем поворот
    ctx.save();
    ctx.translate(canvasSize / 2, canvasSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    
    const sx = -posX / scale;
    const sy = -posY / scale;
    const sw = FRAME / scale;
    const sh = FRAME / scale;
    
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, sx, sy, sw, sh, -canvasSize / 2, -canvasSize / 2, canvasSize, canvasSize);
    ctx.restore();
    
    const url = canvas.toDataURL('image/png');
    onApply?.(url);
  }

  function formatScale(value) {
    return Math.round((value / minScale) * 100);
  }

  onMount(() => {
    window.addEventListener('wheel', onWheel, { passive: false });
  });

  onDestroy(() => {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('pointermove', onPointerMove);
  });
</script>

<div class="cropper-overlay" on:click={(e) => e.target === e.currentTarget && onCancel()}>
  <div class="cropper-modal" on:click|stopPropagation>
    <div class="cropper-header">
      <h2 class="cropper-title">Обрезка аватара</h2>
      <button class="cropper-close" on:click={() => onCancel()} aria-label="Закрыть">×</button>
    </div>

    <div class="cropper-content">
      <div class="cropper-main">
        <div class="cropper-preview-section">
          <div class="cropper-preview-label">Предпросмотр</div>
          <div class="cropper-preview-box" on:pointerdown={onPointerDown} bind:this={cropContainer}>
            <div class="cropper-preview-mask"></div>
            {#if naturalW > 0}
              <img 
                bind:this={imgEl} 
                src={src} 
                alt="crop" 
                class="cropper-image" 
                draggable="false"
                on:load={onImgLoad}
                style="width: {naturalW * scale}px; height: {naturalH * scale}px; transform: translate({posX}px, {posY}px) rotate({rotation}deg);"
              />
            {:else}
              <img 
                bind:this={imgEl} 
                src={src} 
                alt="crop" 
                class="cropper-image" 
                draggable="false"
                on:load={onImgLoad}
                style="display: none;"
              />
            {/if}
            <div class="cropper-overlay-grid"></div>
          </div>
        </div>

          <div class="cropper-controls">
            <div class="cropper-control-group">
            <label class="cropper-control-label">
              <span>Масштаб</span>
              <span class="cropper-scale-value">{naturalW > 0 ? formatScale(scale) : 100}%</span>
            </label>
            <div class="cropper-slider-wrapper">
              <button class="cropper-slider-btn" on:click={() => {
                if (scale > minScale) {
                  const prevScale = scale;
                  scale = Math.max(minScale, scale - minScale * 0.1);
                  const centerX = posX + (naturalW * prevScale) / 2;
                  const centerY = posY + (naturalH * prevScale) / 2;
                  posX = centerX - (naturalW * scale) / 2;
                  posY = centerY - (naturalH * scale) / 2;
                  clampPosition();
                }
              }} disabled={scale <= minScale}>−</button>
              <input 
                type="range" 
                class="cropper-slider"
                min={minScale} 
                max={minScale * 4} 
                step="0.01" 
                bind:value={scale}
                on:input={onScaleChange}
                disabled={naturalW === 0}
              />
              <button class="cropper-slider-btn" on:click={() => {
                if (scale < minScale * 4) {
                  const prevScale = scale;
                  scale = Math.min(minScale * 4, scale + minScale * 0.1);
                  const centerX = posX + (naturalW * prevScale) / 2;
                  const centerY = posY + (naturalH * prevScale) / 2;
                  posX = centerX - (naturalW * scale) / 2;
                  posY = centerY - (naturalH * scale) / 2;
                  clampPosition();
                }
              }} disabled={scale >= minScale * 4}>+</button>
            </div>
          </div>

          <div class="cropper-control-group">
            <label class="cropper-control-label">Поворот</label>
            <div class="cropper-rotate-buttons">
              <button class="cropper-rotate-btn" on:click={rotateLeft} title="Повернуть влево">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </button>
              <button class="cropper-rotate-btn" on:click={rotateRight} title="Повернуть вправо">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9c-2.52 0-4.93 1-6.74 2.74L3 8" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
            </div>
          </div>

          <div class="cropper-hint">
            💡 Перетаскивайте изображение или используйте колесико мыши для масштабирования
          </div>
        </div>
      </div>
    </div>

    <div class="cropper-footer">
      <button class="cropper-btn cropper-btn-cancel" on:click={() => onCancel()}>
        Отмена
      </button>
      <button class="cropper-btn cropper-btn-save" on:click={applyCrop} disabled={naturalW === 0}>
        Сохранить
      </button>
    </div>
  </div>
</div>

<style>
  .cropper-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .cropper-modal {
    background: var(--surface-primary, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 2rem;
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.35);
    animation: slideUp 0.3s ease;
    overflow: hidden;
  }

  @keyframes slideUp {
    from {
      transform: translateY(2rem);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .cropper-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cropper-title {
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--text-primary, #f5f6ff);
    margin: 0;
  }

  .cropper-close {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--text-primary, #f5f6ff);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cropper-close:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
  }

  .cropper-content {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .cropper-main {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .cropper-preview-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .cropper-preview-label {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cropper-preview-box {
    position: relative;
    width: 400px;
    height: 400px;
    border-radius: 1.5rem;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid rgba(255, 255, 255, 0.3);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 1rem 2.5rem rgba(0, 0, 0, 0.5);
    cursor: move;
    touch-action: none;
  }

  .cropper-preview-mask {
    position: absolute;
    inset: 0;
    border-radius: 1.5rem;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
    pointer-events: none;
    z-index: 2;
  }

  .cropper-image {
    position: absolute;
    left: 0;
    top: 0;
    user-select: none;
    pointer-events: auto;
    cursor: move;
    transform-origin: center center;
    transition: transform 0.1s ease-out;
  }

  .cropper-overlay-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
    background-size: calc(100% / 3) calc(100% / 3);
    border-radius: 1.5rem;
  }

  .cropper-controls {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 500px;
    margin: 0 auto;
  }

  .cropper-control-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .cropper-control-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text-primary, #f5f6ff);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cropper-scale-value {
    color: var(--accent-primary, #9ecaff);
    font-size: 1rem;
    font-weight: 900;
  }

  .cropper-slider-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .cropper-slider-btn {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-primary, #f5f6ff);
    font-size: 1.25rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .cropper-slider-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
  }

  .cropper-slider-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .cropper-slider {
    flex: 1;
    height: 0.5rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .cropper-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: var(--accent-primary, #9ecaff);
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(158, 202, 255, 0.4);
    transition: all 0.2s ease;
  }

  .cropper-slider::-webkit-slider-thumb:hover {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: scale(1.15);
    box-shadow: 0 4px 12px rgba(158, 202, 255, 0.6);
  }

  .cropper-slider::-moz-range-thumb {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: var(--accent-primary, #9ecaff);
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(158, 202, 255, 0.4);
    transition: all 0.2s ease;
  }

  .cropper-slider::-moz-range-thumb:hover {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: scale(1.15);
    box-shadow: 0 4px 12px rgba(158, 202, 255, 0.6);
  }

  .cropper-rotate-buttons {
    display: flex;
    gap: 0.75rem;
  }

  .cropper-rotate-btn {
    flex: 1;
    padding: 0.875rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-primary, #f5f6ff);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .cropper-rotate-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: var(--accent-primary, #9ecaff);
    transform: translateY(-1px);
  }

  .cropper-hint {
    padding: 1rem;
    border-radius: 0.75rem;
    background: rgba(158, 202, 255, 0.1);
    border: 1px solid rgba(158, 202, 255, 0.2);
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    font-size: 0.875rem;
    text-align: center;
    line-height: 1.5;
  }

  .cropper-footer {
    display: flex;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    justify-content: flex-end;
  }

  .cropper-btn {
    padding: 0.875rem 2rem;
    border-radius: 0.75rem;
    font-weight: 700;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cropper-btn-cancel {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-primary, #f5f6ff);
  }

  .cropper-btn-cancel:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }

  .cropper-btn-save {
    background: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
    box-shadow: 0 4px 12px rgba(158, 202, 255, 0.3);
  }

  .cropper-btn-save:hover:not(:disabled) {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(158, 202, 255, 0.4);
  }

  .cropper-btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 768px) {
    .cropper-preview-box {
      width: min(400px, 90vw);
      height: min(400px, 90vw);
    }

    .cropper-modal {
      max-width: 95vw;
    }

    .cropper-header,
    .cropper-content,
    .cropper-footer {
      padding: 1.25rem;
    }
  }
</style>
