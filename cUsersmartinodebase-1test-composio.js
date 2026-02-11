// Quick test to see what Composio returns
const { Composio } = require('composio-core');

async function testComposio() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.log('COMPOSIO_API_KEY not set');
    return;
  }
  
  const client = new Composio({ apiKey });
  
  try {
    const apps = await client.apps.list();
    const items = apps.items || apps || [];
    
    // Show first 10 apps to see the format
    console.log('Sample apps:');
    items.slice(0, 10).forEach(app => {
      console.log({
        key: app.key,
        name: app.name,
        appId: app.appId
      });
    });
    
    // Look specifically for People Data Labs
    const pdl = items.find(app => 
      app.key?.toLowerCase().includes('people') || 
      app.name?.toLowerCase().includes('people')
    );
    if (pdl) {
      console.log('\nPeople Data Labs app:', JSON.stringify(pdl, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testComposio();
