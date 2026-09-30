import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, Layers3, Search, StickyNote } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { PERMISSION_CODES } from '../../auth/permissionCodes.generated'
import { Field } from '../../components/Field'
import { OverlayDialog } from '../../components/OverlayDialog'
import { ErrorState, LoadingState, StatePanel } from '../../components/States'
import { Button } from '../../components/ui/Button'
import { Surface } from '../../components/ui/Surface'
import { useToast } from '../../providers/ToastProvider'
import { promisedDateLabel } from '../../utils/promisedDate'
import { BatchCandidateCard, BatchSummary, CompatibilityBadge } from '../wash-batches/BatchComponents'
import { batchKeys, washBatchApi } from '../wash-batches/api'
import { candidateCompatibility, quantityText, sharingText, warningText } from '../wash-batches/presentation'
import type { BatchCandidate } from '../wash-batches/types'
import { orderKeys } from './api'

const batchErrorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return 'Không thể tạo mẻ giặt.'
  const messages: Record<string, string> = {
    BATCH_ITEM_ALREADY_ASSIGNED: 'Một món vừa được xếp vào mẻ khác. Hãy tải lại danh sách.',
    BATCH_INCOMPATIBLE: 'Các món đã chọn không còn phù hợp để ghép chung.',
  }
  return messages[error.problem.errorCode ?? ''] ?? error.message
}

export function OrderBatchComposer({ onClose }: { onClose: () => void }) {
  const { branchId, hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [selectedById, setSelectedById] = useState<Map<number, BatchCandidate>>(() => new Map())
  const [note, setNote] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const canCreate = hasPermission(PERMISSION_CODES.BATCH_CREATE)
  const canRead = hasPermission(PERMISSION_CODES.BATCH_READ)
  const canMarkReady = hasPermission(PERMISSION_CODES.BATCH_MARK_READY)
  const candidates = useInfiniteQuery({
    queryKey: batchKeys.candidates(branchId, search),
    queryFn: ({ pageParam }) => washBatchApi.candidates({ branchId: branchId!, search: search || undefined, page: pageParam, size: 50 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.page + 1 < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: Boolean(branchId && canCreate),
  })
  const selected = useMemo(() => [...selectedById.values()], [selectedById])
  const visible = useMemo(() => candidates.data?.pages.flatMap((page) => page.items) ?? [], [candidates.data])
  const totalElements = candidates.data?.pages[0]?.totalElements ?? 0
  const warnings = useMemo(() => [...new Set(selected.flatMap((candidate) =>
    candidateCompatibility(candidate, selected.filter((item) => item.orderItemId !== candidate.orderItemId)).reasons,
  ))], [selected])

  const create = useMutation({
    mutationFn: (markReady: boolean) => washBatchApi.create({
      branchId: branchId!,
      orderItemIds: selected.map((item) => item.orderItemId),
      note: note.trim() || null,
      markReady,
    }),
    onSuccess: (batch) => {
      setReviewOpen(false)
      setSelectedById(new Map())
      setNote('')
      void queryClient.invalidateQueries({ queryKey: batchKeys.all })
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
      notify({
        title: 'Đã tạo mẻ giặt',
        message: `${batch.batchCode} · ${batch.status === 'READY' ? 'Sẵn sàng' : 'Mẻ nháp'}`,
        tone: 'success',
        ...(canRead ? { actionLabel: 'Xem mẻ', onAction: () => navigate(`/wash-batches/${batch.id}`) } : {}),
      })
    },
    onError: (error) => {
      notify({ message: batchErrorMessage(error), tone: 'error' })
      void candidates.refetch()
    },
  })

  const toggle = (candidate: BatchCandidate, checked: boolean) => {
    setSelectedById((current) => {
      const next = new Map(current)
      if (checked) next.set(candidate.orderItemId, candidate)
      else next.delete(candidate.orderItemId)
      return next
    })
  }

  if (!canCreate) {
    return <StatePanel title="Bạn không có quyền ghép mẻ" body="Cần quyền Tạo mẻ giặt để sử dụng chế độ này." action={<Button variant="secondary" onClick={onClose}>Quay lại đơn hàng</Button>} />
  }

  return <section className="order-batch-composer" aria-labelledby="order-batch-composer-title">
    <header className="order-batch-composer__header">
      <div><h2 id="order-batch-composer-title">Chọn đồ để ghép mẻ</h2><p>Chọn nhiều món cùng dịch vụ. Lựa chọn được giữ nguyên khi bạn tiếp tục tìm đơn khác.</p></div>
      <Button variant="secondary" onClick={onClose}><ArrowLeft size={18} />Quay lại danh sách</Button>
    </header>
    <div className="order-batch-composer__layout">
      <Surface className="order-batch-selector">
        <label className="batch-search"><Search size={19} /><span className="sr-only">Tìm đồ chờ ghép</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mã đơn, tên khách, số điện thoại" /></label>
        <div className="order-batch-selector__status" aria-live="polite">
          <span>{candidates.isFetching && !candidates.isFetchingNextPage ? 'Đang cập nhật…' : `${totalElements} món phù hợp`}</span>
          {selected.length > 0 && <strong>{selected.length} món đang chọn</strong>}
        </div>
        {candidates.isLoading ? <LoadingState rows={6} /> : candidates.isError
          ? <ErrorState title="Không tải được đồ chờ ghép" body="Kiểm tra kết nối rồi thử lại." onRetry={() => void candidates.refetch()} />
          : !visible.length
            ? <StatePanel title={search ? 'Không tìm thấy đồ phù hợp' : 'Không có đồ đang chờ ghép'} body={search ? 'Thử tìm bằng mã đơn, tên hoặc số điện thoại khác.' : 'Các món thuộc đơn Đã nhận sẽ xuất hiện tại đây.'} />
            : <>
              <div className="batch-candidate-table order-batch-candidate-table"><table><thead><tr><th aria-label="Chọn"></th><th>Đơn hàng</th><th>Khách hàng</th><th>Dịch vụ / Loại đồ</th><th>SL / KL</th><th>Hình thức</th><th>Yêu cầu</th><th>Hẹn trả</th><th>Khả năng ghép</th></tr></thead><tbody>{visible.map((candidate) => {
                const checked = selectedById.has(candidate.orderItemId)
                const compatibility = candidateCompatibility(candidate, selected.filter((item) => item.orderItemId !== candidate.orderItemId))
                const blocked = compatibility.kind === 'blocked' && !checked
                return <tr key={candidate.orderItemId} data-selected={checked || undefined}>
                  <td><input type="checkbox" checked={checked} disabled={blocked} onChange={(event) => toggle(candidate, event.target.checked)} aria-label={`Chọn ${candidate.orderCode} ${candidate.itemTypeName}`} /></td>
                  <td><strong>{candidate.orderCode}</strong></td>
                  <td>{candidate.customerName || 'Khách vãng lai'}<small>{candidate.customerPhone}</small></td>
                  <td>{candidate.serviceName}<small>{candidate.itemTypeName}</small></td>
                  <td><strong>{quantityText(candidate.quantity, candidate.unitType)}</strong></td>
                  <td>{sharingText(candidate.sharingMode)}</td>
                  <td>{candidate.itemNote ? <span className="order-batch-note"><StickyNote size={14} />{candidate.itemNote}</span> : <span className="text-muted">Không có</span>}</td>
                  <td>{candidate.promisedAt ? promisedDateLabel(candidate.promisedAt) : 'Chưa hẹn'}</td>
                  <td><CompatibilityBadge value={compatibility} /></td>
                </tr>
              })}</tbody></table></div>
              <div className="batch-candidate-mobile">{visible.map((candidate) => {
                const checked = selectedById.has(candidate.orderItemId)
                return <BatchCandidateCard key={candidate.orderItemId} candidate={candidate} selected={checked} onChange={(value) => toggle(candidate, value)} compatibility={candidateCompatibility(candidate, selected.filter((item) => item.orderItemId !== candidate.orderItemId))} />
              })}</div>
              <div className="order-batch-selector__hint">
                <span>Đã hiển thị {visible.length}/{totalElements} món. Lựa chọn hiện tại vẫn được giữ khi tìm kiếm hoặc tải thêm.</span>
                {candidates.hasNextPage && <Button variant="secondary" loading={candidates.isFetchingNextPage} onClick={() => void candidates.fetchNextPage()}>Tải thêm đồ chờ ghép</Button>}
              </div>
            </>}
      </Surface>
      <Surface as="aside" className="order-batch-composer__summary">
        <div className="order-batch-composer__summary-title"><span><Layers3 size={19} /></span><div><h2>Mẻ đang chọn</h2><p>Review trước khi tạo mẻ.</p></div></div>
        <BatchSummary selected={selected} />
        {warnings.length > 0 && <div className="order-batch-warning"><AlertTriangle size={18} /><div><strong>{warnings.length} yêu cầu cần kiểm tra</strong><ul>{warnings.map((code) => <li key={code}>{warningText[code] ?? code}</li>)}</ul></div></div>}
        <Field label="Ghi chú mẻ" hint={`${note.length}/2000`}><textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thông tin chung cho mẻ này" /></Field>
        <div className="order-batch-composer__summary-actions">
          {selected.length > 0 && <Button variant="ghost" onClick={() => setSelectedById(new Map())}>Bỏ chọn tất cả</Button>}
          <Button disabled={!selected.length} onClick={() => setReviewOpen(true)}>Xem lại và tạo mẻ</Button>
        </div>
      </Surface>
    </div>
    <div className="order-batch-composer__mobile-action"><span><strong>{selected.length} món · {new Set(selected.map((item) => item.orderId)).size} đơn</strong><small>{selected[0]?.serviceName ?? 'Chưa chọn dịch vụ'}</small></span><Button disabled={!selected.length} onClick={() => setReviewOpen(true)}>Review</Button></div>
    <OverlayDialog open={reviewOpen} onClose={() => !create.isPending && setReviewOpen(false)} title="Xác nhận mẻ giặt" description="Kiểm tra khối lượng, từng đơn và yêu cầu xử lý trước khi tạo." variant="drawer" footer={<>
      <Button variant="secondary" disabled={create.isPending} onClick={() => setReviewOpen(false)}>Chọn thêm</Button>
      <Button loading={create.isPending} disabled={!selected.length} onClick={() => create.mutate(false)}>Lưu mẻ nháp</Button>
      {canMarkReady && <Button variant="success" loading={create.isPending} disabled={!selected.length} onClick={() => create.mutate(true)}>Tạo và sẵn sàng</Button>}
    </>}>
      <div className="order-batch-review"><BatchSummary selected={selected} />
        {warnings.length > 0 ? <div className="order-batch-warning"><AlertTriangle size={18} /><div><strong>Kiểm tra trước khi xác nhận</strong><ul>{warnings.map((code) => <li key={code}>{warningText[code] ?? code}</li>)}</ul></div></div> : <div className="order-batch-compatible"><CheckCircle2 size={18} /><span>Các món đã chọn phù hợp để ghép chung.</span></div>}
        {note.trim() && <div className="order-batch-review__note"><strong>Ghi chú mẻ</strong><p>{note.trim()}</p></div>}
      </div>
    </OverlayDialog>
  </section>
}
