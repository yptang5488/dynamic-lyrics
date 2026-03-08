import type { WorkflowState } from '../types/api'

const STORAGE_KEY = 'dynamic-lyrics:workflow'

export function saveWorkflow(workflow: WorkflowState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(workflow))
}

export function loadWorkflow() {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as WorkflowState
  } catch {
    return null
  }
}

export function clearWorkflow() {
  sessionStorage.removeItem(STORAGE_KEY)
}
