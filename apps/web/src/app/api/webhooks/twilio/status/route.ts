import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { mapTwilioStatus } from "@/lib/integrations/twilio";
import { CallStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const duration = formData.get("CallDuration") as string | null;
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;

    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    const mappedStatus = mapTwilioStatus(callStatus);

    // Find and update call by Twilio Call SID
    const existingCall = await prisma.phoneCall.findUnique({
      where: { twilioCallSid: callSid },
    });

    if (existingCall) {
      // Update existing call
      await prisma.phoneCall.update({
        where: { id: existingCall.id },
        data: {
          status: mappedStatus as CallStatus,
          duration: duration ? parseInt(duration, 10) : undefined,
          endedAt:
            callStatus === "completed" || callStatus === "failed" || callStatus === "no-answer"
              ? new Date()
              : undefined,
        },
      });
    } else {
      // This might be a call we haven't logged yet
      // Try to find the phone number and create a record
      const agentPhone = await prisma.agentPhoneNumber.findFirst({
        where: {
          OR: [{ phoneNumber: to }, { phoneNumber: from }],
        },
      });

      if (agentPhone) {
        await prisma.phoneCall.create({
          data: {
            phoneNumberId: agentPhone.id,
            direction: agentPhone.phoneNumber === from ? "OUTBOUND" : "INBOUND",
            fromNumber: from,
            toNumber: to,
            status: mappedStatus as CallStatus,
            twilioCallSid: callSid,
            duration: duration ? parseInt(duration, 10) : undefined,
            endedAt:
              callStatus === "completed" || callStatus === "failed" || callStatus === "no-answer"
                ? new Date()
                : undefined,
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error handling Twilio status webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
