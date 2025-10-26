<script>
  import { clickOutside } from '../lib/clickOutside';
  export let onSelect = (type) => {};
  export let currentType = null; // 'wishlist' | 'watched' | 'dropped' | null
  let open = false;
  function select(type) {
    onSelect?.(type);
    open = false;
  }
  const labelFor = { wishlist: 'Желаемое', watched: 'Просмотрено', dropped: 'Брошено' };
</script>

<div class="relative" use:clickOutside={{ enabled: true, callback: () => open = false }}>
  <button class="rounded-full px-3 py-2 text-sm font-semibold menu-surface hover:bg-white/10" on:click={() => open = !open}>
    {labelFor[currentType] || 'Добавить в список'}
  </button>
  {#if open}
    <div class="absolute left-0 mt-2 rounded-xl overflow-hidden z-20 min-w-[180px] menu-surface p-2">
      <button class="w-full text-left menu-item" on:click={() => select('wishlist')}>Желаемое</button>
      <button class="w-full text-left menu-item" on:click={() => select('watched')}>Просмотрено</button>
      <button class="w-full text-left menu-item" on:click={() => select('dropped')}>Брошено</button>
    </div>
  {/if}
</div>


