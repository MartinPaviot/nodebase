import type { NodeExecutor } from "@/features/executions/types";
import ky, { type Options as KyOptions } from "ky";
import Handlebars from "handlebars";

Handlebars.registerHelper("json", (context) => {
    const jsonString = JSON.stringify(context, null, 2);
    const safeString = new Handlebars.SafeString(jsonString);

    return safeString;
});

type HttpRequestData = {
    variableName?: string;
    endpoint?: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: string;
};

export const httpRequestExecutor: NodeExecutor<HttpRequestData> = async ({
    data,
    nodeId,
    context,
    step,
    publish,
}) => {
    await publish({ nodeId, status: "loading" });


try {
const result = await step.run("http-request", async () => {

        if (!data.endpoint) {
        await publish({ nodeId, status: "error" });
        throw new Error("HTTP Request node: No endpoint configured");
    }

    if (!data.variableName) {
        await publish({ nodeId, status: "error" });
        throw new Error("HTTP Request node: Variable name not configured");
    }

    if (!data.method) {
        await publish({ nodeId, status: "error" });
        throw new Error("HTTP Request node: Method not configured");
    }


    const endpoint = Handlebars.compile(data.endpoint)(context);
    console.log("ENDPOINT", { endpoint });
    const method = data.method;

    const options: KyOptions = { method };

    if (["POST", "PUT", "PATCH"].includes(method)) {
        const resolved = Handlebars.compile(data.body || "{}")(context);
        JSON.parse(resolved);
        options.body = data.body;
        options.headers ={
            "Content-Type": "application/json",
        }
    }

    const response = await ky(endpoint, options);
    const contentType = response.headers.get("content-type");
    const responseData = contentType?.includes("application/json")
        ? await response.json()
        : await response.text();

        const responsePayload = {
            httpResponse: {
                status: response.status,
                statusText: response.statusText,
                data: responseData,
            },
        };

        const variableName = data.variableName;

    return {
        ...context,
        [data.variableName]: responsePayload,
        }
    });

    await publish({ nodeId, status: "success" });

    return result;
    } catch (error) {
        await publish({ nodeId, status: "error" });
        throw error;
    }
};
