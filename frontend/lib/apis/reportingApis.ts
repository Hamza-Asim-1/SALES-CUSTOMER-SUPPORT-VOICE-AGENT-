// reportingService.ts
import axios, { type AxiosError, type AxiosResponse } from "axios"

import { getReportingApiBase } from "@/lib/reporting-url"

const API_BASE_URL = getReportingApiBase()

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  
  timeout: 2000000,
})

// Chat-specific interfaces
interface ChatRequest {
  user_id: string | number
  query: string
  conversation_id?: string // Optional for continuing conversations
  context?: Record<string, any> // Additional context parameters
}

interface ChatResponse {
  response: string
  conversation_id?: string
  timestamp: string
  confidence_score?: number
}

// Updated AnalysisReport interface (maintained from previous implementation)
interface AnalysisReport {
  schema_info: any
  insights: any
  chart_requirements: any
  raw_data: any
  executive_summary: any
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Unified error handler
const handleApiError = (error: unknown): ApiResponse => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>

    if (!axiosError.response) {
      return { success: false, error: "Network error. Please check your connection." }
    }

    const status = axiosError.response.status
    const errorData = axiosError.response.data

    switch (status) {
      case 400:
        return { success: false, error: errorData?.detail || "Invalid request format" }
      case 429:
        return { success: false, error: "Too many requests. Please wait before trying again." }
      case 500:
        return { success: false, error: "Server error processing your request" }
      default:
        return { success: false, error: `Error ${status}: ${errorData?.detail || axiosError.message}` }
    }
  }
  return { success: false, error: error instanceof Error ? error.message : "Unknown error occurred" }
}

// Response handler remains generic
const handleApiResponse = <T>(response: AxiosResponse<T>): ApiResponse<T> => ({
  success: true,
  data: response.data,
  message: 'Request processed successfully',
});

export const ReportingService = {
  /**
   * Get complete analysis report
   */
  getAnalysis: async (): Promise<ApiResponse<AnalysisReport>> => {
    try {
      
      const response = await apiClient.get<AnalysisReport>('/analyze');
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Handle chat conversation with the AI
   * @param chatRequest - The chat request parameters
   * @returns Promise with chatbot response
   */
  handleChat: async (chatRequest: ChatRequest): Promise<ApiResponse<ChatResponse>> => {
    try {
      if (!chatRequest.query?.trim()) return { success: false, error: 'Query cannot be empty' };

      const response = await fetch(`${getReportingApiBase()}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatRequest),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData?.detail || `Error ${response.status}: ${response.statusText}`,
        }
      }

      const data = (await response.json()) as ChatResponse
      return { success: true, data, message: "Chat response received" }
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Helper methods remain unchanged
  isSuccess: <T>(apiResponse: ApiResponse<T>): boolean => apiResponse.success,
  getData: <T>(apiResponse: ApiResponse<T>): T | null => apiResponse.success && apiResponse.data ? apiResponse.data : null,
};

// Export type definitions for external use
export type { ChatRequest, ChatResponse, AnalysisReport };

// Helper function to format chat response
export const formatChatResponse = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<span class='text-xl font-bold text-black'>$1</span>") // Convert **text** to large bold black text
    .replace(/\*(.*?)\*/g, "<span class='text-lg font-bold text-black'>$1</span>") // Convert *text* to medium bold black text
    .replace(/\n/g, "<br />") // Convert newlines to <br />
    .replace(/\n\s*\n/g, "<br /><br />") // Convert double newlines to double <br />
    .replace(/\|(.*?)\|/g, (match: string, content: string) => {
      // Check if this is a table row
      if (content.includes("---")) {
        return "" // Skip the separator row
      }
      // Convert table row to HTML
      const cells = content.split("|").map((cell: string) => cell.trim())
      return `<tr>${cells.map((cell: string) => `<td class='px-4 py-2'>${cell}</td>`).join("")}</tr>`
    })
    .replace(/(<tr>.*<\/tr>)/g, '<table class="min-w-full divide-y divide-gray-200 my-4 border"><tbody>$1</tbody></table>') // Wrap table rows in table tags
    .trim()
}