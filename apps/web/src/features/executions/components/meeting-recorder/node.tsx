"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { VideoCamera } from "@phosphor-icons/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { MeetingRecorderDialog, type MeetingRecorderFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchMeetingRecorderRealtimeToken } from "./actions";

type MeetingRecorderNodeData = {
    variableName?: string;
    botName?: string;
    meetingUrlSource?: "calendarEvent" | "context" | "manual";
    joinMessage?: string;
};

type MeetingRecorderNodeType = Node<MeetingRecorderNodeData>;

export const MeetingRecorderNode = memo((props: NodeProps<MeetingRecorderNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({
        nodeId: props.id,
        channel: "meeting-recorder-execution",
        topic: "status",
        refreshToken: fetchMeetingRecorderRealtimeToken,
    });

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: MeetingRecorderFormValues) => {
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
    const description = nodeData?.botName
        ? `Bot: ${nodeData.botName}`
        : "Not configured";

    return (
        <>
            <MeetingRecorderDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                id={props.id}
                icon={VideoCamera}
                name="Meeting Recorder"
                status={nodeStatus}
                description={description}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});

MeetingRecorderNode.displayName = "MeetingRecorderNode";
