<script>
  import { onMount } from 'svelte';
  import Content from '../components/Content.svelte';
  import { activeView } from '../stores/ui';

  onMount(() => {
    activeView.set('home');
  });
</script>

<Content />

