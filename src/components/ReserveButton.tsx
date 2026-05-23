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
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 px-3 py-1 text-red-600"
      >
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
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
    <div className="flex items-center gap-2.5">
      <Badge
        variant="outline"
        className={
          availableUnits <= 2
            ? "border-amber-200 bg-amber-50 px-3 py-1 text-amber-700"
            : "border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700"
        }
      >
        <span
          className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
            availableUnits <= 2 ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
        {availableUnits} left
      </Badge>
      <Button
        size="sm"
        onClick={handleReserve}
        disabled={isLoading}
        className="cursor-pointer bg-purple-600 text-white hover:bg-purple-700"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        ) : (
          "Reserve"
        )}
      </Button>
    </div>
  );
}
