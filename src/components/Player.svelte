<script>
  import { onDestroy, onMount } from 'svelte';
  import Hls from 'hls.js';
  import { isPlayerOpen, currentItem, currentStreams, isLoadingStreams, closePlayer, currentVariants, selectedVariant } from '../stores/player';

  let videoEl;
  let hls;
  const isDev = (typeof window !== 'undefined') && (import.meta?.env?.DEV === true);

  function createProxyingLoader() {
    if (!isDev) return null; // only in Vite dev server
    try {
      const BaseLoader = Hls?.DefaultConfig?.loader;
      if (!BaseLoader) return null;
      return class ProxyLoader extends BaseLoader {
        load(context, config, callbacks) {
          try {
            const url = String(context?.url || '');
            if (/^https?:/i.test(url)) {
              context.url = `/proxy?url=${encodeURIComponent(url)}`;
            }
          } catch (_) {}
          return super.load(context, config, callbacks);
        }
      };
    } catch (_) { return null; }
  }

  function setupPlayer() {
    if (!videoEl) return;
    const streams = $currentStreams;
    if (!streams || !streams.length) return;
    const stream = streams[0];
    const headers = stream?.headers || {};

    if (stream.type === 'hls') {
      if (Hls.isSupported()) {
        hls?.destroy?.();
        const Loader = createProxyingLoader();
        hls = new Hls({
          xhrSetup: (xhr) => {
            try {
              for (const [k, v] of Object.entries(headers)) {
                try { xhr.setRequestHeader(k, String(v)); } catch (_) {}
              }
            } catch (_) {}
          },
          ...(Loader ? { loader: Loader } : {})
        });
        try { videoEl.muted = true; } catch (_) {}
        hls.on(Hls.Events.MANIFEST_PARSED, async () => {
          try { await videoEl.play(); } catch (_) {}
        });
        hls.loadSource(stream.url);
        hls.attachMedia(videoEl);
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS branch (Safari). Direct URL may be blocked by CORS for segments in dev;
        // rely on desktop runtime for this path.
        videoEl.src = stream.url;
        try { videoEl.play?.(); } catch (_) {}
      }
    } else {
      try { videoEl.muted = true; } catch (_) {}
      const directUrl = String(stream.url || '');
      const finalUrl = (isDev && /^https?:/i.test(directUrl))
        ? `/proxy?url=${encodeURIComponent(directUrl)}`
        : directUrl;
      videoEl.src = finalUrl;
      try { videoEl.play?.(); } catch (_) {}
    }
  }

  onMount(() => {
    const unsub = currentStreams.subscribe(() => setupPlayer());
    return () => {
      unsub?.();
      hls?.destroy?.();
    };
  });

  onDestroy(() => {
    hls?.destroy?.();
  });
</script>

{#if $isPlayerOpen}
  <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
    <div class="bg-neutral-900 rounded-xl w-[960px] max-w-[95vw] p-4 relative">
      <button class="absolute -top-2 -right-2 bg-pink-700 text-white rounded-full w-8 h-8" on:click={closePlayer}>✕</button>
      <h3 class="text-white font-semibold mb-2">{$currentItem?.title}</h3>
      {#if $currentVariants.length > 1}
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          {#each $currentVariants as v, i}
            <button class="px-3 py-1 rounded-full text-xs font-semibold {i === $selectedVariant ? 'bg-pink-700 text-white' : 'bg-white/10 text-white/90'}" on:click={() => { selectedVariant.set(i); currentStreams.set(v.streams || []); }}>
              {v.dub}
            </button>
          {/each}
        </div>
      {/if}
      {#if $isLoadingStreams}
        <div class="text-white/80">Загрузка потоков…</div>
      {:else if $currentStreams.length}
        <video bind:this={videoEl} class="w-full h-[540px] bg-black" controls playsinline></video>
      {:else}
        <div class="text-white/80">Потоки не найдены</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  video { outline: none; }
  button { outline: none; }
  button:focus { outline: none; }
  .fixed { backdrop-filter: blur(2px); }
  .bg-neutral-900 { background: rgba(20,20,20,0.98); }
  .text-white\/80 { color: rgba(255,255,255,0.8); }
  .bg-black\/80 { background-color: rgba(0,0,0,0.8); }
  .bg-pink-700 { background-color: #f59e0b; }
</style>











