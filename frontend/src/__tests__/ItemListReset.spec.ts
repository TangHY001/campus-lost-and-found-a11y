import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { listItems, type PublicItem } from '@/api/items'
import { ApiError } from '@/api/http'
import ItemListView from '@/views/item/ItemListView.vue'

vi.mock('@/api/items', () => ({ listItems: vi.fn<typeof listItems>() }))

const item: PublicItem = {
  id: '42',
  type: 'FOUND',
  category: 'OTHER',
  title: '测试水杯',
  location: '图书馆',
  occurredDate: '2026-11-01',
  description: '用于检索回归测试的虚构水杯',
  publisher: { id: '1', nickname: '测试发布人' },
  images: [],
  hasConfirmedClaim: false,
  publishedAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listItems).mockImplementation(async (page) => ({
    items: [item],
    page,
    pageSize: 10,
    total: 21,
  }))
})

async function openPage() {
  const wrapper = mount(ItemListView, {
    global: { plugins: [ElementPlus], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

function resetButton(wrapper: VueWrapper) {
  const button = wrapper.findAll('button').find((node) => node.text() === '重置筛选')
  if (!button) throw new Error('缺少重置筛选按钮')
  return button
}

async function setFilters(wrapper: VueWrapper) {
  await wrapper.get('input[aria-label="关键词"]').setValue('水杯')
  await wrapper.get('input[aria-label="地点"]').setValue('图书馆')
  const selects = wrapper.findAllComponents({ name: 'ElSelect' })
  selects[0]!.vm.$emit('update:modelValue', 'FOUND')
  selects[1]!.vm.$emit('update:modelValue', 'OTHER')
  const dates = wrapper.findAll('input[type="date"]')
  await dates[0]!.setValue('2026-11-01')
  await dates[1]!.setValue('2026-11-20')
}

describe('CH-B-01 公开检索重置筛选', () => {
  it('TC-RESET-01 清空六项条件并从第二页返回全部公开物品的第一页', async () => {
    const wrapper = await openPage()
    await setFilters(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(listItems).toHaveBeenLastCalledWith(1, {
      keyword: '水杯',
      type: 'FOUND',
      category: 'OTHER',
      location: '图书馆',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-20',
    })
    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2)
    await flushPromises()
    expect(listItems).toHaveBeenLastCalledWith(2, expect.objectContaining({ keyword: '水杯' }))
    await resetButton(wrapper).trigger('click')
    await flushPromises()
    expect(listItems).toHaveBeenLastCalledWith(1, {})
    for (const input of wrapper.findAll('input'))
      expect((input.element as HTMLInputElement).value).toBe('')
    expect(wrapper.findComponent({ name: 'ElPagination' }).props('currentPage')).toBe(1)
    expect(wrapper.text()).toContain('测试水杯')
    wrapper.unmount()
  })

  it('TC-RESET-02 请求处理中禁用重置且不重复发出查询', async () => {
    const wrapper = await openPage()
    let finish!: (value: Awaited<ReturnType<typeof listItems>>) => void
    vi.mocked(listItems).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await wrapper.get('form').trigger('submit')
    expect(resetButton(wrapper).attributes('disabled')).toBeDefined()
    const count = vi.mocked(listItems).mock.calls.length
    await resetButton(wrapper).trigger('click')
    expect(listItems).toHaveBeenCalledTimes(count)
    finish({ items: [], page: 1, pageSize: 10, total: 0 })
    await flushPromises()
    expect(resetButton(wrapper).attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('TC-RESET-03 重置查询失败后提示错误并允许以空条件重试', async () => {
    const wrapper = await openPage()
    await setFilters(wrapper)
    vi.mocked(listItems).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', '重置查询失败'))
    await resetButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('重置查询失败')
    expect(resetButton(wrapper).attributes('disabled')).toBeUndefined()
    await resetButton(wrapper).trigger('click')
    await flushPromises()
    expect(listItems).toHaveBeenLastCalledWith(1, {})
    expect(wrapper.text()).not.toContain('重置查询失败')
    wrapper.unmount()
  })

  it('TC-RESET-04 重复重置保持空条件，重置后仍可重新搜索', async () => {
    const wrapper = await openPage()
    for (let i = 0; i < 2; i++) {
      await resetButton(wrapper).trigger('click')
      await flushPromises()
      expect(listItems).toHaveBeenLastCalledWith(1, {})
    }
    await wrapper.get('input[aria-label="关键词"]').setValue('钥匙')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(listItems).toHaveBeenLastCalledWith(1, expect.objectContaining({ keyword: '钥匙' }))
    wrapper.unmount()
  })

  it('TC-REG-01 翻页继续使用已提交条件，不误用尚未搜索的新输入', async () => {
    const wrapper = await openPage()
    await wrapper.get('input[aria-label="关键词"]').setValue('水杯')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('input[aria-label="关键词"]').setValue('钥匙')
    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2)
    await flushPromises()
    expect(listItems).toHaveBeenLastCalledWith(2, expect.objectContaining({ keyword: '水杯' }))
    wrapper.unmount()
  })

  it('TC-REG-02 初次访问仍查询第一页并展示公开物品', async () => {
    const wrapper = await openPage()
    expect(listItems).toHaveBeenCalledWith(1, {})
    expect(wrapper.text()).toContain('测试水杯')
    wrapper.unmount()
  })
})
