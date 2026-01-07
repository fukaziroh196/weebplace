<script>
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let imageFile;
  
  const dispatch = createEventDispatcher();
  
  let canvas;
  let ctx;
  let image = null;
  let imageLoaded = false;
  
  // Crop area
  let cropX = 0;
  let cropY = 0;
  let cropSize = 200;
  let scale = 1;
  let minScale = 0.1;
  let maxScale = 3;
  
  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let cropStartX = 0;
  let cropStartY = 0;
  
  // Canvas size
  const canvasSize = 300;
  const outputSize = 256; // Output avatar size
  
  onMount(() => {
    ctx = canvas.getContext('2d');
    loadImage();
  });
  
  async function loadImage() {
    if (!imageFile) return;
    
    image = new Image();
    image.onload = () => {
      imageLoaded = true;
      
      // Calculate initial scale to fit image in canvas
      const maxDim = Math.max(image.width, image.height);
      scale = canvasSize / maxDim;
      minScale = Math.min(outputSize / image.width, outputSize / image.height);
      maxScale = 3;
      
      // Center the crop area
      cropSize = Math.min(image.width, image.height) * scale;
      cropX = (canvasSize - cropSize) / 2;
      cropY = (canvasSize - cropSize) / 2;
      
      draw();
    };
    
    // Load from file
    const reader = new FileReader();
    reader.onload = (e) => {
      image.src = e.target.result;
    };
    reader.readAsDataURL(imageFile);
  }
  
  function draw() {
    if (!ctx || !image || !imageLoaded) return;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    
    // Draw image scaled and centered
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;
    const imgX = (canvasSize - scaledWidth) / 2;
    const imgY = (canvasSize - scaledHeight) / 2;
    
    ctx.drawImage(image, imgX, imgY, scaledWidth, scaledHeight);
    
    // Draw dark overlay outside crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasSize, cropY); // Top
    ctx.fillRect(0, cropY + cropSize, canvasSize, canvasSize - cropY - cropSize); // Bottom
    ctx.fillRect(0, cropY, cropX, cropSize); // Left
    ctx.fillRect(cropX + cropSize, cropY, canvasSize - cropX - cropSize, cropSize); // Right
    
    // Draw crop border
    ctx.strokeStyle = '#55efc4';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX, cropY, cropSize, cropSize);
    
    // Draw corner handles
    const handleSize = 12;
    ctx.fillStyle = '#55efc4';
    
    // Corners
    ctx.fillRect(cropX - handleSize/2, cropY - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cropX + cropSize - handleSize/2, cropY - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cropX - handleSize/2, cropY + cropSize - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cropX + cropSize - handleSize/2, cropY + cropSize - handleSize/2, handleSize, handleSize);
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    const third = cropSize / 3;
    ctx.beginPath();
    ctx.moveTo(cropX + third, cropY);
    ctx.lineTo(cropX + third, cropY + cropSize);
    ctx.moveTo(cropX + third * 2, cropY);
    ctx.lineTo(cropX + third * 2, cropY + cropSize);
    ctx.moveTo(cropX, cropY + third);
    ctx.lineTo(cropX + cropSize, cropY + third);
    ctx.moveTo(cropX, cropY + third * 2);
    ctx.lineTo(cropX + cropSize, cropY + third * 2);
    ctx.stroke();
  }
  
  function handleMouseDown(e) {
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    dragStartX = e.clientX - rect.left;
    dragStartY = e.clientY - rect.top;
    cropStartX = cropX;
    cropStartY = cropY;
  }
  
  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const dx = x - dragStartX;
    const dy = y - dragStartY;
    
    // Move crop area
    cropX = Math.max(0, Math.min(canvasSize - cropSize, cropStartX + dx));
    cropY = Math.max(0, Math.min(canvasSize - cropSize, cropStartY + dy));
    
    draw();
  }
  
  function handleMouseUp() {
    isDragging = false;
  }
  
  function handleWheel(e) {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newScale = Math.max(minScale, Math.min(maxScale, scale + delta));
    
    if (newScale !== scale) {
      scale = newScale;
      
      // Recalculate crop size based on scale
      const minDim = Math.min(image.width, image.height);
      cropSize = Math.min(canvasSize, minDim * scale);
      
      // Keep crop centered
      cropX = Math.max(0, Math.min(canvasSize - cropSize, cropX));
      cropY = Math.max(0, Math.min(canvasSize - cropSize, cropY));
      
      draw();
    }
  }
  
  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }
  
  function handleTouchMove(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }
  
  function handleTouchEnd() {
    handleMouseUp();
  }
  
  function handleZoom(direction) {
    const delta = direction === 'in' ? 0.1 : -0.1;
    const newScale = Math.max(minScale, Math.min(maxScale, scale + delta));
    
    if (newScale !== scale) {
      scale = newScale;
      const minDim = Math.min(image.width, image.height);
      cropSize = Math.min(canvasSize, minDim * scale);
      cropX = Math.max(0, Math.min(canvasSize - cropSize, cropX));
      cropY = Math.max(0, Math.min(canvasSize - cropSize, cropY));
      draw();
    }
  }
  
  async function handleCrop() {
    if (!image || !imageLoaded) return;
    
    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputSize;
    outputCanvas.height = outputSize;
    const outputCtx = outputCanvas.getContext('2d');
    
    // Calculate source coordinates on original image
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;
    const imgX = (canvasSize - scaledWidth) / 2;
    const imgY = (canvasSize - scaledHeight) / 2;
    
    // Source crop coordinates in original image space
    const srcX = (cropX - imgX) / scale;
    const srcY = (cropY - imgY) / scale;
    const srcSize = cropSize / scale;
    
    // Draw cropped area to output canvas
    outputCtx.drawImage(
      image,
      srcX, srcY, srcSize, srcSize,
      0, 0, outputSize, outputSize
    );
    
    // Convert to blob
    outputCanvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
        dispatch('crop', { file, preview: outputCanvas.toDataURL('image/jpeg', 0.9) });
      }
    }, 'image/jpeg', 0.9);
  }
  
  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="cropper-overlay">
  <div class="cropper-modal">
    <div class="cropper-header">
      <h3>Обрезать фото</h3>
      <p>Перетащите область выделения или используйте зум</p>
    </div>
    
    <div class="cropper-container">
      <canvas
        bind:this={canvas}
        width={canvasSize}
        height={canvasSize}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
        on:wheel={handleWheel}
        on:touchstart={handleTouchStart}
        on:touchmove={handleTouchMove}
        on:touchend={handleTouchEnd}
      />
      
      <div class="zoom-controls">
        <button class="zoom-btn" on:click={() => handleZoom('out')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        <input 
          type="range" 
          min={minScale * 100} 
          max={maxScale * 100} 
          value={scale * 100}
          on:input={(e) => { scale = e.target.value / 100; draw(); }}
          class="zoom-slider"
        />
        <button class="zoom-btn" on:click={() => handleZoom('in')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="cropper-actions">
      <button class="cancel-btn" on:click={handleCancel}>Отмена</button>
      <button class="crop-btn" on:click={handleCrop}>Применить</button>
    </div>
  </div>
</div>

<style>
  .cropper-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
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
    max-width: 400px;
    width: 100%;
  }
  
  .cropper-header {
    text-align: center;
    margin-bottom: 1rem;
  }
  
  .cropper-header h3 {
    margin: 0 0 0.25rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary, #f5f6ff);
  }
  
  .cropper-header p {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  }
  
  .cropper-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  canvas {
    border-radius: 0.75rem;
    cursor: move;
    touch-action: none;
    max-width: 100%;
  }
  
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 300px;
  }
  
  .zoom-btn {
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.5rem;
    color: var(--text-primary, #f5f6ff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }
  
  .zoom-btn:hover {
    background: rgba(255, 255, 255, 0.2);
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
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
  }
  
  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #55efc4;
    border-radius: 50%;
    cursor: pointer;
  }
  
  .zoom-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #55efc4;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
  
  .cropper-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  
  .cancel-btn, .crop-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .cancel-btn {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary, #f5f6ff);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  
  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  
  .crop-btn {
    background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
    color: #1a1a2e;
  }
  
  .crop-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(85, 239, 196, 0.4);
  }
</style>
