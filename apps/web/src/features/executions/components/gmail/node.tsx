"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { GmailDialog, type GmailFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchGmailRealtimeToken } from "./actions";

type GmailNodeData = {
    variableName?: string;
    requireConfirmation?: boolean;
    toSource?: "external_attendee" | "manual";
    bccSource?: "user_email" | "none";
    subjectTemplate?: string;
    bodyPrompt?: string;
    saveDraft?: boolean;
};

type GmailNodeType = Node<GmailNodeData>;

export const GmailNode = memo((props: NodeProps<GmailNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({
        nodeId: props.id,
        channel: "gmail-execution",
        topic: "status",
        refreshToken: fetchGmailRealtimeToken,
    });

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: GmailFormValues) => {
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
    const description = nodeData?.bodyPrompt
        ? `Email: ${nodeData.bodyPrompt.slice(0, 50)}...`
        : "Not configured";

    return (
        <>
            <GmailDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                id={props.id}
                icon="/logos/google.svg"
                name="Gmail"
                status={nodeStatus}
                description={description}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});

GmailNode.displayName = "GmailNode";
