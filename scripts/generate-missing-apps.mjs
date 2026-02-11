/**
 * Script pour générer la liste des apps Composio non mappées
 *
 * Usage: node scripts/generate-missing-apps.mjs
 *
 * Ce script va :
 * 1. Récupérer toutes les apps de Composio
 * 2. Identifier celles qui ne sont pas dans composio-app-names.ts
 * 3. Générer un fichier avec les apps manquantes à compléter
 */

import { Composio } from 'composio-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import du mapping existant
const COMPOSIO_APP_NAMES = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  cohere: "Cohere",
  huggingface: "Hugging Face",
  // ... (tous les autres mappings existants)
  // Note: Pour l'import dynamique, on va plutôt parser le fichier
};

async function generateMissingApps() {
  const apiKey = process.env.COMPOSIO_API_KEY;

  if (!apiKey) {
    console.error('❌ COMPOSIO_API_KEY not set in environment variables');
    process.exit(1);
  }

  console.log('🔍 Fetching all apps from Composio...\n');

  const client = new Composio({ apiKey });
  const apps = await client.apps.list();
  const allApps = apps.items || apps || [];

  console.log(`✅ Found ${allApps.length} total apps\n`);

  // Lire le fichier de mapping existant
  const mappingFilePath = path.join(__dirname, '../apps/web/src/lib/composio-app-names.ts');
  const mappingContent = fs.readFileSync(mappingFilePath, 'utf-8');

  // Extraire les clés existantes du mapping
  const existingKeys = new Set();
  const regex = /^\s+(\w+):\s*"([^"]+)",?\s*$/gm;
  let match;
  while ((match = regex.exec(mappingContent)) !== null) {
    existingKeys.add(match[1]);
  }

  console.log(`📋 Found ${existingKeys.size} apps already mapped\n`);

  // Trouver les apps manquantes
  const missingApps = allApps.filter(app => {
    const key = app.key?.toLowerCase();
    return key && !existingKeys.has(key);
  });

  console.log(`🔴 Found ${missingApps.length} apps NOT mapped\n`);

  // Générer le fichier de sortie
  const outputLines = [
    '/**',
    ' * Apps Composio non mappées',
    ` * Généré le: ${new Date().toISOString()}`,
    ` * Total: ${missingApps.length} apps`,
    ' *',
    ' * Pour chaque app, recherchez le nom officiel et ajoutez-le à composio-app-names.ts',
    ' * Format: key: "Official Name",',
    ' */',
    '',
    '// Apps à mapper (triées par ordre alphabétique):',
    '',
  ];

  // Grouper par première lettre pour plus de clarté
  const grouped = {};
  missingApps.forEach(app => {
    const key = app.key?.toLowerCase() || 'unknown';
    const firstLetter = key.charAt(0).toUpperCase();
    if (!grouped[firstLetter]) {
      grouped[firstLetter] = [];
    }
    grouped[firstLetter].push({
      key,
      name: app.name,
      description: app.description?.substring(0, 100) || '',
    });
  });

  // Générer les lignes par groupe
  Object.keys(grouped).sort().forEach(letter => {
    outputLines.push(`// === ${letter} ===`);
    grouped[letter].forEach(app => {
      outputLines.push(`// ${app.key}: "${app.name}" - ${app.description}`);
      outputLines.push(`  ${app.key}: "TODO", // ⚠️ À compléter`);
    });
    outputLines.push('');
  });

  // Sauvegarder
  const outputPath = path.join(__dirname, '../apps-missing.txt');
  fs.writeFileSync(outputPath, outputLines.join('\n'));

  console.log(`\n✅ Fichier généré: ${outputPath}`);
  console.log('\n📝 Prochaines étapes:');
  console.log('1. Ouvrez apps-missing.txt');
  console.log('2. Pour chaque app, recherchez le nom officiel');
  console.log('3. Ajoutez les mappings à composio-app-names.ts');
  console.log('\n💡 Astuce: Commencez par les apps les plus populaires !');
}

generateMissingApps().catch(console.error);
