import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SyncCoordinator } from './SyncCoordinator'
import type { FullSync, FullSyncOutput } from '@application/use-cases/sync/FullSync'

const makeMockFullSync = (result: Partial<FullSyncOutput> = {}): FullSync => ({
  execute: vi.fn().mockResolvedValue({
    messagesReceived: 0,
    messagesSent: 0,
    success: true,
    ...result,
  }),
}) as unknown as FullSync

describe('SyncCoordinator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not be running initially', () => {
    const coordinator = new SyncCoordinator(makeMockFullSync())
    expect(coordinator.isRunning).toBe(false)
  })

  it('should schedule and perform sync after delay', async () => {
    const mockFullSync = makeMockFullSync()
    const coordinator = new SyncCoordinator(mockFullSync)

    coordinator.scheduleSync(1000)
    expect(mockFullSync.execute).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()
    expect(mockFullSync.execute).toHaveBeenCalledOnce()
  })

  it('should reschedule on failed sync', async () => {
    const mockFullSync = makeMockFullSync({ success: false })
    const coordinator = new SyncCoordinator(mockFullSync)

    coordinator.scheduleSync(100)
    // Advance only enough to fire the initial sync (not the reschedule at 5000ms)
    await vi.advanceTimersByTimeAsync(100)

    // After failed sync (success: false), should have rescheduled
    expect(mockFullSync.execute).toHaveBeenCalledOnce()
    expect(coordinator.isRunning).toBe(true)
    coordinator.stopSync()
  })

  it('should stop sync when stopSync is called', async () => {
    const mockFullSync = makeMockFullSync()
    const coordinator = new SyncCoordinator(mockFullSync)

    coordinator.scheduleSync(5000)
    expect(coordinator.isRunning).toBe(true)

    coordinator.stopSync()
    expect(coordinator.isRunning).toBe(false)
    expect(mockFullSync.execute).not.toHaveBeenCalled()
  })

  it('should reset timer when scheduleSync is called again', async () => {
    const mockFullSync = makeMockFullSync()
    const coordinator = new SyncCoordinator(mockFullSync)

    coordinator.scheduleSync(5000)
    coordinator.scheduleSync(1000) // reset

    await vi.runAllTimersAsync()
    expect(mockFullSync.execute).toHaveBeenCalledOnce()
  })

  it('should perform sync immediately when called directly', async () => {
    const mockFullSync = makeMockFullSync()
    const coordinator = new SyncCoordinator(mockFullSync)

    await coordinator.performSync()
    expect(mockFullSync.execute).toHaveBeenCalledOnce()
  })
})
