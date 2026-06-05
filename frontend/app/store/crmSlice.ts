import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  lastContact: string;
  uniqueId: string;
}

interface CrmState {
  data: Contact[];
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: CrmState = {
  data: [],
  isLoaded: false,
  isLoading: false,
  error: null,
};

const crmSlice = createSlice({
  name: 'crm',
  initialState,
  reducers: {
    fetchCrmDataStart(state) {
      state.isLoading = true;
      state.error = null;
    },
    fetchCrmDataSuccess(state, action: PayloadAction<Contact[]>) {
      state.data = action.payload;
      state.isLoaded = true;
      state.isLoading = false;
    },
    fetchCrmDataFailure(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const { fetchCrmDataStart, fetchCrmDataSuccess, fetchCrmDataFailure } = crmSlice.actions;
export default crmSlice.reducer;