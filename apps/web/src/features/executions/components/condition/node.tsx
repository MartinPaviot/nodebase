"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { GitBranch } from "@phosphor-icons/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { ConditionDialog, type ConditionFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchConditionRealtimeToken } from "./actions";

type ConditionBranch = {
    id: string;
    label: string;
    prompt: string;
    evaluator: "domain_check" | "domain_check_inverse" | "llm_classify" | "llm_classify_inverse";
};

type ConditionNodeData = {
    variableName?: string;
    conditions?: ConditionBranch[];
};

type ConditionNodeType = Node<ConditionNodeData>;

export const ConditionNode = memo((props: NodeProps<ConditionNodeType>) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({
        nodeId: props.id,
        channel: "condition-execution",
        topic: "status",
        refreshToken: fetchConditionRealtimeToken,
    });

    const handleOpenSettings = () => setDialogOpen(true);

    const handleSubmit = (values: ConditionFormValues) => {
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
    const description = nodeData?.conditions?.length
        ? `${nodeData.conditions.length} condition(s)`
        : "Not configured";

    return (
        <>
            <ConditionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={handleSubmit}
                defaultValues={nodeData}
            />
            <BaseExecutionNode
                {...props}
                id={props.id}
                icon={GitBranch}
                name="Condition"
                status={nodeStatus}
                description={description}
                onSettings={handleOpenSettings}
                onDoubleClick={handleOpenSettings}
            />
        </>
    );
});

ConditionNode.displayName = "ConditionNode";
