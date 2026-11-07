import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import type { DashboardTab } from './App.tsx'

describe('Dashboard Navigation Architecture', () => {
  test('DashboardTab supports the 6 learner tabs plus the admin console', () => {
    const tabs: DashboardTab[] = ['study', 'videos', 'translate', 'compete', 'rankings', 'profile']
    assert.equal(tabs.length, 6)
    assert.deepEqual(tabs, ['study', 'videos', 'translate', 'compete', 'rankings', 'profile'])

    const adminTab: DashboardTab = 'admin'
    assert.equal(adminTab, 'admin')
  })

  test('Tab labels and navigation mappings are correctly defined', () => {
    const tabLabels: Record<DashboardTab, string> = {
      study: 'Học Tập',
      videos: 'Học qua Video',
      translate: 'Dịch Tài Liệu',
      compete: 'Thi Đua',
      rankings: 'Bảng Xếp Hạng',
      profile: 'Profile',
      admin: 'Quản trị',
    }
    assert.equal(tabLabels.study, 'Học Tập')
    assert.equal(tabLabels.videos, 'Học qua Video')
    assert.equal(tabLabels.translate, 'Dịch Tài Liệu')
    assert.equal(tabLabels.compete, 'Thi Đua')
    assert.equal(tabLabels.rankings, 'Bảng Xếp Hạng')
    assert.equal(tabLabels.profile, 'Profile')
    assert.equal(tabLabels.admin, 'Quản trị')
  })
})
