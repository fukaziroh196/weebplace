<script>
  import { currentUser, watched, wishlist, dropped, ratings } from '../stores/auth';
  import { goToDetails } from '../stores/ui';
</script>

<div class="mt-4">
  <h1 class="text-2xl font-bold text-white mb-4">Мои списки</h1>
  {#if !$currentUser}
    <div class="text-white/80">Войдите, чтобы просматривать списки.</div>
  {:else}
    <div class="flex flex-col gap-8">
      <div>
        <h2 class="text-white font-semibold mb-2">Желаемое</h2>
        {#if $wishlist.length}
          <div class="flex flex-col gap-2">
            {#each $wishlist as it}
              <div class="bg-pink-900/40 rounded-xl p-3 pr-4 flex items-center gap-3 hover:bg-pink-900/50 transition-colors">
                {#if it.image}
                  <img src={it.image} alt={it.title} class="w-12 h-16 object-cover rounded" />
                {/if}
                <button class="text-left text-white truncate hover:underline" on:click={() => goToDetails({ id: it.id, __sourceId: 'shikimori', title: it.title, image: it.image })}>{it.title}</button>
                <span class="ml-auto mr-1"></span>
                {#if $ratings[it.id]}
                  <span class="rounded-full px-3 py-1 text-sm font-bold shadow-sm" style="background: rgba(255,255,255,0.95); color: #8e2a8e; border: 1px solid rgba(0,0,0,0.05);">{$ratings[it.id]}</span>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-white/70">Пусто</div>
        {/if}
      </div>

      <div>
        <h2 class="text-white font-semibold mb-2">Просмотренное</h2>
        {#if $watched.length}
          <div class="flex flex-col gap-2">
            {#each $watched as it}
              <div class="bg-pink-900/40 rounded-xl p-3 pr-4 flex items-center gap-3 hover:bg-pink-900/50 transition-colors">
                {#if it.image}
                  <img src={it.image} alt={it.title} class="w-12 h-16 object-cover rounded" />
                {/if}
                <button class="text-left text-white truncate hover:underline" on:click={() => goToDetails({ id: it.id, __sourceId: 'shikimori', title: it.title, image: it.image })}>{it.title}</button>
                <span class="ml-auto mr-1"></span>
                <span class="rounded-full px-3 py-1 text-sm font-bold shadow-sm" style="background: rgba(255,255,255,0.95); color: #8e2a8e; border: 1px solid rgba(0,0,0,0.05);">{$ratings[it.id] ?? '-'}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-white/70">Пусто</div>
        {/if}
      </div>

      <div>
        <h2 class="text-white font-semibold mb-2">Брошенное</h2>
        {#if $dropped.length}
          <div class="flex flex-col gap-2">
            {#each $dropped as it}
              <div class="bg-pink-900/40 rounded-xl p-3 pr-4 flex items-center gap-3 hover:bg-pink-900/50 transition-colors">
                {#if it.image}
                  <img src={it.image} alt={it.title} class="w-12 h-16 object-cover rounded" />
                {/if}
                <button class="text-left text-white truncate hover:underline" on:click={() => goToDetails({ id: it.id, __sourceId: 'shikimori', title: it.title, image: it.image })}>{it.title}</button>
                <span class="ml-auto mr-1"></span>
                {#if $ratings[it.id]}
                  <span class="rounded-full px-3 py-1 text-sm font-bold shadow-sm" style="background: rgba(255,255,255,0.95); color: #8e2a8e; border: 1px solid rgba(0,0,0,0.05);">{$ratings[it.id]}</span>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-white/70">Пусто</div>
        {/if}
      </div>
    </div>
  {/if}
</div>


