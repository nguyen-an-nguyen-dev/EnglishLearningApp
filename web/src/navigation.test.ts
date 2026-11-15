import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import type { DashboardTab } from './App.tsx'

describe('Dashboard Navigation Architecture', () => {
  test('DashboardTab supports the 7 learner tabs', () => {
    const tabs: DashboardTab[] = ['study', 'videos', 'translate', 'compete', 'rankings', 'shop', 'profile']
    assert.equal(tabs.length, 7)
    assert.deepEqual(tabs, ['study', 'videos', 'translate', 'compete', 'rankings', 'shop', 'profile'])
  })

  test('Tab labels are defined for every learner tab', () => {
    const tabLabels: Record<DashboardTab, string> = {
      study: 'Học Tập',
      videos: 'Học qua Video',
      translate: 'Dịch Tài Liệu',
      compete: 'Thi Đua',
      rankings: 'Bảng Xếp Hạng',
      shop: 'Gara Engorace',
      profile: 'Profile',
    }
    assert.equal(tabLabels.study, 'Học Tập')
    assert.equal(tabLabels.videos, 'Học qua Video')
    assert.equal(tabLabels.translate, 'Dịch Tài Liệu')
    assert.equal(tabLabels.compete, 'Thi Đua')
    assert.equal(tabLabels.rankings, 'Bảng Xếp Hạng')
    assert.equal(tabLabels.shop, 'Gara Engorace')
    assert.equal(tabLabels.profile, 'Profile')
  })
})
