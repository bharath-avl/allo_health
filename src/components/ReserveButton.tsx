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

export function ReserveButton({
  inventoryId,
  availableUnits,
  productName,
}: ReserveButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  if (availableUnits === 0) {
    return (
      <Badge variant="destructive" className="opacity-80">
        Out of Stock
      </Badge>
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
    <div className="flex items-center gap-3">
      <Badge
        variant="outline"
        className={
          availableUnits <= 2
            ? "border-amber-400 bg-amber-50 text-amber-700"
            : "border-emerald-400 bg-emerald-50 text-emerald-700"
        }
      >
        {availableUnits} left
      </Badge>
      <Button
        size="sm"
        onClick={handleReserve}
        disabled={isLoading}
        className="cursor-pointer"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Reserve"
        )}
      </Button>
    </div>
  );
}
