// api.ts
import axios, { AxiosError, AxiosResponse } from 'axios';

// Define the base URL for the API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://fyp-q0ac.onrender.com';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 200000, // 30 seconds timeout
});

// Interface definitions based on your API structure
interface UserData {
  user_id: string | number;
  dataset: any;
  file_name: string; // Note: there's a typo in your original code (filen_name vs file_name)
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ProcessingStartResponse {
  message: string;
  task_id?: string;
}

interface ProcessingStopResponse {
  message: string;
  task_ids?: string[];
}

interface StatusResponse {
  pending_rows: any[];
}

// Error handling helper
const handleApiError = (error: unknown): ApiResponse => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    
    // Handle different error scenarios
    if (!axiosError.response) {
      // Network error or server not responding
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
    
    const status = axiosError.response.status;
    const errorData = axiosError.response.data;
    
    if (status === 404) {
      return {
        success: false,
        error: 'Resource not found.',
      };
    } else if (status === 401) {
      return {
        success: false,
        error: 'Authentication required. Please log in again.',
      };
    } else if (status === 403) {
      return {
        success: false,
        error: 'You do not have permission to access this resource.',
      };
    } else if (status === 500) {
      return {
        success: false,
        error: `Server error: ${errorData?.detail || 'Unknown server error'}`,
      };
    } else {
      return {
        success: false,
        error: errorData?.detail || `Error ${status}: ${axiosError.message}`,
      };
    }
  }
  
  // Generic error handler for non-Axios errors
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error occurred',
  };
};

// Wrapper function to handle API responses consistently
const handleApiResponse = <T>(response: AxiosResponse<T>): ApiResponse<T> => {
  return {
    success: true,
    data: response.data,
    message: 'Request successful',
  };
};

/**
 * API Service for interacting with the backend
 */
export const ApiService = {
  /**
   * Send user data to the backend
   * @param userData User data object containing user_id, dataset, and file_name
   * @returns Promise with the response data
   */
  sendUserData: async (userData: UserData): Promise<ApiResponse> => {
    try {
      // Validate required fields
      if (!userData.user_id) {
        return { success: false, error: 'User ID is required' };
      }
      if (!userData.dataset) {
        return { success: false, error: 'Dataset is required' };
      }
      if (!userData.file_name) {
        return { success: false, error: 'File name is required' };
      }

      const response = await apiClient.post('/receive_data', userData);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Get user data by user ID
   * @param userId The ID of the user
   * @returns Promise with the user data
   */
  getUserData: async (userId: string | number): Promise<ApiResponse> => {
    try {
      // Validate required parameter
      if (!userId) {
        return { success: false, error: 'User ID is required' };
      }

      const response = await apiClient.get('/get-user-data/', {
        params: { user_id: userId },
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Get mapped user data by user ID
   * @param userId The ID of the user
   * @returns Promise with the mapped user data
   */
  getMappedUserData: async (userId: string | number): Promise<ApiResponse> => {
    try {
      // Validate required parameter
      if (!userId) {
        return { success: false, error: 'User ID is required' };
      }

      const response = await apiClient.get('/get-user-mapped-data/', {
        params: { user_id: userId },
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Start processing data for a user
   * @param userId The ID of the user
   * @param numAgents Number of agents to use for processing
   * @returns Promise with the processing start response
   */
  startProcessing: async (
    userId: string | number, 
    numAgents: number
  ): Promise<ApiResponse<ProcessingStartResponse>> => {
    try {
      // Validate required parameters
      if (!userId) {
        return { success: false, error: 'User ID is required' };
      }
      if (!numAgents || numAgents <= 0) {
        return { success: false, error: 'Number of agents must be greater than 0' };
      }

      const response = await apiClient.post('/start-processing', null, {
        params: {
          user_id: userId,
          num_agents: numAgents
        }
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Stop processing data for a user
   * @param userId The ID of the user
   * @returns Promise with the processing stop response
   */
  stopProcessing: async (userId: string | number): Promise<ApiResponse<ProcessingStopResponse>> => {
    try {
      // Validate required parameter
      if (!userId) {
        return { success: false, error: 'User ID is required' };
      }

      const response = await apiClient.post('/stop-processing', null, {
        params: { user_id: userId }
      });
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Check the processing status for a user
   * @param userId The ID of the user
   * @returns Promise with the status response
   */
  checkStatus: async (userId: string | number): Promise<ApiResponse<StatusResponse>> => {
    try {
      // Validate required parameter
      if (!userId) {
        return { success: false, error: 'User ID is required' };
      }

      const response = await apiClient.get(`/status/${userId}`);
      return handleApiResponse(response);
    } catch (error) {
      return handleApiError(error);
    }
  },

  /**
   * Helper method to check if a response was successful
   * @param apiResponse The API response to check
   * @returns True if the response was successful, false otherwise
   */
  isSuccess: <T>(apiResponse: ApiResponse<T>): boolean => {
    return apiResponse.success === true;
  },

  /**
   * Helper method to extract data from a response
   * @param apiResponse The API response to extract data from
   * @returns The data from the response or null if unsuccessful
   */
  getData: <T>(apiResponse: ApiResponse<T>): T | null => {
    return apiResponse.success && apiResponse.data ? apiResponse.data : null;
  }
};

export default ApiService;