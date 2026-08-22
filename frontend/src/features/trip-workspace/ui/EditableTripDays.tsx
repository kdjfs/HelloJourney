import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  RedoOutlined,
  RobotOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, message, Modal, Popconfirm, Row, Select, Space, Tooltip, Typography } from 'antd'
import VerificationBadge from '@/components/VerificationBadge'
import type { Attraction, Hotel, TripPlan } from '@/types/api'
import { proposePartialReplan } from '@/services/tripApi'
import { useTripWorkspace } from '../model/useTripWorkspace'
import './editableTripDays.css'

interface Props {
  initialPlan: TripPlan
  planId?: string
  onPlanChange: (plan: TripPlan) => void
}

interface EditTarget {
  dayIndex: number
  attractionIndex: number
}

type AttractionFields = Pick<Attraction, 'name' | 'address' | 'start_time' | 'end_time' | 'visit_duration' | 'description'>
type HotelFields = Pick<Hotel, 'name' | 'address' | 'price_range' | 'rating' | 'distance' | 'type' | 'estimated_cost'>

const emptyAttraction = (name: string): Attraction => ({
  name,
  address: '',
  location: { longitude: 0, latitude: 0 },
  visit_duration: 90,
  description: '',
  verification_status: 'needs_verification',
  source: 'user',
})

export default function EditableTripDays({ initialPlan, planId, onPlanChange }: Props) {
  const { t, i18n } = useTranslation()
  const { state, dispatch, canUndo, canRedo } = useTripWorkspace(initialPlan, planId)
  const [editTarget, setEditTarget] = useState<EditTarget>()
  const [hotelDayIndex, setHotelDayIndex] = useState<number>()
  const [replanOpen, setReplanOpen] = useState(false)
  const [replanSubmitting, setReplanSubmitting] = useState(false)
  const [replanInstruction, setReplanInstruction] = useState('')
  const [replanScope, setReplanScope] = useState<'day' | 'all'>('day')
  const [replanDayIndex, setReplanDayIndex] = useState(0)
  const [form] = Form.useForm<AttractionFields>()
  const [hotelForm] = Form.useForm<HotelFields>()

  useEffect(() => onPlanChange(state.present), [onPlanChange, state.present])

  const openEditor = (dayIndex: number, attractionIndex: number) => {
    const item = state.present.days[dayIndex].attractions[attractionIndex]
    form.setFieldsValue(item)
    setEditTarget({ dayIndex, attractionIndex })
  }

  const saveEditor = async () => {
    if (!editTarget) return
    const values = await form.validateFields()
    dispatch({ type: 'attraction.update', ...editTarget, patch: values })
    setEditTarget(undefined)
  }

  const openHotelEditor = (dayIndex: number) => {
    const hotel = state.present.days[dayIndex].hotel
    if (!hotel) return
    hotelForm.setFieldsValue(hotel)
    setHotelDayIndex(dayIndex)
  }

  const saveHotelEditor = async () => {
    if (hotelDayIndex === undefined) return
    const values = await hotelForm.validateFields()
    dispatch({ type: 'hotel.update', dayIndex: hotelDayIndex, patch: values })
    setHotelDayIndex(undefined)
  }

  const requestReplan = async () => {
    if (!replanInstruction.trim()) {
      message.warning(t('workspace.instructionRequired'))
      return
    }
    if (!planId) {
      message.error(t('workspace.missingPlanId'))
      return
    }
    setReplanSubmitting(true)
    try {
      const changeSet = await proposePartialReplan(planId, {
        instruction: replanInstruction.trim(),
        scope: replanScope,
        day_index: replanScope === 'day' ? replanDayIndex : undefined,
        current_plan: state.present,
      })
      dispatch({ type: 'changeset.preview', changeSet })
      setReplanOpen(false)
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('workspace.replanUnavailable'))
    } finally {
      setReplanSubmitting(false)
    }
  }

  const operationText = (operation: NonNullable<typeof state.pendingChangeSet>['operations'][number]) => {
    const labels: Record<string, string> = {
      'attraction.add': t('workspace.opAdd'), 'attraction.remove': t('workspace.opRemove'), 'attraction.update': t('workspace.opUpdate'),
      'attraction.move': t('workspace.opMove'), 'hotel.update': t('workspace.opHotel'), 'day.update': t('workspace.opDay'),
    }
    const day = 'dayIndex' in operation ? operation.dayIndex : 'fromDayIndex' in operation ? operation.fromDayIndex : undefined
    return `${labels[operation.type] ?? operation.type}${typeof day === 'number' ? ` · ${t('common.dayIndex', { day: day + 1 })}` : ''}`
  }

  const attractionSummary = (item?: Attraction) => item
    ? `${item.name} · ${item.start_time || '--:--'} · ${t('common.minutes', { count: item.visit_duration })}`
    : t('common.none')

  const operationDiff = (operation: NonNullable<typeof state.pendingChangeSet>['operations'][number]) => {
    if (operation.type === 'attraction.add') {
      return { before: t('common.none'), after: attractionSummary(operation.attraction) }
    }
    if (operation.type === 'attraction.remove') {
      return { before: attractionSummary(state.present.days[operation.dayIndex]?.attractions[operation.attractionIndex]), after: t('common.deleted') }
    }
    if (operation.type === 'attraction.update') {
      const current = state.present.days[operation.dayIndex]?.attractions[operation.attractionIndex]
      return { before: attractionSummary(current), after: attractionSummary(current ? { ...current, ...operation.patch } : undefined) }
    }
    if (operation.type === 'attraction.move') {
      const item = state.present.days[operation.fromDayIndex]?.attractions[operation.attractionIndex]
      return { before: `${attractionSummary(item)} · ${t('common.dayIndex', { day: operation.fromDayIndex + 1 })}`, after: `${attractionSummary(item)} · ${t('common.dayIndex', { day: operation.toDayIndex + 1 })}` }
    }
    if (operation.type === 'hotel.update') {
      const hotel = state.present.days[operation.dayIndex]?.hotel
      return { before: hotel ? `${hotel.name} · ${hotel.address}` : t('common.none'), after: hotel ? `${operation.patch.name ?? hotel.name} · ${operation.patch.address ?? hotel.address}` : t('common.none') }
    }
    const day = state.present.days[operation.dayIndex]
    return { before: day?.description || t('common.none'), after: operation.patch.description ?? day?.description ?? t('common.none') }
  }

  return (
    <section className="trip-workspace" aria-label={t('workspace.aria')}>
      <div className="workspace-toolbar">
        <div>
          <Typography.Title level={3}>{t('workspace.title')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('workspace.subtitle')}
          </Typography.Text>
        </div>
        <Space wrap>
          <Tooltip title={t('workspace.undoHint')}>
            <Button aria-label={t('workspace.undo')} icon={<UndoOutlined />} disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })} />
          </Tooltip>
          <Tooltip title={t('workspace.redoHint')}>
            <Button aria-label={t('workspace.redo')} icon={<RedoOutlined />} disabled={!canRedo} onClick={() => dispatch({ type: 'redo' })} />
          </Tooltip>
          <Button type="primary" icon={<RobotOutlined />} onClick={() => setReplanOpen(true)}>{t('workspace.aiReplan')}</Button>
          <span className="draft-status" aria-live="polite">
            {state.lastSavedAt
              ? t('workspace.draftSaved', { time: new Date(state.lastSavedAt).toLocaleTimeString(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit' }) })
              : t('workspace.draftSaving')}
          </span>
        </Space>
      </div>

      <div className="workspace-days">
        {state.present.days.map((day, dayIndex) => (
          <Card
            key={`${day.date}-${day.day_index}`}
            className="workspace-day"
            title={
              <div className="workspace-day-title">
                <span className="day-index">D{dayIndex + 1}</span>
                <span>{day.date}</span>
                {day.city && <span className="day-city"><EnvironmentOutlined /> {day.city}</span>}
              </div>
            }
            extra={(
              <Button
                aria-label={t('workspace.addAttraction')}
                icon={<PlusOutlined />}
                onClick={() => dispatch({ type: 'attraction.add', dayIndex, attraction: emptyAttraction(t('workspace.newAttraction')) })}
              >
                {t('workspace.addAttraction')}
              </Button>
            )}
          >
            {day.is_transfer_day && <div className="transfer-note">{t('workspace.transfer', { info: day.transfer_info || day.transportation })}</div>}
            {day.hotel && (
              <div className="workspace-hotel">
                <div><strong>{t('workspace.stay')}</strong>{day.hotel.name} · {day.hotel.address}</div>
                <Space wrap>
                  <VerificationBadge metadata={day.hotel} />
                  <Button size="small" icon={<EditOutlined />} onClick={() => openHotelEditor(dayIndex)}>{t('workspace.editHotel')}</Button>
                </Space>
              </div>
            )}

            {day.attractions.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workspace.emptyDay')} />
            ) : (
              <ol className="attraction-list">
                {day.attractions.map((item, attractionIndex) => (
                  <li key={`${item.poi_id ?? item.name}-${attractionIndex}`} className="attraction-row">
                    <div className="attraction-time">
                      <span>{item.start_time || '--:--'}</span>
                      <small>{t('common.minutes', { count: item.visit_duration })}</small>
                    </div>
                    <div className="attraction-content">
                      <div className="attraction-heading">
                        <strong>{item.name}</strong>
                        <VerificationBadge metadata={item} />
                      </div>
                      <span>{item.address || t('common.addressPending')}</span>
                      {item.description && <p>{item.description}</p>}
                    </div>
                    <Space className="attraction-actions" size={4} wrap>
                      <Tooltip title={t('workspace.moveUp')}><Button aria-label={`${t('workspace.moveUp')} ${item.name}`} size="small" icon={<ArrowUpOutlined />} disabled={attractionIndex === 0} onClick={() => dispatch({ type: 'attraction.move', fromDayIndex: dayIndex, attractionIndex, toDayIndex: dayIndex, at: attractionIndex - 1 })} /></Tooltip>
                      <Tooltip title={t('workspace.moveDown')}><Button aria-label={`${t('workspace.moveDown')} ${item.name}`} size="small" icon={<ArrowDownOutlined />} disabled={attractionIndex === day.attractions.length - 1} onClick={() => dispatch({ type: 'attraction.move', fromDayIndex: dayIndex, attractionIndex, toDayIndex: dayIndex, at: attractionIndex + 1 })} /></Tooltip>
                      <Tooltip title={t('workspace.movePreviousDay')}><Button aria-label={`${t('workspace.movePreviousDay')} ${item.name}`} size="small" icon={<ArrowLeftOutlined />} disabled={dayIndex === 0} onClick={() => dispatch({ type: 'attraction.move', fromDayIndex: dayIndex, attractionIndex, toDayIndex: dayIndex - 1 })} /></Tooltip>
                      <Tooltip title={t('workspace.moveNextDay')}><Button aria-label={`${t('workspace.moveNextDay')} ${item.name}`} size="small" icon={<ArrowRightOutlined />} disabled={dayIndex === state.present.days.length - 1} onClick={() => dispatch({ type: 'attraction.move', fromDayIndex: dayIndex, attractionIndex, toDayIndex: dayIndex + 1 })} /></Tooltip>
                      <Tooltip title={t('workspace.edit')}><Button aria-label={`${t('workspace.edit')} ${item.name}`} size="small" icon={<EditOutlined />} onClick={() => openEditor(dayIndex, attractionIndex)} /></Tooltip>
                      <Popconfirm title={t('workspace.deleteTitle')} description={t('workspace.deleteDetail')} onConfirm={() => dispatch({ type: 'attraction.remove', dayIndex, attractionIndex })}>
                        <Button aria-label={`${t('workspace.delete')} ${item.name}`} danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        ))}
      </div>

      <Modal title={t('workspace.editAttraction')} open={Boolean(editTarget)} onCancel={() => setEditTarget(undefined)} onOk={() => void saveEditor()} okText={t('workspace.save')} cancelText={t('workspace.cancel')} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={14}><Form.Item name="name" label={t('workspace.attractionName')} rules={[{ required: true, message: t('workspace.attractionNameRequired') }]}><Input /></Form.Item></Col>
            <Col span={10}><Form.Item name="visit_duration" label={t('workspace.visitMinutes')} rules={[{ required: true }]}><InputNumber min={15} max={720} step={15} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="address" label={t('workspace.address')}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="start_time" label={t('workspace.startTime')}><Input placeholder="09:30" pattern="([01]\\d|2[0-3]):[0-5]\\d" /></Form.Item></Col>
            <Col span={12}><Form.Item name="end_time" label={t('workspace.endTime')}><Input placeholder="11:00" pattern="([01]\\d|2[0-3]):[0-5]\\d" /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label={t('workspace.notes')}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={t('workspace.editHotelTitle')} open={hotelDayIndex !== undefined} onCancel={() => setHotelDayIndex(undefined)} onOk={() => void saveHotelEditor()} okText={t('workspace.save')} cancelText={t('workspace.cancel')} destroyOnHidden>
        <Form form={hotelForm} layout="vertical">
          <Form.Item name="name" label={t('workspace.hotelName')} rules={[{ required: true, message: t('workspace.hotelNameRequired') }]}><Input /></Form.Item>
          <Form.Item name="address" label={t('workspace.address')} rules={[{ required: true, message: t('workspace.addressRequired') }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="type" label={t('workspace.type')}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="price_range" label={t('workspace.priceRange')}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="rating" label={t('workspace.rating')}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="distance" label={t('workspace.distance')}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="estimated_cost" label={t('workspace.estimatedCost')}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={t('workspace.replanTitle')} open={replanOpen} confirmLoading={replanSubmitting} onCancel={() => setReplanOpen(false)} onOk={() => void requestReplan()} okText={t('workspace.previewAction')} cancelText={t('workspace.cancel')}>
        <Alert type="info" showIcon title={t('workspace.aiSafeTitle')} description={t('workspace.aiSafeDetail')} />
        <Form layout="vertical" style={{ marginTop: 18 }}>
          <Form.Item label={t('workspace.scope')}>
            <Select value={replanScope} onChange={setReplanScope} options={[{ value: 'day', label: t('workspace.scopeDay') }, { value: 'all', label: t('workspace.scopeAll') }]} />
          </Form.Item>
          {replanScope === 'day' && (
            <Form.Item label={t('workspace.selectDate')}>
              <Select value={replanDayIndex} onChange={setReplanDayIndex} options={state.present.days.map((day, index) => ({ value: index, label: `${t('common.dayIndex', { day: index + 1 })} · ${day.date}${day.city ? ` · ${day.city}` : ''}` }))} />
            </Form.Item>
          )}
          <Form.Item label={t('workspace.instruction')}>
            <Input.TextArea value={replanInstruction} maxLength={1000} showCount rows={4} onChange={(event) => setReplanInstruction(event.target.value)} placeholder={t('workspace.instructionPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={state.pendingChangeSet?.title ?? t('workspace.previewTitle')}
        open={Boolean(state.pendingChangeSet)}
        onCancel={() => dispatch({ type: 'changeset.reject' })}
        footer={[
          <Button key="reject" onClick={() => dispatch({ type: 'changeset.reject' })}>{t('workspace.reject')}</Button>,
          <Button key="apply" type="primary" onClick={() => { dispatch({ type: 'changeset.apply' }); message.success(t('workspace.applied')) }}>{t('workspace.accept')}</Button>,
        ]}
      >
        <Alert type="warning" showIcon title={t('workspace.confirm')} description={state.pendingChangeSet?.summary} />
        <ol className="changeset-list">
          {(state.pendingChangeSet?.operations ?? []).map((operation, index) => (
            <li key={`${operation.type}-${index}`}>
              <Typography.Text strong>{index + 1}. {operationText(operation)}</Typography.Text>
              <div className="change-diff">
                <div><small>{t('common.before')}</small><span>{operationDiff(operation).before}</span></div>
                <div><small>{t('common.after')}</small><span>{operationDiff(operation).after}</span></div>
              </div>
            </li>
          ))}
        </ol>
      </Modal>
    </section>
  )
}
