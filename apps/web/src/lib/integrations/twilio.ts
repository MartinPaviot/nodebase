import prisma from "../db";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

// Base64 encode for Basic Auth
function getAuthHeader() {
  const credentials = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

// Twilio REST API base URL
const TWILIO_API_BASE = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;

interface TwilioPhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  region: string;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
  };
}

interface TwilioIncomingPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  voiceUrl: string;
  statusCallback: string;
}

interface TwilioCall {
  sid: string;
  status: string;
  direction: string;
  from: string;
  to: string;
  duration: string;
}

/**
 * Search for available phone numbers in a specific area code
 */
export async function searchAvailableNumbers(
  country = "US",
  areaCode?: string,
  limit = 5
): Promise<TwilioPhoneNumber[]> {
  const params = new URLSearchParams({
    VoiceEnabled: "true",
    ...(areaCode && { AreaCode: areaCode }),
    PageSize: limit.toString(),
  });

  const response = await fetch(
    `${TWILIO_API_BASE}/AvailablePhoneNumbers/${country}/Local.json?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: getAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to search available numbers");
  }

  const data = await response.json();
  return data.available_phone_numbers.map(
    (num: any) => ({
      phoneNumber: num.phone_number,
      friendlyName: num.friendly_name,
      region: num.region,
      capabilities: {
        voice: num.capabilities?.voice ?? false,
        SMS: num.capabilities?.SMS ?? false,
        MMS: num.capabilities?.MMS ?? false,
      },
    })
  );
}

/**
 * Purchase a phone number and assign it to an agent
 */
export async function purchasePhoneNumber(
  agentId: string,
  areaCode?: string
) {
  // Search for available numbers
  const numbers = await searchAvailableNumbers("US", areaCode, 1);

  if (numbers.length === 0) {
    throw new Error("No phone numbers available");
  }

  const phoneNumber = numbers[0].phoneNumber;

  // Purchase the number
  const response = await fetch(`${TWILIO_API_BASE}/IncomingPhoneNumbers.json`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      PhoneNumber: phoneNumber,
      VoiceUrl: `${APP_URL}/api/webhooks/twilio/voice`,
      VoiceMethod: "POST",
      StatusCallback: `${APP_URL}/api/webhooks/twilio/status`,
      StatusCallbackMethod: "POST",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to purchase phone number");
  }

  const purchased: TwilioIncomingPhoneNumber = await response.json();

  // Save to database
  return prisma.agentPhoneNumber.create({
    data: {
      agentId,
      phoneNumber: purchased.phoneNumber,
      twilioSid: purchased.sid,
    },
  });
}

/**
 * Make an outbound call from an agent
 */
export async function makeOutboundCall(
  agentId: string,
  toNumber: string,
  message: string
) {
  const agentPhone = await prisma.agentPhoneNumber.findUnique({
    where: { agentId },
  });

  if (!agentPhone) {
    throw new Error("Agent has no phone number");
  }

  // Create TwiML for the call
  const twiml = `<Response><Say voice="Polly.Amy">${escapeXml(message)}</Say></Response>`;

  const response = await fetch(`${TWILIO_API_BASE}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: toNumber,
      From: agentPhone.phoneNumber,
      Twiml: twiml,
      StatusCallback: `${APP_URL}/api/webhooks/twilio/status`,
      StatusCallbackMethod: "POST",
      StatusCallbackEvent: ["initiated", "ringing", "answered", "completed"].join(" "),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to make outbound call");
  }

  const call: TwilioCall = await response.json();

  // Log the call
  await prisma.phoneCall.create({
    data: {
      phoneNumberId: agentPhone.id,
      direction: "OUTBOUND",
      fromNumber: agentPhone.phoneNumber,
      toNumber,
      status: "INITIATED",
      twilioCallSid: call.sid,
    },
  });

  return call;
}

/**
 * Make an outbound call with interactive conversation capability
 */
export async function makeOutboundCallWithConversation(
  agentId: string,
  toNumber: string,
  greeting: string
) {
  const agentPhone = await prisma.agentPhoneNumber.findUnique({
    where: { agentId },
    include: { agent: true },
  });

  if (!agentPhone) {
    throw new Error("Agent has no phone number");
  }

  // Create TwiML that starts a conversation (gather speech input)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" action="${APP_URL}/api/webhooks/twilio/voice?agentId=${agentId}" method="POST">
    <Say voice="Polly.Amy">${escapeXml(greeting)}</Say>
  </Gather>
  <Say voice="Polly.Amy">I didn't catch that. Goodbye.</Say>
  <Hangup/>
</Response>`;

  const response = await fetch(`${TWILIO_API_BASE}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: toNumber,
      From: agentPhone.phoneNumber,
      Twiml: twiml,
      StatusCallback: `${APP_URL}/api/webhooks/twilio/status`,
      StatusCallbackMethod: "POST",
      StatusCallbackEvent: ["initiated", "ringing", "answered", "completed"].join(" "),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to make outbound call");
  }

  const call: TwilioCall = await response.json();

  // Log the call
  await prisma.phoneCall.create({
    data: {
      phoneNumberId: agentPhone.id,
      direction: "OUTBOUND",
      fromNumber: agentPhone.phoneNumber,
      toNumber,
      status: "INITIATED",
      twilioCallSid: call.sid,
    },
  });

  return call;
}

/**
 * Release (delete) a phone number
 */
export async function releasePhoneNumber(agentId: string) {
  const agentPhone = await prisma.agentPhoneNumber.findUnique({
    where: { agentId },
  });

  if (!agentPhone) {
    throw new Error("Agent has no phone number");
  }

  // Release from Twilio
  const response = await fetch(
    `${TWILIO_API_BASE}/IncomingPhoneNumbers/${agentPhone.twilioSid}.json`,
    {
      method: "DELETE",
      headers: {
        Authorization: getAuthHeader(),
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    throw new Error(error.message || "Failed to release phone number");
  }

  // Delete from database
  await prisma.agentPhoneNumber.delete({
    where: { id: agentPhone.id },
  });
}

/**
 * Update phone number settings (voiceUrl, etc.)
 */
export async function updatePhoneNumberSettings(
  agentId: string,
  settings: { voiceEnabled?: boolean; voiceGreeting?: string }
) {
  const agentPhone = await prisma.agentPhoneNumber.findUnique({
    where: { agentId },
  });

  if (!agentPhone) {
    throw new Error("Agent has no phone number");
  }

  // Update in database
  return prisma.agentPhoneNumber.update({
    where: { id: agentPhone.id },
    data: {
      ...(settings.voiceEnabled !== undefined && {
        voiceEnabled: settings.voiceEnabled,
      }),
      ...(settings.voiceGreeting !== undefined && {
        voiceGreeting: settings.voiceGreeting,
      }),
    },
  });
}

/**
 * Get call history for an agent
 */
export async function getCallHistory(
  agentId: string,
  page = 1,
  pageSize = 20
) {
  const agentPhone = await prisma.agentPhoneNumber.findUnique({
    where: { agentId },
  });

  if (!agentPhone) {
    return { items: [], totalCount: 0 };
  }

  const [items, totalCount] = await Promise.all([
    prisma.phoneCall.findMany({
      where: { phoneNumberId: agentPhone.id },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.phoneCall.count({
      where: { phoneNumberId: agentPhone.id },
    }),
  ]);

  return { items, totalCount };
}

/**
 * Utility function to escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate TwiML response for voice conversations
 */
export function generateTwiml(
  message: string,
  continueConversation = true,
  agentId?: string
): string {
  if (continueConversation && agentId) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" action="${APP_URL}/api/webhooks/twilio/voice?agentId=${agentId}" method="POST">
    <Say voice="Polly.Amy">${escapeXml(message)}</Say>
  </Gather>
  <Say voice="Polly.Amy">Thank you for calling. Goodbye.</Say>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Map Twilio call status to our CallStatus enum
 */
export function mapTwilioStatus(twilioStatus: string): string {
  const statusMap: Record<string, string> = {
    queued: "INITIATED",
    initiated: "INITIATED",
    ringing: "RINGING",
    "in-progress": "IN_PROGRESS",
    completed: "COMPLETED",
    busy: "FAILED",
    failed: "FAILED",
    "no-answer": "NO_ANSWER",
    canceled: "FAILED",
  };
  return statusMap[twilioStatus] || "INITIATED";
}
