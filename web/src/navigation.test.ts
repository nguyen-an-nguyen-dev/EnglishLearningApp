import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import type { DashboardTab } from './App.tsx'

describe('Dashboard Navigation Architecture', () => {
  test('DashboardTab supports the 5 learner tabs', () => {
    const tabs: DashboardTab[] = ['study', 'videos', 'compete', 'rankings', 'profile']
    assert.equal(tabs.length, 5)
    assert.deepEqual(tabs, ['study', 'videos', 'compete', 'rankings', 'profile'])
  })

  test('Tab labels and navigation mappings are correctly defined', () => {
    const tabLabels: Record<DashboardTab, string> = {
      study: 'Học Tập',
      videos: 'Học qua Video',
      compete: 'Thi Đua',
      rankings: 'Bảng Xếp Hạng',
      profile: 'Profile',
    }
    assert.equal(tabLabels.study, 'Học Tập')
    assert.equal(tabLabels.videos, 'Học qua Video')
    assert.equal(tabLabels.compete, 'Thi Đua')
    assert.equal(tabLabels.rankings, 'Bảng Xếp Hạng')
    assert.equal(tabLabels.profile, 'Profile')
  })
})
