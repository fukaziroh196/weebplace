<script>
  import { onMount } from 'svelte';
  import Content from '../components/Content.svelte';
  import { activeView, friendsModalOpen } from '../stores/ui';

  onMount(() => {
    activeView.set('profile');
    friendsModalOpen.set(true);
  });
</script>

<Content />

