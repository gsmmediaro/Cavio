import type { Detection } from "../api/client";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

function confVariant(confidence: number): "destructive" | "warning" | "secondary" {
  const pct = confidence * 100;
  if (pct >= 80) return "destructive";
  if (pct >= 50) return "warning";
  return "secondary";
}

export default function FindingsTable({ detections }: { detections: Detection[] }) {
  if (detections.length === 0) {
    return (
      <Card className="w-full" role="status" aria-live="polite">
        <CardContent className="py-7 text-center">
          <div className="mb-1 text-sm font-medium text-foreground">No detections</div>
          <div className="text-[13px] text-muted-foreground">
            Zero findings on this scan. Review the image clinically as needed.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full gap-0 py-0">
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Class</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detections.map((d, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-foreground">{d.class_name}</TableCell>
                <TableCell>
                  <Badge variant={confVariant(d.confidence)}>
                    {(d.confidence * 100).toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[11px] tracking-wide text-muted-foreground">
                  [{d.bbox.map((v) => v.toFixed(0)).join(", ")}]
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
