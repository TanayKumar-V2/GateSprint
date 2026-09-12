import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Recommendation } from "@/lib/progress";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{rec.difficulty}</Badge>
          <Badge variant="outline">{rec.year}</Badge>
          <Badge variant="outline">
            {rec.marks} mark{rec.marks === 1 ? "" : "s"}
          </Badge>
        </div>
        <CardTitle className="text-base font-medium leading-6">
          {rec.subject.name} · {rec.topic.name}
        </CardTitle>
        <CardDescription>{rec.reason}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {rec.prompt}
        </p>
        <div className="flex gap-2">
          <Link
            href={rec.practicePath}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Practice this
          </Link>
          <Link
            href={rec.revisePath}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Revise with Mentor
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function BreakdownTable({
  caption,
  rows,
}: {
  caption: string;
  rows: {
    slug: string;
    name: string;
    attempts: number;
    accuracy: number | null;
    detail: string;
    href: string;
  }[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-muted/50">
            <th scope="col" className="px-4 py-2 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Attempts
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Accuracy
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Coverage
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug} className="border-b last:border-0">
              <td className="px-4 py-2 font-medium">{r.name}</td>
              <td className="px-4 py-2">{r.attempts}</td>
              <td className="px-4 py-2">
                {r.accuracy === null ? (
                  <span className="text-muted-foreground">No attempts yet</span>
                ) : (
                  `${Math.round(r.accuracy * 100)}%`
                )}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{r.detail}</td>
              <td className="px-4 py-2">
                <Link
                  href={r.href}
                  className="underline"
                  aria-label={`Practice ${r.name}`}
                >
                  Practice →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
