import type { NodeExecutor } from "@/features/executions/types";

type ManualTriggerData = Record<string, unknown>;

export const manualTriggerExecutor: NodeExecutor<ManualTriggerData> = async ({
        nodeId,
        context,
        step,
        publish,
    }) => {
        await publish({ nodeId, status: "loading" });

    const result = await step.run("manual-trigger", async () => context);

    await publish({ nodeId, status: "success" });

    return result;
};

