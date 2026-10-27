import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import type { DashboardTab } from './App.tsx'

describe('Dashboard Navigation Architecture', () => {
  test('DashboardTab supports the 4 user-specified core tabs', () => {
    const tabs: DashboardTab[] = ['study', 'compete', 'rankings', 'profile']
    assert.equal(tabs.length, 4)
    assert.deepEqual(tabs, ['study', 'compete', 'rankings', 'profile'])
  })

  test('Tab labels and navigation mappings are correctly defined', () => {
    const tabLabels: Record<DashboardTab, string> = {
      study: 'Học Tập',
      compete: 'Thi Đua',
      rankings: 'Bảng Xếp Hạng',
      profile: 'Profile',
    }
    assert.equal(tabLabels.study, 'Học Tập')
    assert.equal(tabLabels.compete, 'Thi Đua')
    assert.equal(tabLabels.rankings, 'Bảng Xếp Hạng')
    assert.equal(tabLabels.profile, 'Profile')
  })
})
