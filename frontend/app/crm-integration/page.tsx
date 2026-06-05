"use client"

import type React from "react"
import { useSelector } from 'react-redux';
import { RootState } from "@/app/store/store";

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import {
  Upload,
  FileText,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiService } from "@/lib/apis/crmApis"
import { readFile } from "fs/promises"

// Dummy data for CRM platforms
const crmPlatforms = [
  { id: 1, name: "Salesforce", connected: false },
  { id: 2, name: "HubSpot", connected: false },
  { id: 3, name: "Zoho CRM", connected: false },
  { id: 4, name: "Pipedrive", connected: false },
  { id: 5, name: "Freshsales", connected: false },
]

// Dummy data for CRM fields
const crmFields = [
  { id: 1, originalName: "first_name", standardName: "firstName", override: "" },
  { id: 2, originalName: "last_name", standardName: "lastName", override: "" },
  { id: 3, originalName: "email", standardName: "email", override: "" },
  { id: 4, originalName: "phone", standardName: "phoneNumber", override: "" },
  { id: 5, originalName: "company", standardName: "companyName", override: "" },
  { id: 6, originalName: "job_title", standardName: "jobTitle", override: "" },
  { id: 7, originalName: "lead_source", standardName: "leadSource", override: "" },
  { id: 8, originalName: "lead_status", standardName: "leadStatus", override: "" },
]

// Dummy data for extraction logs
const extractionLogs = [
  { id: 1, timestamp: "2025-03-07 10:15:22", message: "Started data extraction from Salesforce", type: "info" },
  { id: 2, timestamp: "2025-03-07 10:15:45", message: "Successfully extracted 245 contacts", type: "success" },
  { id: 3, timestamp: "2025-03-07 10:16:12", message: "Failed to map field 'custom_field_1'", type: "error" },
  { id: 4, timestamp: "2025-03-07 10:17:30", message: "Completed data extraction and mapping", type: "success" },
  { id: 5, timestamp: "2025-03-07 11:30:15", message: "Started data extraction from HubSpot", type: "info" },
  { id: 6, timestamp: "2025-03-07 11:31:22", message: "Successfully extracted 189 contacts", type: "success" },
]

// Define an interface for the uploaded file object
interface UploadedFile {
  id: number;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  status: string;
  records: number;
  progress: number;
  content: any; // Adjust the type based on the actual content structure
}

// Dummy data for uploaded files
const uploadedFiles: UploadedFile[] = []

// Function to get the appropriate icon based on file type
const getFileIcon = (type: string) => {
  switch (type) {
    case "csv":
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    case "xlsx":
      return <FileSpreadsheet className="h-5 w-5 text-blue-500" />
    case "json":
      return <FileText className="h-5 w-5 text-amber-500" />
    default:
      return <File className="h-5 w-5 text-gray-500" />
  }
}

// Function to get the appropriate status badge and icon
const getStatusBadge = (status: string) => {
  switch (status) {
    case "Processed":
      return (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
            Processed
          </Badge>
        </div>
      )
    case "Processing":
      return (
        <div className="flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            Processing
          </Badge>
        </div>
      )
    case "Failed":
      return (
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">
            Failed
          </Badge>
        </div>
      )
    case "Queued":
      return (
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-amber-500" />
          <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            Queued
          </Badge>
        </div>
      )
    case "Uploaded":
      return (
        <div className="flex items-center gap-1.5">
          <Upload className="h-4 w-4 text-gray-500" />
          <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            Uploaded
          </Badge>
        </div>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function CRMIntegrationPage() {
  const user = useSelector((state: RootState) => state.auth.user);

  // Remove the true parameter to not require authentication
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  const [platforms, setPlatforms] = useState(crmPlatforms)
  const [fields, setFields] = useState(crmFields)
  const [logs, setLogs] = useState(extractionLogs)
  const [files, setFiles] = useState(uploadedFiles)
  const [selectedPlatform, setSelectedPlatform] = useState<string | undefined>(undefined)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Handle connecting to a CRM platform




  


  
  const handleConnect = (platformId: number) => {
    console.log("Attempting to connect to platform ID:", platformId);
    const platform = platforms.find((p) => p.id === platformId);
    
    // Special handling for HubSpot OAuth flow
    console.log("handleConnect:",handleConnect)
    if (platform?.name === "HubSpot") {
      window.location.href = 'https://app-na2.hubspot.com/oauth/authorize?client_id=0e6915e3-df08-43cd-acfd-fe908305d1ed&redirect_uri=https://ai-sales-automation-front-end.vercel.app/dashboard&scope=oauth%20crm.objects.contacts.read';
      return;
    }

    // Existing connection logic for other platforms
    setPlatforms(
      platforms.map((platform) => (platform.id === platformId ? { ...platform, connected: true } : platform)),
    );

    // Add a log entry
    if (platform) {
      const newLog = {
        id: logs.length + 1,
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        message: `Connected to ${platform.name}`,
        type: "success",
      }
      setLogs([newLog, ...logs])
    }

    // Reset form
    setSelectedPlatform(undefined)
  }

  // Handle updating a field override
  const handleFieldOverride = (fieldId: number, value: string) => {
    setFields(fields.map((field) => (field.id === fieldId ? { ...field, override: value } : field)))
  }

  // Handle saving field mappings
  const handleSaveMapping = () => {
    // In a real application, this would save the field mappings to the backend
    // For now, we'll just add a log entry to simulate a successful save
    const newLog = {
      id: logs.length + 1,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      message: "Saved field mappings",
      type: "success",
    }
    setLogs([newLog, ...logs])

    // Show an alert for demonstration purposes
    alert("Field mappings saved successfully!")
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    }
  }

  // Update handleFileUpload function to properly read CSV/Excel files
  const handleFileUpload = async () => {
    if (!selectedFile) return
  
    setIsUploading(true)
    setUploadProgress(0)
  
    const fileReader = new FileReader()
    fileReader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        let jsonData: any
  
        // Parse CSV content to JSON
        if (selectedFile.type === 'text/csv') {
          jsonData = parseCSV(content)
        } else if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                  selectedFile.type === 'application/vnd.ms-excel') {
          // For Excel files, you'll need to use a library like xlsx
          // This is just a placeholder for now
          jsonData = content
        }
  
        // Simulate upload progress
        const interval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 100) {
              clearInterval(interval)
              return 100
            }
            return prev + 10
          })
        }, 300)
  
        setTimeout(() => {
          clearInterval(interval)
          setUploadProgress(100)
  
          // Add the file to the list with the parsed JSON content
          const newFile = {
            id: files.length + 1,
            name: selectedFile.name,
            type: selectedFile.name.split('.').pop() || '',
            size: `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`,
            uploadDate: new Date().toISOString().split('T')[0],
            status: 'Uploaded',
            records: Array.isArray(jsonData) ? jsonData.length : 0,
            progress: 0,
            content: jsonData // Store the parsed JSON content
          }
  
          setFiles([newFile, ...files])
          setSelectedFile(null)
          setIsUploading(false)
  
          // Reset file input
          const fileInput = document.getElementById('file-upload') as HTMLInputElement
          if (fileInput) fileInput.value = ''
  
          // Add log entry
          const newLog = {
            id: logs.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            message: `Uploaded file ${selectedFile.name}`,
            type: 'info'
          }
          setLogs([newLog, ...logs])
        }, 3000)
      } catch (error) {
        console.error('Error processing file:', error)
        alert('Error processing file. Please make sure it is a valid CSV or Excel file.')
        setIsUploading(false)
      }
    }
  
    fileReader.onerror = () => {
      setIsUploading(false)
      alert('Error reading file')
    }
  
    fileReader.readAsText(selectedFile)
  }
  
  // Helper function to parse CSV to JSON
  const parseCSV = (csv: string) => {
    const lines = csv.split('\n')
    const headers = lines[0].split(',').map(header => header.trim())
    const result = []
  
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue // Skip empty lines
      
      const currentLine = lines[i].split(',').map(cell => cell.trim())
      const obj: { [key: string]: string } = {}
      
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentLine[j]
      }
      
      result.push(obj)
    }
  
    return result
  }
  
  // Add a function to start processing a file
  const startProcessing = async (fileId: number) => {
    const file = files.find(file => file.id === fileId)
    if (!file) return
  
    setFiles(
      files.map(f => {
        if (f.id === fileId) {
          return { ...f, status: 'Processing', progress: 0 }
        }
        return f
      })
    )
  
    try {
      // Send only the parsed content to the backend
      if (!user?.id) {
        throw new Error("Please log in to upload CRM data.")
      }
      const response = await ApiService.sendUserData({
        user_id: user.id,
        dataset: file.content, // This is already in JSON format
        file_name: file.name
      })
  
      if (response.success) {
        // Handle successful processing
        setFiles(
          files.map(f => {
            if (f.id === fileId) {
              return {
                ...f,
                status: 'Processed',
                progress: 100,
                records: Array.isArray(file.content) ? file.content.length : 0
              }
            }
            return f
          })
        )
  
        // Add success log
        setLogs([
          {
            id: logs.length + 1,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            message: `Successfully processed ${file.name}`,
            type: 'success'
          },
          ...logs
        ])
      } else {
        throw new Error(response.error || 'Processing failed')
      }
    } catch (error) {
      console.error('Processing error:', error)
      
      // Update file status to failed
      setFiles(
        files.map(f => {
          if (f.id === fileId) {
            return { ...f, status: 'Failed', progress: 0 }
          }
          return f
        })
      )
  
      // Add error log
      setLogs([
        {
          id: logs.length + 1,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          message: `Failed to process ${file.name}: ${error}`,
          type: 'error'
        },
        ...logs
      ])
  
      alert(`Failed to process file: ${error}`)
    }
  }
  

  return (
    <DashboardLayout>
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-6 ml-4" >Connect Your Data</h1>

        <Tabs defaultValue="connect" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="connect">Connect CRM</TabsTrigger>
            {/* <TabsTrigger value="mapping">Field Mapping</TabsTrigger> */}
            <TabsTrigger value="data-management">Data Management</TabsTrigger>
            
            <TabsTrigger value="data-management">Upload Reporting Data</TabsTrigger>

            <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="connect">
            <Card>
              <CardHeader>
                <CardTitle>Connect to CRM Platform</CardTitle>
                <CardDescription>Set up connections to your CRM platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {/* <div className="flex items-center gap-4">
                    <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select CRM" />
                      </SelectTrigger>
                      <SelectContent>
                        {platforms.map((platform) => (
                          <SelectItem key={platform.id} value={platform.id.toString()}>
                            {platform.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => {
                        if (selectedPlatform) {
                          handleConnect(Number(selectedPlatform));
                        } else {
                          alert("Please select a CRM platform first");
                        }
                      }}
                    >
                      Connect
                    </Button>
                  </div> */}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {platforms.map((platform) => (
                        <TableRow key={platform.id}>
                          <TableCell>{platform.name}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${platform.connected ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                            >
                              {platform.connected ? "Connected" : "Not Connected"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {platform.connected ? (
                              <Button variant="outline" size="sm">
                                Disconnect
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() =>
                                 {
                                setSelectedPlatform(platform.id.toString())
                                handleConnect(platform.id)
                              }}>
                                Connect
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* <TabsContent value="mapping">
            <Card>
              <CardHeader>
                <CardTitle>Field Mapping</CardTitle>
                <CardDescription>Map CRM fields to standardized fields</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Original Field</TableHead>
                      <TableHead>Standardized Field</Head>
                      <TableHead>Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell>{field.originalName}</TableCell>
                        <TableCell>{field.standardName}</TableCell>
                        <TableCell>
                          <Input
                            placeholder="Custom mapping"
                            value={field.override}
                            onChange={(e) => handleFieldOverride(field.id, e.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSaveMapping}>Save Mapping</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent> */}

          <TabsContent value="data-management">
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Upload and manage data files for CRM integration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <div className="p-6 border border-dashed rounded-lg bg-gray-50">
                    <div className="flex flex-col items-center text-center">
                      <Database className="h-10 w-10 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium mb-2">Upload Data File</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Upload CSV, Excel, or JSON files to import into your CRM
                      </p>

                      <div className="w-full max-w-md space-y-4">
                        <div className="flex flex-col gap-2">
                          <label htmlFor="file-upload" className="text-sm font-medium text-left">
                            Select File
                          </label>
                          <Input
                            id="file-upload"
                            type="file"
                            accept=".csv,.xlsx,.xls,.json"
                            onChange={handleFileChange}
                          />
                        </div>

                        {isUploading && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Uploading...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-2" />
                          </div>
                        )}

                        <Button className="w-full" onClick={handleFileUpload} disabled={!selectedFile || isUploading}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload File
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">Uploaded Files</h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>File Name</TableHead>
                            <TableHead>Upload Date</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Records</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {files.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                No files uploaded yet. Upload a file to see it here.
                              </TableCell>
                            </TableRow>
                          ) : (
                            files.map((file) => (
                              <TableRow key={file.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getFileIcon(file.type)}
                                    <span className="font-medium">{file.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    {file.uploadDate}
                                  </div>
                                </TableCell>
                                <TableCell>{file.size}</TableCell>
                                <TableCell>{getStatusBadge(file.status)}</TableCell>
                                <TableCell>
                                  {file.status === "Processing" ? (
                                    <div className="flex items-center gap-2">
                                      <Progress value={file.progress} className="h-2 w-16" />
                                      <span className="text-xs text-muted-foreground">{file.progress}%</span>
                                    </div>
                                  ) : (
                                    file.records.toLocaleString()
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {file.status === "Uploaded" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex items-center gap-1"
                                        onClick={() => startProcessing(file.id)}
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Process
                                      </Button>
                                    )}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                          <span className="sr-only">Open menu</span>
                                          <File className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="cursor-pointer">
                                          <Eye className="mr-2 h-4 w-4" />
                                          <span>View Details</span>
                                        </DropdownMenuItem>
                                        {file.status === "Processed" && (
                                          <DropdownMenuItem className="cursor-pointer">
                                            <Download className="mr-2 h-4 w-4" />
                                            <span>Download</span>
                                          </DropdownMenuItem>
                                        )}
                                        {file.status === "Failed" && (
                                          <DropdownMenuItem className="cursor-pointer">
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            <span>Retry</span>
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="cursor-pointer text-red-600">
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          <span>Delete</span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Activity Logs</CardTitle>
                <CardDescription>View recent CRM integration activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] overflow-y-auto border rounded-md p-4">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`mb-2 p-2 rounded-md ${
                        log.type === "error"
                          ? "bg-red-50 text-red-800"
                          : log.type === "success"
                            ? "bg-green-50 text-green-800"
                            : "bg-blue-50 text-blue-800"
                      }`}
                    >
                      <span className="text-xs font-mono">{log.timestamp}</span>
                      <p>{log.message}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

