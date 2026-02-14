"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { SlackDMDialog, type SlackDMFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchSlackRealtimeToken } from "../slack/actions";

type SlackDMNodeData = {
    variableName?: string;
    target?: "user_dm" | "channel";
    channelId?: string;
    messageTemplate?: "auto" | "custom";
    customMessage?: string;
};

type SlackDMNodeType = Node<SlackDMNodeData>;

export const SlackDMNode = memo((props: NodeProps<SlackDMNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({
        nodeId: props.id,
        channel: "slack-execution",
        topic: "status",
        refreshToken: fetchSlackRealtimeToken,
    });

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: SlackDMFormValues) => {
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
    const description = nodeData?.target === "user_dm"
        ? "Send DM to user"
        : nodeData?.target === "channel"
            ? `Channel: ${nodeData.channelId || "Not set"}`
            : "Not configured";

    return (
        <>
            <SlackDMDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                id={props.id}
                icon="/logos/slack.svg"
                name="Slack DM"
                status={nodeStatus}
                description={description}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});

SlackDMNode.displayName = "SlackDMNode";
