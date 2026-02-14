import { NodeProps} from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { GoogleFormTriggerDialog } from "./dialog";
import { useNodeStatus } from "@/features/executions/hooks/use-node-status";
import { fetchGoogleFormTriggerRealtimeToken } from "./actions";

export const GoogleFormTrigger = memo((props: NodeProps) => {
    const [dialogOpen, setDialogOpen] = useState(false);

        const nodeStatus = useNodeStatus({
                    nodeId: props.id,
                    channel: "google-form-trigger-execution",
                    topic: "status",
                    refreshToken: fetchGoogleFormTriggerRealtimeToken,
                });

    const handleOpenSettings = () => setDialogOpen(true);

    return (
        <>
            <GoogleFormTriggerDialog 
                open={dialogOpen} 
                onOpenChange={setDialogOpen}
            />
            <BaseTriggerNode 
                {...props}
                icon="/logos/googleform.svg"
                name="Google Form"
                description="When form is submitted"
                status={nodeStatus} 
                onSettings={handleOpenSettings} 
                onDoubleClick={handleOpenSettings}   
            />
        </>
    )
});