"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Entry from a weak-topic recommendation: starts a revision session the
 * server briefs with the student's real accuracy and recent misses.
 */
export function RevisionStarter({
  subjectName,
  topicName,
  topicId,
}: {
  subjectName: string;
  topicName: string;
  topicId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTopicId: topicId }),
      });
      if (!res.ok) {
        setError("Couldn't start that session. Try again.");
        return;
      }
      const data = (await res.json()) as { session: { id: string } };
      router.push(`/mentor/${data.session.id}`);
    } catch {
      setError("Network hiccup. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">
          Revise {subjectName} · {topicName} with Mentor?
        </CardTitle>
        <CardDescription>
          Opens a focused session briefed on your accuracy and recent misses
          in this topic.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Start revision session"}
        </Button>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
