"use client";

interface AgentPurposeCardProps {
  description: string;
  trigger?: string;
  tools?: string[];
  features?: string[];
}

export function AgentPurposeCard({
  description,
  trigger = "Conversation (direct chat)",
  tools = [],
  features = [],
}: AgentPurposeCardProps) {
  return (
    <div className="bg-[#FEF9E7] border-l-[5px] border-l-[#F4D03F] rounded-xl p-5 w-[320px] shadow-sm">
      <div className="space-y-4">
        <div>
          <h3 className="font-bold text-[#8B6914] text-[13px] tracking-wide">
            Agent Purpose:
          </h3>
          <p className="text-[13px] text-[#5D4E0B] mt-1.5 leading-relaxed">
            {description}
          </p>
        </div>

        <div>
          <h4 className="font-bold text-[#8B6914] text-[13px] tracking-wide">
            Trigger:
          </h4>
          <p className="text-[13px] text-[#5D4E0B] mt-0.5">{trigger}</p>
        </div>

        {tools.length > 0 && (
          <div>
            <h4 className="font-bold text-[#8B6914] text-[13px] tracking-wide mb-2">
              Tools:
            </h4>
            <ul className="text-[13px] text-[#5D4E0B] space-y-1">
              {tools.map((tool, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#F4D03F] mt-0.5">•</span>
                  <span>{tool}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {features.length > 0 && (
          <div>
            <h4 className="font-bold text-[#8B6914] text-[13px] tracking-wide mb-2">
              Key Features:
            </h4>
            <ul className="text-[13px] text-[#5D4E0B] space-y-1">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#F4D03F] mt-0.5">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
