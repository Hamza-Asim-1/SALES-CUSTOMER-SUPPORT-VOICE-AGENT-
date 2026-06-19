"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Check, Filter, RefreshCw } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { ApiService } from "@/lib/apis/crmApis"
import { AlertCircle, CheckCircle, PhoneCall, PhoneOff, Users, Phone } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Slider } from "@/components/ui/slider"
import { LiveCall } from "@/components/voice/LiveCall"

// Replace the dummy leads with an interface for the real data
interface Lead {
  id: number
  user_id: string | number
  Conversion: string | number
  task_id: string
  status: string
  processing_start_time: string
  processing_end_time: string
  File_Name: string
  priorityScore?: number
  // Additional fields for display
  Name?: string
  Contact?: string
  Email?: string
}

// Keep the dummy tasks and insights for now
const dummyTasks = [
  {
    id: 1,
    leadId: 1,
    leadName: "John Smith",
    title: "Schedule demo call",
    dueDate: "2025-03-10",
    completed: false,
    priority: "High",
  },
  {
    id: 2,
    leadId: 4,
    leadName: "Emily Davis",
    title: "Send proposal",
    dueDate: "2025-03-09",
    completed: false,
    priority: "High",
  },
  {
    id: 3,
    leadId: 2,
    leadName: "Sarah Johnson",
    title: "Follow up on demo",
    dueDate: "2025-03-15",
    completed: false,
    priority: "Medium",
  },
  {
    id: 4,
    leadId: 5,
    leadName: "David Wilson",
    title: "Share case studies",
    dueDate: "2025-03-11",
    completed: false,
    priority: "Medium",
  },
  {
    id: 5,
    leadId: 3,
    leadName: "Michael Brown",
    title: "Initial outreach call",
    dueDate: "2025-03-08",
    completed: false,
    priority: "Low",
  },
]

const dummyInsights = [
  {
    id: 1,
    title: "High Conversion Opportunity",
    description: "John Smith has a 92% probability of conversion based on engagement patterns.",
    leadId: 1,
    type: "opportunity",
  },
  {
    id: 2,
    title: "Follow-up Needed",
    description: "Emily Davis hasn't been contacted in 5 days despite high engagement.",
    leadId: 4,
    type: "action",
  },
  {
    id: 3,
    title: "Industry Trend",
    description: "Tech sector leads are converting 15% higher than average this month.",
    leadId: null,
    type: "trend",
  },
]

export default function SalesAgentPage() {
  const { isAuthenticated, user } = useAuth(true)
  const router = useRouter()

  // Update state to use the new Lead interface
  const [leads, setLeads] = useState<Lead[]>([])
  const [tasks, setTasks] = useState(dummyTasks)
  const [insights, setInsights] = useState(dummyInsights)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [numAgents, setNumAgents] = useState(1)
  const [isCalling, setIsCalling] = useState(false)
  const [callStatus, setCallStatus] = useState<{
    message: string
    type: "success" | "info" | "warning" | "error"
  } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10 // Show 10 leads per page

  // Live browser voice call (per-lead). No telephony — opens the AI agent in-browser.
  const [callLead, setCallLead] = useState<Lead | null>(null)
  const [callMode, setCallMode] = useState<"sales" | "support">("sales")

  // Add a function to fetch data from the API
  const fetchLeadData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!user?.id) {
        throw new Error("Please log in to load your leads.")
      }
      const userId = user.id
      const response = await ApiService.getMappedUserData(userId)
      const rows = response.data?.data?.data ?? response.data?.data

      if (response.success && Array.isArray(rows)) {
        const transformedData: Lead[] = rows.map((item: any, index: number) => {
          // Use real CRM fields only — never fabricate contact/email.
          const name = item.Name || `Lead ${index + 1}`
          const contact = item.Contact || item.Phone || "—"
          const email = item.Email || "—"

          return {
            id: index,
            user_id: item.user_id || userId,
            Conversion: item.Conversion || "—",
            task_id: item.task_id || "—",
            status: item.status || "New",
            processing_start_time: item.processing_start_time || "—",
            processing_end_time: item.processing_end_time || "—",
            File_Name: item.File_Name || "Unknown",
            // Deterministic ordering: keep CRM order (newest uploads first handled by API).
            priorityScore: rows.length - index,
            Name: name,
            Contact: contact,
            Email: email,
          }
        })

        setLeads(transformedData)
      } else {
        throw new Error(response.error || "Failed to fetch lead data")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while fetching data")
      console.error("Error fetching lead data:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Add useEffect to fetch data on component mount
  useEffect(() => {
    fetchLeadData()
  }, [user?.id])

  // Handle refresh button click
  const handleRefresh = () => {
    fetchLeadData()
  }

  // Handle marking a task as complete
  const handleCompleteTask = (taskId: number) => {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, completed: true } : task)))
  }

  // Filter leads based on selected filters
  const filteredLeads = leads.filter((lead) => {
    if (statusFilter && lead.status !== statusFilter) return false
    return true
  })

  // Sort leads by priority score (descending)
  const sortedLeads = [...filteredLeads].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))

  // Calculate pagination values
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage)
  const paginatedLeads = sortedLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleStartCalling = async () => {
    setIsProcessing(true)
    setCallStatus({ message: "Starting sales agents...", type: "info" })

    try {
      if (!user?.id) {
        throw new Error("Please log in to load your leads.")
      }
      const userId = user.id
      const response = await ApiService.startProcessing(userId, numAgents)

      if (ApiService.isSuccess(response)) {
        setIsCalling(true)
        setCallStatus({
          message: `Successfully started ${numAgents} sales agent${numAgents > 1 ? "s" : ""}. Task ID: ${response.data?.task_id || "Unknown"}`,
          type: "success",
        })
        // Refresh the lead data after starting the process
        fetchLeadData()
      } else {
        setCallStatus({
          message: `Failed to start sales agents: ${response.error || "Unknown error"}`,
          type: "error",
        })
      }
    } catch (error) {
      setCallStatus({
        message: `Error starting sales agents: ${error instanceof Error ? error.message : "Unknown error"}`,
        type: "error",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStopCalling = async () => {
    setIsProcessing(true)
    setCallStatus({ message: "Stopping sales agents...", type: "info" })

    try {
      if (!user?.id) {
        throw new Error("Please log in to load your leads.")
      }
      const userId = user.id
      const response = await ApiService.stopProcessing(userId)

      if (ApiService.isSuccess(response)) {
        setIsCalling(false)
        setCallStatus({
          message: `Successfully stopped all sales agents. ${response.data?.task_ids?.length || 0} tasks terminated.`,
          type: "success",
        })
        // Refresh the lead data after stopping the process
        fetchLeadData()
      } else {
        setCallStatus({
          message: `Failed to stop sales agents: ${response.error || "Unknown error"}`,
          type: "error",
        })
      }
    } catch (error) {
      setCallStatus({
        message: `Error stopping sales agents: ${error instanceof Error ? error.message : "Unknown error"}`,
        type: "error",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter])

  return (
    <DashboardLayout>
      <div className="p-4">
        <div className="flex items-center justify-between mb-6 ml-4 mr-2">
          <h1 className="text-3xl font-bold">AI Sales Agent</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Call mode:</span>
            <Button
              size="sm"
              variant={callMode === "sales" ? "default" : "outline"}
              onClick={() => setCallMode("sales")}
            >
              Sales
            </Button>
            <Button
              size="sm"
              variant={callMode === "support" ? "default" : "outline"}
              onClick={() => setCallMode("support")}
            >
              Support
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Batch Lead Processing (simulation)</CardTitle>
            <CardDescription>
              Simulates dispatching multiple agents across your lead list for reporting.
              For a real conversation, press <strong>Call</strong> on any lead below to talk to the
              AI agent live in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium">Number of Sales Agents</label>
                    <span className="text-sm font-medium">{numAgents}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <Slider
                      value={[numAgents]}
                      min={1}
                      max={10}
                      step={1}
                      onValueChange={(value) => setNumAgents(value[0])}
                      disabled={isCalling || isProcessing}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select the number of concurrent AI sales agents to deploy (1-10)
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleStartCalling}
                    disabled={isCalling || isProcessing}
                  >
                    <PhoneCall className="mr-2 h-4 w-4" />
                    Start Calling
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={handleStopCalling}
                    disabled={!isCalling || isProcessing}
                  >
                    <PhoneOff className="mr-2 h-4 w-4" />
                    Stop Calling
                  </Button>
                </div>
              </div>

              <div>
                {callStatus && (
                  <Alert variant={callStatus.type === "error" ? "destructive" : "default"}>
                    {callStatus.type === "success" && <CheckCircle className="h-4 w-4" />}
                    {callStatus.type === "error" && <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>
                      {callStatus.type === "success"
                        ? "Success"
                        : callStatus.type === "error"
                          ? "Error"
                          : callStatus.type === "warning"
                            ? "Warning"
                            : "Information"}
                    </AlertTitle>
                    <AlertDescription>{callStatus.message}</AlertDescription>
                  </Alert>
                )}

                {isCalling && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center">
                      <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse mr-3"></div>
                      <p className="font-medium text-blue-800">Sales agents are actively calling leads</p>
                    </div>
                    <p className="mt-2 text-sm text-blue-600">
                      {numAgents} agent{numAgents > 1 ? "s" : ""} currently deployed. You can monitor progress in
                      real-time below.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Lead Prioritization</CardTitle>
                  <CardDescription>AI-prioritized leads based on engagement and conversion probability</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    {isLoading ? "Refreshing..." : "Refresh Data"}
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Filter Leads</DialogTitle>
                        <DialogDescription>Filter leads by status</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div>
                          <h3 className="mb-2 text-sm font-medium">Status</h3>
                          <div className="flex flex-wrap gap-2">
                            {["New", "In Progress", "Completed", "Failed"].map((status) => (
                              <Badge
                                key={status}
                                variant={statusFilter === status ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => setStatusFilter(statusFilter === status ? null : status)}
                              >
                                {status}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setStatusFilter(null)
                          }}
                        >
                          Reset
                        </Button>
                        <Button>Apply Filters</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    <p>Loading lead data...</p>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-32 text-red-500">
                    <AlertCircle className="h-6 w-6 mr-2" />
                    <p>{error}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Conversion</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLeads.length > 0 ? (
                        paginatedLeads.map((lead, index) => (
                          <TableRow key={lead.id}>
                            <TableCell>{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                            <TableCell>{lead.Name}</TableCell>
                            <TableCell>{lead.Contact}</TableCell>
                            <TableCell>{lead.Email}</TableCell>
                            <TableCell>{lead.Conversion}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  lead.status === "Completed"
                                    ? "default"
                                    : lead.status === "In Progress"
                                      ? "secondary"
                                      : lead.status === "Failed"
                                        ? "destructive"
                                        : "outline"
                                }
                              >
                                {lead.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setSelectedLead(lead)}>
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700"
                                  onClick={() => setCallLead(lead)}
                                  disabled={!user?.id}
                                  title={user?.id ? "Start a live voice call with the AI agent" : "Log in first"}
                                >
                                  <Phone className="h-4 w-4 mr-1" />
                                  Call
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center">
                            {statusFilter ? "No leads found matching your criteria." : "No lead data available."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
                <div className="flex items-center justify-between mt-4 border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing <strong>{paginatedLeads.length}</strong> of <strong>{filteredLeads.length}</strong> leads
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
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Actionable Insights</CardTitle>
                <CardDescription>AI-generated recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.map((insight) => (
                    <div
                      key={insight.id}
                      className={`p-3 rounded-lg border ${
                        insight.type === "opportunity"
                          ? "bg-green-50 border-green-200"
                          : insight.type === "action"
                            ? "bg-blue-50 border-blue-200"
                            : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <h3 className="font-medium mb-1">{insight.title}</h3>
                      <p className="text-sm text-gray-700">{insight.description}</p>
                      {insight.leadId && (
                        <Button
                          variant="link"
                          className="p-0 h-auto text-sm"
                          onClick={() => setSelectedLead(leads.find((l) => l.id === insight.leadId) || null)}
                        >
                          View Lead
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Follow-Up Tasks</CardTitle>
            <CardDescription>AI-recommended follow-up actions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks
                  .filter((task) => !task.completed)
                  .map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>{task.leadName}</TableCell>
                      <TableCell>{task.title}</TableCell>
                      <TableCell>{task.dueDate}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            task.priority === "High"
                              ? "destructive"
                              : task.priority === "Medium"
                                ? "default"
                                : "outline"
                          }
                        >
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => handleCompleteTask(task.id)}
                        >
                          <Check className="h-4 w-4" />
                          Mark Complete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {callLead && user?.id && (
          <Dialog open={!!callLead} onOpenChange={(open) => !open && setCallLead(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Live Voice Call</DialogTitle>
                <DialogDescription>
                  Talking to {callLead.Name} — realtime transcript, sentiment and orders below.
                </DialogDescription>
              </DialogHeader>
              <LiveCall
                userId={String(user.id)}
                lead={callLead}
                mode={callMode}
                onClose={() => setCallLead(null)}
              />
            </DialogContent>
          </Dialog>
        )}

        {selectedLead && (
          <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Lead Details</DialogTitle>
                <DialogDescription>Detailed information about the lead</DialogDescription>
              </DialogHeader>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Lead Information</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3">
                      <span className="text-sm font-medium text-gray-500">Name:</span>
                      <span className="col-span-2">{selectedLead.Name}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-sm font-medium text-gray-500">Contact:</span>
                      <span className="col-span-2">{selectedLead.Contact}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-sm font-medium text-gray-500">Email:</span>
                      <span className="col-span-2">{selectedLead.Email}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-sm font-medium text-gray-500">Status:</span>
                      <span className="col-span-2">{selectedLead.status}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Processing Information</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3">
                      <span className="text-sm font-medium text-gray-500">File Name:</span>
                      <span className="col-span-2">{selectedLead.File_Name}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-sm font-medium text-gray-500">Task ID:</span>
                      <span className="col-span-2">{selectedLead.task_id}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-sm font-medium text-gray-500">Start Time:</span>
                      <span className="col-span-2">{selectedLead.processing_start_time}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-sm font-medium text-gray-500">End Time:</span>
                      <span className="col-span-2">{selectedLead.processing_end_time}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-sm font-medium text-gray-500">Conversion:</span>
                      <span className="col-span-2">{selectedLead.Conversion}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={() => setSelectedLead(null)}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  )
}

