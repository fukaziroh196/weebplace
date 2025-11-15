<script>
  import { onMount, onDestroy } from 'svelte';
  
  export let src = '';
  export let onCancel = () => {};
  export let onApply = (dataUrl) => {};

  const CROP_SIZE = 400;
  const OUTPUT_SIZE = 512;
  
  let imageEl;
  let containerEl;
  let naturalWidth = 0;
  let naturalHeight = 0;
  
  let scale = 1;
  let minScale = 1;
  let x = 0;
  let y = 0;
  
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartImageX = 0;
  let dragStartImageY = 0;

  function handleImageLoad() {
    if (!imageEl) return;
    
    naturalWidth = imageEl.naturalWidth;
    naturalHeight = imageEl.naturalHeight;
    
    // Вычисляем минимальный масштаб, чтобы изображение покрывало всю область обрезки
    const scaleX = CROP_SIZE / naturalWidth;
    const scaleY = CROP_SIZE / naturalHeight;
    minScale = Math.max(scaleX, scaleY);
    scale = minScale;
    
    // Центрируем изображение
    centerImage();
  }

  function centerImage() {
    const displayWidth = naturalWidth * scale;
    const displayHeight = naturalHeight * scale;
    x = (CROP_SIZE - displayWidth) / 2;
    y = (CROP_SIZE - displayHeight) / 2;
    constrainPosition();
  }

  function constrainPosition() {
    const displayWidth = naturalWidth * scale;
    const displayHeight = naturalHeight * scale;
    
    const minX = Math.min(0, CROP_SIZE - displayWidth);
    const minY = Math.min(0, CROP_SIZE - displayHeight);
    const maxX = 0;
    const maxY = 0;
    
    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));
  }

  function handleMouseDown(e) {
    if (!containerEl || e.target === containerEl || e.target.closest('.cropper-controls')) return;
    if (e.button !== 0) return; // только левая кнопка мыши
    
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartImageX = x;
    dragStartImageY = y;
    
    e.preventDefault();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    x = dragStartImageX + deltaX;
    y = dragStartImageY + deltaY;
    
    constrainPosition();
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  function handleWheel(e) {
    if (!containerEl?.contains(e.target)) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const oldScale = scale;
    scale = Math.max(minScale, Math.min(minScale * 3, scale + minScale * delta));
    
    // Масштабируем относительно центра области обрезки
    const centerX = x + (naturalWidth * oldScale) / 2;
    const centerY = y + (naturalHeight * oldScale) / 2;
    x = centerX - (naturalWidth * scale) / 2;
    y = centerY - (naturalHeight * scale) / 2;
    
    constrainPosition();
  }

  function handleScaleChange(e) {
    const newScale = parseFloat(e.target.value);
    const oldScale = scale;
    scale = newScale;
    
    // Сохраняем центр при изменении масштаба
    const centerX = x + (naturalWidth * oldScale) / 2;
    const centerY = y + (naturalHeight * oldScale) / 2;
    x = centerX - (naturalWidth * scale) / 2;
    y = centerY - (naturalHeight * scale) / 2;
    
    constrainPosition();
  }

  function zoomIn() {
    if (scale >= minScale * 3) return;
    const oldScale = scale;
    scale = Math.min(minScale * 3, scale + minScale * 0.1);
    
    const centerX = x + (naturalWidth * oldScale) / 2;
    const centerY = y + (naturalHeight * oldScale) / 2;
    x = centerX - (naturalWidth * scale) / 2;
    y = centerY - (naturalHeight * scale) / 2;
    
    constrainPosition();
  }

  function zoomOut() {
    if (scale <= minScale) return;
    const oldScale = scale;
    scale = Math.max(minScale, scale - minScale * 0.1);
    
    const centerX = x + (naturalWidth * oldScale) / 2;
    const centerY = y + (naturalHeight * oldScale) / 2;
    x = centerX - (naturalWidth * scale) / 2;
    y = centerY - (naturalHeight * scale) / 2;
    
    constrainPosition();
  }

  function applyCrop() {
    if (!imageEl || !naturalWidth || !naturalHeight) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    
    // Вычисляем координаты и размеры для обрезки
    const sourceX = -x / scale;
    const sourceY = -y / scale;
    const sourceWidth = CROP_SIZE / scale;
    const sourceHeight = CROP_SIZE / scale;
    
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      imageEl,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, OUTPUT_SIZE, OUTPUT_SIZE
    );
    
    const dataUrl = canvas.toDataURL('image/png');
    onApply(dataUrl);
  }

  function getScalePercent() {
    if (minScale === 0) return 100;
    return Math.round((scale / minScale) * 100);
  }

  onMount(() => {
    window.addEventListener('wheel', handleWheel, { passive: false });
  });

  onDestroy(() => {
    window.removeEventListener('wheel', handleWheel);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });
</script>

<div class="cropper-backdrop" on:click={(e) => e.target === e.currentTarget && onCancel()}>
  <div class="cropper-modal" on:click|stopPropagation>
    <div class="cropper-header">
      <h2 class="cropper-title">Обрезка аватара</h2>
      <button class="cropper-close-btn" on:click={onCancel} aria-label="Закрыть">×</button>
    </div>

    <div class="cropper-body">
      <div class="cropper-preview-wrapper">
        <div class="cropper-label">Предпросмотр</div>
        <div 
          class="cropper-viewport" 
          bind:this={containerEl}
          on:mousedown={handleMouseDown}
          style="cursor: {isDragging ? 'grabbing' : 'grab'};"
        >
          <div class="cropper-image-wrapper" style="transform: translate({x}px, {y}px);">
            <img
              bind:this={imageEl}
              src={src}
              alt="Crop"
              class="cropper-image"
              style="width: {naturalWidth * scale}px; height: {naturalHeight * scale}px;"
              on:load={handleImageLoad}
              draggable="false"
            />
          </div>
          <div class="cropper-overlay"></div>
          <div class="cropper-grid"></div>
        </div>
      </div>

      <div class="cropper-controls-panel">
        <div class="control-group">
          <div class="control-label">
            <span>Масштаб</span>
            <span class="scale-value">{getScalePercent()}%</span>
          </div>
          <div class="slider-container">
            <button 
              class="zoom-btn" 
              on:click={zoomOut}
              disabled={scale <= minScale}
              aria-label="Уменьшить"
            >
              −
            </button>
            <input
              type="range"
              class="scale-slider"
              min={minScale}
              max={minScale * 3}
              step="0.01"
              value={scale}
              on:input={handleScaleChange}
              disabled={naturalWidth === 0}
            />
            <button 
              class="zoom-btn" 
              on:click={zoomIn}
              disabled={scale >= minScale * 3}
              aria-label="Увеличить"
            >
              +
            </button>
          </div>
        </div>

        <div class="control-hint">
          💡 Перетаскивайте изображение мышью или используйте колесико для масштабирования
        </div>
      </div>
    </div>

    <div class="cropper-footer">
      <button class="btn btn-cancel" on:click={onCancel}>
        Отмена
      </button>
      <button 
        class="btn btn-save" 
        on:click={applyCrop}
        disabled={naturalWidth === 0}
      >
        Сохранить
      </button>
    </div>
  </div>
</div>

<style>
  .cropper-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .cropper-modal {
    background: var(--surface-primary, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 2rem;
    width: 100%;
    max-width: 900px;
    box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.4);
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

  .cropper-close-btn {
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

  .cropper-close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
  }

  .cropper-body {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .cropper-preview-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .cropper-label {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .cropper-viewport {
    position: relative;
    width: 400px;
    height: 400px;
    border-radius: 1.5rem;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid rgba(255, 255, 255, 0.3);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    user-select: none;
  }

  .cropper-image-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }

  .cropper-image {
    display: block;
    user-select: none;
    pointer-events: none;
  }

  .cropper-overlay {
    position: absolute;
    inset: 0;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
    pointer-events: none;
    z-index: 2;
  }

  .cropper-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px);
    background-size: calc(100% / 3) calc(100% / 3);
  }

  .cropper-controls-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 500px;
    margin: 0 auto;
    width: 100%;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .control-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text-primary, #f5f6ff);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .scale-value {
    color: var(--accent-primary, #9ecaff);
    font-size: 1rem;
    font-weight: 900;
  }

  .slider-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .zoom-btn {
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

  .zoom-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
  }

  .zoom-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .scale-slider {
    flex: 1;
    height: 0.5rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .scale-slider::-webkit-slider-thumb {
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

  .scale-slider::-webkit-slider-thumb:hover {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: scale(1.15);
    box-shadow: 0 4px 12px rgba(158, 202, 255, 0.6);
  }

  .scale-slider::-moz-range-thumb {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: var(--accent-primary, #9ecaff);
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(158, 202, 255, 0.4);
    transition: all 0.2s ease;
  }

  .scale-slider::-moz-range-thumb:hover {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: scale(1.15);
    box-shadow: 0 4px 12px rgba(158, 202, 255, 0.6);
  }

  .control-hint {
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

  .btn {
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

  .btn-cancel {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-primary, #f5f6ff);
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }

  .btn-save {
    background: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
    box-shadow: 0 4px 12px rgba(158, 202, 255, 0.3);
  }

  .btn-save:hover:not(:disabled) {
    background: var(--accent-primary-strong, #b3d6ff);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(158, 202, 255, 0.4);
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 768px) {
    .cropper-viewport {
      width: min(400px, 90vw);
      height: min(400px, 90vw);
    }

    .cropper-modal {
      max-width: 95vw;
    }

    .cropper-header,
    .cropper-body,
    .cropper-footer {
      padding: 1.25rem;
    }
  }
</style>
