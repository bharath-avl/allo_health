"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  CheckCircle2,
  Clock,
  ShoppingCart,
  ArrowLeft,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────

type Status = "loading" | "active" | "confirmed" | "expired" | "cancelled" | "error";

interface ReservationData {
  id: string;
  quantity: number;
  status: string;
  expiresAt: string;
  inventory: {
    id: string;
    totalUnits: number;
    reservedUnits: number;
    product: {
      id: string;
      name: string;
      sku: string;
      price: string;
    };
    warehouse: {
      id: string;
      name: string;
      city: string;
    };
  };
}

// ── Helpers ────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerColor(seconds: number): string {
  if (seconds > 180) return "text-emerald-600";
  if (seconds >= 60) return "text-amber-500";
  return "text-red-500";
}

function progressColor(seconds: number): string {
  if (seconds > 180) return "[&>div]:bg-emerald-500";
  if (seconds >= 60) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

// ── Constants ──────────────────────────────────────────

const TOTAL_SECONDS = 600; // 10 minutes
const POLL_INTERVAL = 30_000; // 30 seconds

// ── Component ──────────────────────────────────────────

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all intervals
  const clearTimers = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    countdownRef.current = null;
    pollRef.current = null;
  }, []);

  // ── Initial fetch ────────────────────────────────────

  useEffect(() => {
    async function fetchReservation() {
      try {
        const res = await fetch(`/api/reservations/${id}`);

        if (res.status === 404) {
          setStatus("error");
          return;
        }

        if (res.status === 410) {
          setStatus("expired");
          return;
        }

        if (!res.ok) {
          setStatus("error");
          return;
        }

        const data: ReservationData = await res.json();
        setReservation(data);

        if (data.status === "confirmed") {
          setStatus("confirmed");
          return;
        }

        if (data.status === "released") {
          setStatus("expired");
          return;
        }

        // Calculate initial seconds left
        const remaining = Math.floor(
          (new Date(data.expiresAt).getTime() - Date.now()) / 1000
        );

        if (remaining <= 0) {
          setStatus("expired");
          return;
        }

        setSecondsLeft(remaining);
        setStatus("active");
      } catch {
        setStatus("error");
      }
    }

    fetchReservation();
  }, [id]);

  // ── Countdown + Polling ──────────────────────────────

  useEffect(() => {
    if (status !== "active" || !reservation) return;

    // Countdown every second
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimers();
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Poll every 30s
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/reservations/${id}`);
        if (res.status === 410) {
          clearTimers();
          setStatus("expired");
        }
      } catch {
        // Silently ignore poll errors
      }
    }, POLL_INTERVAL);

    return clearTimers;
  }, [status, reservation, id, clearTimers]);

  // ── Actions ──────────────────────────────────────────

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
      });

      if (res.ok) {
        clearTimers();
        const updated = await res.json();
        setReservation((prev) =>
          prev ? { ...prev, status: updated.status } : prev
        );
        setStatus("confirmed");
        toast.success("Purchase confirmed! 🎉");
      } else if (res.status === 410) {
        clearTimers();
        setStatus("expired");
        toast.error("Reservation expired before confirmation.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to confirm.");
      }
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        clearTimers();
        setStatus("cancelled");
        toast.success("Reservation cancelled");
        setTimeout(() => router.push("/"), 1500);
      } else {
        toast.error("Failed to cancel reservation.");
      }
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Render ───────────────────────────────────────────

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md shadow-lg">
        {/* Loading */}
        {status === "loading" && (
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
            <p className="text-sm text-gray-500">Loading reservation…</p>
          </CardContent>
        )}

        {/* Error / Not Found */}
        {status === "error" && (
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">
              Reservation not found
            </h2>
            <p className="text-sm text-gray-500">
              This reservation doesn&apos;t exist or has been removed.
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="mt-2 cursor-pointer"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
          </CardContent>
        )}

        {/* Active */}
        {status === "active" && reservation && (
          <>
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-xl">Checkout</CardTitle>
              <p className="text-xs text-gray-400">
                Complete your purchase before time runs out
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Countdown Timer */}
              <div className="flex flex-col items-center gap-3 rounded-xl bg-gray-50 px-6 py-6">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Time Remaining
                </p>
                <p
                  className={`font-mono text-5xl font-bold tabular-nums ${timerColor(secondsLeft)}`}
                >
                  {formatTime(secondsLeft)}
                </p>
                <Progress
                  value={(secondsLeft / TOTAL_SECONDS) * 100}
                  className={`h-2 w-full ${progressColor(secondsLeft)}`}
                />
              </div>

              <Separator />

              {/* Order Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Product</span>
                  <span className="text-sm font-medium">
                    {reservation.inventory.product.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Warehouse</span>
                  <span className="text-sm font-medium">
                    {reservation.inventory.warehouse.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Quantity</span>
                  <span className="text-sm font-medium">
                    {reservation.quantity}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Price</span>
                  <span className="text-lg font-semibold text-gray-900">
                    ₹
                    {(
                      Number(reservation.inventory.product.price) *
                      reservation.quantity
                    ).toLocaleString("en-IN")}
                  </span>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Reservation ID</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {reservation.id.slice(0, 8)}…
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Cancel"
                  )}
                </Button>
                <Button
                  className="flex-1 cursor-pointer"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="mr-2 h-4 w-4" />
                  )}
                  Confirm Purchase
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Confirmed */}
        {status === "confirmed" && reservation && (
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Order Confirmed!
            </h2>
            <p className="text-sm text-gray-500">
              {reservation.inventory.product.name} has been purchased
              successfully.
            </p>
            <Badge variant="secondary" className="font-mono text-xs">
              {reservation.id.slice(0, 8)}…
            </Badge>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="mt-4 cursor-pointer"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Products
            </Button>
          </CardContent>
        )}

        {/* Expired */}
        {status === "expired" && (
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <Clock className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Reservation Expired
            </h2>
            <p className="text-sm text-gray-500">
              Your hold has expired. The item is back in stock for others.
            </p>
            <Button
              onClick={() => router.push("/")}
              className="mt-4 cursor-pointer"
            >
              Browse Products
            </Button>
          </CardContent>
        )}

        {/* Cancelled */}
        {status === "cancelled" && (
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="text-sm text-gray-500">
              Reservation cancelled. Redirecting…
            </p>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
