import { NodeProps} from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { Cursor } from "@phosphor-icons/react";
import { ManualTriggerDialog } from "./dialog";
import { useNodeStatus } from "@/features/executions/hooks/use-node-status";
import { fetchManualTriggerRealtimeToken } from "./actions";

export const ManualTriggerNode = memo((props: NodeProps) => {
    const [dialogOpen, setDialogOpen] = useState(false);

        const nodeStatus = useNodeStatus({
            nodeId: props.id,
            channel: "manual-trigger-execution",
            topic: "status",
            refreshToken: fetchManualTriggerRealtimeToken,
        });

    const handleOpenSettings = () => setDialogOpen(true);

    return (
        <>
            <ManualTriggerDialog 
                open={dialogOpen} 
                onOpenChange={setDialogOpen}
            />
            <BaseTriggerNode 
                {...props}
                icon={Cursor}
                name="When clicking `Execute workflow`"
                status={nodeStatus} 
                onSettings={handleOpenSettings} 
                onDoubleClick={handleOpenSettings}   
            />
        </>
    )
});