/**
 * Official app names mapping for Composio integrations
 *
 * This file contains the properly formatted display names for Composio apps.
 * All names are based on official branding and capitalization.
 *
 * Source: Composio returns app names in lowercase without proper formatting.
 * This mapping ensures we display the correct brand names.
 */

export const COMPOSIO_APP_NAMES: Record<string, string> = {
  // ============================================
  // AI & LLM Tools
  // ============================================
  openai: "OpenAI",
  anthropic: "Anthropic",
  cohere: "Cohere",
  huggingface: "Hugging Face",
  replicate: "Replicate",
  stabilityai: "Stability AI",
  elevenlabs: "ElevenLabs",
  assembly: "AssemblyAI",
  deepgram: "Deepgram",
  perplexityai: "Perplexity AI",
  "perplexity-ai": "Perplexity AI",
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  midjourney: "Midjourney",
  runway: "Runway",

  // ============================================
  // Google Workspace
  // ============================================
  gmail: "Gmail",
  googlecalendar: "Google Calendar",
  googledrive: "Google Drive",
  googledocs: "Google Docs",
  googlesheets: "Google Sheets",
  googleslides: "Google Slides",
  googleforms: "Google Forms",
  googlemeet: "Google Meet",
  googlechat: "Google Chat",
  googlecontacts: "Google Contacts",
  googletasks: "Google Tasks",
  googleanalytics: "Google Analytics",
  googlesearch: "Google Search",
  googleads: "Google Ads",
  googlemaps: "Google Maps",
  youtube: "YouTube",

  // ============================================
  // Microsoft 365
  // ============================================
  outlook: "Outlook",
  microsoftoutlook: "Microsoft Outlook",
  microsoftteams: "Microsoft Teams",
  microsoftexcel: "Microsoft Excel",
  microsoftword: "Microsoft Word",
  microsoftpowerpoint: "Microsoft PowerPoint",
  microsoftonedrive: "Microsoft OneDrive",
  microsoftsharepoint: "Microsoft SharePoint",
  microsoftonenote: "Microsoft OneNote",
  microsofttodo: "Microsoft To Do",
  microsoftplanner: "Microsoft Planner",
  azureopenai: "Azure OpenAI",

  // ============================================
  // Communication & Messaging
  // ============================================
  slack: "Slack",
  discord: "Discord",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  signal: "Signal",
  skype: "Skype",
  zoom: "Zoom",
  webex: "Webex",
  gotomeeting: "GoToMeeting",
  whereby: "Whereby",
  meet: "Google Meet",

  // ============================================
  // CRM & Sales
  // ============================================
  salesforce: "Salesforce",
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
  "close-crm": "Close CRM",
  closecrm: "Close CRM",
  zohocrm: "Zoho CRM",
  "zoho-crm": "Zoho CRM",
  freshsales: "Freshsales",
  copper: "Copper",
  capsulecrm: "Capsule CRM",
  insightly: "Insightly",
  nutshell: "Nutshell",
  "salesforce-sandbox": "Salesforce Sandbox",

  // ============================================
  // Project Management
  // ============================================
  asana: "Asana",
  trello: "Trello",
  jira: "Jira",
  linear: "Linear",
  clickup: "ClickUp",
  monday: "Monday.com",
  mondaycom: "Monday.com",
  basecamp: "Basecamp",
  wrike: "Wrike",
  smartsheet: "Smartsheet",
  teamwork: "Teamwork",
  height: "Height",
  shortcut: "Shortcut",

  // ============================================
  // Development & Code
  // ============================================
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  codeberg: "Codeberg",
  gitea: "Gitea",

  // ============================================
  // Customer Support
  // ============================================
  zendesk: "Zendesk",
  freshdesk: "Freshdesk",
  intercom: "Intercom",
  helpscout: "Help Scout",
  "help-scout": "Help Scout",
  helpscoutdocs: "Help Scout Docs",
  gorgias: "Gorgias",
  "front-app": "Front",
  front: "Front",
  kustomer: "Kustomer",

  // ============================================
  // Marketing & Email
  // ============================================
  mailchimp: "Mailchimp",
  sendgrid: "SendGrid",
  constantcontact: "Constant Contact",
  activecampaign: "ActiveCampaign",
  convertkit: "ConvertKit",
  "get-response": "GetResponse",
  getresponse: "GetResponse",
  klaviyo: "Klaviyo",
  sendinblue: "Sendinblue",
  brevo: "Brevo",
  customerio: "Customer.io",
  "customer-io": "Customer.io",

  // ============================================
  // HR & Recruiting
  // ============================================
  bamboohr: "BambooHR",
  workable: "Workable",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  breezyhr: "BreezyHR",
  "breezy-hr": "BreezyHR",
  recruitee: "Recruitee",

  // ============================================
  // Accounting & Finance
  // ============================================
  quickbooks: "QuickBooks",
  "quickbooks-online": "QuickBooks Online",
  xero: "Xero",
  stripe: "Stripe",
  paypal: "PayPal",
  square: "Square",
  braintree: "Braintree",
  plaid: "Plaid",
  chargebee: "Chargebee",
  recurly: "Recurly",

  // ============================================
  // E-commerce
  // ============================================
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  bigcommerce: "BigCommerce",
  magento: "Magento",
  prestashop: "PrestaShop",
  squarespace: "Squarespace",

  // ============================================
  // Productivity & Notes
  // ============================================
  notion: "Notion",
  evernote: "Evernote",
  onenote: "OneNote",
  bear: "Bear",
  simplenote: "Simplenote",
  standardnotes: "Standard Notes",
  obsidian: "Obsidian",
  roam: "Roam Research",

  // ============================================
  // Database & Spreadsheets
  // ============================================
  airtable: "Airtable",
  smartsheet: "Smartsheet",
  "google-sheets": "Google Sheets",
  coda: "Coda",

  // ============================================
  // Storage & Cloud
  // ============================================
  dropbox: "Dropbox",
  box: "Box",
  onedrive: "OneDrive",
  "google-drive": "Google Drive",

  // ============================================
  // Social Media
  // ============================================
  twitter: "Twitter",
  "x-twitter": "X (Twitter)",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  reddit: "Reddit",
  mastodon: "Mastodon",

  // ============================================
  // Scheduling & Calendars
  // ============================================
  calendly: "Calendly",
  cal: "Cal.com",
  "cal-com": "Cal.com",
  calcom: "Cal.com",
  chili: "Chili Piper",
  "chili-piper": "Chili Piper",
  chilipiper: "Chili Piper",

  // ============================================
  // Forms & Surveys
  // ============================================
  typeform: "Typeform",
  jotform: "Jotform",
  surveymonkey: "SurveyMonkey",
  "google-forms": "Google Forms",
  tally: "Tally",

  // ============================================
  // Analytics & Monitoring
  // ============================================
  mixpanel: "Mixpanel",
  amplitude: "Amplitude",
  segment: "Segment",
  posthog: "PostHog",
  plausible: "Plausible",
  fathom: "Fathom Analytics",
  datadog: "Datadog",
  newrelic: "New Relic",
  sentry: "Sentry",

  // ============================================
  // Design & Creative
  // ============================================
  figma: "Figma",
  canva: "Canva",
  sketch: "Sketch",
  invision: "InVision",

  // ============================================
  // Data & APIs
  // ============================================
  peopledatalabs: "People Data Labs",
  clearbit: "Clearbit",
  hunter: "Hunter",
  "apollo-io": "Apollo.io",
  apollo: "Apollo.io",

  // ============================================
  // Automation & Integration
  // ============================================
  zapier: "Zapier",
  make: "Make",
  integromat: "Integromat",
  n8n: "n8n",

  // ============================================
  // Communication Tools
  // ============================================
  twilio: "Twilio",
  vonage: "Vonage",
  "message-bird": "MessageBird",
  messagebird: "MessageBird",

  // ============================================
  // Content Management
  // ============================================
  wordpress: "WordPress",
  contentful: "Contentful",
  sanity: "Sanity",
  strapi: "Strapi",
  ghost: "Ghost",
  medium: "Medium",

  // ============================================
  // Other Popular Apps
  // ============================================
  drift: "Drift",
  loom: "Loom",
  miro: "Miro",
  mural: "Mural",
  lucidchart: "Lucidchart",
  whimsical: "Whimsical",
  excalidraw: "Excalidraw",
  firecrawl: "Firecrawl",
  tavily: "Tavily",
  serpapi: "SerpApi",
  "serp-api": "SerpApi",
  giphy: "Giphy",
  unsplash: "Unsplash",
  pexels: "Pexels",
  cloudflare: "Cloudflare",
  vercel: "Vercel",
  netlify: "Netlify",
  supabase: "Supabase",
  firebase: "Firebase",
  aws: "AWS",
  gcp: "Google Cloud Platform",
  azure: "Microsoft Azure",
  heroku: "Heroku",
  digitalocean: "DigitalOcean",
  linode: "Linode",
  codeinterpreter: "Code Interpreter",
  yelp: "Yelp",
  cal: "Cal",
  "wrike-app": "Wrike",
  slackbot: "Slackbot",
  canvas: "Canvas",
  elevenlabs: "ElevenLabs",
  snowflake: "Snowflake",
  "cloud-data-warehouse": "Snowflake",
  clicksend: "ClickSend",
  youtube: "YouTube",
  vimeo: "Vimeo",
  wistia: "Wistia",
  luma: "Luma",
  figma: "Figma",
  airtable: "Airtable",
  reddit: "Reddit",
  "y-combinator": "Y Combinator",
  hackernews: "Hacker News",
  "hacker-news": "Hacker News",
  producthunt: "Product Hunt",
  "product-hunt": "Product Hunt",
  strava: "Strava",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
};

/**
 * Get the properly formatted name for a Composio app
 * Uses smart fallback for apps not in the mapping
 */
export function getComposioAppName(appKey: string): string {
  const lowerKey = appKey.toLowerCase();

  // Check for exact match first
  if (COMPOSIO_APP_NAMES[lowerKey]) {
    return COMPOSIO_APP_NAMES[lowerKey];
  }

  // Smart fallback for unmapped apps
  return smartFormatFallback(appKey);
}

/**
 * Smart fallback formatting for unmapped apps
 * Handles common patterns intelligently
 */
function smartFormatFallback(name: string): string {
  // Handle hyphens and underscores - split and capitalize
  if (name.includes('-') || name.includes('_')) {
    return name
      .split(/[-_]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Handle common suffixes that should be separate words
  const suffixPatterns = [
    { suffix: 'api', replacement: ' API' },
    { suffix: 'ai', replacement: ' AI' },
    { suffix: 'crm', replacement: ' CRM' },
    { suffix: 'cms', replacement: ' CMS' },
    { suffix: 'io', replacement: '.io' },
    { suffix: 'app', replacement: ' App' },
  ];

  for (const { suffix, replacement } of suffixPatterns) {
    if (name.toLowerCase().endsWith(suffix)) {
      const base = name.slice(0, -suffix.length);
      return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase() + replacement;
    }
  }

  // Default: just capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
