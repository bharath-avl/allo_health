"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ReserveButtonProps {
  inventoryId: string;
  availableUnits: number;
  productName: string;
}

export function StockBadge({ availableUnits }: { availableUnits: number }) {
  if (availableUnits === 0) {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600"
      >
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
        Sold out
      </Badge>
    );
  }

  if (availableUnits <= 2) {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
      >
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
        {availableUnits} left
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {availableUnits} left
    </Badge>
  );
}

export function ReserveButton({
  inventoryId,
  availableUnits,
  productName,
}: ReserveButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  if (availableUnits === 0) {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between">
          <StockBadge availableUnits={0} />
        </div>
        <Button
          disabled
          className="h-10 w-full rounded-xl bg-slate-100 text-sm font-medium text-slate-400 cursor-not-allowed"
        >
          Out of Stock
        </Button>
      </div>
    );
  }

  const handleReserve = async () => {
    setIsLoading(true);
    try {
      const sessionId = crypto.randomUUID();
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId, quantity: 1, sessionId }),
      });

      if (res.ok) {
        const reservation = await res.json();
        toast.success(`Reserved 1× ${productName}!`);
        router.refresh();
        router.push(`/checkout/${reservation.id}`);
      } else if (res.status === 409) {
        toast.error("Sorry, just sold out! 😔");
        router.refresh();
      } else {
        toast.error("Something went wrong. Try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleReserve}
      disabled={isLoading}
      className="h-10 w-full cursor-pointer rounded-xl bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
      ) : null}
      {isLoading ? "Reserving…" : "Reserve · 10 min hold"}
    </Button>
  );
}
