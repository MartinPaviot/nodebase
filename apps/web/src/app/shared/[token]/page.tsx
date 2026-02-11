import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { SharedConversationView } from "./shared-conversation-view";

export default async function SharedConversationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { shareToken: token },
    include: {
      agent: { select: { name: true, avatar: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) {
    notFound();
  }

  return <SharedConversationView conversation={conversation} />;
}
