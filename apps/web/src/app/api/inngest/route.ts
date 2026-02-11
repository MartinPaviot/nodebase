import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { executeWorkflow } from "@/inngest/functions";

// Create an API that serves workflow execution
// LangChain jobs (insights, optimization, proposals) now use BullMQ
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    executeWorkflow,
  ],
});