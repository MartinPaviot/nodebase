import { useQueryStates } from "nuqs";
import { agentsParams } from "../params";

export const useAgentsParams = () => {
  return useQueryStates(agentsParams);
};
