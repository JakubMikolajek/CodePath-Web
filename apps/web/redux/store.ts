import { configureStore } from '@reduxjs/toolkit'

import authReducer from './slices/authSlice'
import chatReducer from './slices/chatSlice'
import collapsibleReducer from './slices/collapsibleSlice'
import graphsReducer from './slices/graphsSlice'
import reposReducer from './slices/reposSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    collapsible: collapsibleReducer,
    graphs: graphsReducer,
    repos: reposReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
