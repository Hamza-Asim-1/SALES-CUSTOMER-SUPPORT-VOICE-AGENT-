"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Search, ArrowUpDown, Calendar, RefreshCw } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApiService } from "@/lib/apis/crmApis"
import { useSelector } from "react-redux"
import { RootState } from "@/app/store/store";

// Define an interface for the contact data
interface Contact {
  id: number
  name: string
  email: string
  phone: string
  company: string
  status: string
  lastContact: string
}

// Static variable to store CRM data
let staticCrmData: Contact[] = []

// Function to get the appropriate status badge
const getStatusBadge = (status: string) => {
  switch (status) {
    case "Lead":
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Lead
        </Badge>
      )
    case "Prospect":
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
          Prospect
        </Badge>
      )
    case "Customer":
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
          Customer
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user)
  const { isAuthenticated } = useAuth()
  const [isLoaded, setIsLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>("lastContact")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [crmData, setCrmData] = useState<Contact[]>(staticCrmData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const itemsPerPage = 20

  // Add fetchUserData outside of useEffect for reusability
  const fetchUserData = async () => {
    if (!user?.id) {
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await ApiService.getMappedUserData(user.id)
      const rows = response.data?.data?.data ?? response.data?.data

      if (response.success && Array.isArray(rows)) {
        const transformedData: Contact[] = rows.map((item: any, index: number) => ({
          id: index,
          name: item.Name || "Unknown",
          email: item.Email || "",
          phone: item.Contact || "",
          company: item.Organization || (item.Location || "").split(" — ")[0] || item.Location || "",
          status: item.Status || (item.Info?.match(/^\[(\w+)\]/)?.[1] ?? "Lead"),
          lastContact: item.created_at
            ? new Date(item.created_at).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        }))
        setCrmData(transformedData)
        staticCrmData = transformedData
        setIsLoaded(true)
      } else if (response.success) {
        setCrmData([])
        staticCrmData = []
        setIsLoaded(true)
      } else {
        throw new Error(response.error || "Failed to fetch data")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while fetching data")
      setIsLoaded(true)
      console.error("Error fetching user data:", err)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Add refresh handler
  const handleRefresh = async () => {
    await fetchUserData()
  }
  
  // Initial data fetch
  useEffect(() => {
    if (user?.id) {
      fetchUserData()
    }
  }, [user?.id])

  // Filter and sort data
  const filteredData = crmData
    .filter((item) => {
      // Apply search filter
      if (
        searchQuery &&
        !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.email.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.company.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false
      }

      // Apply status filter
      if (statusFilter && item.status !== statusFilter) {
        return false
      }

      return true
    })
    .sort((a, b) => {
      // Apply sorting
      if (sortField === "name") {
        return sortDirection === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      } else if (sortField === "company") {
        return sortDirection === "asc" ? a.company.localeCompare(b.company) : b.company.localeCompare(a.company)
      } else if (sortField === "lastContact") {
        return sortDirection === "asc"
          ? new Date(a.lastContact).getTime() - new Date(b.lastContact).getTime()
          : new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime()
      }
      return 0
    })

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Get unique statuses for filter
  const statuses = Array.from(new Set(crmData.map((item) => item.status)))

  // Handle sort toggle
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
      },
    },
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-4 w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 ml-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">CRM Dashboard</h1>
            <p className="text-muted-foreground">View and manage your CRM data</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Button 
              className="flex items-center gap-2" 
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </div>
        </div>

        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          {!user?.id ? (
            <Card className="mb-8">
              <CardContent className="flex items-center justify-center h-32">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <p>Loading your profile…</p>
                </div>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <Card className="mb-8">
              <CardContent className="flex items-center justify-center h-32">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <p>Loading CRM data...</p>
                </div>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="mb-8">
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-red-500">{error}</div>
              </CardContent>
            </Card>
          ) : (
            <>
              <motion.div variants={itemVariants}>
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Data Upload Statistics</CardTitle>
                    <CardDescription>Summary of your CRM data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4 flex flex-col">
                        <span className="text-blue-500 text-sm font-medium">Total Contacts</span>
                        <span className="text-2xl font-bold mt-1">{crmData.length}</span>
                        <span className="text-sm text-muted-foreground mt-1">From all sources</span>
                      </div>

                      <div className="bg-green-50 rounded-lg p-4 flex flex-col">
                        <span className="text-green-500 text-sm font-medium">Customers</span>
                        <span className="text-2xl font-bold mt-1">
                          {crmData.filter((item) => item.status === "Customer").length}
                        </span>
                        <span className="text-sm text-muted-foreground mt-1">Active accounts</span>
                      </div>

                      <div className="bg-amber-50 rounded-lg p-4 flex flex-col">
                        <span className="text-amber-500 text-sm font-medium">Prospects</span>
                        <span className="text-2xl font-bold mt-1">
                          {crmData.filter((item) => item.status === "Prospect").length}
                        </span>
                        <span className="text-sm text-muted-foreground mt-1">In sales pipeline</span>
                      </div>

                      <div className="bg-indigo-50 rounded-lg p-4 flex flex-col">
                        <span className="text-indigo-500 text-sm font-medium">Leads</span>
                        <span className="text-2xl font-bold mt-1">
                          {crmData.filter((item) => item.status === "Lead").length}
                        </span>
                        <span className="text-sm text-muted-foreground mt-1">New opportunities</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="mb-6">
                  <CardHeader className="pb-3">
                    <CardTitle>CRM Data</CardTitle>
                    <CardDescription>Browse and manage your contact data from all integrated sources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search contacts..."
                          className="pl-8"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Select
                          value={statusFilter || "all"}
                          onValueChange={(value) => setStatusFilter(value === "all" ? null : value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {statuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="flex items-center gap-1 p-0 font-medium"
                                onClick={() => toggleSort("name")}
                              >
                                Name
                                <ArrowUpDown className="h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="flex items-center gap-1 p-0 font-medium"
                                onClick={() => toggleSort("company")}
                              >
                                Company
                                <ArrowUpDown className="h-3 w-3" />
                              </Button>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="flex items-center gap-1 p-0 font-medium"
                                onClick={() => toggleSort("lastContact")}
                              >
                                Last Contact
                                <ArrowUpDown className="h-3 w-3" />
                              </Button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedData.length > 0 ? (
                            paginatedData.map((contact, index) => (
                              <TableRow key={contact.id} className="group">
                                <TableCell className="font-medium">{contact.name}</TableCell>
                                <TableCell>{contact.email}</TableCell>
                                <TableCell>{contact.phone}</TableCell>
                                <TableCell>{contact.company}</TableCell>
                                <TableCell>{getStatusBadge(contact.status)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    {new Date(contact.lastContact).toLocaleDateString()}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="h-24 text-center">
                                {searchQuery || statusFilter ? 
                                  "No contacts found matching your criteria." :
                                  "No CRM data available."
                                }
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between border-t px-6 py-4">
                    <div className="text-sm text-muted-foreground">
                      Showing <strong>{paginatedData.length}</strong> of <strong>{filteredData.length}</strong> contacts
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="text-sm font-medium">
                        Page {currentPage} of {totalPages || 1}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                      >
                        Next
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  )
}

