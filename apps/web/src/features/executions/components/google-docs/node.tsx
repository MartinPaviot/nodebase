"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { GoogleDocsDialog, type GoogleDocsFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchGoogleDocsRealtimeToken } from "./actions";

type GoogleDocsNodeData = {
    variableName?: string;
    template?: "meddpicc" | "generic";
    sharingPreference?: "private" | "anyone_with_link";
    folderId?: string;
};

type GoogleDocsNodeType = Node<GoogleDocsNodeData>;

export const GoogleDocsNode = memo((props: NodeProps<GoogleDocsNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({
        nodeId: props.id,
        channel: "google-docs-execution",
        topic: "status",
        refreshToken: fetchGoogleDocsRealtimeToken,
    });

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: GoogleDocsFormValues) => {
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
    const description = nodeData?.template
        ? `Template: ${nodeData.template}`
        : "Not configured";

    return (
        <>
            <GoogleDocsDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                id={props.id}
                icon="/logos/google.svg"
                name="Google Docs"
                status={nodeStatus}
                description={description}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});

GoogleDocsNode.displayName = "GoogleDocsNode";
