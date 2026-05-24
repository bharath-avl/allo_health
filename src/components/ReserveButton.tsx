"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShimmerButton } from "@/components/ui/shimmer-button";
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
    return null;
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
    <ShimmerButton
      onClick={handleReserve}
      disabled={isLoading}
      shimmerColor="#8b5cf6"
      background="rgb(124 58 237)"
      className="mt-3 h-10 w-full rounded-xl text-sm font-medium cursor-pointer"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
      ) : null}
      <span className="text-white">
        {isLoading ? "Reserving…" : "Reserve"}
      </span>
    </ShimmerButton>
  );
}
