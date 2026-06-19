"use client"

import { useCallback, useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, ShoppingCart } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { listOrders, Order } from "@/lib/apis/salesApi"

export default function OrdersPage() {
  const { user } = useAuth(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      setOrders(await listOrders(String(user.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Initial load + light polling so orders placed mid-call appear without a manual refresh.
  useEffect(() => {
    load()
    const t = setInterval(load, 6000)
    return () => clearInterval(t)
  }, [load])

  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)

  return (
    <DashboardLayout>
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Orders</h1>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total Orders</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{orders.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Revenue</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Units Sold</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{orders.reduce((s, o) => s + (Number(o.quantity) || 0), 0)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Orders placed by the AI agent</CardTitle>
            <CardDescription>Orders created during voice calls appear here in realtime.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-red-500 text-sm">{error}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Placed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length > 0 ? (
                    orders.map((o) => (
                      <TableRow key={o.order_id}>
                        <TableCell className="font-medium">{o.product_name}</TableCell>
                        <TableCell>{o.quantity}</TableCell>
                        <TableCell>{o.currency || "USD"} {o.unit_price}</TableCell>
                        <TableCell className="font-semibold">{o.currency || "USD"} {o.total_price}</TableCell>
                        <TableCell>{o.customer_name || "—"}</TableCell>
                        <TableCell><Badge variant="default">{o.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No orders yet. Place one during a call from the Sales Agent page.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
