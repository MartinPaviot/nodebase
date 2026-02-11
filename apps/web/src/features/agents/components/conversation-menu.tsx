"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DotsThree,
  PushPin,
  PushPinSlash,
  Archive,
  ArrowCounterClockwise,
  ShareNetwork,
  Link,
  LinkBreak,
  Trash,
  PencilSimple,
  CircleNotch,
} from "@phosphor-icons/react";
import {
  useRenameConversation,
  useTogglePinConversation,
  useToggleArchiveConversation,
  useGenerateShareLink,
  useRemoveShareLink,
  useDeleteConversation,
} from "../hooks/use-agents";

interface ConversationMenuProps {
  conversation: {
    id: string;
    title: string | null;
    isPinned: boolean;
    isArchived: boolean;
    shareToken: string | null;
  };
}

export function ConversationMenu({ conversation }: ConversationMenuProps) {
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(conversation.title || "");

  const renameConversation = useRenameConversation();
  const togglePin = useTogglePinConversation();
  const toggleArchive = useToggleArchiveConversation();
  const generateShareLink = useGenerateShareLink();
  const removeShareLink = useRemoveShareLink();
  const deleteConversation = useDeleteConversation();

  const handleRename = () => {
    if (newTitle.trim()) {
      renameConversation.mutate(
        { id: conversation.id, title: newTitle.trim() },
        {
          onSuccess: () => {
            setIsRenameDialogOpen(false);
          },
        }
      );
    }
  };

  const handleDelete = () => {
    deleteConversation.mutate(
      { id: conversation.id },
      {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
        },
      }
    );
  };

  const isPending =
    renameConversation.isPending ||
    togglePin.isPending ||
    toggleArchive.isPending ||
    generateShareLink.isPending ||
    removeShareLink.isPending ||
    deleteConversation.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={isPending}
          >
            {isPending ? (
              <CircleNotch className="size-4 animate-spin" />
            ) : (
              <DotsThree className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setIsRenameDialogOpen(true)}>
            <PencilSimple className="size-4 mr-2" />
            Rename
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => togglePin.mutate({ id: conversation.id })}
          >
            {conversation.isPinned ? (
              <>
                <PushPinSlash className="size-4 mr-2" />
                Unpin
              </>
            ) : (
              <>
                <PushPin className="size-4 mr-2" />
                Pin
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => toggleArchive.mutate({ id: conversation.id })}
          >
            {conversation.isArchived ? (
              <>
                <ArrowCounterClockwise className="size-4 mr-2" />
                Restore
              </>
            ) : (
              <>
                <Archive className="size-4 mr-2" />
                Archive
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {conversation.shareToken ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  const shareUrl = `${window.location.origin}/shared/${conversation.shareToken}`;
                  navigator.clipboard.writeText(shareUrl);
                }}
              >
                <Link className="size-4 mr-2" />
                Copy Link
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => removeShareLink.mutate({ id: conversation.id })}
              >
                <LinkBreak className="size-4 mr-2" />
                Remove Link
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onClick={() => generateShareLink.mutate({ id: conversation.id })}
            >
              <ShareNetwork className="size-4 mr-2" />
              Share
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash className="size-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Give this conversation a memorable name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter conversation title"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={renameConversation.isPending || !newTitle.trim()}
            >
              {renameConversation.isPending && (
                <CircleNotch className="size-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConversation.isPending}
            >
              {deleteConversation.isPending && (
                <CircleNotch className="size-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
