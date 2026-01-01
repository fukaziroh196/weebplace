<script>
  import { onMount } from 'svelte';
  import Content from '../components/Content.svelte';
  import { goToPublicProfile } from '../stores/ui';
  import { loadPublicUserByUsername } from '../stores/users';

  export let params = {};

  onMount(async () => {
    const username = params.nickname || params.username;
    if (!username) return;
    const u = await loadPublicUserByUsername(username).catch(() => null);
    if (u?.id) {
      goToPublicProfile(u.id);
    }
  });
</script>

<Content />

