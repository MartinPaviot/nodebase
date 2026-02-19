# @elevay/queue

BullMQ-based job queue system for Elevay (replaces Inngest).

## Features

- ✅ Type-safe job queues with BullMQ
- ✅ Graceful shutdown (30s timeout) - Pattern #8
- ✅ Retry logic with exponential backoff
- ✅ Workflow execution queue
- ✅ Job monitoring and error handling
- ✅ Redis-backed persistence

## Installation

```bash
pnpm add @elevay/queue
```

## Usage

### Creating a Queue

```typescript
import { createQueue, addJob } from "@elevay/queue";

const emailQueue = createQueue({ name: "emails" });

await addJob(emailQueue, "send-welcome", {
  to: "user@example.com",
  template: "welcome"
}, {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000
  }
});
```

### Creating a Worker

```typescript
import { createWorker } from "@elevay/queue";

const worker = createWorker("emails", async (job) => {
  const { to, template } = job.data;
  await sendEmail(to, template);
  return { sent: true };
}, {
  concurrency: 5
});
```

### Workflow Queue

```typescript
import { executeWorkflow, startWorkflowWorker } from "@elevay/queue";

// Add a workflow to the queue
await executeWorkflow({
  workflowId: "workflow_123",
  userId: "user_456",
  initialData: { trigger: "manual" },
  triggeredBy: "manual"
});

// Start the workflow worker
startWorkflowWorker(async (job) => {
  const { workflowId, userId, initialData } = job.data;
  
  // Your workflow execution logic here
  const result = await executeWorkflowLogic(workflowId, userId, initialData);
  
  return {
    workflowId,
    executionId: result.id,
    status: "success",
    result: result.output
  };
});
```

## Migration from Inngest

### Before (Inngest)

```typescript
import { inngest } from "./inngest/client";

// Send event
await inngest.send({
  name: "workflows/execute.workflow",
  data: { workflowId, initialData }
});

// Define function
export const executeWorkflow = inngest.createFunction(
  { id: "execute-workflow", retries: 3 },
  { event: "workflows/execute.workflow" },
  async ({ event, step }) => {
    const workflow = await step.run("fetch-workflow", async () => {
      return prisma.workflow.findUnique({ where: { id: event.data.workflowId } });
    });
    
    // ...
  }
);
```

### After (BullMQ)

```typescript
import { executeWorkflow, startWorkflowWorker } from "@elevay/queue";

// Add job to queue
await executeWorkflow({
  workflowId,
  initialData
});

// Define worker
startWorkflowWorker(async (job) => {
  const workflow = await prisma.workflow.findUnique({
    where: { id: job.data.workflowId }
  });
  
  // ...
  
  return { workflowId, executionId, status: "success" };
});
```

## Graceful Shutdown

Workers automatically handle SIGTERM and SIGINT signals with a 30-second timeout:

```typescript
import { gracefulShutdown } from "@elevay/queue";

const workers = [emailWorker, workflowWorker];

process.on("SIGTERM", async () => {
  await gracefulShutdown(workers, 30000);
});
```

## Configuration

Environment variables:

```bash
REDIS_URL="redis://localhost:6379"
REDIS_MAX_RETRIES=3
```

See `@elevay/config` for configuration details.
