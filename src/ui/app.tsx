// The app shell. Step 3 replaces this with the top bar, tabs and capture bar.
// For now it's a visual check that LooseLeaf and Mep's tokens are loaded:
// system font, 17 px body text, a burnt-orange primary button, and dark mode
// when the phone is set to dark.
export function App() {
  return (
    <main class="center flow">
      <h1>Mep</h1>
      <p>Chef's notebook and prep planner.</p>
      <button class="button" type="button" data-variant="primary">
        Primary action
      </button>
    </main>
  );
}
