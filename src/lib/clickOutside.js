// Svelte action: call callback when clicking outside the bound node
export function clickOutside(node, { enabled = true, callback } = {}) {
  const handle = (event) => {
    if (!node.contains(event.target)) {
      callback?.(event);
    }
  };

  function setup() {
    document.addEventListener('mousedown', handle, true);
    document.addEventListener('touchstart', handle, true);
  }

  function teardown() {
    document.removeEventListener('mousedown', handle, true);
    document.removeEventListener('touchstart', handle, true);
  }

  if (enabled) setup();

  return {
    update(params = {}) {
      const shouldEnable = params.enabled ?? true;
      callback = params.callback;
      if (shouldEnable && !enabled) {
        setup();
      } else if (!shouldEnable && enabled) {
        teardown();
      }
      enabled = shouldEnable;
    },
    destroy() {
      teardown();
    }
  };
}















