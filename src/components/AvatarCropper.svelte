<script>
  export let src = '';
  export let onCancel = () => {};
  export let onApply = (dataUrl) => {};

  const OUTPUT_SIZE = 512;
  const CROP_SIZE = 400;
  
  let imageEl;
  let containerEl;
  let cropBoxEl;
  let naturalWidth = 0;
  let naturalHeight = 0;
  
  let imageScale = 1;
  let cropX = 0;
  let cropY = 0;
  
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartCropX = 0;
  let dragStartCropY = 0;

  function handleImageLoad() {
    if (!imageEl || !containerEl) return;
    
    naturalWidth = imageEl.naturalWidth;
    naturalHeight = imageEl.naturalHeight;
    
    // Масштабируем изображение чтобы оно поместилось в контейнер
    const containerRect = containerEl.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    const scaleX = containerWidth / naturalWidth;
    const scaleY = containerHeight / naturalHeight;
    imageScale = Math.min(scaleX, scaleY);
    
    // Вычисляем размер отображаемого изображения
    const imageDisplayWidth = naturalWidth * imageScale;
    const imageDisplayHeight = naturalHeight * imageScale;
    
    // Центрируем сетку обрезки в центре изображения
    // Изображение центрировано в контейнере
    const imageOffsetX = (containerWidth - imageDisplayWidth) / 2;
    const imageOffsetY = (containerHeight - imageDisplayHeight) / 2;
    
    cropX = imageOffsetX + (imageDisplayWidth - CROP_SIZE) / 2;
    cropY = imageOffsetY + (imageDisplayHeight - CROP_SIZE) / 2;
    
    // Ограничиваем позицию сетки
    constrainCropPosition();
  }

  function constrainCropPosition() {
    if (!imageEl || !containerEl) return;
    
    const containerRect = containerEl.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    const imageDisplayWidth = naturalWidth * imageScale;
    const imageDisplayHeight = naturalHeight * imageScale;
    
    const imageOffsetX = (containerWidth - imageDisplayWidth) / 2;
    const imageOffsetY = (containerHeight - imageDisplayHeight) / 2;
    
    const minX = imageOffsetX;
    const minY = imageOffsetY;
    const maxX = imageOffsetX + imageDisplayWidth - CROP_SIZE;
    const maxY = imageOffsetY + imageDisplayHeight - CROP_SIZE;
    
    cropX = Math.max(minX, Math.min(maxX, cropX));
    cropY = Math.max(minY, Math.min(maxY, cropY));
  }

  function handleMouseDown(e) {
    if (!cropBoxEl?.contains(e.target)) return;
    if (e.button !== 0) return;
    
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartCropX = cropX;
    dragStartCropY = cropY;
    
    e.preventDefault();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    cropX = dragStartCropX + deltaX;
    cropY = dragStartCropY + deltaY;
    
    constrainCropPosition();
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  function applyCrop() {
    if (!imageEl || !naturalWidth || !naturalHeight || !containerEl) return;
    
    const containerRect = containerEl.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    const imageDisplayWidth = naturalWidth * imageScale;
    const imageDisplayHeight = naturalHeight * imageScale;
    const imageOffsetX = (containerWidth - imageDisplayWidth) / 2;
    const imageOffsetY = (containerHeight - imageDisplayHeight) / 2;
    
    // Вычисляем координаты относительно изображения
    const relativeX = cropX - imageOffsetX;
    const relativeY = cropY - imageOffsetY;
    
    // Вычисляем координаты в исходном изображении
    const sourceX = relativeX / imageScale;
    const sourceY = relativeY / imageScale;
    const sourceSize = CROP_SIZE / imageScale;
    
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      imageEl,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, OUTPUT_SIZE, OUTPUT_SIZE
    );
    
    const dataUrl = canvas.toDataURL('image/png');
    onApply(dataUrl);
  }
</script>

<div class="cropper-backdrop" on:click={(e) => e.target === e.currentTarget && onCancel()}>
  <div class="cropper-modal" on:click|stopPropagation>
    <div class="cropper-header">
      <h2 class="cropper-title">Обрезка аватара</h2>
      <button class="cropper-close-btn" on:click={onCancel} aria-label="Закрыть">×</button>
    </div>

    <div class="cropper-body">
      <div class="cropper-preview-wrapper">
        <div class="cropper-label">Перетаскивайте сетку для выбора области</div>
        <div class="cropper-container" bind:this={containerEl}>
          <div class="cropper-image-wrapper">
            <img
              bind:this={imageEl}
              src={src}
              alt="Crop"
              class="cropper-image"
              style="width: {naturalWidth * imageScale}px; height: {naturalHeight * imageScale}px;"
              on:load={handleImageLoad}
              draggable="false"
            />
          </div>
          <div 
            class="cropper-box" 
            bind:this={cropBoxEl}
            style="left: {cropX}px; top: {cropY}px; cursor: {isDragging ? 'grabbing' : 'grab'};"
            on:mousedown={handleMouseDown}
          >
            <div class="cropper-box-border"></div>
            <div class="cropper-box-grid"></div>
            <div class="cropper-box-handles">
              <div class="handle handle-tl"></div>
              <div class="handle handle-tr"></div>
              <div class="handle handle-bl"></div>
              <div class="handle handle-br"></div>
            </div>
          </div>
          <div class="cropper-overlay" style="--crop-x: {cropX}px; --crop-y: {cropY}px; --crop-size: {CROP_SIZE}px;">
            <div class="cropper-overlay-top"></div>
            <div class="cropper-overlay-bottom"></div>
            <div class="cropper-overlay-left"></div>
            <div class="cropper-overlay-right"></div>
          </div>
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
    max-width: 700px;
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

  .cropper-container {
    position: relative;
    width: 100%;
    max-width: 600px;
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 1rem;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cropper-image-wrapper {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    will-change: transform;
  }

  .cropper-image {
    display: block;
    user-select: none;
    pointer-events: none;
    max-width: none;
    max-height: none;
  }

  .cropper-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  }

  .cropper-overlay-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: var(--crop-y);
    background: rgba(0, 0, 0, 0.6);
  }

  .cropper-overlay-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    top: calc(var(--crop-y) + var(--crop-size));
    background: rgba(0, 0, 0, 0.6);
  }

  .cropper-overlay-left {
    position: absolute;
    top: var(--crop-y);
    left: 0;
    width: var(--crop-x);
    height: var(--crop-size);
    background: rgba(0, 0, 0, 0.6);
  }

  .cropper-overlay-right {
    position: absolute;
    top: var(--crop-y);
    right: 0;
    left: calc(var(--crop-x) + var(--crop-size));
    height: var(--crop-size);
    background: rgba(0, 0, 0, 0.6);
  }

  .cropper-box {
    position: absolute;
    width: 400px;
    height: 400px;
    border: 3px solid var(--accent-primary, #9ecaff);
    box-shadow: 0 0 20px rgba(158, 202, 255, 0.5);
    z-index: 4;
    user-select: none;
    transition: transform 0.1s ease;
    will-change: transform;
  }

  .cropper-box:active {
    transform: scale(0.98);
  }

  .cropper-box-border {
    position: absolute;
    inset: 0;
    border: 2px solid rgba(255, 255, 255, 0.8);
    pointer-events: none;
  }

  .cropper-box-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px);
    background-size: calc(100% / 3) calc(100% / 3);
  }

  .cropper-box-handles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .handle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--accent-primary, #9ecaff);
    border: 2px solid rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .handle-tl {
    top: -6px;
    left: -6px;
  }

  .handle-tr {
    top: -6px;
    right: -6px;
  }

  .handle-bl {
    bottom: -6px;
    left: -6px;
  }

  .handle-br {
    bottom: -6px;
    right: -6px;
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
    .cropper-box {
      width: min(400px, 80vw);
      height: min(400px, 80vw);
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
