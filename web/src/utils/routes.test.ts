import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ADMIN_VIEWS, adminPath, adminViewForLocation } from '../admin/adminRoute'
import { DASHBOARD_TABS, LEARNER_PATHS, learnerTabForPath } from './learnerRoutes'

test('each learner tab has a distinct URL that resolves directly', () => {
  assert.equal(new Set(Object.values(LEARNER_PATHS)).size, DASHBOARD_TABS.length)
  for (const tab of DASHBOARD_TABS) {
    assert.equal(learnerTabForPath(LEARNER_PATHS[tab]), tab)
    assert.equal(learnerTabForPath(LEARNER_PATHS[tab] + '/'), tab)
  }
  assert.equal(learnerTabForPath('/'), undefined)
  assert.equal(learnerTabForPath('/videolearning/unknown'), undefined)
})

test('admin URLs and legacy hash links resolve without overriding explicit routes', () => {
  for (const view of ADMIN_VIEWS) {
    assert.equal(adminViewForLocation(adminPath(view), ''), view)
    assert.equal(adminViewForLocation('/', `#${adminPath(view)}`), view)
  }
  assert.equal(adminViewForLocation('/admin', ''), 'overview')
  assert.equal(adminViewForLocation('/admin', '#/admin/stats'), 'stats')
  assert.equal(adminViewForLocation('/admin/users', '#/admin/stats'), 'users')
  assert.equal(adminViewForLocation('/admin-guide', ''), undefined)
  assert.equal(adminViewForLocation('/profile', '#/admin/users'), undefined)
})
