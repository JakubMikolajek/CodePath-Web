import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { Nullable } from '@workspace/codepath-common/globals'

import { getApiErrorMessage } from '@/lib/api/error'
import {
  getRepoEvaluationRuns,
  getRepoEvaluationTrend,
  getRunMetrics,
  triggerEvaluationRun,
  type EvaluationMetric,
  type EvaluationRun,
  type EvaluationRunType,
  type EvaluationTrendPoint,
  type TriggerEvaluationResponse
} from '@/lib/evaluations'
import { SliceName } from '@/redux/sliceName'

interface EvaluationState {
  error: Nullable<string>
  metrics: EvaluationMetric[]
  metricsError: Nullable<string>
  metricsStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error'
  runs: EvaluationRun[]
  runsStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error'
  selectedRunId: Nullable<number>
  trend: EvaluationTrendPoint[]
  trendError: Nullable<string>
  trendStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error'
  triggerError: Nullable<string>
  triggerMessage: Nullable<string>
  triggerStatus: 'idle' | 'loading' | 'success' | 'error'
}

const initialState: EvaluationState = {
  error: null,
  metrics: [],
  metricsError: null,
  metricsStatus: 'idle',
  runs: [],
  runsStatus: 'idle',
  selectedRunId: null,
  trend: [],
  trendError: null,
  trendStatus: 'idle',
  triggerError: null,
  triggerMessage: null,
  triggerStatus: 'idle'
}

export const getEvaluationRuns = createAsyncThunk('evaluation/getEvaluationRuns',
  async ({ limit, repoId }: { limit?: number; repoId: number }, { rejectWithValue }) => {
    try {
      return await getRepoEvaluationRuns(repoId, limit)
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error, 'Cannot fetch evaluation runs'))
    }
  }
)

export const getEvaluationTrend = createAsyncThunk('evaluation/getEvaluationTrend',
  async (repoId: number, { rejectWithValue }) => {
    try {
      return await getRepoEvaluationTrend(repoId)
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error, 'Cannot fetch evaluation trend'))
    }
  }
)

export const getEvaluationRunMetrics = createAsyncThunk('evaluation/getEvaluationRunMetrics',
  async ({ repoId, runId }: { repoId: number; runId: number }, { rejectWithValue }) => {
    try {
      return await getRunMetrics(repoId, runId)
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error, 'Cannot fetch evaluation metrics'))
    }
  }
)

export const triggerEvaluation = createAsyncThunk('evaluation/triggerEvaluation',
  async ({ repoId, runType }: { repoId: number; runType: EvaluationRunType }, { rejectWithValue }) => {
    try {
      return await triggerEvaluationRun(repoId, runType)
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error, 'Cannot trigger evaluation run'))
    }
  }
)

const evaluationSlice = createSlice({
  initialState,
  name: SliceName.EVALUATION,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(getEvaluationRuns.pending, state => {
      state.error = null
      state.runs = []
      state.runsStatus = 'loading'
    }).addCase(getEvaluationRuns.fulfilled, (state, action) => {
      state.runs = action.payload
      state.runsStatus = action.payload.length > 0 ? 'success' : 'empty'
      state.error = null
    }).addCase(getEvaluationRuns.rejected, (state, action) => {
      state.error = action.payload as string
      state.runsStatus = 'error'
    }).addCase(getEvaluationTrend.pending, state => {
      state.trend = []
      state.trendError = null
      state.trendStatus = 'loading'
    }).addCase(getEvaluationTrend.fulfilled, (state, action) => {
      state.trend = action.payload
      state.trendStatus = action.payload.length > 0 ? 'success' : 'empty'
      state.trendError = null
    }).addCase(getEvaluationTrend.rejected, (state, action) => {
      state.trendError = action.payload as string
      state.trendStatus = 'error'
    }).addCase(getEvaluationRunMetrics.pending, (state, action) => {
      state.metrics = []
      state.metricsError = null
      state.metricsStatus = 'loading'
      state.selectedRunId = action.meta.arg.runId
    }).addCase(getEvaluationRunMetrics.fulfilled, (state, action) => {
      state.metrics = action.payload
      state.metricsStatus = action.payload.length > 0 ? 'success' : 'empty'
      state.metricsError = null
    }).addCase(getEvaluationRunMetrics.rejected, (state, action) => {
      state.metricsError = action.payload as string
      state.metricsStatus = 'error'
    }).addCase(triggerEvaluation.pending, state => {
      state.triggerError = null
      state.triggerMessage = null
      state.triggerStatus = 'loading'
    }).addCase(triggerEvaluation.fulfilled, (state, action: { payload: TriggerEvaluationResponse }) => {
      state.triggerError = null
      state.triggerMessage = action.payload.message
      state.triggerStatus = 'success'
    }).addCase(triggerEvaluation.rejected, (state, action) => {
      state.triggerError = action.payload as string
      state.triggerStatus = 'error'
    })
  }
})

export default evaluationSlice.reducer
