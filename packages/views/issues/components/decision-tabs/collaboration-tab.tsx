"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Users } from "lucide-react";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import type { IssuePriority, IssueStatus, TimelineEntry } from "@multica/core/types";
import { timeAgo } from "@multica/core/utils";
import { memberListOptions, agentListOptions } from "@multica/core/workspace/queries";
import { useActorName } from "@multica/core/workspace/hooks";
import { AvatarGroup, AvatarGroupCount } from "@multica/ui/components/ui/avatar";
import { Checkbox } from "@multica/ui/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@multica/ui/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@multica/ui/components/ui/popover";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@multica/ui/components/ui/tooltip";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "@multica/core/issues/config";
import { useIssueSubscribers } from "../../hooks/use-issue-subscribers";
import { useIssueTimeline } from "../../hooks/use-issue-timeline";
import { ActorAvatar } from "../../../common/actor-avatar";
import { AgentLiveCard, TaskRunHistory } from "../agent-live-card";
import { CommentCard } from "../comment-card";
import { CommentInput } from "../comment-input";
import { PriorityIcon } from "../priority-icon";
import { StatusIcon } from "../status-icon";

function statusLabel(status: string): string {
  return STATUS_CONFIG[status as IssueStatus]?.label ?? status;
}

function priorityLabel(priority: string): string {
  return PRIORITY_CONFIG[priority as IssuePriority]?.label ?? priority;
}

function formatActivity(
  entry: TimelineEntry,
  resolveActorName?: (type: string, id: string) => string,
): string {
  const details = (entry.details ?? {}) as Record<string, string>;

  switch (entry.action) {
    case "created":
      return "created this issue";
    case "status_changed":
      return `changed status from ${statusLabel(details.from ?? "?")} to ${statusLabel(details.to ?? "?")}`;
    case "priority_changed":
      return `changed priority from ${priorityLabel(details.from ?? "?")} to ${priorityLabel(details.to ?? "?")}`;
    case "assignee_changed": {
      const isSelfAssign = details.to_type === entry.actor_type && details.to_id === entry.actor_id;
      if (isSelfAssign) return "self-assigned this issue";
      const toName = details.to_id && details.to_type && resolveActorName
        ? resolveActorName(details.to_type, details.to_id)
        : null;
      if (toName) return `assigned to ${toName}`;
      if (details.from_id && !details.to_id) return "removed assignee";
      return "changed assignee";
    }
    case "due_date_changed": {
      if (!details.to) return "removed due date";
      const formatted = new Date(details.to).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `set due date to ${formatted}`;
    }
    case "title_changed":
      return `renamed this issue from "${details.from ?? "?"}" to "${details.to ?? "?"}"`;
    case "description_updated":
      return "updated the description";
    case "task_completed":
      return "completed the task";
    case "task_failed":
      return "task failed";
    default:
      return entry.action ?? "";
  }
}

export function CollaborationTab({
  issueId,
  heading = "协同记录",
  highlightCommentId,
  standalone = false,
}: {
  issueId: string;
  heading?: string;
  highlightCommentId?: string;
  standalone?: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const wsId = useWorkspaceId();
  const { getActorName } = useActorName();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const didHighlightRef = useRef<string | null>(null);

  const {
    timeline,
    loading: timelineLoading,
    submitComment,
    submitReply,
    editComment,
    deleteComment,
    toggleReaction: handleToggleReaction,
  } = useIssueTimeline(issueId, user?.id);

  const {
    subscribers,
    loading: subscribersLoading,
    isSubscribed,
    toggleSubscribe: handleToggleSubscribe,
    toggleSubscriber,
  } = useIssueSubscribers(issueId, user?.id);

  useEffect(() => {
    let timer: number | undefined;

    if (!highlightCommentId || timeline.length === 0) return undefined;
    if (didHighlightRef.current === highlightCommentId) return undefined;

    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (!el) return undefined;

    didHighlightRef.current = highlightCommentId;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(highlightCommentId);
      timer = window.setTimeout(() => setHighlightedId(null), 2000);
    });

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [highlightCommentId, timeline.length]);

  const content = (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">{heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          {subscribersLoading ? (
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-16" />
              <div className="flex -space-x-1">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleToggleSubscribe}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {isSubscribed ? "Unsubscribe" : "Subscribe"}
              </button>
              <Popover>
                <PopoverTrigger className="cursor-pointer transition-opacity hover:opacity-80">
                  {subscribers.length > 0 ? (
                    <AvatarGroup>
                      {subscribers.slice(0, 4).map((sub) => (
                        <ActorAvatar
                          key={`${sub.user_type}-${sub.user_id}`}
                          actorType={sub.user_type}
                          actorId={sub.user_id}
                          size={24}
                        />
                      ))}
                      {subscribers.length > 4 ? (
                        <AvatarGroupCount>+{subscribers.length - 4}</AvatarGroupCount>
                      ) : null}
                    </AvatarGroup>
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground">
                      <Users className="h-3 w-3" />
                    </span>
                  )}
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-0">
                  <Command>
                    <CommandInput placeholder="Change subscribers..." />
                    <CommandList className="max-h-64">
                      <CommandEmpty>No results found</CommandEmpty>
                      {members.length > 0 ? (
                        <CommandGroup heading="Members">
                          {members
                            .filter((member, index, arr) => arr.findIndex((candidate) => candidate.user_id === member.user_id) === index)
                            .map((member) => {
                              const subscriber = subscribers.find(
                                (entry) => entry.user_type === "member" && entry.user_id === member.user_id,
                              );
                              const checked = Boolean(subscriber);

                              return (
                                <CommandItem
                                  key={`member-${member.user_id}`}
                                  onSelect={() => toggleSubscriber(member.user_id, "member", checked)}
                                  className="flex items-center gap-2.5"
                                >
                                  <Checkbox checked={checked} className="pointer-events-none" />
                                  <ActorAvatar actorType="member" actorId={member.user_id} size={22} />
                                  <span className="flex-1 truncate">{member.name}</span>
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      ) : null}
                      {agents.filter((agent) => !agent.archived_at).length > 0 ? (
                        <CommandGroup heading="Agents">
                          {agents
                            .filter((agent) => !agent.archived_at)
                            .map((agent) => {
                              const subscriber = subscribers.find(
                                (entry) => entry.user_type === "agent" && entry.user_id === agent.id,
                              );
                              const checked = Boolean(subscriber);

                              return (
                                <CommandItem
                                  key={`agent-${agent.id}`}
                                  onSelect={() => toggleSubscriber(agent.id, "agent", checked)}
                                  className="flex items-center gap-2.5"
                                >
                                  <Checkbox checked={checked} className="pointer-events-none" />
                                  <ActorAvatar actorType="agent" actorId={agent.id} size={22} />
                                  <span className="flex-1 truncate">{agent.name}</span>
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      ) : null}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      <AgentLiveCard issueId={issueId} />

      <div className="mt-3">
        <TaskRunHistory issueId={issueId} />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {timelineLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 px-4">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : (() => {
          const topLevel = timeline.filter((entry) => entry.type === "activity" || !entry.parent_id);
          const repliesByParent = new Map<string, TimelineEntry[]>();

          for (const entry of timeline) {
            if (entry.type === "comment" && entry.parent_id) {
              const list = repliesByParent.get(entry.parent_id) ?? [];
              list.push(entry);
              repliesByParent.set(entry.parent_id, list);
            }
          }

          const coalesced: TimelineEntry[] = [];
          const COALESCE_MS = 2 * 60 * 1000;

          for (const entry of topLevel) {
            if (entry.type === "activity") {
              const previous = coalesced[coalesced.length - 1];
              if (
                previous?.type === "activity" &&
                previous.action === entry.action &&
                previous.actor_type === entry.actor_type &&
                previous.actor_id === entry.actor_id &&
                Math.abs(new Date(entry.created_at).getTime() - new Date(previous.created_at).getTime()) <= COALESCE_MS
              ) {
                coalesced[coalesced.length - 1] = entry;
                continue;
              }
            }

            coalesced.push(entry);
          }

          const groups: { type: "activities" | "comment"; entries: TimelineEntry[] }[] = [];

          for (const entry of coalesced) {
            if (entry.type === "activity") {
              const last = groups[groups.length - 1];
              if (last?.type === "activities") {
                last.entries.push(entry);
              } else {
                groups.push({ type: "activities", entries: [entry] });
              }
            } else {
              groups.push({ type: "comment", entries: [entry] });
            }
          }

          return groups.map((group) => {
            if (group.type === "comment") {
              const entry = group.entries[0]!;

              return (
                <div key={entry.id} id={`comment-${entry.id}`}>
                  <CommentCard
                    issueId={issueId}
                    entry={entry}
                    allReplies={repliesByParent}
                    currentUserId={user?.id}
                    onReply={submitReply}
                    onEdit={editComment}
                    onDelete={deleteComment}
                    onToggleReaction={handleToggleReaction}
                    highlightedCommentId={highlightedId}
                  />
                </div>
              );
            }

            return (
              <div key={group.entries[0]!.id} className="flex flex-col gap-3 px-4">
                {group.entries.map((entry) => {
                  const details = (entry.details ?? {}) as Record<string, string>;
                  const isStatusChange = entry.action === "status_changed";
                  const isPriorityChange = entry.action === "priority_changed";
                  const isDueDateChange = entry.action === "due_date_changed";

                  let leadIcon: React.ReactNode;
                  if (isStatusChange && details.to) {
                    leadIcon = <StatusIcon status={details.to as IssueStatus} className="h-4 w-4 shrink-0" />;
                  } else if (isPriorityChange && details.to) {
                    leadIcon = <PriorityIcon priority={details.to as IssuePriority} className="h-4 w-4 shrink-0" />;
                  } else if (isDueDateChange) {
                    leadIcon = <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />;
                  } else {
                    leadIcon = <ActorAvatar actorType={entry.actor_type} actorId={entry.actor_id} size={16} />;
                  }

                  return (
                    <div key={entry.id} className="flex items-center text-xs text-muted-foreground">
                      <div className="mr-2 flex w-4 shrink-0 justify-center">
                        {leadIcon}
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-1">
                        <span className="shrink-0 font-medium">{getActorName(entry.actor_type, entry.actor_id)}</span>
                        <span className="truncate">{formatActivity(entry, getActorName)}</span>
                        <Tooltip>
                          <TooltipTrigger
                            render={(
                              <span className="ml-auto shrink-0 cursor-default">
                                {timeAgo(entry.created_at)}
                              </span>
                            )}
                          />
                          <TooltipContent side="top">
                            {new Date(entry.created_at).toLocaleString()}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>

      <div className="mt-4">
        <CommentInput issueId={issueId} onSubmit={submitComment} />
      </div>
    </div>
  );

  if (standalone) {
    return <div className="mx-auto w-full max-w-4xl px-8 py-8">{content}</div>;
  }

  return content;
}
