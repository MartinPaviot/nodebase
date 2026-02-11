import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // Get the agent
  const agent = await prisma.agent.findUnique({
    where: { id: "cmkvbpyo90001idcgzytxukah" },
    select: { id: true, name: true, templateId: true },
  });
  console.log("Current agent:", agent);

  // Get the template
  const template = await prisma.agentTemplate.findFirst({
    where: { name: "Recruiting Agent" },
    select: { id: true, name: true },
  });
  console.log("Template found:", template);

  if (template && agent) {
    // Update the agent's templateId
    const updated = await prisma.agent.update({
      where: { id: agent.id },
      data: { templateId: template.id },
    });
    console.log("Updated agent templateId to:", updated.templateId);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
