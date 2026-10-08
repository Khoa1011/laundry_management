import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { BagContext, ProcessingGroup } from './types'
import { SortingPage, WaitingPage } from './SortingPages'

const mocks = vi.hoisted(() => ({
  scan:vi.fn(),confirm:vi.fn(),reopen:vi.fn(),print:vi.fn(),waiting:vi.fn(),stats:vi.fn(),filterOptions:vi.fn(),
  notify:vi.fn(),subscribe:vi.fn(),labelSubmit:vi.fn(),labelClose:vi.fn(),permissions:new Set<string>(),
}))
vi.mock('../../auth/AuthProvider',() => ({ useAuth:() => ({branchId:1,hasPermission:(code:string) => mocks.permissions.has(code)}) }))
vi.mock('../../providers/ToastProvider',() => ({ useToast:() => ({notify:mocks.notify}) }))
vi.mock('../../realtime/context',() => ({ useRealtime:() => ({subscribe:mocks.subscribe}) }))
vi.mock('./GroupLabels',() => ({openGroupLabelSession:() => ({submit:mocks.labelSubmit,close:mocks.labelClose})}))
vi.mock('./api',async(importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {...actual,sortingApi:{...actual.sortingApi,scan:mocks.scan,confirm:mocks.confirm,reopen:mocks.reopen,print:mocks.print,waiting:mocks.waiting,stats:mocks.stats,filterOptions:mocks.filterOptions}}
})

const base:BagContext = {
  bagId:31,bagCode:'CN01-DH-000007-01',bagSequence:1,activeBagCount:1,lastUnsortedBag:true,
  bagStatus:'RECEIVED',bagVersion:0,bagCreatedAt:'2026-10-08T10:00:00Z',orderId:7,orderCode:'CN01-DH-000007',
  orderStatus:'RECEIVED',customerName:'Trần Thị Mai',items:[{id:41,serviceCode:'WASH',serviceName:'Giặt sấy',
    itemTypeCode:'CLOTHES',itemTypeName:'Quần áo',serviceId:2,itemTypeId:3,unitType:'KG',sharingMode:'ANY',
    requiresSeparateWash:false,quantity:5.2,alreadyAllocatedQuantity:0,remainingQuantity:5.2}],groups:[],
}
const group:ProcessingGroup = {
  id:71,groupCode:'CN01-DH-000007-01-G01',barcode:'G71',orderItemId:41,orderBagId:31,
  orderCode:base.orderCode,bagCode:base.bagCode,customerName:base.customerName,serviceName:'Giặt sấy',itemTypeName:'Quần áo',
  serviceId:2,itemTypeId:3,unitType:'KG',quantity:5.2,colorGroup:'DARK',fabricCare:'STANDARD',washMode:'SERVICE_DEFAULT',
  temperatureProfile:'SERVICE_DEFAULT',detergentProfile:'DEFAULT',softenerProfile:'DEFAULT',hygieneLevel:'STANDARD',
  separateWash:false,shareable:true,dryingInstruction:'HANG_DRY',note:'',status:'WAITING',createdAt:'2026-10-08T10:00:00Z',
  printRequestCount:0,version:0,
}
function renderPage(page:React.ReactNode) {
  const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})
  return render(<QueryClientProvider client={client}><MemoryRouter>{page}</MemoryRouter></QueryClientProvider>)
}
async function scanBag() {
  await userEvent.type(screen.getByRole('textbox',{name:'Mã túi'}),'B31{Enter}')
  await screen.findAllByText(base.bagCode)
}
describe('Sorting operation',() => {
  beforeEach(() => {
    Object.values(mocks).forEach(value => { if (typeof value === 'function' && 'mockReset' in value) value.mockReset() })
    mocks.permissions.clear()
    mocks.subscribe.mockReturnValue(() => undefined)
    mocks.scan.mockResolvedValue(base)
    mocks.confirm.mockResolvedValue({...base,bagStatus:'SORTED',bagVersion:1,groups:[group]})
    mocks.reopen.mockResolvedValue(base)
    mocks.print.mockResolvedValue(group)
    mocks.waiting.mockResolvedValue({items:[group],page:0,size:20,totalElements:1,totalPages:1})
    mocks.stats.mockResolvedValue({total:1,shareable:1,separate:0})
    mocks.filterOptions.mockResolvedValue({services:[{id:2,label:'Giặt sấy'}],itemTypes:[{id:3,label:'Quần áo'}]})
  })
  it('starts in scanner-ready state and resolves keyboard-wedge Enter',async() => {
    renderPage(<SortingPage/>)
    expect(screen.getByText(/Máy quét sẵn sàng/)).toBeInTheDocument()
    await scanBag()
    expect(mocks.scan).toHaveBeenCalledWith(1,'B31')
    expect(screen.getByText('Trần Thị Mai · Đơn CN01-DH-000007')).toBeInTheDocument()
  })
  it('shows not-found without inventing a bag',async() => {
    mocks.scan.mockRejectedValue(new ApiError(404,{status:404,errorCode:'SORTING_BAG_NOT_FOUND'}))
    renderPage(<SortingPage/>)
    await userEvent.type(screen.getByRole('textbox',{name:'Mã túi'}),'UNKNOWN{Enter}')
    expect(await screen.findByRole('heading',{name:'Không tìm thấy túi'})).toBeInTheDocument()
  })
  it('blocks historical unverified bags',async() => {
    mocks.scan.mockResolvedValue({...base,bagStatus:'LEGACY_UNVERIFIED'})
    renderPage(<SortingPage/>)
    await scanBag()
    expect(screen.getByText('Đơn lịch sử này chưa xác minh túi thực tế.')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Thêm nhóm đồ'})).not.toBeInTheDocument()
  })
  it('shows a voided bag and blocks group creation',async() => {
    mocks.scan.mockResolvedValue({...base,bagStatus:'VOIDED',bagVoidReason:'Nhập nhầm túi'})
    renderPage(<SortingPage/>)
    await scanBag()
    expect(screen.getByText('Túi này đã bị hủy.')).toBeInTheDocument()
    expect(screen.getByText('Lý do: Nhập nhầm túi')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Thêm nhóm đồ'})).not.toBeInTheDocument()
  })
  it('locks mandatory separate wash and rejects excess quantity locally',async() => {
    mocks.scan.mockResolvedValue({...base,items:[{...base.items[0],requiresSeparateWash:true}]})
    renderPage(<SortingPage/>)
    await scanBag()
    await userEvent.click(screen.getByRole('button',{name:'Thêm nhóm đồ'}))
    expect(screen.getByRole('checkbox',{name:/Giặt riêng/})).toBeChecked()
    expect(screen.getByRole('checkbox',{name:/Giặt riêng/})).toBeDisabled()
    await userEvent.selectOptions(screen.getByRole('combobox',{name:/Hướng dẫn sấy/}),'HANG_DRY')
    await userEvent.clear(screen.getByRole('textbox',{name:/Số lượng \/ khối lượng/}))
    await userEvent.type(screen.getByRole('textbox',{name:/Số lượng \/ khối lượng/}),'5.201')
    expect(screen.getAllByRole('button',{name:'Xác nhận phân loại'})[0]).toBeDisabled()
  })
  it('adds multiple groups and exposes advanced handling fields',async() => {
    renderPage(<SortingPage/>)
    await scanBag()
    await userEvent.click(screen.getByRole('button',{name:'Thêm nhóm đồ'}))
    await userEvent.click(screen.getByRole('button',{name:'Thêm nhóm đồ'}))
    expect(screen.getByText('Nhóm nháp 2')).toBeInTheDocument()
    await userEvent.click(screen.getAllByText('Yêu cầu xử lý')[0])
    expect(screen.getAllByRole('combobox',{name:'Chất giặt'}).length).toBeGreaterThan(0)
  })
  it('keeps group drafts local and requires drying instruction before confirm',async() => {
    renderPage(<SortingPage/>)
    await scanBag()
    await userEvent.click(screen.getByRole('button',{name:'Thêm nhóm đồ'}))
    expect(screen.getByText('Nhóm nháp 1')).toBeInTheDocument()
    expect(screen.getAllByRole('button',{name:'Xác nhận phân loại'})[0]).toBeDisabled()
    await userEvent.selectOptions(screen.getByRole('combobox',{name:/Hướng dẫn sấy/}),'HANG_DRY')
    expect(screen.getAllByRole('button',{name:'Xác nhận phân loại'})[0]).toBeEnabled()
    await userEvent.click(screen.getByRole('button',{name:'Xóa nhóm nháp 1'}))
    expect(screen.queryByText('Nhóm nháp 1')).not.toBeInTheDocument()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
  it('submits once and displays only server-generated group code',async() => {
    renderPage(<SortingPage/>)
    await scanBag()
    await userEvent.click(screen.getByRole('button',{name:'Thêm nhóm đồ'}))
    await userEvent.selectOptions(screen.getByRole('combobox',{name:/Hướng dẫn sấy/}),'HANG_DRY')
    await userEvent.click(screen.getAllByRole('button',{name:'Xác nhận phân loại'})[0])
    expect(await screen.findByRole('heading',{name:'Đã phân loại'})).toBeInTheDocument()
    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(mocks.confirm).toHaveBeenCalledWith(1,31,0,[expect.objectContaining({orderItemId:41,quantity:5.2,dryingInstruction:'HANG_DRY'})])
    expect(screen.getAllByText(group.groupCode).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button',{name:'Phân loại túi tiếp theo'}))
    expect(screen.getByRole('textbox',{name:'Mã túi'})).toHaveValue('')
  })
  it('preserves drafts on stale conflict',async() => {
    mocks.confirm.mockRejectedValue(new ApiError(409,{status:409,errorCode:'SORTING_VERSION_CONFLICT'}))
    renderPage(<SortingPage/>)
    await scanBag()
    await userEvent.click(screen.getByRole('button',{name:'Thêm nhóm đồ'}))
    await userEvent.selectOptions(screen.getByRole('combobox',{name:/Hướng dẫn sấy/}),'HANG_DRY')
    await userEvent.click(screen.getAllByRole('button',{name:'Xác nhận phân loại'})[0])
    expect((await screen.findAllByRole('alert')).some(node => /Bản nháp được giữ lại/.test(node.textContent || ''))).toBe(true)
    expect(screen.getByText('Nhóm nháp 1')).toBeInTheDocument()
  })
  it('shows sorted groups, requires a reason to reopen, and prints one active label',async() => {
    mocks.permissions.add('sorting.process')
    mocks.scan.mockResolvedValue({...base,bagStatus:'SORTED',groups:[group]})
    renderPage(<SortingPage/>)
    await scanBag()
    expect(screen.getByText('Nhóm đồ đã tạo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button',{name:'In tem'}))
    await waitFor(() => expect(mocks.print).toHaveBeenCalledWith(1,71))
    expect(mocks.labelSubmit).toHaveBeenCalledWith([group])
    await userEvent.click(screen.getByRole('button',{name:'Phân loại lại'}))
    expect(screen.getByRole('button',{name:'Mở lại phân loại'})).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox',{name:'Lý do'}),'Nhầm màu')
    await userEvent.click(screen.getByRole('button',{name:'Mở lại phân loại'}))
    await waitFor(() => expect(mocks.reopen).toHaveBeenCalledWith(1,31,0,'Nhầm màu'))
  })
  it('prints all labels only after a successful confirmation',async() => {
    renderPage(<SortingPage/>)
    await scanBag()
    await userEvent.click(screen.getByRole('button',{name:'Thêm nhóm đồ'}))
    await userEvent.selectOptions(screen.getByRole('combobox',{name:/Hướng dẫn sấy/}),'HANG_DRY')
    await userEvent.click(screen.getAllByRole('button',{name:'Xác nhận phân loại'})[0])
    await screen.findByRole('heading',{name:'Đã phân loại'})
    await userEvent.click(screen.getByRole('button',{name:'In tất cả tem nhóm'}))
    await waitFor(() => expect(mocks.print).toHaveBeenCalledWith(1,71))
    expect(mocks.labelSubmit).toHaveBeenCalledWith([group])
  })
  it('loads waiting cards and table from one paginated query',async() => {
    renderPage(<WaitingPage/>)
    await waitFor(() => expect(mocks.waiting).toHaveBeenCalledWith(expect.objectContaining({branchId:1,page:0,size:20})))
    expect(await screen.findAllByText(group.groupCode)).toHaveLength(2)
    expect(screen.getAllByText('Có thể ghép').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tối · Tiêu chuẩn · Theo dịch vụ')).toHaveLength(2)
    fireEvent.change(screen.getByRole('searchbox',{name:'Tìm nhóm đồ'}),{target:{value:'CN01'}})
    await waitFor(() => expect(mocks.waiting).toHaveBeenCalledWith(expect.objectContaining({search:'CN01'})))
    const filters = screen.getByRole('button',{name:/Bộ lọc/})
    await userEvent.click(filters)
    await userEvent.selectOptions(screen.getByRole('combobox',{name:'Màu'}),'DARK')
    await waitFor(() => expect(mocks.waiting).toHaveBeenCalledWith(expect.objectContaining({color:'DARK'})))
    expect(within(screen.getByRole('table')).getByText(group.groupCode)).toBeInTheDocument()
  })
})
