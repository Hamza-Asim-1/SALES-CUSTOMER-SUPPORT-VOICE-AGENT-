"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  BarChart,
  PieChart,
  AreaChart,
  ScatterChart,
  Bar,
  Pie,
  Area,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/hooks/useAuth"
import { ReportingService, type AnalysisReport, type ChatResponse, type ChatRequest } from "@/lib/apis/reportingApis"
import { getReportingApiBase } from "@/lib/reporting-url"
import { useSelector } from "react-redux"
import type { RootState } from "@/app/store/store"
import { Loader2, AlertCircle, Upload, Database, FileSpreadsheet, HardDrive, FileUp, Users } from "lucide-react"
import { ApiService } from "@/lib/apis/crmApis"
import { buildLeadsAnalysisReport } from "@/lib/reporting/leadsReport"
import { getMetrics, type BusinessMetrics } from "@/lib/apis/salesApi"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"

export default function DashboardPage() {
  // Auth and user state
  const { isAuthenticated } = useAuth()
  const user = useSelector((state: RootState) => state.auth.user)

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // UI states
  const [reportGenerated, setReportGenerated] = useState(false)
  const [activeTab, setActiveTab] = useState("csv")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingLeads, setIsGeneratingLeads] = useState(false)

  // Data states
  const [analysisData, setAnalysisData] = useState<AnalysisReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live business metrics (real orders + calls from the AI agent)
  const [liveMetrics, setLiveMetrics] = useState<BusinessMetrics | null>(null)

  useEffect(() => {
    if (!user?.id) return
    getMetrics(String(user.id)).then(setLiveMetrics).catch(() => {})
  }, [user?.id])

  // Chart data states
  const [salesData, setSalesData] = useState<any[]>([])
  const [productData, setProductData] = useState<any[]>([])
  const [regionData, setRegionData] = useState<any[]>([])
  const [customerData, setCustomerData] = useState<any[]>([])
  const [channelData, setChannelData] = useState<any[]>([])
  const [summaryPoints, setSummaryPoints] = useState<string[]>([])

  // Chat states
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Hello! How can I help you with your business report today?" },
  ])
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [isChatLoading, setIsChatLoading] = useState(false)

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    }
  }

  // Handle file upload button click
  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }
  // Add this function to your component
  // Add this function to your component
const formatMessageContent = (content: string): React.ReactNode => {
  if (!content) return null;
  
  // Split the content into paragraphs
  const paragraphs: string[] = content.split('\n\n').filter((p: string) => p.trim());
  
  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph: string, idx: number) => {
        // Check if this is a main heading (surrounded by ** at beginning of paragraph)
        if (paragraph.trim().match(/^\*\*(.*?)\*\*$/)) {
          return (
            <h2 key={idx} className="text-xl font-bold mt-3 mb-2 text-gray-900">
              {paragraph.trim().replace(/^\*\*|\*\*$/g, '')}
            </h2>
          );
        }
        
        // Check if this is a regular paragraph with a heading at the start
        if (paragraph.trim().match(/^\*\*(.*?)\*\*/)) {
          const parts: string[] = paragraph.trim().split(/^\*\*(.*?)\*\*/);
          return (
            <div key={idx}>
              <h3 className="text-lg font-bold mb-1 text-gray-900">{parts[1]}</h3>
              <p className="text-gray-800">
                {formatInlineContent(parts[2] || '')}
              </p>
            </div>
          );
        }
        
        // Handle numbered lists
        if (paragraph.match(/^\d+\.\s/)) {
          const listItems: string[] = paragraph.split(/\n(?=\d+\.\s)/).filter((item: string) => item.trim());
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1">
              {listItems.map((item: string, itemIdx: number) => {
                // Remove the number and format the rest
                const content: string = item.replace(/^\d+\.\s/, '');
                return (
                  <li key={itemIdx} className="text-gray-800">
                    {formatInlineContent(content)}
                  </li>
                );
              })}
            </ol>
          );
        }
        
        // Handle bullet lists
        if (paragraph.match(/^\*\s/)) {
          const listItems: string[] = paragraph.split(/\n(?=\*\s)/).filter((item: string) => item.trim());
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1">
              {listItems.map((item: string, itemIdx: number) => {
                // Remove the bullet and format the rest
                const content: string = item.replace(/^\*\s/, '');
                return (
                  <li key={itemIdx} className="text-gray-800">
                    {formatInlineContent(content)}
                  </li>
                );
              })}
            </ul>
          );
        }
        
        // Regular paragraph
        return (
          <p key={idx} className="text-gray-800">
            {formatInlineContent(paragraph)}
          </p>
        );
      })}
    </div>
  );
};

// Helper function to format inline content (bold, italic, etc.)
const formatInlineContent = (text: string): React.ReactNode => {
  if (!text) return null;
  
  // Process the content into react elements
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Match bold text (**text**)
  const boldRegex = /\*\*(.*?)\*\*/g;
  let match: RegExpExecArray | null;
  
  while ((match = boldRegex.exec(text)) !== null) {
    // Add the text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add the bold text
    parts.push(
      <span key={match.index} className="font-bold text-gray-900">
        {match[1]}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts;
};
  // Generate report from uploaded CSV
  const handleGenerateReport = async () => {
    if (!selectedFile && activeTab === "csv") {
      setError("Please select a CSV file first")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
       // Fallback to a default ID

      // If CSV file is selected, read and send it
      if (selectedFile && activeTab === "csv") {
        const formData = new FormData()
        formData.append("file", selectedFile)
        

        // Send the CSV file to the analyze endpoint
        const response = await fetch(`${getReportingApiBase()}/analyze`,
          {
            method: "POST",
            body: formData,
          },
        )

        if (!response.ok) {
          throw new Error(`Error uploading file: ${response.statusText}`)
        }

        const data = await response.json()
        setAnalysisData(data)
        processAnalysisData(data)
      } else {
        // For other connection types (placeholder for now)
        // In a real implementation, you would handle SQL, S3, or Blob connections here
        const response = await ReportingService.getAnalysis()

        if (ReportingService.isSuccess(response)) {
          const data = ReportingService.getData(response)
          if (data) {
            setAnalysisData(data)
            processAnalysisData(data)
          } else {
            throw new Error("No data returned from analysis")
          }
        } else {
          throw new Error(response.error || "Failed to fetch analysis data")
        }
      }

      // Set report as generated to show charts
      setReportGenerated(true)
    } catch (err) {
      console.error("Error generating report:", err)
      const message =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? "Cannot reach the reporting service. Start it with: cd backend/reporting_service/app && uvicorn main:app --reload --port 6000"
          : err instanceof Error
            ? err.message
            : "An error occurred while generating the report"
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateLeadsReport = async () => {
    if (!user?.id) {
      setError("Please log in to generate a report from your dashboard leads.")
      return
    }

    setIsGeneratingLeads(true)
    setError(null)

    try {
      const response = await ApiService.getMappedUserData(user.id)
      // CRM returns {data: [...]}, axios wraps => {data: {data: [...]}},
      // ApiService wraps => {success, data: {data: [...]}}.
      const rows = response.data?.data ?? response.data

      if (!response.success || !Array.isArray(rows) || !rows.length) {
        throw new Error("No leads found in your dashboard. Upload CRM data or run the demo seed script first.")
      }

      const report = buildLeadsAnalysisReport(rows)
      setAnalysisData(report)
      processAnalysisData(report)
      setReportGenerated(true)
      setChatMessages([
        {
          role: "assistant",
          content:
            "Your dashboard leads report is ready. Ask me about pipeline status, call outcomes, or top organizations.",
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build leads report")
    } finally {
      setIsGeneratingLeads(false)
    }
  }

  const buildChatContext = () => {
    if (!analysisData) return undefined

    const summaryText = Array.isArray(analysisData.executive_summary)
      ? analysisData.executive_summary.join(" ")
      : typeof analysisData.executive_summary === "string"
        ? analysisData.executive_summary
        : summaryPoints.join(" ")

    return {
      has_analysis_data: true,
      report_type: analysisData.schema_info?.source === "dashboard_leads" ? "dashboard_leads" : "csv_upload",
      executive_summary: analysisData.executive_summary,
      report_summary: summaryText,
      lead_stats: analysisData.raw_data?.lead_stats,
      total_leads: analysisData.raw_data?.lead_stats?.total,
    }
  }

  // Process the analysis data for charts
  const processAnalysisData = (data: AnalysisReport) => {
    try {
      // Process sales data for area chart
      if (data.raw_data?.sales_over_time) {
        const processedSalesData = data.raw_data.sales_over_time.map((item: any) => ({
          month: item.month || item.period || "March",
          sales: Number(item.sales) || 1836,
          calls: Number(item.calls) || 98,
          leads: Number(item.leads) || 102,
        }))
        setSalesData(processedSalesData)
      }

      // Process product data for pie chart
      if (data.raw_data?.product_distribution) {
        const processedProductData = data.raw_data.product_distribution.map((item: any) => ({
          name: item.name || item.product || "Smart Phones",
          value: Number(item.value) || Number(item.sales) || 986,
        }))
        setProductData(processedProductData)
      }

      // Process region data for bar chart
      if (data.raw_data?.regional_performance) {
        const processedRegionData = data.raw_data.regional_performance.map((item: any) => ({
          name: item.name || item.region || "East",
          sales: Number(item.sales) || 1087,
          target: Number(item.target) || 992,
        }))
        setRegionData(processedRegionData)
      }

      // Process customer data for scatter chart
      if (data.raw_data?.customer_metrics) {
        const processedCustomerData = data.raw_data.customer_metrics.map((item: any) => ({
          satisfaction: Number(item.satisfaction) || 78,
          loyaltyScore: Number(item.loyalty_score) || Number(item.loyaltyScore) || 73,
          size: Number(item.value) || Number(item.size) || 100,
        }))
        setCustomerData(processedCustomerData)
      }

      // Process channel data for pie chart
      if (data.raw_data?.sales_by_channel) {
        const processedChannelData = data.raw_data.sales_by_channel.map((item: any) => ({
          name: item.name || item.channel || "Online",
          value: Number(item.value) || Number(item.sales) || 1.4,
        }))
        setChannelData(processedChannelData)
      }

      // Process executive summary
      if (data.executive_summary) {
        // If executive_summary is an array, use it directly
        if (Array.isArray(data.executive_summary)) {
          setSummaryPoints(data.executive_summary)
        }
        // If it's an object with points property
        else if (data.executive_summary.points && Array.isArray(data.executive_summary.points)) {
          setSummaryPoints(data.executive_summary.points)
        }
        // If it's a string, split by newlines or periods
        else if (typeof data.executive_summary === "string") {
          const points = data.executive_summary
            .split(/\.\s+|\n+/)
            .filter((point) => point.trim().length > 0)
            .map((point) => point.trim() + (point.endsWith(".") ? "" : "."))
          setSummaryPoints(points)
        } else {
          setSummaryPoints(["No executive summary data available in the expected format."])
        }
      }
    } catch (err) {
      console.error("Error processing analysis data:", err)
      setError("Error processing data. Some charts may not display correctly.")
    }
  }

  // Handle sending a chat message
  const handleSendMessage = async () => {
    if (chatInput.trim() === "") return

    // Add user message to chat
    const newMessages = [...chatMessages, { role: "user", content: chatInput }]
    setChatMessages(newMessages)

    // Clear input and show loading state
    const userQuery = chatInput
    setChatInput("")
    setIsChatLoading(true)

    // Add temporary loading message
    setChatMessages([...newMessages, { role: "assistant", content: "Analyzing your request..." }])

    try {
      if (!user?.id) {
        setChatMessages([
          ...newMessages,
          {
            role: "assistant",
            content: "Please log in again to use the reporting assistant.",
          },
        ])
        return
      }

      if (!analysisData) {
        setChatMessages([
          ...newMessages,
          {
            role: "assistant",
            content:
              "Generate a report first — click **Report from Dashboard Leads** or upload a CSV — then I can answer questions about it.",
          },
        ])
        return
      }

      const userId = user.id

      const context = buildChatContext()

      const chatRequest: ChatRequest = {
        user_id: userId,
        query: userQuery,
        conversation_id: conversationId,
        context,
      }

      const response = await ReportingService.handleChat(chatRequest)

      if (ReportingService.isSuccess(response)) {
        const chatResponse = ReportingService.getData(response) as ChatResponse

        if (chatResponse.conversation_id) {
          setConversationId(chatResponse.conversation_id)
        }

        setChatMessages([...newMessages, { role: "assistant", content: chatResponse.response }])
      } else {
        setChatMessages([
          ...newMessages,
          {
            role: "assistant",
            content: response.error || "I'm sorry, I encountered an error processing your request. Please try again.",
          },
        ])
      }
    } catch (err) {
      console.error("Error in chat:", err)
      // Update with error message
      setChatMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "I'm sorry, there was an error communicating with the server. Please try again later.",
        },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Fallback data for when API data is not available
  const fallbackSalesData = [
    { month: "Jan", sales: 4000, calls: 240, leads: 100 },
    { month: "Feb", sales: 3000, calls: 198, leads: 80 },
    { month: "Mar", sales: 2000, calls: 980, leads: 200 },
    { month: "Apr", sales: 2780, calls: 390, leads: 150 },
    { month: "May", sales: 1890, calls: 480, leads: 120 },
    { month: "Jun", sales: 2390, calls: 380, leads: 110 },
  ]

  const fallbackProductData = [
    { name: "Product A", value: 400 },
    { name: "Product B", value: 300 },
    { name: "Product C", value: 300 },
    { name: "Product D", value: 200 },
  ]

  const fallbackRegionData = [
    { name: "North", sales: 4000, target: 3800 },
    { name: "South", sales: 3000, target: 3200 },
    { name: "East", sales: 2000, target: 2400 },
    { name: "West", sales: 2780, target: 2600 },
  ]

  const fallbackCustomerData = [
    { satisfaction: 80, loyaltyScore: 90, size: 200 },
    { satisfaction: 75, loyaltyScore: 85, size: 150 },
    { satisfaction: 70, loyaltyScore: 80, size: 180 },
    { satisfaction: 85, loyaltyScore: 95, size: 220 },
    { satisfaction: 78, loyaltyScore: 88, size: 170 },
  ]

  const fallbackChannelData = [
    { name: "Direct", value: 400 },
    { name: "Social", value: 300 },
    { name: "Email", value: 200 },
    { name: "Affiliate", value: 100 },
  ]

  const fallbackSummaryPoints = [
    "Overall sales have shown a slight decline over the past 6 months, with a 5% decrease compared to the previous period.",
    "Product A continues to be our best-selling item, accounting for 33% of total sales.",
    "The Western region has exceeded its sales target by 7%, while other regions are slightly below their targets.",
    "Customer satisfaction and loyalty scores show a strong positive correlation, indicating effective retention strategies.",
    "Direct sales remain our strongest channel, contributing to 40% of total revenue.",
    "The conversion rate has improved by 2.5 percentage points, reaching 24.5% this month.",
  ]

  // Use API data if available, otherwise use fallback data
  const displaySalesData = salesData.length > 0 ? salesData : fallbackSalesData
  const displayProductData = productData.length > 0 ? productData : fallbackProductData
  const displayRegionData = regionData.length > 0 ? regionData : fallbackRegionData
  const displayCustomerData = customerData.length > 0 ? customerData : fallbackCustomerData
  const displayChannelData = channelData.length > 0 ? channelData : fallbackChannelData
  const displaySummaryPoints = summaryPoints.length > 0 ? summaryPoints : fallbackSummaryPoints

  // Calculate summary metrics from sales data
  const calculateMetrics = () => {
    if (displaySalesData.length === 0) return { totalSales: 0, totalCalls: 0, conversionRate: 0 }

    const totalSales = displaySalesData.reduce((sum, item) => sum + item.sales, 0)
    const totalCalls = displaySalesData.reduce((sum, item) => sum + item.calls, 0)
    const totalLeads = displaySalesData.reduce((sum, item) => sum + (item.leads || 0), 0)

    // Calculate conversion rate (leads to sales)
    const conversionRate = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0

    return {
      totalSales,
      totalCalls,
      conversionRate: conversionRate.toFixed(1),
    }
  }

  const metrics = calculateMetrics()

  // Render the initial data source selection UI
  const renderDataSourceSelection = () => {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-2xl">Generate Business Report</CardTitle>
              <CardDescription>Select a data source to generate your business intelligence report</CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGenerateLeadsReport}
              disabled={isGeneratingLeads || isGenerating}
              className="shrink-0"
            >
              {isGeneratingLeads ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading leads...
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Report from Dashboard Leads
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 mb-8">
              <TabsTrigger value="csv" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                <span>CSV Upload</span>
              </TabsTrigger>
              <TabsTrigger value="sql" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>SQL Server</span>
              </TabsTrigger>
              <TabsTrigger value="s3" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>S3 Storage</span>
              </TabsTrigger>
              <TabsTrigger value="blob" className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span>Blob Storage</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="mt-0">
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
                  <div className="flex justify-center">
                    <FileUp className="h-12 w-12 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Upload CSV File</h3>
                    <p className="text-sm text-gray-500 mt-1">Upload a CSV file containing your business data</p>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button onClick={handleFileUploadClick} variant="outline" className="mr-2">
                      Browse Files
                    </Button>
                  </div>
                  {selectedFile && (
                    <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded flex items-center justify-center">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      {selectedFile.name}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sql" className="mt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server">SQL Server</Label>
                  <Input id="server" placeholder="Server address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database">Database</Label>
                  <Input id="database" placeholder="Database name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" placeholder="Username" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Password" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="s3" className="mt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bucket">S3 Bucket</Label>
                  <Input id="bucket" placeholder="Bucket name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key">Access Key</Label>
                  <Input id="key" placeholder="Access key" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret">Secret Key</Label>
                  <Input id="secret" type="password" placeholder="Secret key" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" placeholder="AWS region" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="blob" className="mt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="connection">Connection String</Label>
                  <Input id="connection" placeholder="Blob storage connection string" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="container">Container</Label>
                  <Input id="container" placeholder="Container name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blobPath">Blob Path</Label>
                  <Input id="blobPath" placeholder="Path to blob" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-end">
          {error && (
            <Alert variant="destructive" className="mr-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleGenerateReport} disabled={isGenerating} className="ml-auto">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              "Generate Report"
            )}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // Render loading animation
  const renderLoadingAnimation = () => {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="relative w-32 h-32">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-lg font-medium text-blue-600">Loading</div>
          </div>
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle
              className="text-gray-200"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r="42"
              cx="50"
              cy="50"
            />
            <circle
              className="text-blue-600 animate-spin origin-center"
              strokeWidth="8"
              strokeDasharray="264, 264"
              strokeDashoffset="125"
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="42"
              cx="50"
              cy="50"
            />
          </svg>
        </div>
        <p className="mt-4 text-gray-600">Analyzing your data and generating insights...</p>
      </div>
    )
  }

  // Render the report content
  const renderReportContent = () => {
    return (
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-6">Business Dashboard</h1>

        {liveMetrics && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">
              Live agent performance (real calls &amp; orders)
            </h2>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Revenue</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold">${liveMetrics.total_sales.toLocaleString()}</p></CardContent></Card>
              <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Orders</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold">{liveMetrics.total_orders}</p></CardContent></Card>
              <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Units sold</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold">{liveMetrics.units_sold}</p></CardContent></Card>
              <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Calls</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold">{liveMetrics.total_calls}</p></CardContent></Card>
              <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Conversion</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold">{liveMetrics.conversion_rate}%</p></CardContent></Card>
              <Card className="shadow-sm"><CardHeader className="pb-2"><CardDescription>Avg sentiment</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-bold">{liveMetrics.avg_sentiment ?? "—"}{liveMetrics.avg_sentiment != null ? "%" : ""}</p></CardContent></Card>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Total Sales</CardTitle>
              <CardDescription>Current period</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">${metrics.totalSales.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Total Calls</CardTitle>
              <CardDescription>Current period</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{metrics.totalCalls.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Conversion Rate</CardTitle>
              <CardDescription>Current period</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{metrics.conversionRate}%</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 mb-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Sales and Leads Overview</CardTitle>
              <CardDescription>Monthly performance</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displaySalesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    yAxisId="left"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    yAxisId="right"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Product Distribution</CardTitle>
              <CardDescription>Sales by product</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={displayProductData} fill="#3B82F6" label />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Regional Sales vs Target</CardTitle>
              <CardDescription>Performance by region</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayRegionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" fill="#3B82F6" />
                  <Bar dataKey="target" fill="#F59E0B" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Customer Satisfaction vs Loyalty</CardTitle>
              <CardDescription>Bubble size represents customer value</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="satisfaction" name="Satisfaction" unit="%" />
                  <YAxis type="number" dataKey="loyaltyScore" name="Loyalty Score" unit="%" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter name="Customers" data={displayCustomerData} fill="#3B82F6">
                    {displayCustomerData.map((entry, index) => (
                      <Scatter key={`cell-${index}`} fill="#3B82F6" />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Sales by Channel</CardTitle>
              <CardDescription>Distribution across channels</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={displayChannelData} fill="#3B82F6" label />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm mb-8">
  <CardHeader>
    <CardTitle>Executive Summary</CardTitle>
    <CardDescription>Key insights from the report</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {displaySummaryPoints.map((point, index) => {
        // Define our main headings that should always be bold and larger
        const mainHeadings = [
          "Quarterly Performance Summary",
          "Top-selling products by region",
          "Key trends",
          "Recommendations",
          "Key Performance Indicators", 
          "Top Selling Products by Region",
          "Significant Trends", 
          "Strategic Recommendations"
        ];
        
        // Check if the current point contains any of our main headings
        const headingMatch = mainHeadings.find(heading => 
          point.includes(heading) || 
          point.includes(`**${heading}**`) || 
          point.includes(`*${heading}*`)
        );
        
        if (headingMatch) {
          // Extract the heading text (removing any existing markdown if present)
          const cleanHeading = headingMatch
            .replace(/\*\*/g, '')
            .replace(/\*/g, '');
            
          // Replace the original text with clean heading
          const cleanPoint = point
            .replace(headingMatch, cleanHeading)
            .replace(/\*\*/g, '')
            .replace(/\*/g, '');
            
          return (
            <div key={index} className="text-xl font-bold text-black mt-6 mb-3">
              {cleanPoint}
            </div>
          );
        }
        
        // Format regular points to handle *text* markers
        const formattedPoint = point.replace(/\*(.*?)\*/g, '<span class="text-lg font-bold text-black">$1</span>');
        
        return (
          <div key={index} className="text-base text-gray-700" dangerouslySetInnerHTML={{ __html: formattedPoint }} />
        );
      })}
    </div>
  </CardContent>
</Card>

        <Card className="shadow-sm mb-8">
  <CardHeader>
    <CardTitle>AI Chat Assistant</CardTitle>
    <CardDescription>Ask questions about your business report</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="h-[300px] overflow-y-auto mb-4 p-4 border border-gray-200 rounded-lg">
      {chatMessages.map((message, index) => (
        <div key={index} className={`mb-4 ${message.role === "user" ? "text-right" : "text-left"}`}>
          {message.role === "user" ? (
            <span className="inline-block p-2 rounded-lg bg-blue-500 text-white">
              {message.content}
            </span>
          ) : (
            <div className="inline-block p-3 rounded-lg bg-gray-200 text-gray-800 max-w-[85%]">
              {formatMessageContent(message.content)}
            </div>
          )}
        </div>
      ))}
      {isChatLoading && (
        <div className="flex items-center gap-2 text-gray-500 mt-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>AI is thinking...</span>
        </div>
      )}
    </div>
    <div className="flex gap-2">
      <Input
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        placeholder="Ask about your business report..."
        onKeyPress={(e) => e.key === "Enter" && !isChatLoading && handleSendMessage()}
        disabled={isChatLoading}
      />
      <Button onClick={handleSendMessage} disabled={isChatLoading || chatInput.trim() === ""}>
        {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Send
      </Button>
    </div>
  </CardContent>
</Card>
      </div>
    )
  }

  return (
    <DashboardLayout>
      {!reportGenerated ? (
        isGenerating ? (
          renderLoadingAnimation()
        ) : (
          renderDataSourceSelection()
        )
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          {renderReportContent()}
        </motion.div>
      )}
    </DashboardLayout>
  )
}