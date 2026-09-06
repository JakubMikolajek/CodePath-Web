import { configureStore } from '@reduxjs/toolkit'

import { baseApi } from './api/baseApi'
import { SliceName } from './sliceName'
import authReducer from './slices/authSlice'
import chatReducer from './slices/chatSlice'
import collapsibleReducer from './slices/collapsibleSlice'

export const store = configureStore({
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(baseApi.middleware),
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    [SliceName.AUTH]: authReducer,
    [SliceName.CHAT]: chatReducer,
    [SliceName.COLLAPSIBLE]: collapsibleReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
