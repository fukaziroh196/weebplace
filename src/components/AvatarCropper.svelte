<script>
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let imageFile;
  
  const dispatch = createEventDispatcher();
  
  let container;
  let image;
  let imageLoaded = false;
  
  // Image transform state
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  
  // Drag state
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  
  // Pinch zoom state
  let initialPinchDistance = 0;
  let initialScale = 1;
  
  // Image natural dimensions
  let naturalWidth = 0;
  let naturalHeight = 0;
  
  // Container/crop size
  const cropSize = 280;
  const outputSize = 256;
  
  let minScale = 1;
  let maxScale = 5;
  
  $: imageStyle = `transform: translate(${translateX}px, ${translateY}px) scale(${scale})`;
  
  function handleImageLoad() {
    naturalWidth = image.naturalWidth;
    naturalHeight = image.naturalHeight;
    
    // Calculate minimum scale so image covers the crop area
    const scaleX = cropSize / naturalWidth;
    const scaleY = cropSize / naturalHeight;
    minScale = Math.max(scaleX, scaleY);
    maxScale = minScale * 5;
    
    // Start with image fitting the crop area
    scale = minScale;
    translateX = 0;
    translateY = 0;
    
    imageLoaded = true;
  }
  
  function clampPosition() {
    // Calculate scaled image dimensions
    const scaledWidth = naturalWidth * scale;
    const scaledHeight = naturalHeight * scale;
    
    // Calculate max translation (image edge should not go past crop edge)
    const maxX = (scaledWidth - cropSize) / 2;
    const maxY = (scaledHeight - cropSize) / 2;
    
    translateX = Math.max(-maxX, Math.min(maxX, translateX));
    translateY = Math.max(-maxY, Math.min(maxY, translateY));
  }
  
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
  }
  
  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    
    translateX += dx;
    translateY += dy;
    clampPosition();
    
    lastX = e.clientX;
    lastY = e.clientY;
  }
  
  function handleMouseUp() {
    isDragging = false;
  }
  
  function handleWheel(e) {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    const newScale = Math.max(minScale, Math.min(maxScale, scale * delta));
    
    // Zoom toward cursor position
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    const factor = newScale / scale;
    translateX = x - (x - translateX) * factor;
    translateY = y - (y - translateY) * factor;
    
    scale = newScale;
    clampPosition();
  }
  
  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      isDragging = true;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialPinchDistance = getPinchDistance(e.touches);
      initialScale = scale;
    }
    e.preventDefault();
  }
  
  function handleTouchMove(e) {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - lastX;
      const dy = e.touches[0].clientY - lastY;
      
      translateX += dx;
      translateY += dy;
      clampPosition();
      
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const distance = getPinchDistance(e.touches);
      const newScale = Math.max(minScale, Math.min(maxScale, initialScale * (distance / initialPinchDistance)));
      
      const factor = newScale / scale;
      translateX *= factor;
      translateY *= factor;
      
      scale = newScale;
      clampPosition();
    }
    e.preventDefault();
  }
  
  function handleTouchEnd(e) {
    if (e.touches.length === 0) {
      isDragging = false;
    } else if (e.touches.length === 1) {
      isDragging = true;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    }
  }
  
  function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function handleZoom(direction) {
    const factor = direction === 'in' ? 1.2 : 0.8;
    const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));
    
    const scaleFactor = newScale / scale;
    translateX *= scaleFactor;
    translateY *= scaleFactor;
    
    scale = newScale;
    clampPosition();
  }
  
  function handleSliderChange(e) {
    const value = parseFloat(e.target.value);
    const newScale = minScale + (maxScale - minScale) * (value / 100);
    
    const factor = newScale / scale;
    translateX *= factor;
    translateY *= factor;
    
    scale = newScale;
    clampPosition();
  }
  
  $: sliderValue = ((scale - minScale) / (maxScale - minScale)) * 100;
  
  async function handleCrop() {
    if (!image || !imageLoaded) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    
    // Calculate what portion of the original image is visible in the crop area
    const scaledWidth = naturalWidth * scale;
    const scaledHeight = naturalHeight * scale;
    
    // Center of the crop area in image coordinates
    const centerX = naturalWidth / 2 - translateX / scale;
    const centerY = naturalHeight / 2 - translateY / scale;
    
    // Size of crop area in original image coordinates
    const cropInImageSize = cropSize / scale;
    
    // Source rectangle
    const sx = centerX - cropInImageSize / 2;
    const sy = centerY - cropInImageSize / 2;
    const sSize = cropInImageSize;
    
    // Draw cropped portion
    ctx.drawImage(
      image,
      sx, sy, sSize, sSize,
      0, 0, outputSize, outputSize
    );
    
    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
        dispatch('crop', { file, preview: canvas.toDataURL('image/jpeg', 0.92) });
      }
    }, 'image/jpeg', 0.92);
  }
  
  function handleCancel() {
    dispatch('cancel');
  }
  
  // Create object URL for the image
  let imageSrc = '';
  $: if (imageFile) {
    imageSrc = URL.createObjectURL(imageFile);
  }
  
  onMount(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  });
</script>

<div class="cropper-overlay">
  <div class="cropper-modal">
    <div class="cropper-header">
      <h3>Обрезать фото</h3>
    </div>
    
    <div 
      class="cropper-area"
      bind:this={container}
      on:mousedown={handleMouseDown}
      on:mousemove={handleMouseMove}
      on:mouseup={handleMouseUp}
      on:mouseleave={handleMouseUp}
      on:wheel={handleWheel}
      on:touchstart={handleTouchStart}
      on:touchmove={handleTouchMove}
      on:touchend={handleTouchEnd}
    >
      <div class="image-container">
        {#if imageSrc}
          <img 
            bind:this={image}
            src={imageSrc} 
            alt="Crop preview"
            style={imageStyle}
            on:load={handleImageLoad}
            draggable="false"
          />
        {/if}
      </div>
      
      <!-- Overlay with circular hole -->
      <div class="crop-overlay">
        <svg width="100%" height="100%" viewBox="0 0 320 320">
          <defs>
            <mask id="hole">
              <rect width="100%" height="100%" fill="white"/>
              <circle cx="160" cy="160" r="140" fill="black"/>
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#hole)"/>
          <circle cx="160" cy="160" r="140" fill="none" stroke="white" stroke-width="2"/>
        </svg>
      </div>
    </div>
    
    <div class="zoom-controls">
      <button class="zoom-btn" on:click={() => handleZoom('out')} disabled={scale <= minScale}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <input 
        type="range" 
        min="0" 
        max="100" 
        value={sliderValue}
        on:input={handleSliderChange}
        class="zoom-slider"
      />
      <button class="zoom-btn" on:click={() => handleZoom('in')} disabled={scale >= maxScale}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
    
    <div class="hint">Перетащите фото для позиционирования</div>
    
    <div class="cropper-actions">
      <button class="cancel-btn" on:click={handleCancel}>Отмена</button>
      <button class="crop-btn" on:click={handleCrop} disabled={!imageLoaded}>
        Сохранить
      </button>
    </div>
  </div>
</div>

<style>
  .cropper-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }
  
  .cropper-modal {
    background: rgba(30, 30, 45, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1.25rem;
    padding: 1.5rem;
    max-width: 380px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  
  .cropper-header {
    text-align: center;
  }
  
  .cropper-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #f5f6ff);
  }
  
  .cropper-area {
    position: relative;
    width: 320px;
    height: 320px;
    margin: 0 auto;
    border-radius: 1rem;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
    user-select: none;
    background: rgba(0, 0, 0, 0.4);
  }
  
  .cropper-area:active {
    cursor: grabbing;
  }
  
  .image-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .image-container img {
    max-width: none;
    max-height: none;
    transform-origin: center;
    pointer-events: none;
  }
  
  .crop-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 0.5rem;
  }
  
  .zoom-btn {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    color: var(--text-primary, #f5f6ff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  
  .zoom-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
  }
  
  .zoom-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .zoom-btn svg {
    width: 18px;
    height: 18px;
  }
  
  .zoom-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    cursor: pointer;
  }
  
  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: #55efc4;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .zoom-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: #55efc4;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .hint {
    text-align: center;
    font-size: 0.8rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  }
  
  .cropper-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  .cancel-btn, .crop-btn {
    flex: 1;
    padding: 0.85rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .cancel-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--text-primary, #f5f6ff);
  }
  
  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  
  .crop-btn {
    background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
    color: #1a1a2e;
  }
  
  .crop-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(85, 239, 196, 0.4);
  }
  
  .crop-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  @media (max-width: 400px) {
    .cropper-modal {
      padding: 1.25rem;
    }
    
    .cropper-area {
      width: 280px;
      height: 280px;
    }
  }
</style>
