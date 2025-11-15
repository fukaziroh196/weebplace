<script>
  import { onMount, onDestroy } from 'svelte';

  export let src = '';
  export let onCancel = () => {};
  export let onApply = (dataUrl) => {};

  const OUTPUT_SIZE = 512;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;
  const DEFAULT_ZOOM = 1;

  let imageEl;
  let containerEl;
  let cropAreaEl;
  let naturalWidth = 0;
  let naturalHeight = 0;
  
  // Image position and zoom
  let imageX = 0;
  let imageY = 0;
  let zoom = DEFAULT_ZOOM;
  
  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartImageX = 0;
  let dragStartImageY = 0;
  
  // Touch state for mobile
  let touchState = {
    active: false,
    startDistance: 0,
    startZoom: 1,
    startCenterX: 0,
    startCenterY: 0,
    lastTouch1: null,
    lastTouch2: null
  };

  let containerWidth = 0;
  let containerHeight = 0;
  let cropSize = 0;

  function updateDimensions() {
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    containerWidth = rect.width;
    containerHeight = rect.height;
    cropSize = Math.min(containerWidth, containerHeight) * 0.85;
  }

  function handleImageLoad() {
    if (!imageEl || !containerEl) return;
    
    naturalWidth = imageEl.naturalWidth;
    naturalHeight = imageEl.naturalHeight;
    
    updateDimensions();
    
    // Вычисляем оптимальный зум, чтобы изображение полностью поместилось в контейнер
    // и область обрезки была заполнена
    const containerMinSize = Math.min(containerWidth, containerHeight);
    const imageMaxSize = Math.max(naturalWidth, naturalHeight);
    
    // Вычисляем зум так, чтобы изображение занимало ~80% контейнера
    // Это даст больше контекста и возможность выбора области обрезки
    const fitScale = (containerMinSize * 0.8) / imageMaxSize;
    
    // Но не меньше чем нужно, чтобы область обрезки была заполнена
    const cropScale = cropSize / Math.min(naturalWidth, naturalHeight);
    
    // Используем большее значение, но не превышаем максимум
    zoom = Math.min(Math.max(fitScale, cropScale * 0.9), MAX_ZOOM);
    zoom = Math.max(zoom, MIN_ZOOM);
    
    centerImage();
    
    // Resize observer for container
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
        constrainImagePosition();
      });
      resizeObserver.observe(containerEl);
    }
  }

  function centerImage() {
    if (!imageEl || !containerEl) return;
    
    const scaledWidth = naturalWidth * zoom;
    const scaledHeight = naturalHeight * zoom;
    
    imageX = (containerWidth - scaledWidth) / 2;
    imageY = (containerHeight - scaledHeight) / 2;
    
    constrainImagePosition();
  }

  function constrainImagePosition() {
    if (!imageEl || !containerEl) return;
    
    const scaledWidth = naturalWidth * zoom;
    const scaledHeight = naturalHeight * zoom;
    
    const cropCenterX = containerWidth / 2;
    const cropCenterY = containerHeight / 2;
    
    const halfCropSize = cropSize / 2;
    
    // Constrain image so crop area is always covered
    const minX = cropCenterX - halfCropSize - scaledWidth;
    const maxX = cropCenterX + halfCropSize;
    const minY = cropCenterY - halfCropSize - scaledHeight;
    const maxY = cropCenterY + halfCropSize;
    
    imageX = Math.max(minX, Math.min(maxX, imageX));
    imageY = Math.max(minY, Math.min(maxY, imageY));
  }

  function handleWheel(e) {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    
    if (newZoom === zoom) return;
    
    // Zoom towards mouse position
    const rect = containerEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomRatio = newZoom / zoom;
    
    imageX = mouseX - (mouseX - imageX) * zoomRatio;
    imageY = mouseY - (mouseY - imageY) * zoomRatio;
    
    zoom = newZoom;
    constrainImagePosition();
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.crop-controls')) return;
    
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartImageX = imageX;
    dragStartImageY = imageY;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    imageX = dragStartImageX + deltaX;
    imageY = dragStartImageY + deltaY;
    
    constrainImagePosition();
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  // Touch handlers for mobile
  function getTouchDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(touch1, touch2) {
    const rect = containerEl.getBoundingClientRect();
    return {
      x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
      y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
    };
  }

  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      // Single touch - drag
      const touch = e.touches[0];
      touchState.active = true;
      touchState.lastTouch1 = touch;
      
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      dragStartImageX = imageX;
      dragStartImageY = imageY;
      
      isDragging = true;
    } else if (e.touches.length === 2) {
      // Two touches - pinch zoom
      e.preventDefault();
      touchState.active = true;
      touchState.lastTouch1 = e.touches[0];
      touchState.lastTouch2 = e.touches[1];
      
      touchState.startDistance = getTouchDistance(e.touches[0], e.touches[1]);
      touchState.startZoom = zoom;
      
      const center = getTouchCenter(e.touches[0], e.touches[1]);
      touchState.startCenterX = center.x;
      touchState.startCenterY = center.y;
    }
  }

  function handleTouchMove(e) {
    if (!touchState.active) return;
    
    if (e.touches.length === 1 && touchState.lastTouch1) {
      // Single touch drag
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartX;
      const deltaY = touch.clientY - dragStartY;
      
      imageX = dragStartImageX + deltaX;
      imageY = dragStartImageY + deltaY;
      
      constrainImagePosition();
      touchState.lastTouch1 = e.touches[0];
    } else if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      
      if (!touchState.lastTouch1 || !touchState.lastTouch2) return;
      
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = distance / touchState.startDistance;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchState.startZoom * scale));
      
      if (newZoom !== zoom) {
        const zoomRatio = newZoom / zoom;
        imageX = touchState.startCenterX - (touchState.startCenterX - imageX) * zoomRatio;
        imageY = touchState.startCenterY - (touchState.startCenterY - imageY) * zoomRatio;
        
        zoom = newZoom;
        constrainImagePosition();
      }
      
      touchState.lastTouch1 = e.touches[0];
      touchState.lastTouch2 = e.touches[1];
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length === 0) {
      touchState.active = false;
      isDragging = false;
      touchState.lastTouch1 = null;
      touchState.lastTouch2 = null;
    } else if (e.touches.length === 1) {
      touchState.lastTouch1 = e.touches[0];
      touchState.lastTouch2 = null;
    }
  }

  function handleZoomChange(e) {
    const newZoom = parseFloat(e.target.value);
    
    // Zoom towards center of crop area
    const cropCenterX = containerWidth / 2;
    const cropCenterY = containerHeight / 2;
    
    const zoomRatio = newZoom / zoom;
    
    imageX = cropCenterX - (cropCenterX - imageX) * zoomRatio;
    imageY = cropCenterY - (cropCenterY - imageY) * zoomRatio;
    
    zoom = newZoom;
    constrainImagePosition();
  }

  function applyCrop() {
    if (!imageEl || !naturalWidth || !naturalHeight || !imageEl.complete) {
      console.error('[AvatarCropper] Cannot crop: image not ready');
      return;
    }
    
    try {
      const cropCenterX = containerWidth / 2;
      const cropCenterY = containerHeight / 2;
      const halfCropSize = cropSize / 2;
      
      // Calculate source coordinates in the natural image
      const scaledWidth = naturalWidth * zoom;
      const scaledHeight = naturalHeight * zoom;
      
      // Crop area in displayed coordinates
      const cropLeft = cropCenterX - halfCropSize;
      const cropTop = cropCenterY - halfCropSize;
      
      // Convert to image coordinates
      const relativeX = cropLeft - imageX;
      const relativeY = cropTop - imageY;
      
      // Source coordinates in natural image
      const sourceX = relativeX / zoom;
      const sourceY = relativeY / zoom;
      const sourceSize = cropSize / zoom;
      
      // Clamp to image bounds
      const clampedSourceX = Math.max(0, Math.min(sourceX, naturalWidth - sourceSize));
      const clampedSourceY = Math.max(0, Math.min(sourceY, naturalHeight - sourceSize));
      const clampedSourceSize = Math.min(sourceSize, naturalWidth - clampedSourceX, naturalHeight - clampedSourceY);
      
      // Create canvas and draw cropped image
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('[AvatarCropper] Cannot get canvas context');
        return;
      }
      
      ctx.imageSmoothingQuality = 'high';
      ctx.imageSmoothingEnabled = true;
      
      ctx.drawImage(
        imageEl,
        clampedSourceX, clampedSourceY, clampedSourceSize, clampedSourceSize,
        0, 0, OUTPUT_SIZE, OUTPUT_SIZE
      );
      
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      
      if (!dataUrl || dataUrl === 'data:,') {
        console.error('[AvatarCropper] Failed to create data URL');
        return;
      }
      
      onApply(dataUrl);
    } catch (error) {
      console.error('[AvatarCropper] Error applying crop:', error);
    }
  }

  let resizeObserver;

  onMount(() => {
    updateDimensions();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateDimensions);
    }
  });

  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updateDimensions);
    }
  });

  $: scaledWidth = naturalWidth * zoom;
  $: scaledHeight = naturalHeight * zoom;
  $: imageTransform = `translate(${imageX}px, ${imageY}px) scale(${zoom})`;
</script>

<div class="cropper-backdrop" on:click={(e) => e.target === e.currentTarget && onCancel()}>
  <div class="cropper-modal" role="dialog" aria-modal="true" aria-labelledby="cropper-title">
    <div class="cropper-header">
      <h2 id="cropper-title" class="cropper-title">Обрезка аватара</h2>
      <button class="cropper-close-btn" on:click={onCancel} aria-label="Закрыть" type="button">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>

    <div class="cropper-body">
      <div class="cropper-container" bind:this={containerEl}>
        <div 
          class="cropper-image-wrapper"
          class:dragging={isDragging}
          style="transform: {imageTransform};"
        >
          <img
            bind:this={imageEl}
            src={src}
            alt="Аватар для обрезки"
            class="cropper-image"
            style="width: {naturalWidth}px; height: {naturalHeight}px;"
            on:load={handleImageLoad}
            draggable="false"
          />
        </div>

        <!-- Crop overlay -->
        <div class="cropper-overlay">
          <div class="cropper-overlay-top" style="height: calc(50% - {cropSize / 2}px);"></div>
          <div class="cropper-overlay-bottom" style="top: calc(50% + {cropSize / 2}px);"></div>
          <div class="cropper-overlay-left" style="width: calc(50% - {cropSize / 2}px);"></div>
          <div class="cropper-overlay-right" style="left: calc(50% + {cropSize / 2}px);"></div>
        </div>

        <!-- Crop area -->
        <div 
          class="cropper-crop-area"
          bind:this={cropAreaEl}
          style="width: {cropSize}px; height: {cropSize}px; left: calc(50% - {cropSize / 2}px); top: calc(50% - {cropSize / 2}px);"
        >
          <div class="cropper-crop-border"></div>
          <div class="cropper-crop-grid">
            <div class="cropper-grid-line horizontal" style="top: 33.33%;"></div>
            <div class="cropper-grid-line horizontal" style="top: 66.66%;"></div>
            <div class="cropper-grid-line vertical" style="left: 33.33%;"></div>
            <div class="cropper-grid-line vertical" style="left: 66.66%;"></div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="crop-controls">
        <div class="zoom-control">
          <label for="zoom-slider" class="zoom-label">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
            </svg>
            <span>Масштаб</span>
          </label>
          <input
            id="zoom-slider"
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step="0.1"
            value={zoom}
            on:input={handleZoomChange}
            class="zoom-slider"
          />
          <span class="zoom-value">{Math.round(zoom * 100)}%</span>
        </div>

        <div class="crop-hint">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
          </svg>
          <span>Прокрутите колёсиком мыши для масштабирования</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="cropper-actions">
        <button class="cropper-btn cropper-btn-secondary" on:click={onCancel} type="button">
          Отмена
        </button>
        <button class="cropper-btn cropper-btn-primary" on:click={applyCrop} type="button">
          Обрезать
        </button>
      </div>
    </div>
  </div>
</div>

<div
  class="cropper-drag-handler"
  on:mousedown={handleMouseDown}
  on:wheel={handleWheel}
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
  class:dragging={isDragging}
></div>

<style>
  .cropper-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
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
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
    border-radius: 1rem;
    box-shadow: var(--shadow-outer, 0 1.5rem 4rem rgba(0, 0, 0, 0.35));
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }

  @keyframes slideUp {
    from {
      transform: translateY(1rem);
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
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
  }

  .cropper-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #f5f6ff);
    margin: 0;
  }

  .cropper-close-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    line-height: 1;
  }

  .cropper-close-btn:hover {
    background: var(--surface-muted, rgba(255, 255, 255, 0.1));
    color: var(--text-primary, #f5f6ff);
  }

  .cropper-close-btn:active {
    transform: scale(0.95);
  }

  .cropper-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .cropper-container {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 0.75rem;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .cropper-image-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    transition: transform 0.1s ease-out;
    will-change: transform;
  }

  .cropper-image-wrapper.dragging {
    transition: none;
    cursor: grabbing !important;
  }

  .cropper-image {
    display: block;
    user-select: none;
    pointer-events: none;
    max-width: none;
    max-height: none;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }

  .cropper-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  }

  .cropper-overlay-top,
  .cropper-overlay-bottom,
  .cropper-overlay-left,
  .cropper-overlay-right {
    position: absolute;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    transition: opacity 0.2s ease;
  }

  .cropper-crop-area {
    position: absolute;
    border: 3px solid var(--accent-primary, #9ecaff);
    box-shadow: 
      0 0 0 1px rgba(0, 0, 0, 0.5),
      0 0 30px rgba(158, 202, 255, 0.4),
      inset 0 0 20px rgba(158, 202, 255, 0.1);
    z-index: 3;
    pointer-events: none;
    border-radius: 0.25rem;
  }

  .cropper-crop-border {
    position: absolute;
    inset: -3px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 0.25rem;
    pointer-events: none;
  }

  .cropper-crop-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .cropper-grid-line {
    position: absolute;
    background: rgba(255, 255, 255, 0.4);
  }

  .cropper-grid-line.horizontal {
    left: 0;
    right: 0;
    height: 1px;
  }

  .cropper-grid-line.vertical {
    top: 0;
    bottom: 0;
    width: 1px;
  }

  .crop-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .zoom-control {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .zoom-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    min-width: 100px;
  }

  .zoom-label svg {
    flex-shrink: 0;
  }

  .zoom-slider {
    flex: 1;
    height: 6px;
    background: var(--surface-muted, rgba(255, 255, 255, 0.1));
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--accent-primary, #9ecaff);
    border-radius: 50%;
    cursor: grab;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .zoom-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(158, 202, 255, 0.5);
  }

  .zoom-slider::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.05);
  }

  .zoom-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--accent-primary, #9ecaff);
    border-radius: 50%;
    border: none;
    cursor: grab;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .zoom-slider::-moz-range-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(158, 202, 255, 0.5);
  }

  .zoom-slider::-moz-range-thumb:active {
    cursor: grabbing;
    transform: scale(1.05);
  }

  .zoom-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #f5f6ff);
    min-width: 45px;
    text-align: right;
  }

  .crop-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-tertiary, rgba(245, 246, 255, 0.65));
    padding: 0.75rem;
    background: var(--surface-muted, rgba(255, 255, 255, 0.05));
    border-radius: 0.5rem;
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
  }

  .crop-hint svg {
    flex-shrink: 0;
    opacity: 0.7;
  }

  .cropper-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .cropper-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 100px;
  }

  .cropper-btn-secondary {
    background: var(--surface-secondary, rgba(255, 255, 255, 0.08));
    color: var(--text-secondary, rgba(245, 246, 255, 0.85));
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.2));
  }

  .cropper-btn-secondary:hover {
    background: var(--surface-muted, rgba(255, 255, 255, 0.15));
    color: var(--text-primary, #f5f6ff);
  }

  .cropper-btn-secondary:active {
    transform: scale(0.98);
  }

  .cropper-btn-primary {
    background: var(--accent-primary, #9ecaff);
    color: var(--text-primary, #f5f6ff);
    box-shadow: 0 4px 12px rgba(158, 202, 255, 0.3);
  }

  .cropper-btn-primary:hover {
    background: var(--accent-primary-strong, #b3d6ff);
    box-shadow: 0 6px 16px rgba(158, 202, 255, 0.4);
    transform: translateY(-1px);
  }

  .cropper-btn-primary:active {
    transform: translateY(0) scale(0.98);
  }

  .cropper-drag-handler {
    position: fixed;
    inset: 0;
    z-index: 9998;
    cursor: grab;
    touch-action: none;
  }

  .cropper-drag-handler.dragging {
    cursor: grabbing;
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .cropper-modal {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }

    .cropper-body {
      padding: 1rem;
      gap: 1rem;
    }

    .cropper-header {
      padding: 1rem;
    }

    .zoom-control {
      flex-wrap: wrap;
    }

    .zoom-label {
      min-width: auto;
    }

    .crop-hint {
      font-size: 0.75rem;
      padding: 0.625rem;
    }

    .cropper-actions {
      flex-direction: column-reverse;
    }

    .cropper-btn {
      width: 100%;
    }
  }

  /* Hide hint on mobile */
  @media (max-width: 768px) {
    .crop-hint {
      display: none;
    }
  }
</style>
