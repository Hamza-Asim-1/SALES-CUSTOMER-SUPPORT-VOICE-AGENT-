"use client"

import { useCallback, useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import {
  createProduct,
  deleteProduct,
  listProducts,
  Product,
  updateProduct,
} from "@/lib/apis/salesApi"

export default function ProductsPage() {
  const { user } = useAuth(true)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Product>>({ name: "", price: "", stock: "", description: "" })

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      setProducts(await listProducts(String(user.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products")
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!user?.id || !draft.name) return
    try {
      await createProduct(String(user.id), draft)
      setDraft({ name: "", price: "", stock: "", description: "" })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add product")
    }
  }

  const saveRow = async (p: Product) => {
    if (!user?.id || !p.product_id) return
    try {
      await updateProduct(String(user.id), p.product_id, {
        name: p.name,
        price: p.price,
        stock: p.stock,
        description: p.description,
      })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update product")
    }
  }

  const removeRow = async (p: Product) => {
    if (!user?.id || !p.product_id) return
    await deleteProduct(String(user.id), p.product_id)
    load()
  }

  const patch = (idx: number, field: keyof Product, value: string) => {
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  return (
    <DashboardLayout>
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Products</h1>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add a product</CardTitle>
            <CardDescription>
              The voice agent quotes these prices and checks this live stock before placing orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5 items-end">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={draft.name as string} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Product name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Price</label>
                <Input value={draft.price as string} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Stock</label>
                <Input value={draft.stock as string} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} placeholder="0" />
              </div>
              <Button onClick={add} disabled={!draft.name} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Description (optional)</label>
              <Input value={draft.description as string} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Short description the agent can use" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Catalog</CardTitle></CardHeader>
          <CardContent>
            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length > 0 ? (
                  products.map((p, idx) => (
                    <TableRow key={p.product_id || idx}>
                      <TableCell><Input value={p.name} onChange={(e) => patch(idx, "name", e.target.value)} className="h-8" /></TableCell>
                      <TableCell className="w-24"><Input value={String(p.price)} onChange={(e) => patch(idx, "price", e.target.value)} className="h-8" /></TableCell>
                      <TableCell className="w-20"><Input value={String(p.stock)} onChange={(e) => patch(idx, "stock", e.target.value)} className="h-8" /></TableCell>
                      <TableCell><Input value={p.description || ""} onChange={(e) => patch(idx, "description", e.target.value)} className="h-8" /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => saveRow(p)}><Save className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => removeRow(p)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No products yet. Add one above (or during onboarding).
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
