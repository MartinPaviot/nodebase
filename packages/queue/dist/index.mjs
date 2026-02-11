// src/index.ts
import { Queue, Worker, Job, QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import { NodebaseError } from "@nodebase/types";
var QueueManager = class {
  connection;
  queues = /* @__PURE__ */ new Map();
  workers = /* @__PURE__ */ new Map();
  queueEvents = /* @__PURE__ */ new Map();
  config;
  isShuttingDown = false;
  constructor(config) {
    this.config = config;
    this.connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      // Required for BullMQ
      enableReadyCheck: false
    });
    this.setupGracefulShutdown();
  }
  /**
   * Get or create a queue.
   */
  getQueue(name) {
    if (this.queues.has(name)) {
      return this.queues.get(name);
    }
    const queue = new Queue(name, {
      connection: this.getConnectionOptions(),
      prefix: this.config.prefix ?? "nodebase",
      defaultJobOptions: {
        attempts: this.config.defaultJobOptions?.attempts ?? 3,
        backoff: this.config.defaultJobOptions?.backoff ?? {
          type: "exponential",
          delay: 1e3
        },
        removeOnComplete: this.config.defaultJobOptions?.removeOnComplete ?? 100,
        removeOnFail: this.config.defaultJobOptions?.removeOnFail ?? 500
      }
    });
    this.queues.set(name, queue);
    return queue;
  }
  /**
   * Create a worker for a queue.
   */
  createWorker(queueName, processor, options = {}) {
    if (this.workers.has(queueName)) {
      throw new NodebaseError(
        `Worker for queue ${queueName} already exists`,
        "WORKER_EXISTS"
      );
    }
    const worker = new Worker(
      queueName,
      async (job) => {
        if (this.isShuttingDown) {
          throw new NodebaseError("Worker is shutting down", "SHUTDOWN");
        }
        return processor(job);
      },
      {
        connection: this.getConnectionOptions(),
        prefix: this.config.prefix ?? "nodebase",
        concurrency: options.concurrency ?? 5,
        limiter: options.limiter,
        stalledInterval: 3e4,
        // Check for stalled jobs every 30s
        lockDuration: 6e4
        // Job lock expires after 60s
      }
    );
    worker.on("failed", (job, error) => {
      console.error(`Job ${job?.id} in queue ${queueName} failed:`, error);
    });
    worker.on("error", (error) => {
      console.error(`Worker error in queue ${queueName}:`, error);
    });
    worker.on("stalled", (jobId) => {
      console.warn(`Job ${jobId} in queue ${queueName} has stalled`);
    });
    this.workers.set(queueName, worker);
    return worker;
  }
  /**
   * Add a job to a queue.
   */
  async addJob(queueName, data, options) {
    const queue = this.getQueue(queueName);
    return queue.add(queueName, data, {
      jobId: options?.jobId,
      priority: options?.priority,
      delay: options?.delay,
      repeat: options?.repeat
    });
  }
  /**
   * Add multiple jobs to a queue.
   */
  async addBulk(queueName, jobs) {
    const queue = this.getQueue(queueName);
    return queue.addBulk(
      jobs.map((job) => ({
        name: queueName,
        data: job.data,
        opts: job.opts
      }))
    );
  }
  /**
   * Get queue events for monitoring.
   */
  getQueueEvents(queueName) {
    if (this.queueEvents.has(queueName)) {
      return this.queueEvents.get(queueName);
    }
    const events = new QueueEvents(queueName, {
      connection: this.getConnectionOptions(),
      prefix: this.config.prefix ?? "nodebase"
    });
    this.queueEvents.set(queueName, events);
    return events;
  }
  /**
   * Get job by ID.
   */
  async getJob(queueName, jobId) {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    return job ?? null;
  }
  /**
   * Get queue stats.
   */
  async getQueueStats(queueName) {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);
    return { waiting, active, completed, failed, delayed };
  }
  /**
   * Pause a queue.
   */
  async pauseQueue(queueName) {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }
  /**
   * Resume a queue.
   */
  async resumeQueue(queueName) {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }
  /**
   * Clean old jobs from a queue.
   */
  async cleanQueue(queueName, options = {}) {
    const queue = this.getQueue(queueName);
    return queue.clean(
      options.grace ?? 24 * 60 * 60 * 1e3,
      // 24 hours default
      options.limit ?? 100,
      options.status ?? "completed"
    );
  }
  /**
   * Graceful shutdown - waits for active jobs to complete.
   */
  async shutdown(timeout = 3e4) {
    console.log("Starting graceful shutdown...");
    this.isShuttingDown = true;
    const shutdownPromises = [];
    for (const [name, worker] of this.workers) {
      console.log(`Closing worker for queue: ${name}`);
      shutdownPromises.push(worker.close());
    }
    for (const [name, events] of this.queueEvents) {
      console.log(`Closing queue events for: ${name}`);
      shutdownPromises.push(events.close());
    }
    try {
      await Promise.race([
        Promise.all(shutdownPromises),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Shutdown timeout")), timeout)
        )
      ]);
    } catch (error) {
      console.error("Shutdown error:", error);
    }
    for (const [name, queue] of this.queues) {
      console.log(`Closing queue: ${name}`);
      await queue.close();
    }
    await this.connection.quit();
    console.log("Shutdown complete");
  }
  getConnectionOptions() {
    return this.connection;
  }
  setupGracefulShutdown() {
    const signals = ["SIGTERM", "SIGINT"];
    for (const signal of signals) {
      process.on(signal, async () => {
        console.log(`Received ${signal}, starting graceful shutdown...`);
        await this.shutdown();
        process.exit(0);
      });
    }
  }
};
var _queueManager = null;
function initQueue(config) {
  if (_queueManager) {
    console.warn("Queue manager already initialized, returning existing instance");
    return _queueManager;
  }
  _queueManager = new QueueManager(config);
  return _queueManager;
}
function getQueue() {
  if (!_queueManager) {
    throw new NodebaseError(
      "Queue manager not initialized. Call initQueue() first.",
      "QUEUE_NOT_INITIALIZED"
    );
  }
  return _queueManager;
}
var QUEUES = {
  SCAN: "scan",
  AGENT_EXECUTION: "agent-execution",
  EVAL: "eval",
  NOTIFICATION: "notification",
  EMAIL: "email",
  WEBHOOK: "webhook",
  SCHEDULED: "scheduled"
};
export {
  Job,
  QUEUES,
  Queue,
  QueueEvents,
  QueueManager,
  Worker,
  getQueue,
  initQueue
};
