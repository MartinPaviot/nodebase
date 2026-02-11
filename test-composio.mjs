// Quick test to see what Composio returns
import { Composio } from 'composio-core';

async function testComposio() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.log('COMPOSIO_API_KEY not set');
    process.exit(1);
  }

  const client = new Composio({ apiKey });

  try {
    console.log('Fetching apps from Composio...');
    const apps = await client.apps.list();
    const items = apps.items || apps || [];

    console.log(`\nTotal apps: ${items.length}`);

    // Show first 15 apps to see the format
    console.log('\n=== Sample apps (first 15) ===');
    items.slice(0, 15).forEach((app, i) => {
      console.log(`${i + 1}. key: "${app.key}", name: "${app.name}"`);
    });

    // Look specifically for People Data Labs
    const pdl = items.find(app =>
      app.key?.toLowerCase().includes('people') ||
      app.name?.toLowerCase().includes('people')
    );
    if (pdl) {
      console.log('\n=== People Data Labs app ===');
      console.log(JSON.stringify(pdl, null, 2));
    }

    // Look for other common apps
    const commonApps = ['hubspot', 'google', 'slack', 'github', 'salesforce'];
    console.log('\n=== Common apps ===');
    commonApps.forEach(appKey => {
      const app = items.find(a => a.key?.toLowerCase() === appKey);
      if (app) {
        console.log(`${appKey}: name="${app.name}"`);
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testComposio();
