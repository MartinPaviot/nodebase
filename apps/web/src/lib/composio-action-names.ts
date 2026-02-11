/**
 * Format Composio action names for better display
 *
 * Composio returns action names like:
 * - SLACK_SEND_MESSAGE
 * - GOOGLEDRIVE_CREATE_FILE
 * - PEOPLEDATALABS_AUTOCOMPLETE_FIELD_SUGGESTIONS
 *
 * This transforms them to readable names:
 * - Send Message
 * - Create File
 * - Autocomplete Field Suggestions
 */

export function formatComposioActionName(actionName: string): string {
  // Remove common prefixes (app name prefix)
  // Example: "SLACK_SEND_MESSAGE" -> "SEND_MESSAGE"
  const withoutPrefix = removeAppPrefix(actionName);

  // Split by underscores and format
  const words = withoutPrefix
    .split('_')
    .filter(word => word.length > 0)
    .map(word => {
      // Handle common acronyms that should stay uppercase
      const upperWord = word.toUpperCase();
      if (ACRONYMS.has(upperWord)) {
        return upperWord;
      }

      // Capitalize first letter, lowercase rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

  return words.join(' ');
}

/**
 * Remove app name prefix from action names
 * Example: "SLACK_SEND_MESSAGE" -> "SEND_MESSAGE"
 */
function removeAppPrefix(actionName: string): string {
  // Common app prefixes to remove
  const prefixes = [
    'SLACK_',
    'GITHUB_',
    'GMAIL_',
    'GOOGLEDRIVE_',
    'GOOGLECALENDAR_',
    'GOOGLESHEETS_',
    'GOOGLEDOCS_',
    'NOTION_',
    'ASANA_',
    'TRELLO_',
    'JIRA_',
    'LINEAR_',
    'HUBSPOT_',
    'SALESFORCE_',
    'STRIPE_',
    'TWILIO_',
    'ZENDESK_',
    'INTERCOM_',
    'DISCORD_',
    'ZOOM_',
    'PEOPLEDATALABS_',
    'AIRTABLE_',
    'CLICKUP_',
    'MONDAY_',
    'SHOPIFY_',
    'MAILCHIMP_',
    'SENDGRID_',
    'DROPBOX_',
    'BOX_',
    'OUTLOOK_',
    'TEAMS_',
    'ONEDRIVE_',
    'SHAREPOINT_',
  ];

  for (const prefix of prefixes) {
    if (actionName.toUpperCase().startsWith(prefix)) {
      return actionName.slice(prefix.length);
    }
  }

  // If no known prefix, try to detect and remove generic pattern
  // Pattern: APPNAME_ACTION -> ACTION
  const parts = actionName.split('_');
  if (parts.length > 1) {
    // Remove first part if it looks like an app name (all caps, common app)
    return parts.slice(1).join('_');
  }

  return actionName;
}

/**
 * Common acronyms that should stay uppercase
 */
const ACRONYMS = new Set([
  'API',
  'URL',
  'URI',
  'HTTP',
  'HTTPS',
  'REST',
  'JSON',
  'XML',
  'HTML',
  'CSS',
  'SQL',
  'ID',
  'UUID',
  'PDF',
  'CSV',
  'ZIP',
  'CRM',
  'ERP',
  'CMS',
  'AI',
  'ML',
  'NLP',
  'OCR',
  'SMS',
  'MMS',
  'IP',
  'DNS',
  'SSL',
  'TLS',
  'SSH',
  'FTP',
  'SFTP',
  'AWS',
  'GCP',
  'CDN',
  'CEO',
  'CFO',
  'CTO',
  'HR',
  'PR',
  'SEO',
  'SEM',
  'KPI',
  'ROI',
  'SLA',
  'FAQ',
  'UTC',
  'GMT',
]);

/**
 * Get a short description for common action types
 * This can be used as a fallback or enhancement to the action description
 */
export function getActionTypeDescription(actionName: string): string | null {
  const upper = actionName.toUpperCase();

  if (upper.includes('SEND') || upper.includes('POST')) {
    return 'Send or post data';
  }
  if (upper.includes('GET') || upper.includes('FETCH') || upper.includes('LIST')) {
    return 'Retrieve data';
  }
  if (upper.includes('CREATE') || upper.includes('ADD')) {
    return 'Create new item';
  }
  if (upper.includes('UPDATE') || upper.includes('EDIT') || upper.includes('MODIFY')) {
    return 'Update existing item';
  }
  if (upper.includes('DELETE') || upper.includes('REMOVE')) {
    return 'Delete item';
  }
  if (upper.includes('SEARCH') || upper.includes('FIND')) {
    return 'Search for items';
  }
  if (upper.includes('UPLOAD')) {
    return 'Upload file';
  }
  if (upper.includes('DOWNLOAD')) {
    return 'Download file';
  }

  return null;
}
