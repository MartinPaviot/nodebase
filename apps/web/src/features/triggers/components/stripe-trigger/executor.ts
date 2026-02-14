import type { NodeExecutor } from "@/features/executions/types";

type StripeTriggerData = Record<string, unknown>;

export const stripeTriggerExecutor: NodeExecutor<StripeTriggerData> = async ({
        nodeId,
        context,
        step,
        publish,
    }) => {
        await publish({ nodeId, status: "loading" });

    const result = await step.run("stripe-trigger", async () => context);

    await publish({ nodeId, status: "success" });

    return result;
};

