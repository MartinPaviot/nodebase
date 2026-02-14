import type { NodeExecutor } from "@/features/executions/types";

type GoogleFormTriggerData = Record<string, unknown>;

export const GoogleFormTriggerExecutor: NodeExecutor<GoogleFormTriggerData> = async ({
        nodeId,
        context,
        step,
        publish,
    }) => {
        await publish({ nodeId, status: "loading" });

    const result = await step.run("google-form-trigger", async () => context);

    await publish({ nodeId, status: "success" });

    return result;
};

