import { configureStore } from '@reduxjs/toolkit'

import authReducer from './slices/authSlice'
import chatReducer from './slices/chatSlice'
import collapsibleReducer from './slices/collapsibleSlice'
import evaluationReducer from './slices/evaluationSlice'
import graphsReducer from './slices/graphsSlice'
import reposReducer from './slices/reposSlice'
import { SliceName } from './sliceName'

export const store = configureStore({
  reducer: {
    [SliceName.AUTH]: authReducer,
    [SliceName.CHAT]: chatReducer,
    [SliceName.COLLAPSIBLE]: collapsibleReducer,
    [SliceName.EVALUATION]: evaluationReducer,
    [SliceName.GRAPHS]: graphsReducer,
    [SliceName.REPOS]: reposReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
