"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { CalendarBlank } from "@phosphor-icons/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { CalendarTriggerDialog, type CalendarTriggerFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchCalendarTriggerRealtimeToken } from "./actions";

type CalendarTriggerNodeData = {
    variableName?: string;
    minutesOffset?: number;
    restrictByAttendee?: "all" | "external_only" | "internal_only";
};

type CalendarTriggerNodeType = Node<CalendarTriggerNodeData>;

export const CalendarTriggerNode = memo((props: NodeProps<CalendarTriggerNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({
        nodeId: props.id,
        channel: "calendar-trigger-execution",
        topic: "status",
        refreshToken: fetchCalendarTriggerRealtimeToken,
    });

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: CalendarTriggerFormValues) => {
        setNodes((nodes) => nodes.map((node) => {
            if (node.id === props.id) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ...values,
                    }
                };
            }
            return node;
        }));
    };

    const nodeData = props.data;
    const description = nodeData?.minutesOffset != null
        ? `${nodeData.minutesOffset}min before meeting`
        : "Not configured";

    return (
        <>
            <CalendarTriggerDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                id={props.id}
                icon={CalendarBlank}
                name="Calendar Trigger"
                status={nodeStatus}
                description={description}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});

CalendarTriggerNode.displayName = "CalendarTriggerNode";
