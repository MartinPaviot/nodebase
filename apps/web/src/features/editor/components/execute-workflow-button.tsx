import { Button } from "@/components/ui/button";
import { useExecuteWorkflow } from "@/features/workflows/hooks/use-workflows";
import { workflowsParams } from "@/features/workflows/params";
import { Flask } from "@phosphor-icons/react";

export const ExecuteWorkflowButton = ({
    workflowId,
}: {
    workflowId: string;
}) => {
    const executeWorkflow = useExecuteWorkflow();

    const handleExecute = () => {
        executeWorkflow.mutate({ id: workflowId });
    };


    return (
        <Button size ="lg" onClick={handleExecute} disabled={executeWorkflow.isPending}>
            <Flask className="size-4" />
            Execute workflows
        </Button>
    );
};